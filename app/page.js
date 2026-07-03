'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError(null);

    const cleanId = extractRoomId(roomIdInput);
    if (!cleanId) {
      setError('Formato inválido. Ingresa un código de 5 letras (ej: ABCDE) o la URL de la partida.');
      return;
    }

    router.push(`/room/${cleanId}/character`);
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
            <input
              type="text"
              placeholder="Ej: e4b0-4057-9184... o URL completa"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              style={styles.input}
              required
            />
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
};
