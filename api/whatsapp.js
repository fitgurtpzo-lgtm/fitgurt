export default async function handler(req, res) {
  // 1. Verificación del Webhook de Meta (GET)
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

  // 2. Recepción de mensajes de WhatsApp (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Webhook recibido:', JSON.stringify(body));
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
