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
      console.log('Webhook recibido:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      // Si es un evento de edición o no tiene remitente claro, lo ignoramos para evitar errores
      if (!messaging || messaging.message_edit) {
        console.log("Evento ignorado (es un cambio de estado o edición sin texto de usuario).");
        return res.status(200).json({ success: true });
      }

      const senderId = messaging.sender?.id;
      const userText = messaging.message?.text;

      // Nos aseguramos de que el mensaje sea del usuario y no de nuestra propia cuenta
      const PAGE_ID = "17841448817465869"; // Tu ID de fitgurtpzo
      if (senderId && senderId !== PAGE_ID && userText) {
        console.log(`Mensaje real de ${senderId}: "${userText}"`);

        const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: `¡Hola! Gracias por escribir a Fitgurt. Recibimos tu mensaje: "${userText}". Pronto un asesor te atenderá. 🥛✨` }
          })
        });

        const data = await response.json();
        console.log("Respuesta de envío de Meta:", JSON.stringify(data, null, 2));
      } else {
        console.log("El mensaje provino de la misma página o no contiene texto válido.");
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("EXCEPCIÓN:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
