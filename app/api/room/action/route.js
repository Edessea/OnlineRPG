import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { supabase } from '../../../../lib/supabaseClient';

// Enforce schema constraint on Gemini response
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    gm_message: {
      type: SchemaType.STRING,
      description: "La respuesta narrativa del Game Master en español, describiendo el resultado de la acción basándose en la tirada."
    },
    next_player_id: {
      type: SchemaType.STRING,
      description: "El ID del siguiente jugador en la secuencia de juego."
    },
    next_dice_type: {
      type: SchemaType.STRING,
      description: "El tipo de dado recomendado para el siguiente turno (ej: 'D20', 'D12', 'D10', 'D6', 'D4')."
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
      description: "El resumen de memoria actualizado y condensado de la campaña (Quest status, eventos clave, etc)."
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

    // Backend turn enforcer guard
    if (room.active_player_id !== playerId) {
      return NextResponse.json({ error: 'No es tu turno de juego.' }, { status: 403 });
    }

    // 2. Compute Dice Roll
    const diceType = room.current_dice_type || 'D20';
    const maxRoll = parseInt(diceType.replace('D', ''), 10) || 20;
    const roll = Math.floor(Math.random() * maxRoll) + 1;

    // 3. Write player action to message logs
    const { error: msgErr1 } = await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'player',
        player_id: playerId,
        message_type: 'action',
        content: actionText,
        dice_roll: roll
      }
    ]);
    if (msgErr1) throw msgErr1;

    // 4. Write system log announcement for the roll
    const { error: msgErr2 } = await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'system',
        content: `🎲 ${player.name} lanza un ${diceType} sacando un ${roll} para realizar su acción.`
      }
    ]);
    if (msgErr2) throw msgErr2;

    // 5. Fetch last 15 messages for conversational history
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
          `- ID: "${p.id}", Nombre: "${p.name}", Raza: "${p.race}", Clase: "${p.class}", HP: ${p.stats?.HP ?? 100}, Nivel: ${p.stats?.Level ?? 1}, XP: ${p.stats?.XP ?? 0}, Orden de unión: ${p.join_order}`
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

HISTORIAL DE MEMORIA DEL NARRADOR (GM CONTEXT):
${room.gm_context || 'Inicio del viaje a las puertas de la mazmorra ancestral.'}

AVENTUREROS ACTIVOS EN EL GRUPO:
${playerListText}

HISTORIAL DE ACCIONES RECIENTES:
${recentMessagesText}

NUEVA ACCIÓN A EVALUAR:
Jugador Activo: "${player.name}" (Clase: ${player.class}, Raza: ${player.race})
Acción declarada: "${actionText}"
Resultado del tiro de dado (${diceType}): sacó un ${roll} de un máximo de ${maxRoll}.

INSTRUCCIONES PARA TU RESPUESTA:
1. Actúa como el Game Master (GM) y narra el desenlace de la acción en "gm_message".
   - Sé inmersivo, usa una prosa de fantasía de alta calidad en español.
   - Evalúa el éxito o fracaso basándote directamente en el tiro de dados (20 es éxito legendario, 1 es catástrofe rotunda, < 10 es fallo o complicación severa, >= 10 es un éxito moderado o completo).
2. Modificaciones de HP/XP:
   - Si la acción falló o era peligrosa, resta HP de manera justa al jugador en "updated_players" (ej: -10 HP o -15 HP).
   - Si el jugador hizo una gran hazaña o avanzó, otorga XP (ej: +20 XP).
   - Si un jugador alcanza 100 XP o múltiplos, aumenta su Level en 1 y reinicia el XP restante.
   - Deberás devolver las estadísticas completas de los jugadores modificados.
3. Rotación de Turno:
   - Determina a quién le toca ir ahora. Asigna su ID exacto a "next_player_id".
   - Para mantener el orden, rota secuencialmente según el 'Orden de unión' (join_order). El jugador actual tiene join_order = ${player.join_order}. El siguiente debe ser el que tenga join_order = ${(player.join_order + 1) % allPlayers.length}.
   - IDs válidos de aventureros disponibles: ${allPlayers.map((p) => `"${p.id}" (${p.name})`).join(', ')}.
4. Próxima Tirada:
   - Establece el tipo de dado para la siguiente acción del próximo jugador en "next_dice_type" (ej: "D20" por defecto, o dados menores como "D10", "D8", "D6" si están en una situación apremiante o combate cerrado).
5. Ilustración Escénica:
   - Si ocurre algo épico, cómico o un giro dramático, pon "is_critical_moment" en true y genera un prompt descriptivo en inglés para Midjourney/DallE en "image_prompt".
6. Estado de la Campaña:
   - Evalúa si la campaña ha terminado. Establece "game_status" en "finished" si todos los aventureros han muerto (HP = 0) o si han completado con éxito su misión (victoria). De lo contrario, debe ser "playing".
   - Si declaras "finished", describe la victoria o derrota final brevemente en "campaign_outcome" (ej: "Los aventureros perecieron ante el fuego del dragón" o "Los héroes recuperaron la gema y salvaron el reino"). De lo contrario, pon un string vacío.
7. Contexto de Memoria:
   - Modifica el "updated_gm_context" resumiendo el estado actual de la campaña y hechos críticos para recordar en turnos posteriores.
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

    const systemInstruction = `Eres un Game Master y Narrador de fantasía medieval para un juego de rol de mesa interactivo. Tu prosa es rica, cautivadora y descriptiva. Debes seguir fielmente el esquema JSON y evaluar el tiro de dados para describir las consecuencias lógicas de las acciones en español.`;

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

    // B. Insert GM Narrative Message
    const { error: gmMsgErr } = await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'gm',
        content: gmResponse.gm_message,
        image_url: finalImageUrl
      }
    ]);
    if (gmMsgErr) throw gmMsgErr;

    // C. Apply Player Stat Changes
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

          await supabase
            .from('players')
            .update({ stats: mergedStats })
            .eq('id', up.id);
        }
      }
    }

    // D. Update Room State (turn, context, dice type, status)
    // Validate next_player_id is in room
    let finalNextPlayerId = gmResponse.next_player_id;
    const isValidId = allPlayers.some((p) => p.id === finalNextPlayerId);
    if (!isValidId) {
      // Fallback to sequential join order
      const currentIdx = allPlayers.findIndex((p) => p.id === playerId);
      const fallbackPlayer = allPlayers[(currentIdx + 1) % allPlayers.length];
      finalNextPlayerId = fallbackPlayer.id;
    }

    const isFinished = gmResponse.game_status === 'finished';
    const roomUpdates = {
      gm_context: gmResponse.updated_gm_context || room.gm_context,
      active_player_id: finalNextPlayerId,
      current_dice_type: gmResponse.next_dice_type || 'D20'
    };

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
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al procesar el turno.' },
      { status: 500 }
    );
  }
}
