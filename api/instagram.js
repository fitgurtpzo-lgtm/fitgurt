export default async function handler(req, res) {
  // 1. Verificación del Webhook (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = 'FITGURT_IG_WEBHOOK_SECRET'; // Asegúrate de que coincida con el de Meta Developers

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verificado exitosamente.');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Error de verificación');
  }

  // 2. Recepción de mensajes directos (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      // Verificar si es un mensaje de texto entrante válido de un usuario (y no un eco nuestro)
      if (messaging && messaging.message && messaging.message.text && !messaging.message.is_echo) {
        const senderId = messaging.sender.id; // IGSID del usuario
        const userText = messaging.message.text;

        console.log(`[Instagram DM] Mensaje de ${senderId}: "${userText}"`);

        // URL de tu API en Google Studio
        const FITGURT_API_URL = 'https://fitgurt.ai.studio/api/chat';
        const INSTAGRAM_PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        // A. Consultar la API de Fitgurt
        let replyText = '¡Hola! 🥣 Gracias por escribir al Instagram de Fitgurt. ¿En qué te podemos ayudar hoy?';
        
        try {
          const apiResponse = await fetch(FITGURT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: userText }],
              channel: 'instagram'
            })
          });

          const apiData = await apiResponse.json();
          if (apiData?.data?.reply) {
            replyText = apiData.data.reply;
          }
        } catch (apiError) {
          console.error("Aviso: No se pudo conectar a la API externa, usando respaldo local:", apiError.message);
          // Respuesta de respaldo con tus datos reales si la API externa llegara a fallar
          replyText = "¡Hola! Bienvenido a Fitgurt 🥛✨. Tenemos yogurts individuales de 8oz (Mora, Piña, Fresa) a 2$ (⚠️ Ahorita no hay ciruelas pasas), parfaits desde 5$, bowls a 10$, y nuestra gran promo de 3+ kilos a 7.5$ c/u (Total 22.5$). ¿Qué deseas ordenar?";
        }

        // B. Enviar respuesta por Instagram Direct vía Meta Graph API
        const metaResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText }
          })
        });

        const metaData = await metaResponse.json();
        console.log("Respuesta de Meta enviada:", JSON.stringify(metaData, null, 2));
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error procesando Instagram webhook:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
