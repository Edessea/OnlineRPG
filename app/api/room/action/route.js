import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { supabase } from '../../../../lib/supabaseClient';
import { SPELL_LIBRARY } from '../../../../lib/spells';

// Enforce schema constraint on Gemini response
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    gm_message: {
      type: SchemaType.STRING,
      description: "La respuesta narrativa del Game Master en español, describiendo el resultado de la acción basándose en la tirada (si es que se usó la tirada)."
    },
    next_player_id: {
      type: SchemaType.STRING,
      description: "El ID del siguiente jugador en la secuencia de juego. Puede ser un string vacío '' si next_turn_mode es 'free'."
    },
    next_dice_type: {
      type: SchemaType.STRING,
      description: "El tipo de dado recomendado para el siguiente turno (ej: 'D20', 'D12', 'D10', 'D6', 'D4')."
    },
    dice_roll_used: {
      type: SchemaType.BOOLEAN,
      description: "Indica si la acción del jugador requería un tiro de dado para evaluar su éxito o fracaso. Debe ser false para acciones cotidianas o conversaciones simples (ej: hablar con un compañero, caminar a un cuarto vacío, sentarse), y true para desafíos de destreza, ataques, uso de magia compleja, sigilo frente a enemigos, etc."
    },
    next_turn_mode: {
      type: SchemaType.STRING,
      description: "El modo de juego para el siguiente turno. Debe ser 'free' (para exploración libre donde cualquiera puede hablar y actuar en cualquier orden) o 'ordered' (para turnos secuenciales estrictos cuando hay combate activo, trampas de tiempo real o situaciones tensas de uno a la vez)."
    },
    updated_players: {
      type: SchemaType.ARRAY,
      description: "Lista de jugadores cuyas estadísticas (HP, Nivel o XP) han cambiado debido a este desenlace.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          stats: {
            type: SchemaType.OBJECT,
            properties: {
              HP: { type: SchemaType.INTEGER },
              Level: { type: SchemaType.INTEGER },
              XP: { type: SchemaType.INTEGER },
              MP: { type: SchemaType.INTEGER },
              sleeping_rounds: { type: SchemaType.INTEGER }
            },
            required: ["HP", "Level", "XP"]
          }
        },
        required: ["id", "stats"]
      }
    },
    is_critical_moment: {
      type: SchemaType.BOOLEAN,
      description: "Indica si la acción resultó en un hito dramático que requiere una ilustración visual."
    },
    image_prompt: {
      type: SchemaType.STRING,
      description: "Un prompt en inglés descriptivo y cinematográfico de la escena (solo si is_critical_moment es verdadero)."
    },
    updated_gm_context: {
      type: SchemaType.STRING,
      description: "La bitácora o crónica acumulativa de toda la campaña. Debe resumir cronológicamente todos los sucesos notables, decisiones, combates, objetos hallados y descubrimientos clave desde el inicio de la campaña hasta el presente. No borres la historia antigua; anexa los nuevos hitos para mantener una memoria permanente de todo el viaje."
    },
    game_status: {
      type: SchemaType.STRING,
      description: "El estado actual del juego. Debe ser 'playing' para continuar la campaña, o 'finished' si la campaña concluyó en victoria o derrota de los héroes."
    },
    campaign_outcome: {
      type: SchemaType.STRING,
      description: "Una breve descripción del desenlace final de la campaña (solo si game_status es 'finished'; de lo contrario, puede ser un string vacío)."
    },
    roll_attribute: {
      type: SchemaType.STRING,
      description: "Si dice_roll_used es true, indica cuál característica o atributo del jugador se usó para evaluar la tirada (ej: 'fuerza', 'destreza', 'magia', 'carisma', 'inteligencia'). De lo contrario, dejar vacío."
    }
  },
  required: [
    "gm_message",
    "next_player_id",
    "next_dice_type",
    "dice_roll_used",
    "next_turn_mode",
    "updated_players",
    "is_critical_moment",
    "image_prompt",
    "updated_gm_context",
    "game_status",
    "campaign_outcome"
  ]
};

export async function POST(request) {
  try {
    const { roomId, playerId, actionText, clientRoll, clientMessageId } = await request.json();

    if (!roomId || !playerId || !actionText) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos (roomId, playerId, actionText).' },
        { status: 400 }
      );
    }

    // 1. Resolve Room by UUID or code
    const isUuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(roomId);
    let roomQuery = supabase.from('rooms').select('*');
    if (isUuid) {
      roomQuery = roomQuery.eq('id', roomId);
    } else {
      roomQuery = roomQuery.eq('code', roomId.toUpperCase());
    }

    const { data: room, error: roomError } = await roomQuery.maybeSingle();
    if (roomError || !room) throw new Error('No se encontró la sala de juego.');

    const roomUuid = room.id;

    // Fetch Active Player and Room Players List
    const [playerRes, allPlayersRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', playerId).maybeSingle(),
      supabase.from('players').select('*').eq('room_id', roomUuid).order('join_order', { ascending: true })
    ]);

    if (playerRes.error || !playerRes.data) throw new Error('No se encontró el aventurero.');
    if (allPlayersRes.error || !allPlayersRes.data) throw new Error('No se pudieron obtener los aventureros.');

    const player = playerRes.data;
    const allPlayers = allPlayersRes.data;

    // Decrement sleeping rounds for any player who is sleeping
    for (const p of allPlayers) {
      const stats = p.stats || {};
      if (stats.sleeping_rounds && stats.sleeping_rounds > 0) {
        const newRounds = stats.sleeping_rounds - 1;
        const updatedStats = {
          ...stats,
          sleeping_rounds: newRounds
        };
        if (newRounds === 0) {
          // Woke up! Restore HP and MP
          updatedStats.HP = p.salud ?? 100;
          updatedStats.MP = stats.MaxMP ?? (p.magia ?? 10);
          
          // Insert system message about waking up
          await supabase.from('messages').insert([
            {
              room_id: roomUuid,
              sender_type: 'system',
              content: `💤 ¡${p.name} se ha despertado totalmente recuperado (Vida: ${updatedStats.HP} HP, Magia: ${updatedStats.MP} PM)!`
            }
          ]);
        }
        
        // Save to database
        await supabase
          .from('players')
          .update({ stats: updatedStats })
          .eq('id', p.id);
        
        // Update local copies
        p.stats = updatedStats;
        if (p.id === player.id) {
          player.stats = updatedStats;
        }
      }
    }

    // Backend turn enforcer guard (only when in ordered mode!)
    if (room.turn_mode === 'ordered' && room.active_player_id !== playerId) {
      return NextResponse.json({ error: 'No es tu turno de juego.' }, { status: 403 });
    }

    // 2. Compute Pre-generated Dice Roll (use clientRoll if provided)
    const diceType = room.current_dice_type || 'D20';
    const maxRoll = parseInt(diceType.replace('D', ''), 10) || 20;
    const roll = clientRoll !== undefined && clientRoll !== null 
      ? clientRoll 
      : (Math.floor(Math.random() * maxRoll) + 1);

    // 3. Fetch last 15 messages for conversational history
    const { data: recentMsgs, error: fetchMsgsErr } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomUuid)
      .order('created_at', { ascending: false })
      .limit(15);

    if (fetchMsgsErr) throw fetchMsgsErr;
    const chronologicalMsgs = (recentMsgs || []).reverse();

    // 6. Build prompts for Gemini
    const playerListText = allPlayers
      .map(
        (p) => {
          const hasMagic = ['Mago', 'Clérigo', 'Bardo'].includes(p.class) || (p.magia ?? 10) >= 12;
          const eligibleSpells = hasMagic
            ? SPELL_LIBRARY.filter(s => s.tier <= (p.stats?.Level ?? 1)).map(s => s.name)
            : [];
          return `- ID: "${p.id}", Nombre: "${p.name}", Raza: "${p.race}", Clase: "${p.class}", HP: ${p.stats?.HP ?? 100}/${p.salud ?? 100}, PM: ${p.stats?.MP ?? 0}/${p.stats?.MaxMP ?? (p.magia ?? 10)}, Nivel: ${p.stats?.Level ?? 1}, XP: ${p.stats?.XP ?? 0}, Fuerza: ${p.fuerza ?? 10}, Destreza: ${p.destreza ?? 10}, Magia: ${p.magia ?? 10}, Carisma: ${p.carisma ?? 10}, Inteligencia: ${p.inteligencia ?? 10}, Habilidades: [${(p.skills || []).join(', ')}], Conjuros Disponibles: [${eligibleSpells.join(', ')}], Orden de unión: ${p.join_order}`;
        }
      )
      .join('\n');

    const recentMessagesText = chronologicalMsgs
      .map((m) => {
        const sender =
          m.sender_type === 'player'
            ? allPlayers.find((p) => p.id === m.player_id)?.name || 'Jugador'
            : m.sender_type === 'gm'
              ? 'Game Master'
              : 'Sistema';
        return `[${sender}]: ${m.content} ${m.dice_roll ? `(Dados: ${m.dice_roll})` : ''}`;
      })
      .join('\n');

    const prompt = `
NOMBRE DE LA CAMPAÑA:
${room.name || 'Campaña sin nombre'}

DESCRIPCIÓN GLOBAL DE LA CAMPAÑA (TRASFONDO):
${room.description || 'No se ha provisto un trasfondo específico. Mazmorra medieval estándar.'}
(Nota para el GM: Esta descripción global sirve de guía general para la trama, pero eres libre de introducir giros argumentales, sorpresas o adiciones secretas).

MODO DE TURNOS ACTUAL:
${room.turn_mode || 'free'}
(Nota para el GM: Si el modo actual es 'free', los aventureros juegan de manera libre sin orden estricto de turnos. Si el modo es 'ordered', juegan estrictamente en turnos ordenados. Evalúa si la nueva acción merece iniciar un combate o secuencia de peligro para cambiar a 'ordered', o si la situación se ha calmado para volver a 'free').

HISTORIAL DE MEMORIA DEL NARRADOR (GM CONTEXT):
${room.gm_context || 'Inicio del viaje a las puertas de la mazmorra ancestral.'}

AVENTUREROS ACTIVOS EN EL GRUPO:
${playerListText}

HISTORIAL DE ACCIONES RECIENTES:
${recentMessagesText}

NUEVA ACCIÓN A EVALUAR:
Jugador Activo: "${player.name}" (Clase: ${player.class}, Raza: ${player.race})
Acción declarada: "${actionText}"
Resultado del tiro de dado en caso de ser necesario (${diceType}): sacó un ${roll} de un máximo de ${maxRoll}.

INSTRUCCIONES PARA TU RESPUESTA:
1. Actúa como el Game Master (GM). Evalúa si la acción declarada por el jugador requiere una tirada de dados para resolverse (ej: atacar, forzar cerraduras, esquivar trampas o escalar rocas requieren tirada de dados; mientras que hablar con otros, mirar a su alrededor, caminar por pasillos vacíos o esperar de pie NO requieren tiradas de dados).
   - Establece "dice_roll_used" en true si la tirada de dado es requerida para este desenlace. En este caso, evalúa el tiro provisto (${roll} de ${maxRoll}) para narrar el resultado en "gm_message". Además, en el campo "roll_attribute", especifica obligatoriamente sobre qué atributo/característica se basa la tirada (ej: "fuerza", "destreza", "inteligencia", "carisma", "magia").
   - Establece "dice_roll_used" en false si no se requiere tirada de dados. Narra el desenlace directamente sin penalizar/beneficiar según el número del dado. Dejar "roll_attribute" vacío o nulo en este caso.
   - En ambos casos, escribe el resultado en "gm_message" de forma narrativa, descriptiva y envolvente (aproximadamente entre 1 y 2 párrafos cortos, de 5 a 8 frases en total). Narra las consecuencias directas de la acción aportando atmósfera e inmersión, pero **SIEMPRE finaliza tu narración con un nuevo 'hilo del que tirar' (una pista, dilema, suceso inminente, obstáculo o pregunta abierta)** para dar dirección y momentum a los jugadores (ej: escuchas un murmullo detrás de la pared, ves una palanca cubierta de polvo, el enemigo herido retrocede buscando huir, o el aire empieza a enfriarse repentinamente). Evita dejar la escena estática o vacía para que el jugador no tenga que inventarse la trama para avanzar.
2. Determina el modo de turnos para el siguiente ciclo de juego en "next_turn_mode" ('free' o 'ordered'). Si se inicia un combate o un evento de riesgo inmediato que requiera turnos estrictos, cámbialo a 'ordered'. Si la situación está en calma o la lucha terminó, déjalo o regrésalo a 'free'.
3. Rotación de Turno ("next_player_id"):
   - Si "next_turn_mode" es "ordered", selecciona el ID del jugador al que le toca actuar en la rotación según join_order.
   - Si "next_turn_mode" es "free", establece "next_player_id" como un string vacío "".
4. Modificaciones de HP/XP y Estado de Sueño:
   - Modifica las estadísticas en "updated_players" cuando sea necesario. Si falló gravemente en una acción peligrosa, resta HP de manera justa. Otorga XP por progresos y buenas ideas.
   - REGLAS DE SUEÑO/DESCANSO: Si el jugador activo declara que intenta dormir/descansar:
     * Esta acción NUNCA requiere tirada de dados. Debes establecer obligatoriamente "dice_roll_used" en false.
     * Evalúa las circunstancias ambientales o el entorno. Si el lugar o la situación hacen que sea imposible dormir (ej: combate activo, monstruos atacando, trampas disparando, clima extremo sin refugio, o ruido ensordecedor), niégalo narrativamente en "gm_message" y NO agregues "sleeping_rounds" (o déjalo en 0) en la respuesta.
     * Si las circunstancias permiten descansar (la zona está tranquila o asegurada, no hay enemigos activos), apruébalo narrando cómo cae dormido y agregando al jugador en "updated_players" con "sleeping_rounds" establecido en 2.
5. Ilustración Escénica (Extremadamente selectiva):
   - Sé muy restrictivo al generar ilustraciones. Establece "is_critical_moment" en true ÚNICAMENTE cuando ocurra un evento crítico, dramático o memorable de gran impacto en la historia (ej: derrotar a un jefe principal, encontrar un artefacto legendario, la caída o desmayo de un aventurero, una emboscada masiva, o un giro narrativo mayor).
   - Para acciones ordinarias (abrir puertas normales, combates contra monstruos menores, descansar, hablar, observar salas), debes dejar obligatoriamente "is_critical_moment" en false y no proveer "image_prompt".
6. Contexto de Memoria:
   - Modifica y extiende la bitácora "updated_gm_context" en tu respuesta. Este campo es tu diario persistente de la campaña y recopila la historia entera. No olvides los sucesos de turnos anteriores; al contrario, resume brevemente la resolución de la acción de este turno y agrégala al final de la bitácora acumulada, preservando todos los hechos memorables e importantes que han ocurrido en la campaña para asegurar la coherencia del mundo en futuros turnos.
`;

    // Initialize Gemini Client
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('API Key de Gemini ausente del servidor.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });

    const systemInstruction = `Eres un Game Master y Narrador de fantasía medieval para un juego de rol de mesa interactivo. Escribes en español. Narra de forma envolvente, inmersiva y natural (aproximadamente 1 o 2 párrafos cortos, de 5 a 8 frases en total), dando buena atmósfera a tus descripciones sin ser redundante. Concéntrate en la consecuencia de la acción y en mantener dinámico el juego. Siempre finaliza tu narración con un nuevo 'hilo del que tirar' (un misterio, suceso inminente, pista, obstáculo o pregunta abierta) para guiar y dar dirección a los jugadores, evitando que tengan que inventarse la historia ellos mismos. Debes seguir fielmente el esquema JSON y evaluar el tiro de dados para describir las consecuencias lógicas de las acciones. Sé extremadamente restrictivo con las ilustraciones: solo pon is_critical_moment en true en momentos épicos, trágicos o hitos de gran importancia. Para acciones normales del día a día o combates menores, no generes ilustraciones.`;

    console.log('--- GEMINI ACTION ROUTE PROMPT ---');
    console.log(prompt);
    console.log('----------------------------------');

    const result = await model.generateContent({
      systemInstruction: systemInstruction,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const textResult = result.response.text();
    const gmResponse = JSON.parse(textResult);

    // 7. Write Game Master responses and updates to Supabase
    // A. Handle Image Generation if it's a critical moment
    let finalImageUrl = null;
    if (gmResponse.is_critical_moment) {
      const seed = Math.floor(Math.random() * 1000000);
      const encodedPrompt = encodeURIComponent(gmResponse.image_prompt);
      finalImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true&seed=${seed}`;
    }

    // B. Insert or update Player Action message into message logs
    if (clientMessageId) {
      if (!gmResponse.dice_roll_used) {
        // If GM did not use the roll, clear it from the client-inserted message
        await supabase
          .from('messages')
          .update({ dice_roll: null })
          .eq('id', clientMessageId);
      }
    } else {
      const { error: msgErr1 } = await supabase.from('messages').insert([
        {
          room_id: roomUuid,
          sender_type: 'player',
          player_id: playerId,
          message_type: 'action',
          content: actionText,
          dice_roll: gmResponse.dice_roll_used ? roll : null
        }
      ]);
      if (msgErr1) throw msgErr1;
    }

    // C. If dice roll was used, insert system log of the roll
    if (gmResponse.dice_roll_used) {
      const rollAttr = gmResponse.roll_attribute || 'característica';
      const { error: msgErr2 } = await supabase.from('messages').insert([
        {
          room_id: roomUuid,
          sender_type: 'system',
          content: `🎲 Tienes que tirar un dado de ${diceType} basado en tu ${rollAttr}. ${player.name} saca un ${roll}.`
        }
      ]);
      if (msgErr2) throw msgErr2;
    }

    // D. If the turn mode changed, insert system log indicating mode shift
    if (gmResponse.next_turn_mode !== room.turn_mode) {
      let modeText = '';
      if (gmResponse.next_turn_mode === 'ordered') {
        modeText = `⚔️ Modo de combate iniciado. Turnos ordenados activos.`;
      } else {
        modeText = `🕊️ Modo de exploración libre iniciado. Todos los aventureros pueden actuar libremente.`;
      }
      await supabase.from('messages').insert([
        {
          room_id: roomUuid,
          sender_type: 'system',
          content: modeText
        }
      ]);
    }

    // E. Insert GM Narrative Message
    const { error: gmMsgErr } = await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'gm',
        content: gmResponse.gm_message,
        image_url: finalImageUrl
      }
    ]);
    if (gmMsgErr) throw gmMsgErr;

    // F. Apply Player Stat Changes
    if (gmResponse.updated_players && gmResponse.updated_players.length > 0) {
      for (const up of gmResponse.updated_players) {
        // Fetch current player to merge default stats if missing
        const currentPlayerObj = allPlayers.find((p) => p.id === up.id);
        if (currentPlayerObj) {
          const mergedStats = {
            ...currentPlayerObj.stats,
            ...up.stats
          };
          // Clamp HP to prevent negative HP or overflow (e.g. 0 to 100)
          mergedStats.HP = Math.max(0, Math.min(100, mergedStats.HP));

          // Enforce auto-leveling based on XP
          const oldLevel = currentPlayerObj.stats?.Level ?? 1;
          const xp = mergedStats.XP ?? 0;
          const calculatedLevel = Math.max(1, Math.floor(xp / 1000) + 1);
          mergedStats.Level = calculatedLevel;

          await supabase
            .from('players')
            .update({ stats: mergedStats })
            .eq('id', up.id);

          if (calculatedLevel > oldLevel) {
            // Level up! Insert system log in the chat room
            await supabase.from('messages').insert([
              {
                room_id: roomUuid,
                sender_type: 'system',
                content: `🎉 ¡${currentPlayerObj.name} ha subido al Nivel ${calculatedLevel}! 🎉`
              }
            ]);
          }
        }
      }
    }

    // G. Update Room State (turn, turn_mode, context, dice type, status)
    const isFinished = gmResponse.game_status === 'finished';
    const roomUpdates = {
      gm_context: gmResponse.updated_gm_context || room.gm_context,
      current_dice_type: gmResponse.next_dice_type || 'D20',
      turn_mode: gmResponse.next_turn_mode || 'free'
    };

    if (roomUpdates.turn_mode === 'ordered') {
      // Validate next_player_id is in room and not sleeping
      let finalNextPlayerId = gmResponse.next_player_id;
      let nextPlayer = allPlayers.find((p) => p.id === finalNextPlayerId);
      
      if (!nextPlayer || (nextPlayer.stats?.sleeping_rounds ?? 0) > 0) {
        // Fallback or rotate to next awake and alive player
        const currentIdx = allPlayers.findIndex((p) => p.id === playerId);
        let found = false;
        for (let i = 1; i <= allPlayers.length; i++) {
          const candidate = allPlayers[(currentIdx + i) % allPlayers.length];
          const isCandSleeping = (candidate.stats?.sleeping_rounds ?? 0) > 0;
          const candidateHP = gmResponse.updated_players?.find((up) => up.id === candidate.id)?.stats?.HP ?? (candidate.stats?.HP ?? 100);
          if (!isCandSleeping && candidateHP > 0) {
            roomUpdates.active_player_id = candidate.id;
            found = true;
            break;
          }
        }
        if (!found) {
          roomUpdates.active_player_id = null; // No one is awake and alive!
        }
      } else {
        roomUpdates.active_player_id = finalNextPlayerId;
      }
    } else {
      // Free play mode: active player is null
      roomUpdates.active_player_id = null;
    }

    if (isFinished) {
      roomUpdates.status = 'finished';
      // Determine if defeat or victory based on surviving players
      const allDead = allPlayers.every((p) => {
        const updatedStats = gmResponse.updated_players?.find((up) => up.id === p.id)?.stats;
        const currentHP = updatedStats ? updatedStats.HP : (p.stats?.HP ?? 100);
        return currentHP <= 0;
      });
      if (allDead) {
        roomUpdates.defeat_condition = gmResponse.campaign_outcome || 'El grupo ha caído en batalla.';
      } else {
        roomUpdates.victory_condition = gmResponse.campaign_outcome || '¡Los aventureros han completado su gesta!';
      }
    }

    const { error: roomUpdateErr } = await supabase
      .from('rooms')
      .update(roomUpdates)
      .eq('id', roomUuid);

    if (roomUpdateErr) throw roomUpdateErr;

    return NextResponse.json({
      success: true,
      message: 'Turno procesado correctamente por el GM.',
      roll: roll,
      dice_roll_used: gmResponse.dice_roll_used
    });
  } catch (err) {
    console.error('Error en Action Handler Endpoint:', err);
    let errMsg = err.message || 'Error interno del servidor al procesar el turno.';
    if (errMsg.includes('turn_mode') || errMsg.includes('schema cache')) {
      errMsg = 'La columna "turn_mode" no existe en la tabla "rooms". Por favor, ejecuta las sentencias SQL de migration_v5.sql en tu consola de Supabase (SQL Editor).';
    }
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
