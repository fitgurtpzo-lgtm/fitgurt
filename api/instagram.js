import axios from 'axios';

export default async function handler(req, res) {
  // 1. Verificación del Webhook (GET) - Usa el mismo token de seguridad
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'fitgurt_token_seguro_2026';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Error de verificación');
  }

  // 2. Recepción de mensajes de Instagram Direct (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      
      // Validar si es un evento de Instagram
      if (body.object === 'instagram') {
        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0];

        if (messaging && messaging.message) {
          const senderId = messaging.sender.id; // ID del usuario de Instagram
          const userText = messaging.message.text; // Lo que escribió en el DM

          console.log(`[Instagram] Mensaje de ${senderId}: "${userText}"`);

          const replyText = `¡Hola! Gracias por escribir a Fitgurt por Instagram. Vemos que dijiste: "${userText}". ¿En qué te podemos ayudar hoy? 🥛✨`;

          // 3. Enviar respuesta vía Meta Graph API para Instagram
          const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN; // Tu token de la página de Facebook vinculada a IG

          await axios.post(
            `https://graph.facebook.com/v19.0/me/messages`,
            {
              recipient: { id: senderId },
              message: { text: replyText }
            },
            { params: { access_token: PAGE_ACCESS_TOKEN } }
          );
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error en webhook de Instagram:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
