'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { useRoomState } from '../../../lib/useRoomState';
import TypewriterText from '../../../components/TypewriterText';

export default function GameRoom() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  const { room, players, messages, loading, error } = useRoomState(roomId);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isCheckingPlayer, setIsCheckingPlayer] = useState(true);

  // Inputs State
  const [messageType, setMessageType] = useState('chat'); // 'chat' (OOC) or 'action'
  const [inputText, setInputText] = useState('');
  const [actionLockedText, setActionLockedText] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Character Detail Modal
  const [modalPlayer, setModalPlayer] = useState(null);

  // Spectator mode for dead players
  const [isSpectating, setIsSpectating] = useState(false);

  // Scroll anchor for chat
  const chatEndRef = useRef(null);

  const [user, setUser] = useState(null);

  // Load user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('rpg_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/');
    }
  }, [router]);

  // Check if player has a valid registration in this room
  useEffect(() => {
    if (loading || !user) return;

    const player = players.find((p) => p.user_id === user.id);

    if (!player) {
      // Redirect to character registration if not registered
      router.push(`/room/${roomId}/character`);
    } else {
      setCurrentPlayer(player);
      setIsCheckingPlayer(false);
    }
  }, [loading, players, roomId, router, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Redirect to end summary page when room status changes to finished
  useEffect(() => {
    if (room && room.status === 'finished') {
      router.push(`/room/${roomId}/end`);
    }
  }, [room, roomId, router]);

  if (loading || isCheckingPlayer) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>⌛</div>
        <p style={styles.loadingText}>Conectando con el portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h2>⚠️ Error al entrar</h2>
        <p>{error}</p>
        <button className="btn" onClick={() => router.push('/')} style={{ marginTop: '1.5rem' }}>
          Volver a la Posada
        </button>
      </div>
    );
  }

  const activePlayer = players.find((p) => p.id === room.active_player_id);
  const isDead = currentPlayer && (currentPlayer.stats?.HP ?? 100) <= 0;

  // Start the campaign
  const handleStartGame = async () => {
    setSubmitting(true);
    try {
      if (players.length === 0) throw new Error('No hay aventureros en la sala.');

      const res = await fetch('/api/room/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId: user?.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar la campaña.');
    } catch (err) {
      alert(err.message || 'Error al iniciar la campaña.');
    } finally {
      setSubmitting(false);
    }
  };

  // Send OOC Chat Message
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setSubmitting(true);
    try {
      const { error: sendError } = await supabase.from('messages').insert([
        {
          room_id: room.id,
          sender_type: 'player',
          player_id: currentPlayer.id,
          message_type: 'chat',
          content: inputText.trim()
        }
      ]);

      if (sendError) throw sendError;
      setInputText('');
    } catch (err) {
      console.error(err);
      alert('Error al enviar el mensaje.');
    } finally {
      setSubmitting(false);
    }
  };

  // Prepare and lock action text
  const handleLockAction = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setActionLockedText(inputText.trim());
    setInputText('');
  };

  // Roll dice and submit action
  const handleRollAndSubmitAction = async () => {
    if (!actionLockedText) return;
    setSubmitting(true);

    try {
      // Call consolidated backend API action route
      const res = await fetch('/api/room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId: currentPlayer.id,
          actionText: actionLockedText
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar la acción.');

      setActionLockedText(null);
    } catch (err) {
      console.error('Error al realizar la acción:', err);
      alert(err.message || 'Error al procesar tu acción. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerTitleContainer}>
          <h1 style={styles.headerTitle}>RPG Online</h1>
          <span style={styles.headerRoomId}>Sala: {room?.code || roomId}</span>
        </div>
        <div style={styles.headerStatus}>
          <span style={room.status === 'lobby' ? styles.statusLobby : styles.statusPlaying}>
            ● {room.status === 'lobby' ? 'Lobby Abierto' : 'Campaña Iniciada'}
          </span>
          <span style={styles.playerCount}>{players.length} Aventureros</span>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="btn exit-btn"
          >
            Salir al Home
          </button>
        </div>
      </header>

      {/* Main Splitscreen Layout */}
      <div style={styles.mainGrid}>
        
        {/* Left Panel: Players list */}
        <aside style={styles.sidebar}>
          <h2 style={styles.sectionTitle}>Aventureros</h2>
          <div style={styles.playerList}>
            {players.map((p) => {
              const isActive = room.active_player_id === p.id && room.status === 'playing';
              return (
                <div 
                  key={p.id} 
                  style={{
                    ...styles.playerCard,
                    ...(isActive ? styles.playerCardActive : {}),
                    ...(p.id === currentPlayer.id ? styles.playerCardSelf : {})
                  }}
                >
                  <div style={styles.playerCardHeader}>
                    <div>
                      <span style={styles.playerName}>
                        {p.name} {p.id === currentPlayer.id && ' (Tú)'}
                      </span>
                      <div style={styles.playerSub}>{p.race} • {p.class}</div>
                    </div>
                    {isActive && <span style={styles.activeBadge}>TURNO</span>}
                  </div>
                  
                  {/* Stats list */}
                  <div style={styles.statsRow}>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>HP</span>
                      <span style={styles.statVal}>{p.stats?.HP ?? 100}</span>
                    </div>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>LVL</span>
                      <span style={styles.statVal}>{p.stats?.Level ?? 1}</span>
                    </div>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>XP</span>
                      <span style={styles.statVal}>{p.stats?.XP ?? 0}</span>
                    </div>
                  </div>

                  <button 
                    className="btn" 
                    onClick={() => setModalPlayer(p)} 
                    style={styles.detailsBtn}
                  >
                    Detalles
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Panel: Messages Stream */}
        <section style={styles.chatArea}>
          <div style={styles.chatStream}>
            {messages.length === 0 ? (
              <div style={styles.emptyChat}>
                <p>Las crónicas están vacías. Reúne a tu grupo para iniciar el viaje.</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                if (m.sender_type === 'system') {
                  return (
                    <div key={m.id} style={styles.systemMsg}>
                      {m.content}
                    </div>
                  );
                }

                if (m.sender_type === 'gm') {
                  const isLatestGM = 
                    idx === messages.map((msg) => msg.sender_type).lastIndexOf('gm');
                  return (
                    <div key={m.id} style={styles.gmMsg}>
                      <div style={styles.gmSender}>Narrador (Gemini)</div>
                      <div style={styles.gmBody}>
                        {isLatestGM ? (
                          <TypewriterText text={m.content} speed={15} />
                        ) : (
                          m.content
                        )}
                      </div>
                      {m.image_url && (
                        <div style={styles.imageContainer}>
                          <img 
                            src={m.image_url} 
                            alt="Ilustración escénica del Narrador" 
                            style={styles.scenicImage}
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                const msgPlayer = players.find((p) => p.id === m.player_id);
                const isAction = m.message_type === 'action';

                return (
                  <div 
                    key={m.id} 
                    style={{
                      ...styles.playerMsg,
                      ...(isAction ? styles.playerMsgAction : {})
                    }}
                  >
                    <div style={styles.playerMsgHeader}>
                      <span style={styles.playerMsgSender}>
                        {msgPlayer ? msgPlayer.name : 'Aventurero'}
                      </span>
                      <span style={styles.playerMsgTime}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={styles.playerMsgContent}>
                      {m.content}
                      {isAction && m.dice_roll && (
                        <div style={styles.rollIndicator}>
                          🎲 D20: <strong>{m.dice_roll}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Panel: Interactive Interface Console */}
          <div style={styles.consoleArea}>
            
            {/* If in Lobby State */}
            {room.status === 'lobby' && (
              <div style={styles.lobbyConsole}>
                <h3>Lobby de Espera</h3>
                <p>Esperando a que se unan más compañeros de juego. Actualmente hay {players.length} listos.</p>
                {user && user.id === room.creator_id ? (
                  <button 
                    className="btn" 
                    onClick={handleStartGame} 
                    disabled={submitting || players.length === 0}
                    style={styles.startBtn}
                  >
                    {submitting ? 'Iniciando Campaña...' : 'Comenzar Campaña'}
                  </button>
                ) : (
                  <p style={{ fontStyle: 'italic', color: 'var(--secondary)', marginTop: '1rem' }}>
                    Esperando a que el creador de la campaña inicie la campaña...
                  </p>
                )}
              </div>
            )}

            {/* If player is dead and hasn't chosen to spectate yet */}
            {room.status === 'playing' && isDead && !isSpectating && (
              <div style={styles.deathConsole}>
                <div style={styles.deathHeader}>
                  <span style={styles.deathIcon}>💀</span>
                  <h3>Has Caído en Combate</h3>
                </div>
                <p style={styles.deathText}>
                  Tu aventurero ha perecido en esta travesía. Puedes quedarte a observar en silencio el destino de tus compañeros, o retirarte y volver a la posada.
                </p>
                <div style={styles.deathButtonsRow}>
                  <button 
                    className="btn" 
                    onClick={() => setIsSpectating(true)}
                    style={styles.spectateBtn}
                  >
                    👁️ Observar como Espectador
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => router.push('/')}
                    style={styles.leaveBtn}
                  >
                    🚶 Abandonar Campaña
                  </button>
                </div>
              </div>
            )}

            {/* If player is spectating */}
            {room.status === 'playing' && isDead && isSpectating && (
              <div style={styles.spectatorConsole}>
                <span style={styles.spectatorText}>👁️ Modo Espectador: Estás observando la campaña en silencio. Tu personaje ha caído.</span>
                <button 
                  className="btn" 
                  onClick={() => router.push('/')}
                  style={styles.spectatorLeaveBtn}
                >
                  Volver a la Posada
                </button>
              </div>
            )}

            {/* If Game is Active and Player is Alive */}
            {room.status === 'playing' && !isDead && (
              <div style={styles.playingConsole}>
                {/* Form Controls */}
                <div style={styles.toggleRow}>
                  <button 
                    style={{
                      ...styles.toggleTab,
                      ...(messageType === 'chat' ? styles.toggleTabActive : {})
                    }}
                    onClick={() => {
                      setMessageType('chat');
                      setActionLockedText(null);
                    }}
                  >
                    Mandar Chat OOC
                  </button>
                  <button 
                    style={{
                      ...styles.toggleTab,
                      ...(messageType === 'action' ? styles.toggleTabActive : {})
                    }}
                    onClick={() => setMessageType('action')}
                  >
                    Realizar Acción de Turno
                  </button>
                </div>

                {/* If Out-Of-Character Chat is Active */}
                {messageType === 'chat' && (
                  <form onSubmit={handleSendChat} style={styles.chatForm}>
                    <input
                      type="text"
                      placeholder="Habla fuera de juego (ej: ¿Deberíamos forzar la puerta?)"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      style={styles.consoleInput}
                      disabled={submitting}
                      required
                    />
                    <button type="submit" className="btn" style={styles.sendBtn} disabled={submitting}>
                      Enviar
                    </button>
                  </form>
                )}

                {/* If In-Game Action Turn is Active */}
                {messageType === 'action' && (
                  <div style={styles.actionConsole}>
                    {room.active_player_id !== currentPlayer.id ? (
                      // Waiting for Turn
                      <div style={styles.turnNotification}>
                        <span>⌛ Espera tu turno. Actualmente es el turno de <strong>{activePlayer ? activePlayer.name : 'otro jugador'}</strong>.</span>
                      </div>
                    ) : actionLockedText ? (
                      // Action typed, prompt Dice Roll
                      <div style={styles.diceConsole}>
                        <div style={styles.lockedActionPreview}>
                          <strong>Acción preparada:</strong> &ldquo;{actionLockedText}&rdquo;
                        </div>
                        <p style={styles.diceText}>Se requiere un tiro de dados para evaluar tu éxito.</p>
                        <button 
                          className="btn" 
                          onClick={handleRollAndSubmitAction}
                          style={styles.rollBtn}
                          disabled={submitting}
                        >
                          {submitting 
                            ? 'Consultando al GM...' 
                            : `🎲 Lanzar ${room.current_dice_type || 'D20'} y Finalizar Turno`}
                        </button>
                      </div>
                    ) : (
                      // Type Turn Action
                      <form onSubmit={handleLockAction} style={styles.actionForm}>
                        <textarea
                          placeholder="Describe tu acción física o conjuro (ej: Desenvaino mi espada e intento golpear al orco...)"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          style={styles.actionTextarea}
                          disabled={submitting}
                          required
                        />
                        <button type="submit" className="btn" style={styles.actionSubmitBtn} disabled={submitting}>
                          Preparar Acción de Turno
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal: Player Details */}
      {modalPlayer && (
        <div style={styles.modalOverlay} onClick={() => setModalPlayer(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{modalPlayer.name}</h3>
            <p style={styles.modalSub}>{modalPlayer.race} • {modalPlayer.class}</p>
            
            <div style={styles.modalDivider} />
            
            <div style={styles.modalSection}>
              <h4>Estadísticas</h4>
              <ul style={styles.modalList}>
                <li><strong>Vida (HP):</strong> {modalPlayer.stats?.HP ?? 100} / 100</li>
                <li><strong>Nivel (Level):</strong> {modalPlayer.stats?.Level ?? 1}</li>
                <li><strong>Experiencia (XP):</strong> {modalPlayer.stats?.XP ?? 0}</li>
              </ul>
            </div>

            <div style={styles.modalSection}>
              <h4>Historia y Trasfondo</h4>
              <p style={styles.modalDesc}>{modalPlayer.description}</p>
            </div>

            <button className="btn" onClick={() => setModalPlayer(null)} style={styles.modalCloseBtn}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    background: 'var(--background)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.2rem 2rem',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#0d1321',
  },
  headerTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerTitle: {
    fontSize: '1.5rem',
    margin: 0,
  },
  headerRoomId: {
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    backgroundColor: '#151f32',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid var(--border)',
  },
  headerStatus: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '0.9rem',
  },
  statusLobby: {
    color: 'var(--accent)',
    fontWeight: 'bold',
  },
  statusPlaying: {
    color: 'var(--success)',
    fontWeight: 'bold',
  },
  playerCount: {
    color: 'var(--secondary)',
  },
  mainGrid: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid var(--border)',
    backgroundColor: '#0e1524',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    marginBottom: '1.25rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '0.5rem',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  playerCard: {
    backgroundColor: 'var(--card-bg)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    borderRadius: '6px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s ease',
  },
  playerCardActive: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)',
  },
  playerCardSelf: {
    borderStyle: 'dashed',
  },
  playerCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
  },
  playerName: {
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
  playerSub: {
    fontSize: '0.75rem',
    color: 'var(--secondary)',
  },
  activeBadge: {
    fontSize: '0.65rem',
    fontWeight: 'bold',
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    padding: '0.1rem 0.3rem',
    borderRadius: '3px',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: '#0a0e17',
    padding: '0.5rem',
    borderRadius: '4px',
    marginBottom: '0.75rem',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: '0.65rem',
    color: 'var(--secondary)',
  },
  statVal: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--foreground)',
  },
  detailsBtn: {
    padding: '0.3rem',
    fontSize: '0.75rem',
    width: '100%',
    textAlign: 'center',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--background)',
  },
  chatStream: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  emptyChat: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: 'var(--secondary)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  systemMsg: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    border: '1px solid #1e293b',
    borderRadius: '4px',
    padding: '0.6rem 1rem',
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  gmMsg: {
    backgroundColor: '#131c2e',
    borderLeft: '4px solid var(--accent)',
    borderRadius: '0 8px 8px 0',
    padding: '1.25rem 1.5rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  gmSender: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--accent)',
    marginBottom: '0.5rem',
  },
  gmBody: {
    fontSize: '0.98rem',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  playerMsg: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--card-bg)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    maxWidth: '80%',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  playerMsgAction: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f243a',
  },
  playerMsgHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '0.35rem',
    fontSize: '0.8rem',
  },
  playerMsgSender: {
    fontWeight: 'bold',
    color: 'var(--foreground)',
  },
  playerMsgTime: {
    color: 'var(--secondary)',
  },
  playerMsgContent: {
    fontSize: '0.95rem',
    lineHeight: '1.5',
    wordBreak: 'break-word',
  },
  rollIndicator: {
    marginTop: '0.5rem',
    display: 'inline-block',
    fontSize: '0.8rem',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid rgba(56, 189, 248, 0.3)',
  },
  consoleArea: {
    borderTop: '1px solid var(--border)',
    padding: '1.5rem 2rem',
    backgroundColor: '#0d1321',
  },
  lobbyConsole: {
    textAlign: 'center',
  },
  startBtn: {
    marginTop: '1rem',
    width: '260px',
  },
  playingConsole: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  toggleRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  toggleTab: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    backgroundColor: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    borderRadius: '4px',
    color: 'var(--secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  toggleTabActive: {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#ffffff',
  },
  chatForm: {
    display: 'flex',
    gap: '1rem',
  },
  consoleInput: {
    flex: 1,
    padding: '0.8rem 1.2rem',
    backgroundColor: '#0a0e17',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
  },
  sendBtn: {
    padding: '0.8rem 1.8rem',
  },
  turnNotification: {
    textAlign: 'center',
    padding: '1.5rem',
    backgroundColor: '#0a0e17',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--secondary)',
    fontSize: '0.95rem',
  },
  diceConsole: {
    textAlign: 'center',
    padding: '1rem',
  },
  lockedActionPreview: {
    backgroundColor: '#0f243a',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '0.8rem 1.2rem',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontStyle: 'italic',
    marginBottom: '1rem',
  },
  diceText: {
    color: 'var(--secondary)',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  rollBtn: {
    width: '300px',
    fontSize: '1rem',
  },
  actionForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionTextarea: {
    padding: '0.8rem 1.2rem',
    backgroundColor: '#0a0e17',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    outline: 'none',
    minHeight: '80px',
    resize: 'none',
    fontFamily: 'var(--font-sans)',
  },
  actionSubmitBtn: {
    alignSelf: 'flex-end',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#151f32',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '500px',
    padding: '2.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  modalTitle: {
    fontSize: '1.8rem',
    marginBottom: '0.25rem',
    color: 'var(--accent)',
  },
  modalSub: {
    color: 'var(--secondary)',
    fontSize: '0.9rem',
    fontStyle: 'italic',
  },
  modalDivider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '1.25rem 0',
  },
  modalSection: {
    marginBottom: '1.5rem',
  },
  modalList: {
    listStyleType: 'none',
    padding: 0,
    marginTop: '0.5rem',
    fontSize: '0.95rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  modalDesc: {
    fontSize: '0.95rem',
    lineHeight: '1.6',
    color: 'var(--foreground)',
    marginTop: '0.5rem',
    whiteSpace: 'pre-wrap',
  },
  modalCloseBtn: {
    width: '100%',
    marginTop: '0.5rem',
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
  imageContainer: {
    marginTop: '1.25rem',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
    maxWidth: '100%',
  },
  scenicImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '400px',
    objectFit: 'cover',
    display: 'block',
  },
  deathConsole: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '1.75rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  deathHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
  },
  deathIcon: {
    fontSize: '1.75rem',
  },
  deathText: {
    color: 'var(--secondary)',
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: '1.5',
  },
  deathButtonsRow: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginTop: '0.5rem',
  },
  spectateBtn: {
    backgroundColor: '#1e293b',
    border: '1px solid var(--border)',
  },
  leaveBtn: {
    backgroundColor: 'var(--failure)',
  },
  spectatorConsole: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0e17',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '1rem 1.5rem',
    gap: '1rem',
  },
  spectatorText: {
    color: 'var(--secondary)',
    fontSize: '0.92rem',
    fontStyle: 'italic',
  },
  spectatorLeaveBtn: {
    padding: '0.5rem 1.25rem',
  },
};
