'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(true);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // User Data state
  const [characters, setCharacters] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [fetchingData, setFetchingData] = useState(false);

  // Character Creation state
  const [showCharModal, setShowCharModal] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharRace, setNewCharRace] = useState('Humano');
  const [newCharClass, setNewCharClass] = useState('Guerrero');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [creatingChar, setCreatingChar] = useState(false);
  const [newCharError, setNewCharError] = useState(null);

  // Campaign Creation modal state
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomDesc, setCreateRoomDesc] = useState('');

  // Room Join code state
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Auto-login on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('rpg_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchUserData(parsedUser.id);
    }
  }, []);

  const fetchUserData = async (userId) => {
    setFetchingData(true);
    try {
      // 1. Fetch characters
      const { data: charData, error: charErr } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (charErr) throw charErr;
      setCharacters(charData || []);

      // 2. Fetch joined campaigns with details
      const { data: playerRows, error: playerErr } = await supabase
        .from('players')
        .select(`
          characters(id, name),
          rooms(
            id,
            code,
            status,
            created_at,
            creator_id,
            name,
            players(id),
            messages(created_at)
          )
        `)
        .eq('user_id', userId);

      if (playerErr) throw playerErr;

      const processedRooms = (playerRows || [])
        .filter(row => row.rooms) // filter out deleted/missing rooms
        .map(row => {
          const roomItem = row.rooms;
          const lastMessage = roomItem.messages && roomItem.messages.length > 0
            ? roomItem.messages.reduce((latest, current) => 
                new Date(current.created_at) > new Date(latest.created_at) ? current : latest
              )
            : null;

          const lastActivityTime = lastMessage 
            ? new Date(lastMessage.created_at) 
            : new Date(roomItem.created_at);

          return {
            id: roomItem.id,
            code: roomItem.code,
            name: roomItem.name,
            status: roomItem.status,
            creator_id: roomItem.creator_id,
            players: roomItem.players || [],
            charName: row.characters?.name || 'Desconocido',
            lastActivityTime
          };
        });

      // Sort campaigns from most to least recent last activity
      processedRooms.sort((a, b) => b.lastActivityTime - a.lastActivityTime);

      setActiveRooms(processedRooms);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setFetchingData(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError('Por favor completa todos los campos.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    const usernameLower = authUsername.trim().toLowerCase();

    try {
      if (isLoggingIn) {
        // Iniciar Sesión (Login)
        const { data, error: fetchErr } = await supabase
          .from('users')
          .select('id, username, password')
          .eq('username', usernameLower)
          .eq('password', authPassword.trim())
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!data) {
          throw new Error('Usuario o contraseña incorrectos.');
        }

        const loggedInUser = { id: data.id, username: data.username };
        localStorage.setItem('rpg_user', JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        fetchUserData(loggedInUser.id);
      } else {
        // Registrarse (Signup)
        // Check if username exists
        const { data: existingUser, error: checkErr } = await supabase
          .from('users')
          .select('id')
          .eq('username', usernameLower)
          .maybeSingle();

        if (checkErr) throw checkErr;
        if (existingUser) {
          throw new Error('El nombre de usuario ya está registrado.');
        }

        // Insert new user
        const { data: newUser, error: insertErr } = await supabase
          .from('users')
          .insert([{ username: usernameLower, password: authPassword.trim() }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        const loggedInUser = { id: newUser.id, username: newUser.username };
        localStorage.setItem('rpg_user', JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        fetchUserData(loggedInUser.id);
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message || 'Error de conexión.';
      if (err.code === 'PGRST205' || (err.message && err.message.includes('public.users')) || (err.message && err.message.includes('schema cache'))) {
        errMsg = 'La tabla "users" no está creada. Por favor, copia y ejecuta las sentencias de migration_v2.sql en el SQL Editor de tu consola de Supabase.';
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rpg_user');
    setUser(null);
    setCharacters([]);
    setActiveRooms([]);
    setAuthUsername('');
    setAuthPassword('');
    setAuthError(null);
  };

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const extractRoomId = (text) => {
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    const codeRegex = /\b[a-zA-Z]{5}\b/;
    
    const uuidMatch = text.match(uuidRegex);
    if (uuidMatch) return uuidMatch[0];
    
    const codeMatch = text.match(codeRegex);
    return codeMatch ? codeMatch[0].toUpperCase() : null;
  };

  const handleCreateRoom = async (e) => {
    if (e) e.preventDefault();
    if (!user) return;
    if (!createRoomName.trim()) {
      setError('Por favor escribe un nombre para la campaña.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const roomCode = generateRoomCode();
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert([{ 
          status: 'lobby', 
          code: roomCode, 
          creator_id: user.id,
          name: createRoomName.trim(),
          description: createRoomDesc.trim() || null
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error('No se pudo crear la sala.');

      setShowCreateRoomModal(false);
      router.push(`/room/${roomCode}/character`);
    } catch (err) {
      console.error('Error al crear la sala:', err);
      setError(err.message || 'Error al iniciar la campaña. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  const handleDigitChange = (e, index) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    const newDigits = [...codeDigits];
    
    if (!val) {
      newDigits[index] = '';
      setCodeDigits(newDigits);
      return;
    }

    newDigits[index] = val.charAt(0);
    setCodeDigits(newDigits);

    if (index < 4) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const cleanId = extractRoomId(pastedData);
    if (cleanId) {
      if (cleanId.length === 5) {
        setCodeDigits(cleanId.split(''));
        inputRefs[4].current?.focus();
      } else {
        router.push(`/room/${cleanId}/character`);
      }
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError(null);

    const code = codeDigits.join('').toUpperCase();
    if (code.length < 5) {
      setError('Por favor, ingresa el código completo de 5 letras.');
      return;
    }

    router.push(`/room/${code}/character`);
  };

  const handleCreateCharacter = async (e) => {
    e.preventDefault();
    if (!newCharName.trim()) {
      setNewCharError('El nombre es obligatorio.');
      return;
    }
    setCreatingChar(true);
    setNewCharError(null);
    try {
      const { data, error: charErr } = await supabase
        .from('characters')
        .insert([{
          user_id: user.id,
          name: newCharName.trim(),
          race: newCharRace,
          class: newCharClass,
          description: newCharDesc.trim()
        }])
        .select()
        .single();

      if (charErr) throw charErr;
      
      setCharacters((prev) => [data, ...prev]);
      setShowCharModal(false);
      setNewCharName('');
      setNewCharDesc('');
    } catch (err) {
      console.error(err);
      setNewCharError(err.message || 'Error al crear el personaje.');
    } finally {
      setCreatingChar(false);
    }
  };

  const formatLastActivity = (dateVal) => {
    if (!dateVal) return 'Sin actividad';
    const date = new Date(dateVal);
    const now = new Date();
    
    const isSameDay = date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
      
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isSameDay) {
      return `Hoy a las ${timeStr}`;
    } else if (isYesterday) {
      return `Ayer a las ${timeStr}`;
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month} a las ${timeStr}`;
    }
  };

  // Render Authentication Screen if not logged in
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">⚔️ RPG Online</h1>
            <p className="auth-subtitle">
              {isLoggingIn 
                ? 'Ingresa a la posada para continuar tu gesta' 
                : 'Crea tu cuenta para comenzar la leyenda'}
            </p>
          </div>

          {authError && (
            <div style={styles.errorBanner}>
              <span>⚠️ {authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="username">Usuario</label>
              <input
                id="username"
                type="text"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                style={styles.input}
                placeholder="Ej. legolas"
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={styles.input}
                placeholder="Escribe tu clave"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn" 
              disabled={authLoading}
              style={{ marginTop: '1rem' }}
            >
              {authLoading 
                ? 'Abriendo el portal...' 
                : (isLoggingIn ? 'Entrar a la Posada' : 'Registrar Cuenta')}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--secondary)' }}>
            {isLoggingIn ? '¿Eres nuevo?' : '¿Ya tienes cuenta?'} {' '}
            <button 
              type="button" 
              className="auth-toggle-link"
              onClick={() => {
                setIsLoggingIn(!isLoggingIn);
                setAuthError(null);
              }}
            >
              {isLoggingIn ? 'Regístrate aquí' : 'Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Screen if logged in
  return (
    <div className="dashboard-container">
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div className="dashboard-user-info">
          <div className="dashboard-avatar">🧙</div>
          <div>
            <h1 className="dashboard-greeting">¡Saludos, {user.username}!</h1>
            <p className="dashboard-subgreet">Bienvenido de vuelta a la Posada del Portal.</p>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="btn logout-btn"
        >
          Cerrar Sesión
        </button>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="dashboard-columns">
        
        {/* Column 1: Characters */}
        <section className="dashboard-column card">
          <div className="dashboard-column-header">
            <h2 className="dashboard-column-title">🛡️ Mis Personajes</h2>
            <button 
              onClick={() => setShowCharModal(true)} 
              className="btn enter-btn"
            >
              + Nuevo
            </button>
          </div>

          {fetchingData && characters.length === 0 ? (
            <p style={{ color: 'var(--secondary)' }}>Invocando tus crónicas...</p>
          ) : characters.length === 0 ? (
            <div className="empty-rooms-card" style={{ padding: '2rem' }}>
              <p style={{ marginBottom: '1rem' }}>Aún no tienes personajes creados.</p>
              <button 
                onClick={() => setShowCharModal(true)} 
                className="btn"
              >
                Crear tu primer personaje
              </button>
            </div>
          ) : (
            <div className="dashboard-list">
              {characters.map((char) => (
                <div key={char.id} className="char-card">
                  <div className="char-info">
                    <span className="char-name">{char.name}</span>
                    <span className="char-meta">{char.race} • {char.class}</span>
                    {char.description && (
                      <span className="char-desc" title={char.description}>{char.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Column 2: Campaigns */}
        <section className="dashboard-column card">
          <div className="dashboard-column-header">
            <h2 className="dashboard-column-title">🏰 Mis Campañas</h2>
            <button 
              onClick={() => fetchUserData(user.id)} 
              className="refresh-btn" 
              disabled={fetchingData}
            >
              {fetchingData ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          {fetchingData && activeRooms.length === 0 ? (
            <p style={{ color: 'var(--secondary)' }}>Leyendo mapas del reino...</p>
          ) : activeRooms.length === 0 ? (
            <div className="empty-rooms-card" style={{ padding: '2rem' }}>
              <p>No estás participando en ninguna campaña activa.</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {activeRooms.map((campaign) => (
                <div key={campaign.id} className="room-card" style={{ margin: 0 }}>
                  <div className="room-card-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--foreground)' }}>
                        {campaign.name || 'Campaña sin nombre'}
                      </span>
                      <span className="room-card-code" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', margin: 0 }}>{campaign.code}</span>
                      {campaign.creator_id === user.id && (
                        <span className="creator-badge" title="Tú creaste esta campaña">Creador</span>
                      )}
                    </div>
                    <div className="room-card-details">
                      <span className={campaign.status === 'lobby' ? 'room-status-lobby' : 'room-status-playing'}>
                        ● {campaign.status === 'lobby' ? 'Esperando Héroes' : 'En Campaña'}
                      </span>
                      <span className="room-card-players">
                        👤 {campaign.players?.length || 0} {campaign.players?.length === 1 ? 'jugador' : 'jugadores'} (como <strong>{campaign.charName}</strong>)
                      </span>
                      <span className="room-card-activity" style={{ marginTop: '0.2rem', opacity: 0.8, fontSize: '0.8rem', color: 'var(--secondary)' }}>
                        ⏳ Última jugada: {formatLastActivity(campaign.lastActivityTime)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/room/${campaign.code}`)}
                    className="btn enter-btn"
                  >
                    Entrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Action Zone: Create / Join Room */}
      <div className="dashboard-columns">
        
        {/* Card: Create adventure */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2rem', minHeight: '220px' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Crear una Campaña</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Forja una nueva sala de juego. Serás el creador de la campaña y el único capaz de abrir el portal cuando tu grupo esté listo.
            </p>
          </div>
          <button 
            className="btn" 
            onClick={() => {
              setCreateRoomDesc('');
              setShowCreateRoomModal(true);
            }}
            disabled={loading}
          >
            {loading ? 'Invocando portal...' : 'Iniciar Nueva Campaña'}
          </button>
        </section>

        {/* Card: Join adventure */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2rem', minHeight: '220px' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Unirse a la Campaña</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1rem' }}>
              Entra a un reino existente ingresando el código único de la sala que te compartió tu grupo.
            </p>
          </div>
          <form onSubmit={handleJoinRoom} style={styles.form}>
            <div style={styles.slotsRow}>
              {codeDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(e, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={handlePaste}
                  onFocus={() => setFocusedIndex(idx)}
                  onBlur={() => setFocusedIndex(null)}
                  className="slotInput"
                  style={{
                    backgroundColor: '#0a0e17',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: focusedIndex === idx ? 'var(--accent)' : 'var(--border)',
                    boxShadow: focusedIndex === idx ? '0 0 8px rgba(99, 102, 241, 0.25)' : 'none',
                    width: '2.8rem',
                    height: '3.4rem',
                    fontSize: '1.6rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    borderRadius: '6px',
                    color: 'var(--foreground)',
                    outline: 'none',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease',
                    marginRight: '0.4rem'
                  }}
                  required
                />
              ))}
            </div>
            <button 
              type="submit" 
              className="btn"
            >
              Unirse al Lobby
            </button>
          </form>
        </section>

      </div>

      {/* Character Creation Modal */}
      {showCharModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">⚔️ Forjar Nuevo Personaje</h2>
            </div>
            
            {newCharError && (
              <div style={styles.errorBanner}>
                <span>⚠️ {newCharError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCharacter} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="charName">Nombre del Aventurero</label>
                <input
                  id="charName"
                  type="text"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  style={styles.input}
                  placeholder="Ej. Thorin Escudo de Roble"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ ...styles.formGroup, flex: 1, minWidth: '150px' }}>
                  <label style={styles.label} htmlFor="charRace">Raza</label>
                  <select
                    id="charRace"
                    value={newCharRace}
                    onChange={(e) => setNewCharRace(e.target.value)}
                    style={{ ...styles.input, cursor: 'pointer' }}
                  >
                    <option value="Humano">Humano</option>
                    <option value="Elfo">Elfo</option>
                    <option value="Enano">Enano</option>
                    <option value="Mediano">Mediano (Hobbit)</option>
                    <option value="Orco">Semiorco</option>
                  </select>
                </div>

                <div style={{ ...styles.formGroup, flex: 1, minWidth: '150px' }}>
                  <label style={styles.label} htmlFor="charClass">Clase</label>
                  <select
                    id="charClass"
                    value={newCharClass}
                    onChange={(e) => setNewCharClass(e.target.value)}
                    style={{ ...styles.input, cursor: 'pointer' }}
                  >
                    <option value="Guerrero">Guerrero</option>
                    <option value="Mago">Mago</option>
                    <option value="Pícaro">Pícaro (Rogue)</option>
                    <option value="Clérigo">Clérigo</option>
                    <option value="Explorador">Explorador (Ranger)</option>
                    <option value="Bardo">Bardo</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="charDesc">Historia & Trasfondo</label>
                <textarea
                  id="charDesc"
                  value={newCharDesc}
                  onChange={(e) => setNewCharDesc(e.target.value)}
                  style={{ ...styles.input, minHeight: '100px', resize: 'vertical' }}
                  placeholder="Describe su origen, motivaciones o apariencia..."
                  maxLength={400}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCharModal(false);
                    setNewCharError(null);
                  }}
                  className="btn exit-btn"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={creatingChar}
                  style={{ flex: 2 }}
                >
                  {creatingChar ? 'Creando personaje...' : 'Forjar Personaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Campaign Creation Modal */}
      {showCreateRoomModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">🏰 Iniciar Nueva Campaña</h2>
            </div>
            
            <form onSubmit={handleCreateRoom} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="campaignName">Nombre de la Campaña</label>
                <input
                  id="campaignName"
                  type="text"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  style={styles.input}
                  placeholder="Ej: Las Crónicas del Templo Hundido"
                  maxLength={100}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="campaignDesc">Trasfondo / Descripción Global de la Campaña</label>
                <textarea
                  id="campaignDesc"
                  value={createRoomDesc}
                  onChange={(e) => setCreateRoomDesc(e.target.value)}
                  style={{ ...styles.input, minHeight: '120px', resize: 'vertical' }}
                  placeholder="Describe el trasfondo de la campaña (ej: Un grupo de exploradores investiga el misterioso Templo Hundido en busca de la corona de la tormenta...)"
                  maxLength={500}
                />
                <p style={{ color: 'var(--secondary)', fontSize: '0.82rem', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  💡 <em>Esta descripción guiará a la Inteligencia Artificial (GM) para dirigir el juego. No debe contener información secreta (todos los jugadores podrán leerla en el menú Trasfondo) para asegurar que el creador no tenga ventajas.</em>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateRoomModal(false)}
                  className="btn exit-btn"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={loading}
                  style={{ flex: 2 }}
                >
                  {loading ? 'Invocando portal...' : 'Crear Campaña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        <p>Asegúrate de ejecutar la migración <code>migration_v2.sql</code> en tu base de datos Supabase para habilitar usuarios y personajes.</p>
        <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Aesthetic medieval e IA activa.</p>
      </footer>
    </div>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--accent)',
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    padding: '0.8rem 1rem',
    backgroundColor: '#0f172a',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  errorBanner: {
    backgroundColor: 'rgba(184, 92, 92, 0.15)',
    border: '1px solid var(--failure)',
    color: '#ff8888',
    padding: '1rem',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '0.95rem',
  },
  footer: {
    textAlign: 'center',
    color: 'var(--secondary)',
    fontSize: '0.85rem',
    borderTop: '1px solid var(--border)',
    paddingTop: '2rem',
    marginTop: '4rem',
  },
  slotsRow: {
    display: 'flex',
    justifyContent: 'center',
    margin: '1rem 0',
  },
};
