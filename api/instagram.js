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
      console.log('Webhook completo recibido:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];
      
      // Extraemos el ID del remitente de forma segura
      const senderId = messaging?.sender?.id || entry?.id;

      if (senderId) {
        const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        console.log("Enviando mensaje al ID de Instagram:", senderId);

        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: "¡Hola! Fitgurt te saluda. Hemos recibido tu mensaje con éxito. 🥛✨" }
          })
        });

        const data = await response.json();
        console.log("RESPUESTA COMPLETA DE META:", JSON.stringify(data, null, 2));
      } else {
        console.log("No se encontró ningún senderId válido en el payload.");
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("EXCEPCIÓN EN EL SERVIDOR:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
