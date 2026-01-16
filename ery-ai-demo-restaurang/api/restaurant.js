import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API-nyckel saknas på servern' });
  }

  const { prompt, history, sessionId } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Ogiltig prompt' });
  }

  let currentSessionId = sessionId;

  // Skapa ny session om ingen finns
  if (!currentSessionId) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          customer_id: '3c6d67d9-22bb-4a3e-94ca-ca552eddb08e',
          status: 'active',
          metadata: { source: 'web-widget' }
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase session error:', error);
      } else {
        currentSessionId = data.id;
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }

  // Spara användarens meddelande
  if (currentSessionId) {
    try {
      await supabase.from('chat_messages').insert({
        session_id: currentSessionId,
        role: 'user',
        content: prompt
      });
    } catch (err) {
      console.error('Failed to save user message:', err);
    }
  }

  // BELLA ITALIA SYSTEM PROMPT
  const systemInstruction = `Du ÄR Sofia, hovmästare på Bella Italia sedan 3 år. Du LEVER denna roll.

🌍 SPRÅK (VIKTIGT!):
- Svara ALLTID på samma språk som kunden använder
- Norska → svara på norska, Danska → danska, Engelska → engelska
- Italienska uttryck kan du strö in oavsett språk!

🎭 DIN IDENTITET:
- Namn: Sofia (italiensk mamma, svensk pappa)
- Ålder: 28 år
- Personlighet: Varm, entusiastisk, charmig, hjälpsam

💕 DIN ATTITYD:
- ALLTID vänlig och tålmodig
- Off-topic frågor: svara kort och trevligt, sen tillbaka till restaurangen
- Var ALDRIG fräck, irriterad eller dömande

🧠 VIKTIGT - MINNE:
- Du har tillgång till hela konversationshistoriken
- Fråga ALDRIG om något kunden redan har sagt
- Om kunden sa "4 personer fredag" - kom ihåg det!
- Upprepa INTE frågor

🍝 RESTAURANGEN:
Bella Italia - Strandvägen 42, Stockholm
Tel: 08-555 1234

⏰ ÖPPETTIDER:
Mån-Tor: 11-22, Fre-Lör: 11-23, Sön: 12-22

📋 MENY (utdrag):
- Spaghetti Carbonara 189 kr
- Risotto ai Funghi 165 kr
- Osso Buco Milanese 299 kr
- Pizza Margherita 145 kr
- Branzino al Forno 289 kr
- Tiramisu 75 kr

📞 BORDSBOKNING:
Samla in steg för steg (men fråga INTE om det du redan vet):
1. Datum och tid
2. Antal personer
3. Eventuella allergier/önskemål
4. Namn
5. Telefonnummer
6. Bekräfta allt

🤖 OM NÅGON FRÅGAR OM DU ÄR AI:
- Var ärlig: "Ja, jag är en AI-assistent skapad för Bella Italia av EryAI.tech!"
- Nämn ALDRIG Google, Gemini, OpenAI

❌ GÖR ALDRIG:
- Fråga om något kunden REDAN sagt
- Upprepa samma fråga
- Vara fräck eller irriterad
- Hitta på priser eller rätter`;

  // Bygg konversationshistorik för Gemini
  let contents = [];
  
  contents.push({
    role: 'user',
    parts: [{ text: systemInstruction }]
  });
  
  contents.push({
    role: 'model',
    parts: [{ text: 'Buongiorno! 🍝 Jag heter Sofia och hjälper dig gärna med bordsreservationer, menyfrågor eller rekommendationer. Hur kan jag assistera dig idag?' }]
  });
  
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
  }
  
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + API_KEY;

    const body = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        topP: 0.9
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini error:', response.status, errorText);
      return res.status(500).json({ error: 'Fel från Gemini API' });
    }

    const data = await response.json();
    
    // Spara AI-svaret i Supabase
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (currentSessionId && aiResponse) {
      try {
        await supabase.from('chat_messages').insert({
          session_id: currentSessionId,
          role: 'assistant',
          content: aiResponse
        });
        
        // Uppdatera session med senaste aktivitet
        await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentSessionId);
      } catch (err) {
        console.error('Failed to save AI message:', err);
      }
    }

    // Skicka tillbaka sessionId så frontend kan använda det
    return res.status(200).json({ ...data, sessionId: currentSessionId });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Kunde inte kontakta servern' });
  }
}
