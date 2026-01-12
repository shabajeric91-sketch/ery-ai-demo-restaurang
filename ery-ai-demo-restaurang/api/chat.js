export default async function handler(req, res) {
    res.status(200).json({ 
        candidates: [{ 
            content: { 
                parts: [{ text: "Hovmästaren är här! Om du ser detta fungerar kopplingen, men API-nyckeln kanske spökar." }] 
            } 
        }] 
    });
}
