import axios from 'axios';
import { neon } from '@neondatabase/serverless';

// Conexión directa a tu base de datos de Neon
const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // 1. Verificación del Webhook de Meta (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'MI_TOKEN_SECRETO_FITGURT';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Error de verificación');
  }

  // 2. Recepción de mensajes de WhatsApp (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (message && message.type === 'text') {
        const fromNumber = message.from; // Número de WhatsApp del cliente
        const userText = message.text.body; // Lo que escribió

        console.log(`[WhatsApp] Mensaje de ${fromNumber}: "${userText}"`);

        // AQUÍ PUEDES CONSULTAR NEON SI QUIERES:
        // Por ejemplo, buscar si pregunta por un producto o guardar el cliente en una tabla.
        // const productos = await sql`SELECT * FROM productos WHERE activo = true`;

        // Generar respuesta inteligente (puedes conectar tu lógica de Gemini aquí o seguir usando tu API externa)
        const replyText = `¡Hola! Gracias por escribir a Fitgurt. Hemos recibido tu mensaje: "${userText}". En un momento un asesor o el sistema automatizado te atenderá con nuestro catálogo. 🥛✨`;

        // 3. Enviar respuesta de vuelta a WhatsApp vía Meta Graph API
        const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
        const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

        await axios.post(
          `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: 'whatsapp',
            to: fromNumber,
            type: 'text',
            text: { body: replyText }
          },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
        );
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error en webhook de WhatsApp:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.setHeader('Allow', ['GET', 'POST']).status(405).end(`Method ${req.method} Not Allowed`);
}
