import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

const sql = neon(process.env.DATABASE_URL);

async function withRecipes(products) {
  const recipeRows = await sql`
    SELECT pr.product_id, pr.material_id, pr.qty, m.name AS material_name, m.unit AS material_unit,
           m.cost AS material_cost, m.package_qty AS material_package_qty
    FROM product_recipe pr
    JOIN materials m ON m.id = pr.material_id`;
  return products.map((p) => ({
    ...p,
    recipe: recipeRows
      .filter((r) => r.product_id === p.id)
      .map((r) => ({
        materialId: r.material_id,
        qty: Number(r.qty),
        materialName: r.material_name,
        unit: r.material_unit,
        materialCost: Number(r.material_cost),
        materialPackageQty: Number(r.material_package_qty),
      })),
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
      // Actualiza precios / cantidad mínima mayor / disponibilidad / costeo / foto / sabores de un producto
      const { id, retailPrice, wholesalePrice, wholesaleMin, active, yieldQty, marginTarget, image, flavors, name } = req.body;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      const [current] = await sql`SELECT * FROM products WHERE id = ${id}`;
      if (!current) return res.status(404).json({ error: 'Producto no encontrado' });
      const [row] = await sql`
        UPDATE products
        SET retail_price = ${retailPrice ?? current.retail_price},
            wholesale_price = ${wholesalePrice ?? current.wholesale_price},
            wholesale_min = ${wholesaleMin ?? current.wholesale_min},
            active = ${active === undefined ? current.active : active},
            yield_qty = ${yieldQty || current.yield_qty || 1},
            margin_target = ${marginTarget ?? current.margin_target ?? 0.30},
            image = ${image !== undefined ? image : current.image},
            flavors = ${flavors !== undefined ? JSON.stringify(flavors) : current.flavors},
            name = ${name || current.name}
        WHERE id = ${id}
        RETURNING *`;
      return res.status(200).json(row);
    }

    if (req.method === 'POST' && req.body?.action === 'create') {
      const { id, name, retailPrice, wholesalePrice, wholesaleMin, image, flavors, category } = req.body;
      if (!id || !name) return res.status(400).json({ error: 'Falta id o nombre' });
      const [existing] = await sql`SELECT id FROM products WHERE id = ${id}`;
      if (existing) return res.status(409).json({ error: 'Ya existe un producto con ese id' });
      const [row] = await sql`
        INSERT INTO products (id, name, retail_price, wholesale_price, wholesale_min, image, flavors, category)
        VALUES (${id}, ${name}, ${retailPrice || 0}, ${wholesalePrice || 0}, ${wholesaleMin || 1},
                ${image || null}, ${JSON.stringify(flavors || [])}, ${category || 'menudeo'})
        RETURNING *`;
      return res.status(201).json({ ...row, recipe: [] });
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
