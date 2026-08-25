export default async function handler(req, res) {
  // 1. Verificación del Webhook de Meta (GET)
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

  // 2. Recepción de mensajes de Instagram Direct (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Webhook de Instagram recibido:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (messaging && messaging.message && messaging.message.text) {
        const senderId = messaging.sender.id; 
        const userText = messaging.message.text; 

        console.log(`[Instagram] Mensaje de ${senderId}: "${userText}"`);

        const replyText = `¡Hola! Gracias por escribir a Fitgurt por Instagram. Hemos recibido tu mensaje: "${userText}". Pronto un asesor te atenderá. 🥛✨`;
        const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        // Enviar respuesta usando fetch nativo
        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText }
          })
        });

        const data = await response.json();
        console.log('[Instagram] Respuesta de Meta:', data);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error al procesar mensaje de Instagram:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
