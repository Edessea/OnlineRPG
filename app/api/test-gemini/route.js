import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'GEMINI_API_KEY is not defined in environment variables.' },
      { status: 400 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the standard and fast 'gemini-2.5-flash' model for testing connection
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Say "Handshake OK".' }] }],
    });
    
    const responseText = result.response.text().trim();

    return NextResponse.json({
      success: true,
      message: 'Gemini API handshake successful.',
      response: responseText,
    });
  } catch (error) {
    console.error('Gemini API Handshake Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gemini API call failed.' },
      { status: 500 }
    );
  }
}
