import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { supabase } from '../../../../lib/supabaseClient';

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
              XP: { type: SchemaType.INTEGER }
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
    const { roomId, playerId, actionText } = await request.json();

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

    // Backend turn enforcer guard (only when in ordered mode!)
    if (room.turn_mode === 'ordered' && room.active_player_id !== playerId) {
      return NextResponse.json({ error: 'No es tu turno de juego.' }, { status: 403 });
    }

    // 2. Compute Pre-generated Dice Roll
    const diceType = room.current_dice_type || 'D20';
    const maxRoll = parseInt(diceType.replace('D', ''), 10) || 20;
    const roll = Math.floor(Math.random() * maxRoll) + 1;

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
        (p) =>
          `- ID: "${p.id}", Nombre: "${p.name}", Raza: "${p.race}", Clase: "${p.class}", HP: ${p.stats?.HP ?? 100}/${p.salud ?? 100}, Nivel: ${p.stats?.Level ?? 1}, XP: ${p.stats?.XP ?? 0}, Fuerza: ${p.fuerza ?? 10}, Destreza: ${p.destreza ?? 10}, Magia: ${p.magia ?? 10}, Carisma: ${p.carisma ?? 10}, Inteligencia: ${p.inteligencia ?? 10}, Habilidades: [${(p.skills || []).join(', ')}], Conjuros Preparados: [${(p.stats?.spells || []).join(', ')}], Orden de unión: ${p.join_order}`
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
   - Establece "dice_roll_used" en true si la tirada de dado es requerida para este desenlace. En este caso, evalúa el tiro provisto (${roll} de ${maxRoll}) para narrar el resultado en "gm_message".
   - Establece "dice_roll_used" en false si no se requiere tirada de dados. Narra el desenlace directamente sin penalizar/beneficiar según el número del dado.
   - En ambos casos, escribe el resultado en "gm_message" de forma extremadamente breve, concisa y directa (máximo 2 o 3 frases cortas). Evita cualquier descripción detallada de personajes, el entorno, el brillo o glinto de las armas, o poses de combate. Ve directo a las consecuencias.
2. Determina el modo de turnos para el siguiente ciclo de juego en "next_turn_mode" ('free' o 'ordered'). Si se inicia un combate o un evento de riesgo inmediato que requiera turnos estrictos, cámbialo a 'ordered'. Si la situación está en calma o la lucha terminó, déjalo o regrésalo a 'free'.
3. Rotación de Turno ("next_player_id"):
   - Si "next_turn_mode" es "ordered", selecciona el ID del jugador al que le toca actuar en la rotación según join_order.
   - Si "next_turn_mode" es "free", establece "next_player_id" como un string vacío "".
4. Modificaciones de HP/XP:
   - Modifica las estadísticas en "updated_players" cuando sea necesario. Si falló gravemente en una acción peligrosa, resta HP de manera justa. Otorga XP por progresos y buenas ideas.
5. Ilustración Escénica:
   - Si ocurre algo memorable, genera un prompt descriptivo en inglés en "image_prompt" y activa "is_critical_moment".
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

    const systemInstruction = `Eres un Game Master y Narrador de fantasía medieval para un juego de rol de mesa interactivo. Escribes en español. Sé extremadamente breve, directo y conciso en tus respuestas (máximo 2 o 3 frases cortas por narración). Evita descripciones largas, poéticas o floridas de personajes, objetos, armas o el entorno. Concéntrate en la consecuencia de la acción y en mantener dinámico el juego. Debes seguir fielmente el esquema JSON y evaluar el tiro de dados para describir las consecuencias lógicas de las acciones.`;

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

    // B. Insert Player Action message into message logs
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

    // C. If dice roll was used, insert system log of the roll
    if (gmResponse.dice_roll_used) {
      const { error: msgErr2 } = await supabase.from('messages').insert([
        {
          room_id: roomUuid,
          sender_type: 'system',
          content: `🎲 ${player.name} lanza un ${diceType} sacando un ${roll} para realizar su acción.`
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
      // Validate next_player_id is in room
      let finalNextPlayerId = gmResponse.next_player_id;
      const isValidId = allPlayers.some((p) => p.id === finalNextPlayerId);
      if (!isValidId) {
        // Fallback to sequential join order
        const currentIdx = allPlayers.findIndex((p) => p.id === playerId);
        const fallbackPlayer = allPlayers[(currentIdx + 1) % allPlayers.length];
        roomUpdates.active_player_id = fallbackPlayer.id;
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

    return NextResponse.json({ success: true, message: 'Turno procesado correctamente por el GM.' });
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
