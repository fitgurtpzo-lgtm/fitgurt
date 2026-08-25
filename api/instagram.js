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
        const senderId = messaging.sender?.id || messaging.recipient?.id;
        const PAGE_ID = "17841448817465869";
        const userText = messaging.message?.text ? messaging.message.text.toLowerCase() : "";

        // ==========================================
        // CONTROL DE STOCK (Cambia a true si no hay)
        // ==========================================
        const AGOTADOS = {
          ciruela: true, // ¡Ahorita no hay ciruelas pasas!
          fresa: false,
          mora: false,
          pina: false
        };

        if (senderId && senderId !== PAGE_ID) {
          console.log(`¡Mensaje de ${senderId}: "${userText}"! Generando respuesta...`);

          // Construimos el aviso de sabores disponibles y agotados
          let sabores8oz = "Mora, Piña, Fresa";
          if (!AGOTADOS.ciruela) sabores8oz += ", Ciruela";

          let replyText = "¡Hola! Bienvenido a Fitgurt 🥛✨. Soy Gurtie, tu asistente virtual. Aquí tienes nuestro menú actualizado:\n\n";
          replyText += `🔹 *Yogurts Individuales (8 oz / 250g) - 2$ c/u*\n- Sabores disponibles: ${sabores8oz}.\n`;
          if (AGOTADOS.ciruela) replyText += "⚠️ *Nota:* Ahorita no tenemos disponible de ciruelas pasas.\n\n";
          else replyText += "\n";

          replyText += "🔹 *Parfaits y Bowls*\n- Parfait 8oz (fresa, kiwi, chía): 5$\n- Parfait 14oz (fresa, kiwi, manzana): 8$\n- Bowl 16oz: 10$\n\n";
          replyText += "🔹 *Kilos con Mermelada (12$ c/u)*\n- 1 kg de yogurt natural + 250g de mermelada (Fresa, Piña o Mora).\n\n";
          replyText += "🔥 *GRAN PROMO FITGURT*\n- Kilo individual: 8.5$\n- ¡Llevando 3 o más unidades pagan a precio especial de *7.5$ c/u* (Total: 22.5$)!\n\n";
          replyText += "¿Te gustaría realizar un pedido o consultar otro detalle?";

          if (userText.includes("precio") || userText.includes("cuanto") || userText.includes("catalogo") || userText.includes("menu")) {
            replyText = "¡Claro que sí! Estos son nuestros precios y sabores actuales:\n\n" +
                        `• Yogurts 8oz (2$): ${sabores8oz}` + (AGOTADOS.ciruela ? " *(Sin stock de ciruela temporalmente)*" : "") + "\n" +
                        "• Parfaits 8oz (5$) y 14oz (8$)\n" +
                        "• Bowl 16oz (10$)\n" +
                        "• Kilos con mermelada - Fresa/Piña/Mora (12$)\n" +
                        "• Promo 3+ kilos: 7.5$ c/u (Total 22.5$)\n\n" +
                        "¿Cuál te gustaría ordenar hoy? 🥛";
          }

          const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

          const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { text: replyText }
            })
          });

          const data = await response.json();
          console.log("Respuesta de Meta enviada con éxito:", JSON.stringify(data, null, 2));
        } else {
          console.log("Interacción omitida (mensaje propio).");
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
