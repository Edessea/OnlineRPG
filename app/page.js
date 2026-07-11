'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRooms, setActiveRooms] = useState([]);
  const [fetchingRooms, setFetchingRooms] = useState(true);

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

  const fetchActiveRooms = async () => {
    setFetchingRooms(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('rooms')
        .select('id, code, status, created_at, players(id), messages(created_at)')
        .neq('status', 'finished');

      if (fetchErr) throw fetchErr;
      
      const processedRooms = (data || []).map((roomItem) => {
        const lastMessage = roomItem.messages && roomItem.messages.length > 0
          ? roomItem.messages.reduce((latest, current) => 
              new Date(current.created_at) > new Date(latest.created_at) ? current : latest
            )
          : null;

        const lastActivityTime = lastMessage 
          ? new Date(lastMessage.created_at) 
          : new Date(roomItem.created_at);

        return {
          ...roomItem,
          lastActivityTime
        };
      });

      // Sort chronologically (most recent first)
      processedRooms.sort((a, b) => b.lastActivityTime - a.lastActivityTime);

      setActiveRooms(processedRooms);
    } catch (err) {
      console.error('Error fetching active rooms:', err);
    } finally {
      setFetchingRooms(false);
    }
  };

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const extractRoomId = (text) => {
    // Match UUID or 5-letter alphabetical code
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    const codeRegex = /\b[a-zA-Z]{5}\b/;
    
    const uuidMatch = text.match(uuidRegex);
    if (uuidMatch) return uuidMatch[0];
    
    const codeMatch = text.match(codeRegex);
    return codeMatch ? codeMatch[0].toUpperCase() : null;
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const roomCode = generateRoomCode();
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert([{ status: 'lobby', code: roomCode }])
        .select();

      if (insertError) throw insertError;
      if (!data || data.length === 0) throw new Error('No se pudo crear la sala.');

      router.push(`/room/${roomCode}/character`);
    } catch (err) {
      console.error('Error al crear la sala:', err);
      setError(err.message || 'Error al iniciar la aventura. Inténtalo de nuevo.');
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

    // Auto-focus next input
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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.emblem}>⚔️</div>
        <h1 style={styles.title}>RPG Online</h1>
        <p style={styles.subtitle}>Un juego de rol multijugador narrado por Inteligencia Artificial</p>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <main style={styles.grid}>
        {/* Create Campaign Card */}
        <section className="card" style={styles.card}>
          <h2 style={styles.cardTitle}>Crear una Aventura</h2>
          <p style={styles.cardText}>
            Forja una nueva sala de juego. Serás el anfitrión del viaje y el encargado de guiar a tus aliados hacia el portal.
          </p>
          <button 
            className="btn" 
            onClick={handleCreateRoom} 
            disabled={loading}
            style={styles.actionBtn}
          >
            {loading ? 'Invocando portal...' : 'Iniciar Nueva Partida'}
          </button>
        </section>

        {/* Join Campaign Card */}
        <section className="card" style={styles.card}>
          <h2 style={styles.cardTitle}>Unirse a la Partida</h2>
          <p style={styles.cardText}>
            Entra a un reino existente ingresando el código único de la sala o el enlace que te compartió tu grupo de juego.
          </p>
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
                  style={{
                    ...styles.slotInput,
                    ...(focusedIndex === idx ? styles.slotInputFocused : {})
                  }}
                  required
                />
              ))}
            </div>
            <button 
              type="submit" 
              className="btn" 
              style={styles.actionBtn}
            >
              Unirse al Lobby
            </button>
          </form>
        </section>
      </main>

      {/* Active Games Section */}
      <section className="active-rooms-section">
        <div className="active-rooms-header">
          <h2 className="active-rooms-title">⚔️ Partidas Activas</h2>
          <button 
            type="button"
            onClick={fetchActiveRooms} 
            className="refresh-btn" 
            disabled={fetchingRooms}
          >
            {fetchingRooms ? 'Buscando...' : 'Actualizar'}
          </button>
        </div>
        {fetchingRooms && activeRooms.length === 0 ? (
          <p style={{ color: 'var(--secondary)', textAlign: 'center', margin: '2rem 0' }}>
            Buscando tableros de juego activos en el reino...
          </p>
        ) : activeRooms.length === 0 ? (
          <div className="empty-rooms-card">
            <p>No hay salas activas en este momento. ¡Forja la tuya para iniciar la leyenda!</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {activeRooms.map((roomItem) => (
              <div key={roomItem.id} className="room-card">
                <div className="room-card-info">
                  <span className="room-card-code">{roomItem.code}</span>
                  <div className="room-card-details">
                    <span className={roomItem.status === 'lobby' ? 'room-status-lobby' : 'room-status-playing'}>
                      ● {roomItem.status === 'lobby' ? 'Esperando Héroes' : 'En Campaña'}
                    </span>
                    <span className="room-card-players">
                      👤 {roomItem.players?.length || 0} {roomItem.players?.length === 1 ? 'jugador' : 'jugadores'}
                    </span>
                    <span className="room-card-activity" style={{ marginTop: '0.2rem', opacity: 0.8, fontSize: '0.8rem', color: 'var(--secondary)' }}>
                      ⏳ Última jugada: {formatLastActivity(roomItem.lastActivityTime)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/room/${roomItem.code}/character`)}
                  className="btn enter-btn"
                >
                  Entrar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <p>Asegúrate de configurar tus credenciales en el archivo <code>.env.local</code> y aplicar la migración <code>schema.sql</code> antes de jugar.</p>
        <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Aesthetic medieval e IA activa.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '4rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    justifyContent: 'center',
  },
  header: {
    textAlign: 'center',
    marginBottom: '4rem',
  },
  emblem: {
    fontSize: '3.5rem',
    marginBottom: '1rem',
    animation: 'pulse 3s infinite ease-in-out',
  },
  title: {
    fontSize: '3rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 'bold',
    color: 'var(--accent)',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
    letterSpacing: '0.05em',
  },
  subtitle: {
    color: 'var(--secondary)',
    fontSize: '1.2rem',
    fontStyle: 'italic',
    marginTop: '0.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '2.5rem',
    marginBottom: '4rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '2.5rem 2rem',
    minHeight: '280px',
  },
  cardTitle: {
    fontSize: '1.6rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '0.75rem',
    marginBottom: '1.25rem',
  },
  cardText: {
    color: 'var(--secondary)',
    fontSize: '0.98rem',
    lineHeight: '1.6',
    marginBottom: '2rem',
    flexGrow: 1,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
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
  actionBtn: {
    width: '100%',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(184, 92, 92, 0.15)',
    border: '1px solid var(--failure)',
    color: '#ff8888',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '2rem',
    textAlign: 'center',
    fontSize: '0.95rem',
  },
  footer: {
    textAlign: 'center',
    color: 'var(--secondary)',
    fontSize: '0.85rem',
    borderTop: '1px solid var(--border)',
    paddingTop: '2rem',
  },
  slotsRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    margin: '1.25rem 0',
  },
  slotInput: {
    width: '3.2rem',
    height: '3.8rem',
    fontSize: '1.8rem',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#0a0e17',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    borderRadius: '6px',
    color: 'var(--foreground)',
    outline: 'none',
    textTransform: 'uppercase',
    transition: 'all 0.2s ease',
  },
  slotInputFocused: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 8px rgba(99, 102, 241, 0.25)',
  },
};
