import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { supabase } from '../../../../lib/supabaseClient';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    welcome_message: {
      type: SchemaType.STRING,
      description: "La narración inicial en español introduciendo el encuentro de los aventureros como desconocidos que se ven por primera vez a las puertas de la mazmorra."
    },
    initial_context: {
      type: SchemaType.STRING,
      description: "La bitácora o crónica inicial de la campaña (Quest status inicial, llegada a las puertas y estado del grupo). Servirá de base acumulativa para registrar toda la historia de la campaña."
    }
  },
  required: ["welcome_message", "initial_context"]
};

export async function POST(request) {
  try {
    const { roomId, userId } = await request.json();

    if (!roomId) {
      return NextResponse.json({ error: 'Falta el parámetro roomId.' }, { status: 400 });
    }

    // 1. Resolve room by UUID or code
    const isUuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(roomId);
    let roomQuery = supabase.from('rooms').select('*');
    if (isUuid) {
      roomQuery = roomQuery.eq('id', roomId);
    } else {
      roomQuery = roomQuery.eq('code', roomId.toUpperCase());
    }

    const { data: room, error: roomError } = await roomQuery.maybeSingle();
    if (roomError || !room) throw new Error('No se encontró la sala de juego.');

    // Enforce campaign creator validation
    if (room.creator_id && room.creator_id !== userId) {
      return NextResponse.json(
        { error: 'Solo el creador de la campaña puede iniciar la campaña.' },
        { status: 403 }
      );
    }

    const roomUuid = room.id;

    // 2. Fetch all registered players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomUuid)
      .order('join_order', { ascending: true });

    if (playersError || !players || players.length === 0) {
      throw new Error('No hay aventureros registrados en esta sala.');
    }

    const firstPlayer = players[0];

    // 3. Construct Gemini Prompt detailing the "strangers meeting" context
    const playerListText = players
      .map(
        (p) =>
          `- ${p.name} (Raza: ${p.race}, Clase: ${p.class}, Fuerza: ${p.fuerza ?? 10}, Destreza: ${p.destreza ?? 10}, Magia: ${p.magia ?? 10}, Salud: ${p.salud ?? 10}, Carisma: ${p.carisma ?? 10}, Inteligencia: ${p.inteligencia ?? 10}, Habilidades: [${(p.skills || []).join(', ')}]). Trasfondo: ${p.description || 'Un guerrero misterioso.'}`
      )
      .join('\n');

    const prompt = `
Estás iniciando una nueva campaña de juego de rol de mesa.

NOMBRE DE LA CAMPAÑA:
${room.name || 'Campaña sin nombre'}

TRASFONDO / DESCRIPCIÓN GLOBAL DE LA CAMPAÑA:
${room.description || 'No se ha provisto un trasfondo específico. Diseña una mazmorra de fantasía medieval estándar.'}
(Nota para el GM: Esta descripción global sirve de guía general para la trama de la campaña, pero eres libre de introducir giros argumentales, sorpresas o adiciones secretas más adelante).

AVENTUREROS REGISTRADOS EN ESTA CAMPAÑA:
${playerListText}

REGLAS CRÍTICAS PARA LA NARRACIÓN DE APERTURA:
1. Escribe una introducción breve pero que enganche inmediatamente a los jugadores.
2. Termina llamando al grupo a la acción y cediendo la palabra a los jugadores.
3. Devuelve un JSON que contenga:
   - "welcome_message": La narración literaria detallada.
   - "initial_context": El registro inicial de la bitácora de la campaña, estableciendo las bases del quest, el grupo reunido en modo libre y el trasfondo inicial de la campaña para las futuras anexiones de memoria.
`;

    // 4. Invoke Gemini API
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

    const systemInstruction = `Eres un Game Master y Narrador de fantasía de alta calidad. Escribes en español con prosa descriptiva e inmersiva. Sigues al pie de la letra el formato JSON y la consigna de que los jugadores se conocen por primera vez.`;

    console.log('--- GEMINI START ROUTE PROMPT ---');
    console.log(prompt);
    console.log('---------------------------------');

    const result = await model.generateContent({
      systemInstruction: systemInstruction,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const textResult = result.response.text();
    const gmResponse = JSON.parse(textResult);

    // 5. Update Room to active state
    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({
        status: 'playing',
        turn_mode: 'free',
        active_player_id: null,
        gm_context: gmResponse.initial_context
      })
      .eq('id', roomUuid);

    if (roomUpdateError) throw roomUpdateError;

    // 6. Insert System start message
    await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'system',
        content: `⚔️ ¡La campaña ha comenzado! La exploración está abierta para todos los aventureros en modo libre.`
      }
    ]);

    // 7. Insert GM welcome message
    await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'gm',
        content: gmResponse.welcome_message
      }
    ]);

    return NextResponse.json({ success: true, message: 'La campaña ha comenzado exitosamente.' });
  } catch (err) {
    console.error('Error al iniciar campaña:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al inicializar la campaña.' },
      { status: 500 }
    );
  }
}
