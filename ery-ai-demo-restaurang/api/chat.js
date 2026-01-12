export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(200).json({ reply: "Fel: API-nyckel saknas i Vercel." });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Svara som en hovmästare på restaurangen Ery Bistro. Svara kort på: " + req.body.prompt }] }]
      })
    });

    const data = await response.json();
    
    // Här säkerställer vi att vi hämtar texten rätt
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hovmästaren funderar... (Inget svar från AI)";
    
    // Vi skickar tillbaka ett objekt som heter { reply: "..." }
    res.status(200).json({ reply: aiText });
  } catch (error) {
    res.status(500).json({ reply: "Kunde inte kontakta hovmästaren just nu." });
  }
}
