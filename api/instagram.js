export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = 'fitgurt_token_seguro_2026';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Error de verificación');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (messaging) {
        const senderId = messaging.sender?.id;
        const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        console.log("Intentando enviar mensaje a ID:", senderId);
        console.log("Token usado (primeros caracteres):", PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN.substring(0, 10) + "..." : "NO EXISTE TOKEN");

        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: "¡Hola! Esto es una prueba de Fitgurt." }
          })
        });

        const data = await response.json();
        console.log("RESPUESTA COMPLETA DE META:", JSON.stringify(data, null, 2));
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("EXCEPCIÓN EN EL SERVIDOR:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
