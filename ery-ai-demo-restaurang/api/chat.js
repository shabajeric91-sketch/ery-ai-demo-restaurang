export default async function handler(req, res) {
  // Kontrollera att det är ett POST-anrop
  if (req.method !== 'POST') {
    return res.status(405).json({ text: "Method Not Allowed" });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  const { prompt } = req.body;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Du är en artig hovmästare på Ery Bistro. Svara kort på svenska: " + prompt
          }]
        }]
      })
    });

    const data = await response.json();

    // Om Google skickar ett felmeddelande
    if (data.error) {
      return res.status(200).json({ text: "API-fel: " + data.error.message });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hovmästaren är lite upptagen, försök igen.";
    
    return res.status(200).json({ text: aiText });

  } catch (error) {
    return res.status(500).json({ text: "Ett internt fel uppstod: " + error.message });
  }
}
