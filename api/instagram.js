import axios from 'axios';

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

      // Verificar si es un evento de mensajería de Instagram
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (messaging && messaging.message && messaging.message.text) {
        const senderId = messaging.sender.id; // ID único del cliente de Instagram
        const userText = messaging.message.text; // Lo que el usuario escribió

        console.log(`[Instagram] Mensaje de ${senderId}: "${userText}"`);

        // Mensaje de respuesta automática para Fitgurt
        const replyText = `¡Hola! Gracias por escribir a Fitgurt por Instagram. Hemos recibido tu mensaje: "${userText}". Pronto un asesor te atenderá. 🥛✨`;

        // Token de acceso de Instagram que guardaste en Vercel
        const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        // 3. Enviar la respuesta de vuelta a Instagram usando la API Graph
        await axios.post(
          `https://graph.facebook.com/v19.0/me/messages`,
          {
            recipient: { id: senderId },
            message: { text: replyText }
          },
          { params: { access_token: PAGE_ACCESS_TOKEN } }
        );

        console.log(`[Instagram] Respuesta enviada exitosamente a ${senderId}`);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error al procesar mensaje de Instagram:', error.response?.data || error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(500).end(`Method ${req.method} Not Allowed`);
}
