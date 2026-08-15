import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

const sql = neon(process.env.DATABASE_URL);

async function withRecipes(products) {
  const recipeRows = await sql`
    SELECT pr.product_id, pr.material_id, pr.qty, m.name AS material_name, m.unit AS material_unit
    FROM product_recipe pr
    JOIN materials m ON m.id = pr.material_id`;
  return products.map((p) => ({
    ...p,
    recipe: recipeRows
      .filter((r) => r.product_id === p.id)
      .map((r) => ({ materialId: r.material_id, qty: Number(r.qty), materialName: r.material_name, unit: r.material_unit })),
  }));
}

export default async function handler(req, res) {
  const wantsAll = req.query && (req.query.all === '1' || req.query.all === 'true');

  if (req.method === 'GET' && !wantsAll) {
    // Catálogo público: el sitio no necesita sesión para leer precios/disponibilidad
    try {
      const products = await sql`SELECT * FROM products WHERE active = true ORDER BY name ASC`;
      return res.status(200).json(await withRecipes(products));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error de servidor' });
    }
  }

  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET' && wantsAll) {
      const products = await sql`SELECT * FROM products ORDER BY name ASC`;
      return res.status(200).json(await withRecipes(products));
    }

    if (req.method === 'PUT') {
      // Actualiza precios / cantidad mínima mayor / disponibilidad de un producto
      const { id, retailPrice, wholesalePrice, wholesaleMin, active } = req.body;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      const [row] = await sql`
        UPDATE products
        SET retail_price = ${retailPrice}, wholesale_price = ${wholesalePrice},
            wholesale_min = ${wholesaleMin}, active = ${active === undefined ? true : active}
        WHERE id = ${id}
        RETURNING *`;
      return res.status(200).json(row);
    }

    if (req.method === 'POST' && req.body?.action === 'setRecipe') {
      // Reemplaza la receta completa de un producto: { productId, lines: [{materialId, qty}] }
      const { productId, lines } = req.body;
      if (!productId) return res.status(400).json({ error: 'Falta productId' });
      await sql`DELETE FROM product_recipe WHERE product_id = ${productId}`;
      for (const line of lines || []) {
        if (line.materialId && line.qty > 0) {
          await sql`
            INSERT INTO product_recipe (product_id, material_id, qty)
            VALUES (${productId}, ${line.materialId}, ${line.qty})`;
        }
      }
      const [product] = await sql`SELECT * FROM products WHERE id = ${productId}`;
      const [withRecipe] = await withRecipes([product]);
      return res.status(200).json(withRecipe);
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).end('Método no permitido');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error de servidor', detail: String(err.message || err) });
  }
}
