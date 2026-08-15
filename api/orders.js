import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`;
      const ids = orders.map((o) => o.id);
      const items = ids.length ? await sql`SELECT * FROM order_items WHERE order_id = ANY(${ids})` : [];
      const withItems = orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
      return res.status(200).json(withItems);
    }

    if (req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const { id, status } = req.body;
      if (!id || !status) return res.status(400).json({ error: 'Falta id o status' });
      const [row] = await sql`UPDATE orders SET status = ${status} WHERE id = ${id} RETURNING *`;
      return res.status(200).json(row);
    }

    if (req.method === 'POST') {
      // Abierto sin sesión: aquí llega el checkout del carrito público
      const { customer, phone, channel, delivery, lines } = req.body;
      // lines: [{ productId (opcional), name, qty, unitPrice }]
      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: 'El pedido no tiene productos' });
      }

      const knownIds = lines.map((l) => l.productId).filter(Boolean);
      const products = knownIds.length ? await sql`SELECT * FROM products WHERE id = ANY(${knownIds})` : [];

      let total = 0;
      const resolvedItems = lines.map((line) => {
        const qty = Math.max(1, parseInt(line.qty, 10) || 1);
        const product = products.find((p) => p.id === line.productId);
        let unitPrice = Number(line.unitPrice) || 0;
        if (product) {
          const useWholesale = channel === 'mayor' && Number(product.wholesale_price) > 0 && qty >= product.wholesale_min;
          if (useWholesale) unitPrice = Number(product.wholesale_price);
        }
        total += unitPrice * qty;
        return { productId: product ? product.id : null, name: line.name || product?.name || 'Producto', qty, unitPrice };
      });
      total = Math.round(total * 100) / 100;

      const [order] = await sql`
        INSERT INTO orders (customer, phone, channel, delivery, total, status)
        VALUES (${customer || ''}, ${phone || ''}, ${channel || 'menudeo'}, ${delivery || ''}, ${total}, 'pendiente')
        RETURNING *`;

      for (const item of resolvedItems) {
        await sql`
          INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price)
          VALUES (${order.id}, ${item.productId}, ${item.name}, ${item.qty}, ${item.unitPrice})`;
      }

      // Descontar materia prima solo para productos que sí tienen receta definida
      const matchedIds = resolvedItems.map((i) => i.productId).filter(Boolean);
      if (matchedIds.length) {
        const recipeRows = await sql`
          SELECT product_id, material_id, qty FROM product_recipe WHERE product_id = ANY(${matchedIds})`;
        const deltas = {};
        for (const line of resolvedItems) {
          if (!line.productId) continue;
          for (const r of recipeRows.filter((r) => r.product_id === line.productId)) {
            deltas[r.material_id] = (deltas[r.material_id] || 0) + Number(r.qty) * line.qty;
          }
        }
        for (const [materialId, amount] of Object.entries(deltas)) {
          await sql`UPDATE materials SET stock = GREATEST(0, stock - ${amount}) WHERE id = ${materialId}`;
        }
      }

      return res.status(201).json({ ...order, items: resolvedItems });
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).end('Método no permitido');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error de servidor', detail: String(err.message || err) });
  }
}
