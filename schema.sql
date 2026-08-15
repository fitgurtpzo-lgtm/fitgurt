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
