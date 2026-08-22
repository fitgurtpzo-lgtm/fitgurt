-- Fitgurt · esquema de base de datos (Neon / Postgres)
-- Corre esto UNA VEZ en el editor SQL de Neon (console.neon.tech → tu proyecto → SQL Editor)

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidad',
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  retail_price NUMERIC NOT NULL DEFAULT 0,
  wholesale_price NUMERIC NOT NULL DEFAULT 0,
  wholesale_min INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_recipe (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  qty NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, material_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer TEXT,
  phone TEXT,
  channel TEXT NOT NULL DEFAULT 'menudeo' CHECK (channel IN ('menudeo','mayor')),
  delivery TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','listo','entregado'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL
);

-- Catálogo real (precios de menudeo confirmados; mayor y recetas se completan desde el panel)
INSERT INTO products (id, name, retail_price, wholesale_min) VALUES
  ('natural_1kilo', 'Yogurt natural 1 kilo', 8.5, 6),
  ('natural_3kilos', 'Yogurt natural 3 kilos (promo)', 22.5, 6),
  ('natural_8oz', 'Yogurt natural vaso 8oz', 1.7, 12),
  ('parfait_8oz', 'Parfait 8oz', 5, 12),
  ('parfait_14oz', 'Parfait 14oz', 8, 12),
  ('parfait_bowl16oz', 'Bowl 16oz', 10, 12),
  ('granola_5oz', 'Yogurt con granola y miel 5oz', 2, 12),
  ('mermelada_250', 'Mermelada 250gr', 5, 12),
  ('mermelada_vaso', 'Yogurt con mermelada vaso 8oz', 2, 12),
  ('natural_150gr', 'Yogurt natural 150gr (supermercados)', 0, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Actualización: costeo por receta (paquete → costo por unidad,
-- rendimiento del lote, margen objetivo). Segura de correr de nuevo.
-- ============================================================

ALTER TABLE materials ADD COLUMN IF NOT EXISTS package_qty NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS yield_qty NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_target NUMERIC NOT NULL DEFAULT 0.30;
CREATE UNIQUE INDEX IF NOT EXISTS materials_name_unique ON materials(name);

-- Materia prima real, tomada de tu hoja de costos
-- (cost = costo del paquete completo; package_qty = cuántas unidades trae ese paquete)
INSERT INTO materials (name, unit, stock, min_stock, cost, package_qty) VALUES
  ('Leche', 'gr', 0, 0, 9.94, 4),
  ('Yogurt (cultivo)', 'unidad', 0, 0, 2, 160),
  ('Vasos', 'unidad', 0, 0, 63.32, 100),
  ('Tapas', 'unidad', 0, 0, 23.42, 100),
  ('Envío insumos', 'unidad', 0, 0, 15.38, 120),
  ('Etiquetas', 'unidad', 0, 0, 10, 70),
  ('Agua', 'litros', 0, 0, 0.32, 18000),
  ('Mano de obra', 'unidad', 0, 0, 15, 100),
  ('Carro (transporte)', 'unidad', 0, 0, 40, 600),
  ('Casa (espacio de producción)', 'unidad', 0, 0, 40, 600)
ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, package_qty = EXCLUDED.package_qty;

-- Rendimiento y margen objetivo (30%, igual que tu hoja)
UPDATE products SET yield_qty = 4, margin_target = 0.30 WHERE id = 'natural_1kilo';
UPDATE products SET yield_qty = 4, margin_target = 0.30 WHERE id = 'natural_150gr';

-- Número de control fiscal, para cuando se conecte la facturación electrónica
ALTER TABLE orders ADD COLUMN IF NOT EXISTS control_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
INSERT INTO product_recipe (product_id, material_id, qty)
SELECT 'natural_1kilo', id, qty FROM materials
JOIN (VALUES
  ('Leche', 1), ('Yogurt (cultivo)', 1), ('Vasos', 1), ('Tapas', 1),
  ('Envío insumos', 1), ('Etiquetas', 1), ('Agua', 750),
  ('Mano de obra', 1), ('Carro (transporte)', 1), ('Casa (espacio de producción)', 1)
) AS r(name, qty) ON r.name = materials.name
ON CONFLICT (product_id, material_id) DO UPDATE SET qty = EXCLUDED.qty;

-- Receta de "Yogurt natural 150gr" (el cultivo usa 4 en vez de 1, igual que tu hoja)
INSERT INTO product_recipe (product_id, material_id, qty)
SELECT 'natural_150gr', id, qty FROM materials
JOIN (VALUES
  ('Leche', 1), ('Yogurt (cultivo)', 4), ('Vasos', 1), ('Tapas', 1),
  ('Envío insumos', 1), ('Etiquetas', 1), ('Agua', 750),
  ('Mano de obra', 1), ('Carro (transporte)', 1), ('Casa (espacio de producción)', 1)
) AS r(name, qty) ON r.name = materials.name
ON CONFLICT (product_id, material_id) DO UPDATE SET qty = EXCLUDED.qty;

-- ============================================================
-- Actualización: facturación al mayor (RIF, IVA, entregado/pagado)
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_rif TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_condition TEXT NOT NULL DEFAULT 'contado' CHECK (payment_condition IN ('contado','credito'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS iva NUMERIC;

-- ============================================================
-- Actualización: catálogo editable desde el panel (foto, sabores, nuevos productos)
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flavors JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'menudeo';

-- Producto que faltaba: 1 kilo con mermelada
INSERT INTO products (id, name, retail_price, wholesale_min, category) VALUES
  ('natural_1kilo_mermelada', 'Yogurt 1 kilo con mermelada', 12, 6, 'menudeo')
ON CONFLICT (id) DO NOTHING;

-- Sabores editables desde el panel (Catálogo), reflejan las opciones ya visibles en el sitio
UPDATE products SET flavors = '[
  {"label":"Fresa","available":true},{"label":"Piña","available":true},
  {"label":"Mora","available":true},{"label":"Durazno","available":true},
  {"label":"Ciruela pasas","available":true},{"label":"Granola y miel","available":true}
]'::jsonb WHERE id = 'mermelada_vaso' AND flavors = '[]'::jsonb;

UPDATE products SET flavors = '[
  {"label":"Fresa","available":true},{"label":"Piña","available":true},
  {"label":"Mora","available":true},{"label":"Durazno","available":true},
  {"label":"Ciruelas pasas","available":true}
]'::jsonb WHERE id = 'mermelada_250' AND flavors = '[]'::jsonb;
