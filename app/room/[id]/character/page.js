'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function CharacterCreation() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  // Session & user state
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Available user characters
  const [userCharacters, setUserCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);

  const getRoomUuid = async (code) => {
    const isUuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(code);
    if (isUuid) return code;
    
    const { data, error: fetchErr } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (fetchErr || !data) {
      throw new Error('La sala especificada no existe.');
    }
    return data.id;
  };

  // Auth and state verification
  useEffect(() => {
    if (!roomId) return;

    const verifySession = async () => {
      try {
        const storedUser = localStorage.getItem('rpg_user');
        if (!storedUser) {
          // If not logged in, redirect to home page
          router.push('/');
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        const roomUuid = await getRoomUuid(roomId);

        // 1. Check if user already joined this room
        const { data: player, error: playerErr } = await supabase
          .from('players')
          .select('id')
          .eq('room_id', roomUuid)
          .eq('user_id', parsedUser.id)
          .maybeSingle();

        if (playerErr) throw playerErr;

        if (player) {
          // User already joined this room, skip selection
          router.push(`/room/${roomId}`);
          return;
        }

        // 2. Fetch user's characters
        const { data: chars, error: charsErr } = await supabase
          .from('characters')
          .select('*')
          .eq('user_id', parsedUser.id)
          .order('created_at', { ascending: false });

        if (charsErr) throw charsErr;
        setUserCharacters(chars || []);

        if (chars && chars.length > 0) {
          // Default to first character
          setSelectedCharId(chars[0].id);
        }

        setLoadingSession(false);
      } catch (err) {
        console.error('Error during character selection verification:', err);
        setError(err.message || 'Error al conectar con la sala.');
        setLoadingSession(false);
      }
    };

    verifySession();
  }, [roomId, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCharId) {
      setError('Por favor selecciona un personaje.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      if (!user) throw new Error('No hay una sesión activa.');
      const roomUuid = await getRoomUuid(roomId);

      // Fetch player count for join_order
      const { count, error: countError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomUuid);

      if (countError) throw countError;
      const joinOrder = count || 0;

      // Find selected character
      const characterToJoin = userCharacters.find(c => c.id === selectedCharId);
      if (!characterToJoin) throw new Error('Personaje seleccionado no encontrado.');

      // Join the campaign room as player
      const { error: insertError } = await supabase
        .from('players')
        .insert([{
          room_id: roomUuid,
          user_id: user.id,
          character_id: characterToJoin.id,
          name: characterToJoin.name,
          race: characterToJoin.race,
          class: characterToJoin.class,
          description: characterToJoin.description || 'Un valeroso aventurero.',
          stats: { HP: characterToJoin.salud || 100, Level: 1, XP: 0 },
          fuerza: characterToJoin.fuerza || 10,
          destreza: characterToJoin.destreza || 10,
          magia: characterToJoin.magia || 10,
          salud: characterToJoin.salud || 10,
          carisma: characterToJoin.carisma || 10,
          inteligencia: characterToJoin.inteligencia || 10,
          skills: characterToJoin.skills || [],
          join_order: joinOrder
        }]);

      if (insertError) {
        // Unique key constraint violation: user joined in the meantime
        if (insertError.code === '23505') {
          router.push(`/room/${roomId}`);
          return;
        }
        throw insertError;
      }

      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Error joining campaign:', err);
      setError(err.message || 'Error al entrar a la sala.');
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>⌛</div>
        <p style={styles.loadingText}>Preparando pergaminos de aventurero...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Hoja de Entrada</h1>
        <p style={styles.subtitle}>
          Elige un aventurero para entrar a la sala: <code style={styles.roomCode}>{roomId}</code>
        </p>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <main className="card" style={styles.card}>
        {userCharacters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: 'var(--secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              No tienes personajes creados en este ordenador. 
              <br />
              Por favor, regresa a la posada principal y forja a tu primer héroe antes de unirse a esta campaña.
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn"
              style={{ width: '100%' }}
            >
              Volver a la Posada
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Character Selection Grid */}
            <div>
              <label style={styles.label}>Selecciona tu personaje para esta campaña</label>
              <div className="char-selection-grid">
                {userCharacters.map((char) => (
                  <div
                    key={char.id}
                    className={`selection-char-card ${selectedCharId === char.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCharId(char.id)}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
                      {char.class === 'Mago' ? '🧙' : char.class === 'Guerrero' ? '⚔️' : char.class === 'Pícaro' ? '🗡️' : '🛡️'}
                    </div>
                    <span style={{ fontWeight: 'bold', display: 'block' }}>{char.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>{char.race} • {char.class}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit & Back Buttons */}
            <div style={styles.actionsRow}>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="btn exit-btn"
                style={styles.backBtn}
              >
                Volver
              </button>
              <button
                type="submit"
                className="btn"
                disabled={submitting}
                style={styles.submitBtn}
              >
                {submitting ? 'Conectando...' : 'Entrar con Personaje'}
              </button>
            </div>
          </form>
        )}
      </main>

      <footer style={styles.footer}>
        <p>Tu progreso de personaje se guardará en tu cuenta de RPG Online.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '3rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    justifyContent: 'center',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  title: {
    fontSize: '2.8rem',
    fontFamily: 'var(--font-sans)',
    color: 'var(--accent)',
  },
  subtitle: {
    color: 'var(--secondary)',
    fontSize: '1rem',
    marginTop: '0.5rem',
  },
  roomCode: {
    backgroundColor: '#0f172a',
    padding: '0.2rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontSize: '0.9rem',
    color: 'var(--accent)',
  },
  card: {
    padding: '3rem 2.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--accent)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.03em',
  },
  input: {
    padding: '0.8rem 1rem',
    backgroundColor: '#0f172a',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  row: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  select: {
    padding: '0.8rem 1rem',
    backgroundColor: '#0f172a',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    cursor: 'pointer',
    width: '100%'
  },
  textarea: {
    padding: '0.8rem 1rem',
    backgroundColor: '#0f172a',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'var(--font-sans)',
  },
  actionsRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem',
    width: '100%',
  },
  backBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
  errorBanner: {
    backgroundColor: 'rgba(184, 92, 92, 0.15)',
    border: '1px solid var(--failure)',
    color: '#ff8888',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '2rem',
    textAlign: 'center',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
  },
  spinner: {
    fontSize: '3rem',
    animation: 'spin 2s infinite linear',
    marginBottom: '1rem',
  },
  loadingText: {
    fontFamily: 'var(--font-sans)',
    fontSize: '1.2rem',
    color: 'var(--accent)',
  },
  footer: {
    textAlign: 'center',
    color: 'var(--secondary)',
    fontSize: '0.85rem',
    marginTop: '2rem',
  },
};
