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
      const changes = entry?.changes?.[0];
      
      // Búsqueda robusta del ID del usuario en cualquier formato de Meta
      const senderId = messaging?.sender?.id || changes?.value?.sender?.id || entry?.id;

      if (senderId) {
        const PAGE_ACCESS_TOKEN = EAAUIK5oxCVcBSRqf53c2vooZAaxxjF6AhbyJlKpZBf36FpQMjzMNHh6hUDiLRZAOpz2WgenpXCcb7noLpaCNoxa8V3NEf6IgIwLAjz2Tk1zk4AKMZBQbXxCfWN7sok7nWyetSD0p1SQQcifLZBn7YOWxzG4yhjVNMInM3q43J3ARsPaDJtx90lEZBrbZAiNnr6ZBTRMCKoGs4Fv2UjRtA7AecoZBRzEKdaD9ZCIgytY9BSnXxZCZAysaWm2ygyw1yaZCZBVxhfpzTD3M8KfKLWmZCWFccK3mPQsZAv9j0cZBMJ88ZDprocess.env.INSTAGRAM_ACCESS_TOKEN;

        console.log("Enviando respuesta al ID de Instagram:", senderId);

        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: "¡Hola! Fitgurt te saluda. Mensaje recibido con éxito. 🥛✨" }
          })
        });

        const data = await response.json();
        console.log("RESPUESTA COMPLETA DE META:", JSON.stringify(data, null, 2));
      } else {
        console.log("Aviso: No se pudo extraer un senderId de este evento específico.");
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("EXCEPCIÓN EN EL SERVIDOR:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
