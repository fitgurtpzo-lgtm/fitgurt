export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    const lastMessage = messages?[messages.length - 1];
    const userText = lastMessage?.content ? lastMessage.content.toLowerCase() : '';

    // Respuestas inteligentes con tus datos reales de Fitgurt
    let reply = "¡Hola! Bienvenido a Fitgurt 🥛✨. Soy Gurtie, tu asistente virtual. ¿En qué te puedo ayudar hoy?";

    if (userText.includes('precio') || userText.includes('cuanto') || userText.includes('menu') || userText.includes('catalogo')) {
      reply = "¡Claro que sí! Aquí tienes nuestro menú y precios actuales:\n\n" +
              "• Yogurts 8oz (Mora, Piña, Fresa): *2$* *(Ahorita no hay ciruelas pasas)*\n" +
              "• Parfait 8oz (*5$*) y 14oz (*8$*)\n" +
              "• Bowl 16oz: *10$*\n" +
              "• Kilos con mermelada (Fresa/Piña/Mora): *12$*\n" +
              "• Promo 3+ kilos: *7.5$ c/u* (Total 22.5$)\n\n" +
              "¿Cuál te gustaría ordenar hoy? 🥛";
    } else if (userText.includes('promo') || userText.includes('oferta') || userText.includes('kilo')) {
      reply = "🔥 ¡Tenemos la Gran Promo Fitgurt! El kilo de yogurt natural individual sale en 8.5$, pero si llevas 3 o más unidades te quedan a precio especial de *7.5$ c/u* (Total: 22.5$). ¡Aprovecha!";
    } else if (userText.includes('hola') || userText.includes('buenos dias') || userText.includes('buenas')) {
      reply = "¡Hola! Qué gusto saludarte. ¿Te gustaría ver nuestros yogurts de 8oz, los parfaits o las promos por kilo?";
    }

    return res.status(200).json({
      data: {
        reply: reply
      }
    });

  } catch (error) {
    console.error("Error en chat.js:", error);
    return res.status(500).json({ 
      data: { 
        reply: "Lo siento, ocurrió un problema temporal. Por favor reintenta en unos momentos." 
      } 
    });
  }
}
