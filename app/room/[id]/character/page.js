'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function CharacterCreation() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [race, setRace] = useState('Humano');
  const [charClass, setCharClass] = useState('Guerrero');
  const [description, setDescription] = useState('');

  // Check if player has an existing session in this room
  useEffect(() => {
    if (!roomId) return;

    const checkExistingSession = async () => {
      try {
        let sessionId = localStorage.getItem('rpg_session_id');
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem('rpg_session_id', sessionId);
          setLoadingSession(false);
          return;
        }

        // Search for existing player in this room with this session_id
        const { data: player, error: fetchError } = await supabase
          .from('players')
          .select('id')
          .eq('room_id', roomId)
          .eq('session_id', sessionId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (player) {
          // Player already exists for this session, skip character creation
          router.push(`/room/${roomId}`);
        } else {
          setLoadingSession(false);
        }
      } catch (err) {
        console.error('Error al verificar sesión existente:', err);
        setError('Error de conexión con el servidor. Inténtalo de nuevo.');
        setLoadingSession(false);
      }
    };

    checkExistingSession();
  }, [roomId, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, ingresa el nombre de tu aventurero.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const sessionId = localStorage.getItem('rpg_session_id');
      if (!sessionId) throw new Error('No se encontró una sesión activa.');

      // 1. Fetch current player count to determine join_order
      const { count, error: countError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);

      if (countError) throw countError;

      // 2. Insert new player sheet
      const newPlayer = {
        room_id: roomId,
        session_id: sessionId,
        name: name.trim(),
        race,
        class: charClass,
        description: description.trim() || 'Un misterioso viajero en busca de fortuna.',
        stats: { HP: 100, Level: 1, XP: 0 },
        join_order: count || 0
      };

      const { error: insertError } = await supabase
        .from('players')
        .insert([newPlayer]);

      if (insertError) {
        // Handle unique constraint check (if another window registered in the meantime)
        if (insertError.code === '23505') {
          router.push(`/room/${roomId}`);
          return;
        }
        throw insertError;
      }

      // 3. Redirect to the main game board
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Error al registrar personaje:', err);
      setError(err.message || 'Error al guardar tu hoja de personaje. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>⌛</div>
        <p style={styles.loadingText}>Consultando los pergaminos de sesión...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Hoja de Personaje</h1>
        <p style={styles.subtitle}>Crea tu identidad para ingresar a la sala: <code style={styles.roomCode}>{roomId}</code></p>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <main className="card" style={styles.card}>
        <form onSubmit={handleSubmit} style={styles.form}>
          
          {/* Name Field */}
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="name">Nombre del Personaje</label>
            <input
              type="text"
              id="name"
              placeholder="Ej: Eldrin Valerius"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              maxLength={50}
              required
            />
          </div>

          {/* Race & Class Row */}
          <div style={styles.row}>
            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label} htmlFor="race">Raza</label>
              <select
                id="race"
                value={race}
                onChange={(e) => setRace(e.target.value)}
                style={styles.select}
              >
                <option value="Humano">Humano</option>
                <option value="Elfo">Elfo</option>
                <option value="Enano">Enano</option>
                <option value="Orco">Orco</option>
                <option value="Mediano">Mediano (Halfling)</option>
                <option value="Dracónido">Dracónido</option>
              </select>
            </div>

            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label} htmlFor="class">Clase</label>
              <select
                id="class"
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                style={styles.select}
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

          {/* Biography & Backstory */}
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="description">Historia & Descripción</label>
            <textarea
              id="description"
              placeholder="Describe su trasfondo, apariencia o motivaciones..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.textarea}
              maxLength={500}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn"
            disabled={submitting}
            style={styles.submitBtn}
          >
            {submitting ? 'Forjando personaje...' : 'Entrar a la Sala de Juego'}
          </button>
        </form>
      </main>

      <footer style={styles.footer}>
        <p>Tu progreso de personaje se guardará localmente en este navegador.</p>
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
    fontFamily: 'var(--font-serif)',
    color: 'var(--accent)',
  },
  subtitle: {
    color: 'var(--secondary)',
    fontSize: '1rem',
    marginTop: '0.5rem',
  },
  roomCode: {
    backgroundColor: '#1b1410',
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
    fontFamily: 'var(--font-serif)',
    letterSpacing: '0.03em',
  },
  input: {
    padding: '0.8rem 1rem',
    backgroundColor: '#1b1410',
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
    backgroundColor: '#1b1410',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    padding: '0.8rem 1rem',
    backgroundColor: '#1b1410',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'var(--font-sans)',
  },
  submitBtn: {
    marginTop: '1rem',
    width: '100%',
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
    fontFamily: 'var(--font-serif)',
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
