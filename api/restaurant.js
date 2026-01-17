import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Bella Italia customer ID
const BELLA_ITALIA_ID = '3c6d67d9-22bb-4a3e-94ca-ca552eddb08e';

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
          customer_id: BELLA_ITALIA_ID,
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
        content: prompt,
        sender_type: 'user'
      });
    } catch (err) {
      console.error('Failed to save user message:', err);
    }
  }

  // BELLA ITALIA SYSTEM PROMPT - UPPDATERAD MED HANDOFF-INSTRUKTIONER
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

📞 BORDSBOKNING - SAMLA IN STEG FÖR STEG:
1. Datum och tid
2. Antal personer
3. Eventuella allergier/önskemål
4. Namn
5. Telefonnummer eller email (för bekräftelse)
6. Sammanfatta och säg att RESTAURANGEN ÅTERKOMMER med bekräftelse

⚠️ VIKTIGT OM BOKNINGAR:
- Du kan INTE bekräfta bokningar själv
- Säg ALDRIG "din bokning är bekräftad" eller "bordet är reserverat"
- Säg istället: "Tack! Jag har skickat din förfrågan till restaurangen. Du kommer få en bekräftelse via email/sms inom kort."
- Du tar endast EMOT bokningsförfrågningar - personalen bekräftar
- Gästen måste INVÄNTA bekräftelse innan bokningen är giltig
- Förtydliga att bordet INTE är reserverat förrän restaurangen bekräftat

🔄 HANDOFF TILL PERSONAL (SUPER VIKTIGT!):
Om gästen:
- Explicit ber att prata med personal/människa/chef
- Har en fråga du INTE kan svara på (kosher, halal, specifika allergier, privata event, catering, etc)
- Uttrycker missnöje eller klagomål

Då ska du säga EXAKT detta (anpassa till situationen):
"Absolut! Jag kopplar dig till personalen nu. Dröj kvar i chatten så svarar de så snart de kan! 😊 Om du behöver gå innan dess, lämna gärna din email så skickar vi en notis när svaret finns."

VIKTIGT:
- Säg att de ska DRÖJA KVAR - personal kommer svara i chatten
- Erbjud email-notis om de behöver lämna
- Säg ALDRIG bara "ring oss" - erbjud ALLTID att koppla till personal i chatten
- Var tydlig med att ett RIKTIGT svar kommer från en människa

🤖 OM NÅGON FRÅGAR OM DU ÄR AI:
- Var ärlig: "Ja, jag är en AI-assistent skapad för Bella Italia av EryAI.tech!"
- Nämn ALDRIG Google, Gemini, OpenAI
- Erbjud ALLTID att koppla till personal: "Men om du hellre vill prata med en riktig person kan jag koppla dig direkt - dröj bara kvar i chatten!"

❌ GÖR ALDRIG:
- Fråga om något kunden REDAN sagt
- Upprepa samma fråga
- Vara fräck eller irriterad
- Hitta på priser eller rätter
- Använda markdown (**, ##, numrerade listor)
- Svara som en robot med punktlistor
- Vara formell eller stel
- Bara säga "ring oss" när du inte kan svara - erbjud alltid att skicka vidare!

✨ SKRIV NATURLIGT:
- Skriv som i en vanlig konversation
- Inga punktlistor eller numrerade listor
- Ingen bold/fetstil eller formatering
- Ställ EN fråga i taget, inte alla på en gång
- Var personlig och avslappnad`;

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
        maxOutputTokens: 500,
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
    let aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Spara AI-svaret i Supabase
    if (currentSessionId && aiResponse) {
      try {
        await supabase.from('chat_messages').insert({
          session_id: currentSessionId,
          role: 'assistant',
          content: aiResponse,
          sender_type: 'ai'
        });
        
        // Uppdatera session
        await supabase
          .from('chat_sessions')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSessionId);
      } catch (err) {
        console.error('Failed to save AI message:', err);
      }
    }

    // FÖRBÄTTRAD TRIGGER-LOGIK
    // Analysera konversationen om NÅGOT av följande är sant
    const fullConversation = [
      ...(history || []),
      { role: 'user', content: prompt },
      { role: 'assistant', content: aiResponse }
    ];
    
    if (currentSessionId && fullConversation.length >= 2) {
      // Kolla ALLA meddelanden, inte bara de senaste
      const allMessages = fullConversation.map(m => m.content).join(' ').toLowerCase();
      const recentMessages = fullConversation.slice(-4).map(m => m.content).join(' ').toLowerCase();
      const userMessage = prompt.toLowerCase();
      
      // Kontaktinfo triggers
      const hasEmail = /@/.test(recentMessages);
      const hasPhone = /(\d{3,4}[\s-]?\d{2,3}[\s-]?\d{2,4}|\d{10,})/.test(recentMessages);
      
      // Klagomål triggers
      const hasComplaint = /(klagomål|missnöjd|dålig|besviken|arg|fel |problem|klaga|hemskt|fruktansvärt|skandal)/i.test(recentMessages);
      
      // EXPLICIT handoff request - gästen vill prata med människa
      const wantsHuman = /(prata med|tala med|personal|chef|människa|riktig person|mänsklig|kontakta er|nå er|höra av er|prata med någon|träffa|boka möte med)/i.test(userMessage);
      
      // Frågor som Sofia troligen inte kan svara på
      const specialRequests = /(kosher|halal|vegan|strikt|privat event|kalas|bröllop|svensexa|möhippa|firmafest|allergisk mot|intolerans|specialkost|catering|hyra lokal|stora sällskap|rullstol|tillgänglighet|parkering|present|julbord|påsk|nyår|gluten|laktos|nöt)/i.test(userMessage);
      
      // Sofias svar indikerar att hon inte kunde svara
      const sofiaUnsure = /(vet tyvärr inte|kan inte svara på|får du kontakta|rekommenderar att du ringer|bäst att fråga|inte säker på|får återkomma|har ingen information|kan tyvärr inte|ber om ursäkt men)/i.test(aiResponse);
      
      // Sofia erbjuder att skicka vidare (då ska vi vara redo att trigga handoff)
      const sofiaOffersHandoff = /(skickar vidare|skickar din fråga|personalen återkommer|personalen kontaktar|kan jag få din email|kan jag få ditt nummer)/i.test(aiResponse);

      // Kör analys om NÅGOT av dessa är sant
      const shouldAnalyze = hasEmail || hasPhone || hasComplaint || wantsHuman || specialRequests || sofiaUnsure || sofiaOffersHandoff;
      
      if (shouldAnalyze) {
        console.log('Trigger detected, running analysis:', { 
          hasEmail, hasPhone, hasComplaint, wantsHuman, specialRequests, sofiaUnsure, sofiaOffersHandoff 
        });
        await analyzeConversation(currentSessionId, fullConversation);
      }
    }

    return res.status(200).json({
      ...data,
      sessionId: currentSessionId
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Kunde inte kontakta servern' });
  }
}

// Analysera konversation för reservationer och frågor som behöver mänskligt svar
async function analyzeConversation(sessionId, conversationHistory, retryCount = 0) {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return;

    // Bygg konversationstext
    const conversationText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Gäst' : 'Sofia'}: ${msg.content}`)
      .join('\n');

    // FÖRBÄTTRAD analysisprompt
    const analysisPrompt = `Analysera denna restaurangkonversation noggrant:

${conversationText}

Avgör följande:

1. KOMPLETT RESERVATION: Har gästen gett ALL info för en bokning?
   - Krävs: datum + tid + antal personer + namn + (email ELLER telefon)
   - Om ALLT finns = reservation_complete: true

2. BEHÖVER MÄNSKLIGT SVAR: Ska personalen kontaktas? Sant om:
   - Gästen explicit ber att prata med personal/människa/chef
   - Gästen har en fråga Sofia inte kunde svara på (kosher, halal, allergier, privata event, etc)
   - Sofia sa "vet inte", "kan inte svara", "kontakta restaurangen" eller liknande
   - Gästen verkar frustrerad eller missnöjd

3. KLAGOMÅL: Uttrycker gästen missnöje?

4. GÄSTINFO: Extrahera all kontaktinfo som nämnts (även om bokningen inte är komplett)

Svara ENDAST med JSON (ingen annan text):
{
  "reservation_complete": true/false,
  "needs_human_response": true/false,
  "needs_human_reason": "specifik anledning eller null",
  "is_complaint": true/false,
  "guest_name": "namn eller null",
  "guest_email": "email eller null", 
  "guest_phone": "telefon eller null",
  "reservation_date": "datum/veckodag eller null",
  "reservation_time": "tid eller null",
  "party_size": antal eller null,
  "special_requests": "allergier/önskemål eller null",
  "unanswered_question": "fråga Sofia inte kunde svara på, eller null"
}`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    );

    // Hantera rate limit med retry
    if (response.status === 429) {
      if (retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`Rate limited, retrying in ${waitTime}ms (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return analyzeConversation(sessionId, conversationHistory, retryCount + 1);
      } else {
        console.error('Analysis failed after 3 retries due to rate limiting');
        return;
      }
    }

    if (!response.ok) {
      console.error('Analysis API error:', response.status);
      return;
    }

    const analysisData = await response.json();
    const analysisText = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON från svaret
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in analysis');
      return;
    }

    const analysis = JSON.parse(jsonMatch[0]);
    console.log('Conversation analysis:', analysis);

    // Uppdatera session med gästinfo om vi har det
    if (analysis.guest_name || analysis.guest_email || analysis.guest_phone) {
      await updateSessionWithGuestInfo(sessionId, analysis);
    }

    // Hantera komplett reservation
    if (analysis.reservation_complete && analysis.guest_name && (analysis.guest_email || analysis.guest_phone)) {
      await handleCompleteReservation(sessionId, analysis);
    }
    // Hantera frågor som behöver mänskligt svar (ÄVEN utan kontaktinfo!)
    else if (analysis.needs_human_response || analysis.is_complaint) {
      await handleNeedsHumanResponse(sessionId, analysis);
    }

  } catch (err) {
    console.error('Conversation analysis error:', err);
  }
}

// Uppdatera session med gästinfo så det syns i dashboarden
async function updateSessionWithGuestInfo(sessionId, analysis) {
  try {
    // Hämta befintlig metadata först
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single();

    const existingMetadata = existingSession?.metadata || {};

    const updateData = {
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        guest_name: analysis.guest_name || existingMetadata.guest_name,
        guest_email: analysis.guest_email || existingMetadata.guest_email,
        guest_phone: analysis.guest_phone || existingMetadata.guest_phone,
        source: 'web-widget'
      }
    };

    await supabase
      .from('chat_sessions')
      .update(updateData)
      .eq('id', sessionId);

    console.log('Session updated with guest info:', analysis.guest_name);
  } catch (err) {
    console.error('Failed to update session with guest info:', err);
  }
}

// Hantera komplett reservation
async function handleCompleteReservation(sessionId, analysis) {
  try {
    // Kolla om notification redan finns för denna session
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('session_id', sessionId)
      .eq('type', 'reservation')
      .single();

    if (existingNotif) {
      console.log('Reservation notification already exists for this session');
      return;
    }

    const guestContact = analysis.guest_email || analysis.guest_phone;
    const summary = `Reservation ${analysis.reservation_date} kl ${analysis.reservation_time}, ${analysis.party_size} pers${analysis.special_requests ? ', ' + analysis.special_requests : ''}`;
    
    // Skapa notification i databasen
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        customer_id: BELLA_ITALIA_ID,
        session_id: sessionId,
        type: 'reservation',
        priority: 'high',
        status: 'unread',
        summary: summary,
        guest_name: analysis.guest_name,
        guest_email: analysis.guest_email,
        guest_phone: analysis.guest_phone,
        reservation_details: {
          date: analysis.reservation_date,
          time: analysis.reservation_time,
          party_size: analysis.party_size,
          special_requests: analysis.special_requests
        }
      })
      .select()
      .single();

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      return;
    }

    // Markera session som needs_human
    await supabase
      .from('chat_sessions')
      .update({ needs_human: true })
      .eq('id', sessionId);

    console.log('Reservation notification created:', notification.id);

    // Skicka email till restaurangen
    await sendRestaurantNotificationEmail(sessionId, {
      type: 'reservation',
      guestName: analysis.guest_name,
      guestContact: guestContact,
      summary: summary,
      details: {
        date: analysis.reservation_date,
        time: analysis.reservation_time,
        partySize: analysis.party_size,
        specialRequests: analysis.special_requests
      }
    });

    // Skicka bekräftelsemail till gästen (om vi har email)
    if (analysis.guest_email) {
      await sendGuestConfirmationEmail(analysis.guest_email, {
        guestName: analysis.guest_name,
        date: analysis.reservation_date,
        time: analysis.reservation_time,
        partySize: analysis.party_size,
        specialRequests: analysis.special_requests
      });
    }

  } catch (err) {
    console.error('Error handling complete reservation:', err);
  }
}

// Hantera frågor som behöver mänskligt svar
async function handleNeedsHumanResponse(sessionId, analysis) {
  try {
    // Kolla om vi redan har en notification för denna session
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('session_id', sessionId)
      .in('type', ['question', 'complaint', 'handoff'])
      .single();

    if (existingNotif) {
      console.log('Human response notification already exists');
      return;
    }

    const notificationType = analysis.is_complaint ? 'complaint' : 'question';
    const priority = analysis.is_complaint ? 'urgent' : 'normal';
    
    // Bygg bättre sammanfattning
    let summary = analysis.needs_human_reason || '';
    if (analysis.unanswered_question) {
      summary = `Fråga: "${analysis.unanswered_question}"`;
    }
    if (!summary) {
      summary = analysis.is_complaint ? 'Gäst har uttryckt missnöje' : 'Gäst vill prata med personal';
    }

    // Skapa notification
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        customer_id: BELLA_ITALIA_ID,
        session_id: sessionId,
        type: notificationType,
        priority: priority,
        status: 'unread',
        summary: summary,
        guest_name: analysis.guest_name,
        guest_email: analysis.guest_email,
        guest_phone: analysis.guest_phone
      })
      .select()
      .single();

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      return;
    }

    // Markera session
    await supabase
      .from('chat_sessions')
      .update({ needs_human: true })
      .eq('id', sessionId);

    console.log('Human response notification created:', notification.id);

    // Skicka email till restaurangen
    const guestContact = analysis.guest_email || analysis.guest_phone || 'Ej angiven ännu';
    await sendRestaurantNotificationEmail(sessionId, {
      type: notificationType,
      guestName: analysis.guest_name || 'Okänd gäst',
      guestContact: guestContact,
      summary: summary,
      unansweredQuestion: analysis.unanswered_question
    });

  } catch (err) {
    console.error('Error handling needs human response:', err);
  }
}

// Skicka notification email till restaurangen
async function sendRestaurantNotificationEmail(sessionId, data) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return;
  }

  const typeEmoji = {
    reservation: '📅',
    complaint: '🚨',
    question: '❓',
    special_request: '🥗',
    handoff: '👋'
  };
  
  const typeText = {
    reservation: 'Ny bokningsförfrågan - VÄNTAR PÅ BEKRÄFTELSE',
    complaint: 'Klagomål - KRÄVER OMEDELBAR ÅTGÄRD',
    question: 'Fråga från gäst - VÄNTAR PÅ SVAR',
    special_request: 'Specialönskemål',
    handoff: 'Gäst vill prata med personal'
  };

  const urgencyBanner = data.type === 'complaint' 
    ? '<div style="background: #dc2626; color: white; padding: 12px; text-align: center; font-weight: bold;">⚠️ KRÄVER OMEDELBAR UPPMÄRKSAMHET</div>'
    : data.type === 'reservation'
    ? '<div style="background: #f59e0b; color: white; padding: 12px; text-align: center; font-weight: bold;">📞 Vänligen bekräfta inom 2 timmar</div>'
    : '<div style="background: #3b82f6; color: white; padding: 12px; text-align: center; font-weight: bold;">💬 Gäst väntar på svar</div>';

  // Bygg detaljer för reservation
  let detailsHtml = '';
  if (data.type === 'reservation' && data.details) {
    detailsHtml = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 12px 0; color: #166534;">📋 Bokningsdetaljer</h3>
        <p style="margin: 4px 0;"><strong>Datum:</strong> ${data.details.date}</p>
        <p style="margin: 4px 0;"><strong>Tid:</strong> ${data.details.time}</p>
        <p style="margin: 4px 0;"><strong>Antal gäster:</strong> ${data.details.partySize}</p>
        ${data.details.specialRequests ? `<p style="margin: 4px 0;"><strong>Önskemål:</strong> ${data.details.specialRequests}</p>` : ''}
      </div>
    `;
  }

  // Info om obesvarad fråga
  if (data.unansweredQuestion) {
    detailsHtml += `
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 12px 0; color: #92400e;">❓ Fråga som behöver svar</h3>
        <p style="margin: 0; font-style: italic;">"${data.unansweredQuestion}"</p>
      </div>
    `;
  }

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Sofia <sofia@eryai.tech>',
        to: 'demo@eryai.tech',
        reply_to: 'info@bellaitalia.se',
        subject: `${typeEmoji[data.type] || '📌'} ${typeText[data.type] || 'Notifikation'} - Bella Italia`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1c1c1c; margin: 0; padding: 0; }
              .container { max-width: 500px; margin: 0 auto; }
              .header { background: #2d3e2f; color: #d4a574; padding: 20px; }
              .header h1 { margin: 0; font-size: 22px; }
              .content { background: #faf8f5; padding: 24px; border: 1px solid #e0d5c7; }
              .detail { margin: 12px 0; }
              .label { font-weight: 600; color: #2d3e2f; }
              .cta { display: inline-block; background: #d4a574; color: #1c1c1c; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
              .footer { background: #1c1c1c; color: #888; padding: 16px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${typeEmoji[data.type] || '📌'} Sofia behöver din hjälp!</h1>
              </div>
              ${urgencyBanner}
              <div class="content">
                <div class="detail">
                  <span class="label">Typ:</span> ${typeText[data.type] || data.type}
                </div>
                <div class="detail">
                  <span class="label">Gäst:</span> ${data.guestName || 'Ej angiven'}
                </div>
                <div class="detail">
                  <span class="label">Kontakt:</span> ${data.guestContact || 'Ej angiven ännu'}
                </div>
                ${detailsHtml}
                <div class="detail">
                  <span class="label">Sammanfattning:</span><br>
                  ${data.summary}
                </div>
                <a href="https://dashboard.eryai.tech/chat/${sessionId}" class="cta">
                  Öppna konversationen →
                </a>
              </div>
              <div class="footer">
                Skickat av Sofia AI · Bella Italia · Powered by EryAI.tech
              </div>
            </div>
          </body>
          </html>
        `
      })
    });
    
    const emailResult = await emailResponse.json();
    
    if (emailResponse.ok) {
      console.log('Restaurant notification email sent:', emailResult.id);
    } else {
      console.error('Resend API error:', emailResponse.status, emailResult);
    }
  } catch (emailError) {
    console.error('Failed to send restaurant email:', emailError);
  }
}

// Skicka bekräftelsemail till gästen
async function sendGuestConfirmationEmail(guestEmail, data) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping guest email');
    return;
  }

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Bella Italia <sofia@eryai.tech>',
        to: guestEmail,
        reply_to: 'info@bellaitalia.se',
        subject: '🍝 Tack för din bokningsförfrågan - Bella Italia',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Georgia', serif; line-height: 1.8; color: #2d3e2f; margin: 0; padding: 0; background: #faf8f5; }
              .container { max-width: 500px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 30px 20px; }
              .header h1 { color: #2d3e2f; margin: 0; font-size: 28px; }
              .header p { color: #d4a574; margin: 8px 0 0 0; font-style: italic; }
              .content { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
              .booking-details { background: #f0fdf4; border-left: 4px solid #2d3e2f; padding: 20px; margin: 20px 0; }
              .booking-details h3 { margin: 0 0 12px 0; color: #2d3e2f; }
              .booking-details p { margin: 6px 0; }
              .message { font-size: 16px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🍝 Bella Italia</h1>
                <p>Autentisk italiensk mat sedan 1985</p>
              </div>
              <div class="content">
                <p class="message">Ciao ${data.guestName}!</p>
                <p class="message">Tack för din bokningsförfrågan! Vi har tagit emot den och återkommer med bekräftelse inom kort.</p>
                
                <div class="booking-details">
                  <h3>📋 Din förfrågan</h3>
                  <p><strong>Datum:</strong> ${data.date}</p>
                  <p><strong>Tid:</strong> ${data.time}</p>
                  <p><strong>Antal gäster:</strong> ${data.partySize}</p>
                  ${data.specialRequests ? `<p><strong>Önskemål:</strong> ${data.specialRequests}</p>` : ''}
                </div>

                <p class="message">Vi kontaktar dig så snart vi bekräftat din bokning. Har du frågor under tiden är du välkommen att ringa oss på <strong>08-555 1234</strong>.</p>
                
                <p class="message">Varma hälsningar,<br><em>Teamet på Bella Italia</em></p>
              </div>
              <div class="footer">
                Bella Italia · Strandvägen 42, Stockholm · 08-555 1234<br>
                <small>Detta mail skickades automatiskt via EryAI.tech</small>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });
    
    const emailResult = await emailResponse.json();
    
    if (emailResponse.ok) {
      console.log('Guest confirmation email sent:', emailResult.id);
    } else {
      console.error('Guest email error:', emailResponse.status, emailResult);
    }
  } catch (emailError) {
    console.error('Failed to send guest email:', emailError);
  }
}
