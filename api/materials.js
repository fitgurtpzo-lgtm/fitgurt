import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM materials ORDER BY name ASC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, unit, stock, minStock, cost, packageQty } = req.body;
      if (!name) return res.status(400).json({ error: 'Falta el nombre' });
      const [row] = await sql`
        INSERT INTO materials (name, unit, stock, min_stock, cost, package_qty)
        VALUES (${name}, ${unit || 'unidad'}, ${stock || 0}, ${minStock || 0}, ${cost || 0}, ${packageQty || 1})
        RETURNING *`;
      return res.status(201).json(row);
    }

    if (req.method === 'PUT') {
      const { id, name, unit, stock, minStock, cost, packageQty } = req.body;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      const [row] = await sql`
        UPDATE materials
        SET name = ${name}, unit = ${unit}, stock = ${stock}, min_stock = ${minStock}, cost = ${cost}, package_qty = ${packageQty || 1}
        WHERE id = ${id}
        RETURNING *`;
      return res.status(200).json(row);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      await sql`DELETE FROM materials WHERE id = ${id}`;
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).end('Método no permitido');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error de servidor', detail: String(err.message || err) });
  }
}
