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

      if (messaging) {
        // Obtenemos el ID del remitente de cualquier lugar posible del objeto messaging
        const senderId = messaging.sender?.id || messaging.recipient?.id;
        const PAGE_ID = "17841448817465869";

        // Si el mensaje viene de la cuenta evaluadora (y no de nuestra propia página)
        if (senderId && senderId !== PAGE_ID) {
          console.log(`¡Detectada interacción del usuario ID: ${senderId}! Enviando respuesta...`);

          const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

          const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { text: "¡Hola! Fitgurt te saluda. Hemos recibido tu mensaje correctamente. 🥛✨" }
            })
          });

          const data = await response.json();
          console.log("Respuesta de Meta:", JSON.stringify(data, null, 2));
        } else {
          console.log("Interacción omitida por ser de la propia página.");
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("EXCEPCIÓN:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
