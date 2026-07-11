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
      description: "El resumen inicial de memoria y quest status de la campaña para la memoria futura del GM."
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
          `- ${p.name} (Raza: ${p.race}, Clase: ${p.class}). Trasfondo: ${p.description || 'Un guerrero misterioso.'}`
      )
      .join('\n');

    const prompt = `
Estás iniciando una nueva campaña de juego de rol de mesa.
Ubicación inicial: Frente a la pesada puerta de hierro fundido decorada con runas resplandecientes de una mazmorra ancestral ancestral, bajo un cielo morado místico.

NOMBRE DE LA CAMPAÑA:
${room.name || 'Campaña sin nombre'}

TRASFONDO / DESCRIPCIÓN GLOBAL DE LA CAMPAÑA:
${room.description || 'No se ha provisto un trasfondo específico. Diseña una mazmorra de fantasía medieval estándar.'}
(Nota para el GM: Esta descripción global sirve de guía general para la trama de la campaña, pero eres libre de introducir giros argumentales, sorpresas o adiciones secretas más adelante).

AVENTUREROS REGISTRADOS EN ESTA CAMPAÑA:
${playerListText}

REGLAS CRÍTICAS PARA LA NARRACIÓN DE APERTURA:
1. Escribe una introducción inmersiva de fantasía medieval en español.
2. IMPORTANTE: Los aventureros NO SE CONOCEN entre sí. Es la primera vez que se cruzan sus miradas. Narra cómo se encuentran en este helado y ventoso paraje, mirándose mutuamente con desconfianza, curiosidad o resignación. Explica cómo la necesidad, el destino o los rumores los han reunido ante este portal común.
3. Termina llamando al grupo a la acción y cediendo la palabra a los jugadores.
4. Devuelve un JSON que contenga:
   - "welcome_message": La narración literaria detallada.
   - "initial_context": Un resumen del estado inicial del quest, los jugadores presentes y su relación de extraños.
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
        active_player_id: firstPlayer.id,
        gm_context: gmResponse.initial_context
      })
      .eq('id', roomUuid);

    if (roomUpdateError) throw roomUpdateError;

    // 6. Insert System start message
    await supabase.from('messages').insert([
      {
        room_id: roomUuid,
        sender_type: 'system',
        content: `⚔️ ¡La campaña ha comenzado! El destino de la campaña está en juego. Es el turno de ${firstPlayer.name}.`
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
