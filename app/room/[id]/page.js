'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { useRoomState } from '../../../lib/useRoomState';
import TypewriterText from '../../../components/TypewriterText';

import { SPELL_LIBRARY } from '../../../lib/spells';

const DICE_GEOMETRY = {
  D4: {
    vertices: [
      [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]
    ],
    faces: [
      { indices: [0, 1, 2], label: '1' },
      { indices: [0, 2, 3], label: '2' },
      { indices: [0, 3, 1], label: '3' },
      { indices: [1, 3, 2], label: '4' }
    ]
  },
  D6: {
    vertices: [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ],
    faces: [
      { indices: [0, 1, 2, 3], label: '1' },
      { indices: [5, 4, 7, 6], label: '6' },
      { indices: [4, 0, 3, 7], label: '2' },
      { indices: [1, 5, 6, 2], label: '5' },
      { indices: [4, 5, 1, 0], label: '3' },
      { indices: [3, 2, 6, 7], label: '4' }
    ]
  },
  D8: {
    vertices: [
      [0, 0, 1.2], [1.2, 0, 0], [0, 1.2, 0], [-1.2, 0, 0], [0, -1.2, 0], [0, 0, -1.2]
    ],
    faces: [
      { indices: [0, 1, 2], label: '1' },
      { indices: [0, 2, 3], label: '2' },
      { indices: [0, 3, 4], label: '3' },
      { indices: [0, 4, 1], label: '4' },
      { indices: [5, 2, 1], label: '5' },
      { indices: [5, 3, 2], label: '6' },
      { indices: [5, 4, 3], label: '7' },
      { indices: [5, 1, 4], label: '8' }
    ]
  },
  D10: {
    vertices: [
      [0, 0, 1.2], [0, 0, -1.2],
      ...Array.from({length: 5}, (_, i) => {
        const a = (i * 2 * Math.PI) / 5;
        return [Math.cos(a), Math.sin(a), 0.2];
      }),
      ...Array.from({length: 5}, (_, i) => {
        const a = ((i + 0.5) * 2 * Math.PI) / 5;
        return [Math.cos(a), Math.sin(a), -0.2];
      })
    ],
    faces: [
      { indices: [0, 2, 3], label: '1' },
      { indices: [0, 3, 4], label: '2' },
      { indices: [0, 4, 5], label: '3' },
      { indices: [0, 5, 6], label: '4' },
      { indices: [0, 6, 2], label: '5' },
      { indices: [1, 8, 7], label: '6' },
      { indices: [1, 9, 8], label: '7' },
      { indices: [1, 10, 9], label: '8' },
      { indices: [1, 11, 10], label: '9' },
      { indices: [1, 7, 11], label: '10' }
    ]
  },
  D12: {
    vertices: (() => {
      const phi = (1 + Math.sqrt(5)) / 2;
      return [
        [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
        [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
        [0, -1/phi, -phi], [0, -1/phi, phi], [0, 1/phi, -phi], [0, 1/phi, phi],
        [-1/phi, -phi, 0], [-1/phi, phi, 0], [1/phi, -phi, 0], [1/phi, phi, 0],
        [-phi, 0, -1/phi], [-phi, 0, 1/phi], [phi, 0, -1/phi], [phi, 0, 1/phi]
      ];
    })(),
    faces: [
      { indices: [1, 9, 11, 3, 17], label: '1' },
      { indices: [1, 17, 16, 0, 12], label: '2' },
      { indices: [1, 12, 14, 5, 9], label: '3' },
      { indices: [3, 11, 7, 15, 13], label: '4' },
      { indices: [3, 13, 2, 10, 11], label: '5' },
      { indices: [9, 5, 19, 7, 11], label: '6' },
      { indices: [17, 3, 13, 2, 16], label: '7' },
      { indices: [12, 0, 8, 4, 14], label: '8' },
      { indices: [16, 2, 10, 8, 0], label: '9' },
      { indices: [14, 4, 18, 19, 5], label: '10' },
      { indices: [15, 7, 19, 5, 14], label: '11' },
      { indices: [18, 6, 15, 7, 19], label: '12' }
    ]
  },
  D20: {
    vertices: (() => {
      const phi = (1 + Math.sqrt(5)) / 2;
      return [
        [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
        [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
        [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
      ];
    })(),
    faces: [
      { indices: [0, 11, 5], label: '1' },
      { indices: [0, 5, 1], label: '2' },
      { indices: [0, 1, 7], label: '3' },
      { indices: [0, 7, 10], label: '4' },
      { indices: [0, 10, 11], label: '5' },
      { indices: [1, 5, 9], label: '6' },
      { indices: [5, 11, 4], label: '7' },
      { indices: [11, 10, 2], label: '8' },
      { indices: [10, 7, 6], label: '9' },
      { indices: [7, 1, 8], label: '10' },
      { indices: [3, 9, 4], label: '11' },
      { indices: [3, 4, 2], label: '12' },
      { indices: [3, 2, 6], label: '13' },
      { indices: [3, 6, 8], label: '14' },
      { indices: [3, 8, 9], label: '15' },
      { indices: [4, 9, 5], label: '16' },
      { indices: [2, 4, 11], label: '17' },
      { indices: [6, 2, 10], label: '18' },
      { indices: [8, 6, 7], label: '19' },
      { indices: [9, 8, 1], label: '20' }
    ]
  }
};

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
  const [submitting, setSubmitting] = useState(false);

  // Dice Animation State
  const [rollingDice, setRollingDice] = useState(false);
  const [rolledValue, setRolledValue] = useState(null);
  const [diceTypeToRoll, setDiceTypeToRoll] = useState('D20');
  const [rollerName, setRollerName] = useState('');

  // Typing Indicator State & Refs
  const [typingUsers, setTypingUsers] = useState([]);
  const typingChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isCurrentlyTypingRef = useRef(false);

  // Campaign Description modal state
  const [showDescModal, setShowDescModal] = useState(false);

  // Character Detail Modal
  const [modalPlayer, setModalPlayer] = useState(null);

  // Spectator mode for dead players
  const [isSpectating, setIsSpectating] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`spectating_${roomId}`) === 'true';
    }
    return false;
  });

  // Scroll anchor for chat
  const chatEndRef = useRef(null);
  const isInitialScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  const [user, setUser] = useState(null);

  // Load user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('rpg_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      supabase
        .from('users')
        .select('id')
        .eq('id', parsedUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            localStorage.removeItem('rpg_user');
            setUser(null);
            router.push('/');
          } else {
            setUser(parsedUser);
          }
        });
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirect_room', roomId);
      }
      router.push('/');
    }
  }, [roomId, router]);

  // Check if player has a valid registration in this room
  useEffect(() => {
    if (loading || !user) return;

    const player = players.find((p) => p.user_id === user.id);

    if (!player) {
      // Redirect to character registration if not registered
      router.push(`/room/${roomId}/character`);
    } else {
      // Ensure MP & MaxMP are initialized
      const stats = player.stats || {};
      const maxMp = player.magia ?? 10;
      if (stats.MP === undefined || stats.MaxMP === undefined) {
        const updatedStats = {
          ...stats,
          MP: stats.MP !== undefined ? stats.MP : maxMp,
          MaxMP: stats.MaxMP !== undefined ? stats.MaxMP : maxMp
        };
        supabase
          .from('players')
          .update({ stats: updatedStats })
          .eq('id', player.id)
          .then(({ error }) => {
            if (error) console.error("Error auto-initializing MP/MaxMP:", error);
          });
      }
      setCurrentPlayer(player);
      setIsCheckingPlayer(false);
    }
  }, [loading, players, roomId, router, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialScrollRef.current) {
        chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
        isInitialScrollRef.current = false;
      } else {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Trigger multiplayer dice rolling animation when another player rolls
  useEffect(() => {
    if (loading) return;
    
    if (messages.length > lastMessageCountRef.current) {
      const newMsg = messages[messages.length - 1];
      
      if (newMsg && newMsg.message_type === 'action' && newMsg.dice_roll && newMsg.player_id !== currentPlayer?.id) {
        const roller = players.find(p => p.id === newMsg.player_id);
        const name = roller ? roller.name : 'Otro jugador';

        // Synchronize dice rolling animation on spectating/other client
        setRollerName(name);
        setDiceTypeToRoll(room?.current_dice_type || 'D20');
        setRollingDice(true);
        setRolledValue(null);

        // Let the dice roll with suspense for 900ms before stopping it on the rolled number
        const timer = setTimeout(() => {
          setRolledValue(newMsg.dice_roll);
          
          // Clear animation state after it settles
          setTimeout(() => {
            setRollingDice(false);
            setRollerName('');
          }, 2100);
        }, 900);

        lastMessageCountRef.current = messages.length;
        return () => clearTimeout(timer);
      }
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages, currentPlayer, players, room, loading]);

  // Redirect to end summary page when room status changes to finished
  useEffect(() => {
    if (room && room.status === 'finished') {
      router.push(`/room/${roomId}/end`);
    }
  }, [room, roomId, router]);

  // Subscribe to typing broadcast channel
  useEffect(() => {
    if (!roomId || !currentPlayer || !room) return;

    const channelName = `typing:${room.id}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { name, isTyping } = payload.payload;
        setTypingUsers((prev) => {
          if (isTyping) {
            if (prev.includes(name)) return prev;
            return [...prev, name];
          } else {
            return prev.filter(u => u !== name);
          }
        });
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentPlayer, room]);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!rollingDice) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Get geometry
    const geomKey = diceTypeToRoll && DICE_GEOMETRY[diceTypeToRoll] ? diceTypeToRoll : 'D20';
    const geometry = DICE_GEOMETRY[geomKey];
    const faces = geometry.faces;

    // Rotation angles and speeds
    let rotX = Math.random() * Math.PI;
    let rotY = Math.random() * Math.PI;
    let rotZ = Math.random() * Math.PI;

    let velX = 0.22 + Math.random() * 0.15;
    let velY = 0.22 + Math.random() * 0.15;
    let velZ = 0.15 + Math.random() * 0.10;

    // 3D rotation math functions
    const rotateX = (v, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
    };
    const rotateY = (v, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    };
    const rotateZ = (v, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
    };

    const project = (v) => {
      // Scale based on canvas size
      const scale = Math.min(width, height) * 0.35;
      const zOffset = 3.2;
      const px = (v[0] * scale) / (v[2] + zOffset) + width / 2;
      const py = (v[1] * scale) / (v[2] + zOffset) + height / 2;
      return { x: px, y: py, z: v[2] };
    };

    let animationFrameId;
    let damping = 0.84; // Friction to slow it down
    let settled = false;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Apply rotation velocities
      rotX += velX;
      rotY += velY;
      rotZ += velZ;

      // Apply damping to simulate landing when rolledValue is set
      if (rolledValue !== null) {
        velX *= damping;
        velY *= damping;
        velZ *= damping;

        if (Math.abs(velX) < 0.002 && Math.abs(velY) < 0.002 && Math.abs(velZ) < 0.002) {
          velX = 0;
          velY = 0;
          velZ = 0;
          settled = true;
        }
      }

      // Rotate vertices
      const rotated = geometry.vertices.map(v => {
        let r = rotateX(v, rotX);
        r = rotateY(r, rotY);
        r = rotateZ(r, rotZ);
        return r;
      });

      // Painter's algorithm: sort faces by depth
      const sortedFaces = faces.map(face => {
        const projectedPoints = face.indices.map(idx => project(rotated[idx]));
        const avgZ = projectedPoints.reduce((sum, p) => sum + p.z, 0) / projectedPoints.length;
        return { face, points: projectedPoints, avgZ };
      }).sort((a, b) => b.avgZ - a.avgZ);

      // Draw faces
      sortedFaces.forEach(({ face, points, avgZ }) => {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();

        // Calculate translucent intensity
        const intensity = Math.max(0.1, Math.min(0.9, (1.5 - avgZ) / 3.0));

        // Face color (semi-transparent Indigo/Blue gradient overlay)
        ctx.fillStyle = `rgba(79, 70, 229, ${intensity * 0.45})`;
        ctx.fill();

        ctx.strokeStyle = `rgba(129, 140, 248, ${intensity})`;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Draw numbers on the front-facing faces (Z depth closer to camera)
        if (avgZ < 0.1) {
          const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
          const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.4, intensity)})`;
          ctx.font = `bold ${Math.max(11, Math.floor(15 * intensity))}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(face.label, cx, cy);
        }
      });

      if (!settled) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [rollingDice, rolledValue, diceTypeToRoll]);

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

  const clearMyTypingState = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isCurrentlyTypingRef.current = false;
    if (typingChannelRef.current && currentPlayer) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { name: currentPlayer.name, isTyping: false }
      });
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);

    if (!typingChannelRef.current || !currentPlayer) return;

    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { name: currentPlayer.name, isTyping: true }
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isCurrentlyTypingRef.current = false;
      if (typingChannelRef.current) {
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { name: currentPlayer.name, isTyping: false }
        });
      }
    }, 1700);
  };

  // Send OOC Chat Message
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    clearMyTypingState();

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

  // Submit action directly to backend GM
  const handleDirectActionSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    clearMyTypingState();

    setSubmitting(true);
    const actionTextToSend = inputText.trim();
    setInputText('');

    // Check if player is casting a spell by checking for [Spell Name] in the action text
    let spellToCast = null;
    let spellMatch = actionTextToSend.match(/\[([^\]]+)\]/);
    if (spellMatch) {
      const spellName = spellMatch[1].trim();
      const spell = SPELL_LIBRARY.find(s => s.name.toLowerCase() === spellName.toLowerCase());
      if (spell) {
        spellToCast = spell;
      }
    }

    if (spellToCast) {
      // Validate that player has enough MP
      const currentMp = currentPlayer.stats?.MP ?? 0;
      const cost = spellToCast.tier;
      if (currentMp < cost) {
        alert(`No tienes suficientes Puntos de Magia para lanzar [${spellToCast.name}]. Requiere ${cost} PM, pero solo tienes ${currentMp} PM. ¡Necesitas descansar/dormir para recargar tu magia!`);
        setInputText(actionTextToSend); // Restore action text
        setSubmitting(false);
        return;
      }

      // Deduct MP in the database before sending action
      try {
        const updatedStats = {
          ...currentPlayer.stats,
          MP: Math.max(0, currentMp - cost)
        };
        const { error: updateError } = await supabase
          .from('players')
          .update({ stats: updatedStats })
          .eq('id', currentPlayer.id);
        if (updateError) throw updateError;
      } catch (err) {
        console.error('Error al descontar puntos de magia:', err);
        alert('Error al descontar puntos de magia. No se pudo lanzar el hechizo.');
        setInputText(actionTextToSend); // Restore action text
        setSubmitting(false);
        return;
      }
    }

    // Compute client-side dice roll first
    const diceType = room.current_dice_type || 'D20';
    const maxRoll = parseInt(diceType.replace('D', ''), 10) || 20;
    const clientRoll = Math.floor(Math.random() * maxRoll) + 1;

    // A. Insert player action message immediately so it appears on screen for everyone
    let playerMsgId = null;
    try {
      const { data: newMsg, error: insertError } = await supabase.from('messages').insert([
        {
          room_id: room.id,
          sender_type: 'player',
          player_id: currentPlayer.id,
          message_type: 'action',
          content: actionTextToSend,
          dice_roll: clientRoll
        }
      ]).select().single();

      if (insertError) throw insertError;
      playerMsgId = newMsg.id;
    } catch (err) {
      console.error('Error inserting message client side:', err);
      alert('Error de conexión al enviar la acción.');
      setInputText(actionTextToSend);
      setSubmitting(false);
      return;
    }

    // Trigger rolling dice animation locally
    setDiceTypeToRoll(diceType);
    setRollingDice(true);
    setRolledValue(null);

    try {
      // Call consolidated backend API action route with the pre-inserted message and roll
      const res = await fetch('/api/room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId: currentPlayer.id,
          actionText: actionTextToSend,
          clientRoll: clientRoll,
          clientMessageId: playerMsgId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar la acción.');

      if (data.roll && data.dice_roll_used) {
        setRolledValue(data.roll);
        // Automatically hide rolling overlay after showing the result
        setTimeout(() => {
          setRollingDice(false);
        }, 1300);
      } else {
        setRollingDice(false);
      }
    } catch (err) {
      console.error('Error al realizar la acción:', err);
      alert(err.message || 'Error al procesar tu acción. Inténtalo de nuevo.');
      setRollingDice(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSleep = async () => {
    if (submitting) return;
    if (!confirm('¿Estás seguro de que quieres intentar dormir/descansar? Si el Game Master lo permite, quedarás profundamente dormido por 2 turnos (sin poder actuar), pero al despertar recuperarás toda tu vida y magia.')) return;
    
    setSubmitting(true);
    const actionText = `Intento acostarme a dormir profundamente para descansar y recuperar mis fuerzas y magia.`;
    let playerMsgId = null;
    try {
      const { data: newMsg, error: insertError } = await supabase.from('messages').insert([
        {
          room_id: room.id,
          sender_type: 'player',
          player_id: currentPlayer.id,
          message_type: 'action',
          content: actionText,
          dice_roll: null
        }
      ]).select().single();

      if (insertError) throw insertError;
      playerMsgId = newMsg.id;
    } catch (err) {
      console.error('Error inserting sleep message:', err);
      alert('Error de conexión al intentar descansar.');
      setSubmitting(false);
      return;
    }

    try {
      // Submit narrative action to GM. If allowed, the GM response will set sleeping_rounds = 2.
      const res = await fetch('/api/room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId: currentPlayer.id,
          actionText: actionText,
          clientRoll: null,
          clientMessageId: playerMsgId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar la acción de descanso.');
    } catch (err) {
      console.error('Error al intentar descansar:', err);
      alert('Error al intentar descansar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassSleepTurn = async () => {
    if (submitting) return;
    setSubmitting(true);
    const actionText = `${currentPlayer.name} continúa durmiendo profundamente.`;
    let playerMsgId = null;
    try {
      const { data: newMsg, error: insertError } = await supabase.from('messages').insert([
        {
          room_id: room.id,
          sender_type: 'player',
          player_id: currentPlayer.id,
          message_type: 'action',
          content: actionText,
          dice_roll: null
        }
      ]).select().single();

      if (insertError) throw insertError;
      playerMsgId = newMsg.id;
    } catch (err) {
      console.error('Error inserting pass sleep message:', err);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId: currentPlayer.id,
          actionText: actionText,
          clientRoll: null,
          clientMessageId: playerMsgId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo pasar el turno de descanso.');
    } catch (err) {
      console.error('Error al pasar el turno de descanso:', err);
      alert('Error al pasar el turno: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCastSpell = (spellName) => {
    setInputText(`Lanzo [${spellName}] para `);
    setMessageType('action');
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder*="Describe tu acción"]');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 100);
  };

  const hasMagic = currentPlayer && ['Mago', 'Clérigo', 'Bardo'].includes(currentPlayer.class);

  const isSleeping = (currentPlayer?.stats?.sleeping_rounds ?? 0) > 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerTitleContainer}>
          <h1 style={styles.headerTitle}>{room?.name || 'Campaña sin nombre'}</h1>
          <span style={styles.headerRoomId}>Código: {room?.code || roomId}</span>
        </div>
        <div style={styles.headerStatus}>
          <span style={room.status === 'lobby' ? styles.statusLobby : styles.statusPlaying}>
            ● {room.status === 'lobby' ? 'Lobby Abierto' : 'Campaña Iniciada'}
          </span>
          {room.status === 'playing' && (
            <span style={{
              background: room.turn_mode === 'ordered' ? '#ef4444' : '#10b981',
              color: '#ffffff',
              fontSize: '0.75rem',
              padding: '0 0.5rem',
              height: '24px',
              borderRadius: '4px',
              fontWeight: '600',
              marginLeft: '0.5rem',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {room.turn_mode === 'ordered' ? '⚔️ Turnos Ordenados' : '🕊️ Exploración Libre'}
            </span>
          )}
          <span style={styles.playerCount}>{players.length} Aventureros</span>
          <button
            type="button"
            onClick={() => setShowDescModal(true)}
            className="btn enter-btn"
            style={{ marginRight: '0.5rem' }}
          >
            📜 Trasfondo
          </button>
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
                    {(['Mago', 'Clérigo', 'Bardo'].includes(p.class) || (p.magia ?? 10) >= 12) && (
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>PM</span>
                        <span style={styles.statVal}>{p.stats?.MP ?? 0}</span>
                      </div>
                    )}
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
                      alignSelf: isAction ? 'flex-end' : 'flex-start',
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
            {typingUsers.length > 0 && (
              <div style={{
                alignSelf: 'flex-start',
                padding: '0.4rem 1.25rem',
                fontSize: '0.82rem',
                color: 'var(--secondary)',
                fontStyle: 'italic',
                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                border: '1px dashed var(--border)',
                borderRadius: '8px',
                marginTop: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                💬 {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está escribiendo...' : 'están escribiendo...'}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Panel: Interactive Interface Console */}
          <div style={styles.consoleArea}>
            
            {/* If in Lobby State */}
            {room.status === 'lobby' && (
              <div style={styles.lobbyConsole}>
                <h3>Lobby: {room?.name || 'Campaña sin nombre'}</h3>
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
                    onClick={() => {
                      setIsSpectating(true);
                      localStorage.setItem(`spectating_${roomId}`, 'true');
                    }}
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
                    Realizar Acción
                  </button>
                  {hasMagic && (
                    <button 
                      style={{
                        ...styles.toggleTab,
                        ...(messageType === 'spells' ? styles.toggleTabActive : {})
                      }}
                      onClick={() => setMessageType('spells')}
                    >
                      🪄 Libro de Hechizos
                    </button>
                  )}
                </div>

                {/* If Out-Of-Character Chat is Active */}
                {messageType === 'chat' && (
                  <form onSubmit={handleSendChat} style={styles.chatForm}>
                    <input
                      type="text"
                      placeholder="Habla fuera de juego (ej: ¿Deberíamos forzar la puerta?)"
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
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
                    {isSleeping ? (
                      <div style={{
                        backgroundColor: 'rgba(30, 27, 75, 0.4)',
                        border: '1px dashed #4338ca',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        width: '100%'
                      }}>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#a5b4fc', fontWeight: 'bold' }}>
                          😴 Estás durmiendo profundamente para recuperar tus fuerzas...
                        </p>
                        <div style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '1.25rem' }}>
                          Despertarás en <strong>{currentPlayer.stats.sleeping_rounds}</strong> {currentPlayer.stats.sleeping_rounds === 1 ? 'turno' : 'turnos'}.
                        </div>
                        <button
                          type="button"
                          onClick={handlePassSleepTurn}
                          className="btn enter-btn"
                          disabled={submitting}
                          style={{ margin: '0 auto', display: 'block' }}
                        >
                          {submitting ? 'Avanzando tiempo...' : '⌛ Esperar / Avanzar Turno'}
                        </button>
                      </div>
                    ) : room.turn_mode === 'ordered' && room.active_player_id !== currentPlayer.id ? (
                      // Waiting for Turn
                      <div style={styles.turnNotification}>
                        <span>⌛ Espera tu turno. Actualmente es el turno de <strong>{activePlayer ? activePlayer.name : 'otro jugador'}</strong>.</span>
                      </div>
                    ) : (
                      // Direct Action Form
                      <form onSubmit={handleDirectActionSubmit} style={styles.actionForm}>
                        <textarea
                          placeholder="Describe tu acción física o conjuro (ej: Desenvaino mi espada e intento golpear al orco...)"
                          value={inputText}
                          onChange={(e) => handleInputChange(e.target.value)}
                          style={styles.actionTextarea}
                          disabled={submitting}
                          required
                        />
                        <button type="submit" className="btn" style={styles.actionSubmitBtn} disabled={submitting}>
                          {submitting 
                            ? 'Enviando al GM...' 
                            : room.turn_mode === 'ordered' 
                              ? `Enviar Acción (Turno de ${currentPlayer.name})` 
                              : 'Enviar Acción'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* If Spellbook Console is Active */}
                {messageType === 'spells' && (
                  <div style={styles.spellsConsole}>
                    {isSleeping ? (
                      <div style={{
                        backgroundColor: 'rgba(30, 27, 75, 0.4)',
                        border: '1px dashed #4338ca',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        width: '100%'
                      }}>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#a5b4fc', fontWeight: 'bold' }}>
                          😴 Estás durmiendo profundamente para recuperar tus fuerzas...
                        </p>
                        <div style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '1.25rem' }}>
                          Despertarás en <strong>{currentPlayer.stats.sleeping_rounds}</strong> {currentPlayer.stats.sleeping_rounds === 1 ? 'turno' : 'turnos'}.
                        </div>
                        <button
                          type="button"
                          onClick={handlePassSleepTurn}
                          className="btn enter-btn"
                          disabled={submitting}
                          style={{ margin: '0 auto', display: 'block' }}
                        >
                          {submitting ? 'Avanzando tiempo...' : '⌛ Esperar / Avanzar Turno'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Spell slots status */}
                        <div style={styles.spellsHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Libro de Hechizos</h3>
                            <span style={{
                              background: 'var(--accent)',
                              color: '#ffffff',
                              fontSize: '0.82rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              boxShadow: '0 0 10px rgba(129, 140, 248, 0.3)'
                            }}>
                              🔮 PM: {currentPlayer.stats?.MP ?? 0} / {currentPlayer.stats?.MaxMP ?? (currentPlayer.magia ?? 10)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleSleep}
                            className="btn enter-btn"
                            disabled={submitting}
                            style={{
                              fontSize: '0.82rem',
                              padding: '0.35rem 0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              marginLeft: 'auto'
                            }}
                          >
                            😴 Descansar / Dormir
                          </button>
                        </div>

                        <div style={{ ...styles.spellsList, marginTop: '1rem' }}>
                          {(() => {
                            const currentLvl = currentPlayer.stats?.Level ?? 1;
                            const availableSpells = SPELL_LIBRARY.filter(s => s.tier <= currentLvl);

                            if (availableSpells.length === 0) {
                              return <p style={styles.emptySpellsText}>No hay hechizos disponibles para tu nivel actual.</p>;
                            }

                            return (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '1rem',
                                width: '100%'
                              }}>
                                {availableSpells.map((spell) => {
                                  const cost = spell.tier;
                                  const canAfford = (currentPlayer.stats?.MP ?? 0) >= cost;
                                  return (
                                    <div key={spell.name} style={{
                                      ...styles.spellCard,
                                      borderColor: canAfford ? '#4338ca' : '#ef4444',
                                      backgroundColor: canAfford ? '#0f172a' : '#1a1212',
                                      margin: 0,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between'
                                    }}>
                                      <div>
                                        <div style={styles.spellCardMeta}>
                                          <span style={styles.spellCardName}>🪄 {spell.name}</span>
                                          <span style={{
                                            ...styles.spellCardTier,
                                            color: canAfford ? '#818cf8' : '#ef4444'
                                          }}>
                                            Niv {spell.tier} • {cost} PM
                                          </span>
                                        </div>
                                        <p style={styles.spellCardDesc}>{spell.desc}</p>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid #1e293b', paddingTop: '0.5rem' }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>
                                          {spell.type}
                                        </span>
                                        <button 
                                          className="btn" 
                                          onClick={() => handleCastSpell(spell.name)}
                                          style={{
                                            ...styles.castBtn,
                                            backgroundColor: canAfford ? 'var(--accent)' : '#374151',
                                            cursor: canAfford ? 'pointer' : 'not-allowed',
                                            fontSize: '0.75rem',
                                            padding: '0.2rem 0.5rem'
                                          }}
                                          disabled={submitting || !canAfford}
                                        >
                                          {canAfford ? 'Lanzar' : 'Sin PM'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </>
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
                <li><strong>Vida (HP):</strong> {modalPlayer.stats?.HP ?? 100} / {modalPlayer.salud ?? 100}</li>
                {(['Mago', 'Clérigo', 'Bardo'].includes(modalPlayer.class) || (modalPlayer.magia ?? 10) >= 12) && (
                  <li><strong>Puntos de Magia (PM):</strong> {modalPlayer.stats?.MP ?? 0} / {modalPlayer.stats?.MaxMP ?? (modalPlayer.magia ?? 10)}</li>
                )}
                <li><strong>Nivel (Level):</strong> {modalPlayer.stats?.Level ?? 1}</li>
                <li><strong>Experiencia (XP):</strong> {modalPlayer.stats?.XP ?? 0}</li>
              </ul>
            </div>

            <div style={styles.modalSection}>
              <h4>Atributos</h4>
              <ul style={styles.modalList}>
                <li><strong>💪 Fuerza:</strong> {modalPlayer.fuerza ?? 10}</li>
                <li><strong>🏹 Destreza:</strong> {modalPlayer.destreza ?? 10}</li>
                <li><strong>✨ Magia:</strong> {modalPlayer.magia ?? 10}</li>
                <li><strong>❤️ Salud (Máx HP):</strong> {modalPlayer.salud ?? 10}</li>
                <li><strong>🗣️ Carisma:</strong> {modalPlayer.carisma ?? 10}</li>
                <li><strong>🧠 Inteligencia:</strong> {modalPlayer.inteligencia ?? 10}</li>
              </ul>
            </div>

            {modalPlayer.skills && modalPlayer.skills.length > 0 && (
              <div style={styles.modalSection}>
                <h4>Habilidades</h4>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {modalPlayer.skills.map((skill, sIdx) => (
                    <span key={sIdx} className="creator-badge" style={{ background: '#1e293b', border: '1px solid var(--border)', textTransform: 'none', fontSize: '0.8rem', padding: '0.2rem 0.5rem', marginLeft: 0 }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(['Mago', 'Clérigo', 'Bardo'].includes(modalPlayer.class) || (modalPlayer.magia ?? 10) >= 12) && (
              <div style={styles.modalSection}>
                <h4>Libro de Hechizos</h4>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {(() => {
                    const level = modalPlayer.stats?.Level ?? 1;
                    const eligibleSpells = SPELL_LIBRARY.filter(s => s.tier <= level);
                    if (eligibleSpells.length === 0) {
                      return <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>Ninguno</span>;
                    }
                    return eligibleSpells.map((spell, sIdx) => (
                      <span key={sIdx} className="creator-badge" style={{ background: '#1e1b4b', border: '1px solid #4338ca', textTransform: 'none', fontSize: '0.8rem', padding: '0.2rem 0.5rem', marginLeft: 0 }}>
                        🪄 {spell.name} (Niv {spell.tier})
                      </span>
                    ));
                  })()}
                </div>
              </div>
            )}

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

      {/* Campaign Premise Modal */}
      {showDescModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">📜 Trasfondo: {room?.name || 'Campaña sin nombre'}</h2>
            </div>
            
            <div style={{ padding: '0.5rem 0' }}>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
                {room?.description || 'Esta campaña no tiene un trasfondo inicial especificado.'}
              </p>
              <p style={{ color: 'var(--secondary)', fontSize: '0.82rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', lineHeight: '1.4' }}>
                💡 <em>Este trasfondo sirve como la descripción de partida abierta visible para todos los héroes. No contiene información secreta para asegurar un juego justo.</em>
              </p>
            </div>

            <button 
              className="btn" 
              onClick={() => setShowDescModal(false)}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 3D Dice Throwing Overlay Modal */}
      {rollingDice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(5, 5, 10, 0.92)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.25)',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h2 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.6rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              🎲 {rollerName ? `${rollerName} lanza ${diceTypeToRoll}` : `Lanzando ${diceTypeToRoll}`}
            </h2>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem', color: 'var(--secondary)' }}>
              {rollerName ? '¿Qué dirán los dados?' : 'El destino está en movimiento...'}
            </p>

            <div style={{
              position: 'relative',
              width: '280px',
              height: '280px',
              backgroundColor: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)'
            }}>
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                style={{ display: 'block' }}
              />

              {/* Splash value overlay once rolledValue is settled */}
              {rolledValue !== null && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(11, 15, 25, 0.75)',
                  animation: 'fadeIn 0.3s ease-out forwards',
                }}>
                  <div style={{
                    fontSize: '4.8rem',
                    fontWeight: '900',
                    color: '#ffffff',
                    textShadow: '0 0 20px rgba(99, 102, 241, 0.8), 0 0 40px rgba(99, 102, 241, 0.4)',
                    animation: 'scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                  }}>
                    {rolledValue}
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: '#a5b4fc',
                    marginTop: '0.5rem',
                    letterSpacing: '1px',
                    animation: 'fadeInUp 0.4s ease-out 0.2s forwards',
                    opacity: 0
                  }}>
                    ¡TIRADA COMPLETADA!
                  </div>
                </div>
              )}
            </div>

            {/* Animations Styles Keyframes */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeIn {
                from { opacity: 0; backdrop-filter: blur(0px); }
                to { opacity: 1; backdrop-filter: blur(4px); }
              }
              @keyframes scaleUp {
                from { transform: scale(0.5); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              @keyframes fadeInUp {
                from { transform: translateY(10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}} />
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
    alignSelf: 'flex-start',
    maxWidth: '85%',
    backgroundColor: '#131c2e',
    borderLeft: '4px solid var(--accent)',
    borderRadius: '8px',
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
  spellsConsole: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: '380px',
    overflowY: 'auto',
  },
  spellsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '0.5rem',
  },
  spellSlotsBadge: {
    fontSize: '0.8rem',
    backgroundColor: '#1e1b4b',
    color: '#a5b4fc',
    padding: '0.2rem 0.6rem',
    borderRadius: '4px',
    border: '1px solid #4338ca',
    fontWeight: '600',
  },
  learnAlert: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    borderRadius: '6px',
    padding: '0.6rem 1rem',
    fontSize: '0.85rem',
    color: '#a5b4fc',
  },
  spellsSplitGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    height: '280px',
  },
  spellsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    overflowY: 'auto',
    paddingRight: '0.5rem',
  },
  spellsColumnTitle: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--secondary)',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  spellsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  spellCard: {
    backgroundColor: '#151f32',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '0.8rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  spellCardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  spellCardName: {
    fontWeight: 'bold',
    fontSize: '0.9rem',
    color: '#a5b4fc',
  },
  spellCardTier: {
    fontSize: '0.7rem',
    color: 'var(--secondary)',
  },
  spellCardDesc: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--foreground)',
    lineHeight: '1.4',
    opacity: 0.85,
  },
  castBtn: {
    alignSelf: 'flex-end',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    marginTop: '0.25rem',
  },
  emptySpellsText: {
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    fontStyle: 'italic',
    margin: 0,
    padding: '1rem 0',
    textAlign: 'center',
  },
};
