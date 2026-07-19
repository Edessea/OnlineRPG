'use client';

import { useRouter, useParams } from 'next/navigation';
import { useRoomState } from '../../../../lib/useRoomState';

export default function CampaignEnd() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  const { room, players, loading, error } = useRoomState(roomId);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>⌛</div>
        <p style={styles.loadingText}>Desenterrando las crónicas finales...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div style={styles.errorContainer}>
        <h2>⚠️ Error al cargar el desenlace</h2>
        <p>{error || 'No se encontró la sala de juego.'}</p>
        <button className="btn" onClick={() => router.push('/')} style={{ marginTop: '1.5rem' }}>
          Volver a la Posada
        </button>
      </div>
    );
  }

  // Determine if it was a Victory or Defeat
  const isVictory = !!room.victory_condition;
  const outcomeText = isVictory 
    ? room.victory_condition 
    : (room.defeat_condition || 'La oscuridad ha consumido al grupo de aventureros.');

  return (
    <div style={styles.container}>
      <main style={styles.card}>
        {/* Emblem header */}
        <div style={styles.header}>
          <div style={{
            ...styles.emblem,
            color: isVictory ? '#f59e0b' : '#ef4444',
            textShadow: isVictory ? '0 0 25px rgba(245, 158, 11, 0.4)' : '0 0 25px rgba(239, 68, 68, 0.4)'
          }}>
            {isVictory ? '🛡️' : '💀'}
          </div>
          <h1 style={{
            ...styles.title,
            color: isVictory ? '#f59e0b' : '#ef4444'
          }}>
            {isVictory ? '¡Victoria de la Gesta!' : 'Derrota de los Héroes'}
          </h1>
          <span style={styles.roomLabel}>Sala: {room.code || roomId}</span>
        </div>

        {/* Narrative Outcome */}
        <section style={styles.outcomeSection}>
          <p style={styles.outcomeText}>&ldquo;{outcomeText}&rdquo;</p>
        </section>

        {/* Player Stats Summary */}
        <section style={styles.statsSection}>
          <h2 style={styles.sectionTitle}>Estatus Final de los Aventureros</h2>
          <div style={styles.playersList}>
            {players.map((p) => {
              const hp = p.stats?.HP ?? 0;
              const lvl = p.stats?.Level ?? 1;
              const xp = p.stats?.XP ?? 0;
              const relativeXP = xp % 1000;
              const nextLevelXP = 1000;
              const xpPercent = (relativeXP / nextLevelXP) * 100;

              return (
                <div key={p.id} style={styles.playerRow}>
                  <div style={styles.playerMeta}>
                    <span style={styles.playerName}>{p.name}</span>
                    <span style={styles.playerSub}>{p.race} • {p.class}</span>
                  </div>
                  
                  <div style={styles.playerStats}>
                    {/* HP Indicator */}
                    <div style={styles.statContainer}>
                      <span style={styles.statLabel}>Vida: {hp}/100</span>
                      <div style={styles.progressBarBg}>
                        <div style={{
                          ...styles.progressBarFill,
                          width: `${hp}%`,
                          backgroundColor: hp > 50 ? 'var(--success)' : hp > 20 ? '#eab308' : 'var(--failure)'
                        }} />
                      </div>
                    </div>

                    {/* Level / XP */}
                    <div style={styles.statContainer}>
                      <span style={styles.statLabel}>Nivel {lvl} • XP: {relativeXP}/{nextLevelXP}</span>
                      <div style={styles.progressBarBg}>
                        <div style={{
                          ...styles.progressBarFill,
                          width: `${xpPercent}%`,
                          backgroundColor: 'var(--accent)'
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Play Again Button */}
        <div style={styles.actionsRow}>
          <button 
            className="btn" 
            onClick={() => router.push('/')}
            style={styles.homeBtn}
          >
            Volver a la Posada (Jugar de nuevo)
          </button>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2.5rem 1.5rem',
    background: 'var(--background)',
  },
  card: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '3rem 2.5rem',
    maxWidth: '700px',
    width: '100%',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2.2rem',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  emblem: {
    fontSize: '4.5rem',
    marginBottom: '0.5rem',
    lineHeight: 1,
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 'bold',
    margin: 0,
    letterSpacing: '0.05em',
  },
  roomLabel: {
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    backgroundColor: '#0a0e17',
    padding: '0.2rem 0.6rem',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    marginTop: '0.5rem',
  },
  outcomeSection: {
    backgroundColor: '#0a0e17',
    borderLeft: '4px solid var(--border)',
    borderRadius: '0 8px 8px 0',
    padding: '1.5rem',
    fontStyle: 'italic',
    lineHeight: '1.6',
    color: 'var(--foreground)',
  },
  outcomeText: {
    margin: 0,
    fontSize: '1.05rem',
    whiteSpace: 'pre-wrap',
  },
  statsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  sectionTitle: {
    fontSize: '1.2rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '0.5rem',
    margin: 0,
  },
  playersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  playerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '1.2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  playerMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  playerName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: 'var(--foreground)',
  },
  playerSub: {
    fontSize: '0.8rem',
    color: 'var(--secondary)',
  },
  playerStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '260px',
  },
  statContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    fontWeight: '600',
  },
  progressBarBg: {
    height: '6px',
    backgroundColor: '#020617',
    borderRadius: '3px',
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  actionsRow: {
    marginTop: '0.5rem',
  },
  homeBtn: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.05rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
  },
  spinner: {
    fontSize: '3rem',
    animation: 'spin 2s infinite linear',
    marginBottom: '1rem',
  },
  loadingText: {
    fontSize: '1.1rem',
    color: 'var(--accent)',
    fontWeight: '600',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
    padding: '2rem',
    textAlign: 'center',
  },
};
