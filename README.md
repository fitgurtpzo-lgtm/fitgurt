# Fitgurt — sitio + base de datos real + panel administrativo

## Qué hay en esta carpeta
- `index.html` — tu landing page (catálogo, carrito, WhatsApp) — cada pedido también se guarda en la base de datos. Tiene un botón **"Panel ↗"** en el menú que lleva al login administrativo.
- `enterprise-login.html` / `enterprise-login.js` — pantalla de acceso al panel, validada de verdad contra el servidor (ya no son credenciales de prueba escritas en el código).
- `enterprise.html` / `enterprise.js` / `enterprise-*.css` — el panel: resumen, ventas de la semana, productos estrella, pedidos (con filtros y cambio de estado), inventario (activar/pausar productos) y clientes. Todo con datos reales, nada inventado.
- `api/` — funciones que Vercel despliega automáticamente como backend:
  - `login.js` — valida usuario/clave y entrega un token firmado.
  - `_auth.js` — helper que verifica ese token (no es una ruta, es compartido por las demás).
  - `materials.js`, `products.js` — requieren el token (protegidos).
  - `orders.js` — leer/cambiar estado requiere token; **crear** un pedido queda abierto porque lo usa el carrito público.
- `schema.sql` — crea las tablas en Neon. Se corre una sola vez.
- `package.json` — la única dependencia (`@neondatabase/serverless`), Vercel la instala sola.

## Pasos para publicar

### 1. Preparar la base de datos (Neon)
1. Entra a [console.neon.tech](https://console.neon.tech) → tu proyecto → **SQL Editor**.
2. Pega todo el contenido de `schema.sql` y ejecútalo. Esto crea las tablas y carga tu catálogo de 9 productos con los precios de menudeo reales.
3. En **Dashboard → Connection string**, copia la URL `postgresql://...` (la que generaste al rotar la contraseña). No la pegues en ningún chat ni la subas a GitHub.

### 2. Subir el proyecto a Vercel
Arrastra esta carpeta completa en [vercel.com/new](https://vercel.com/new), o conéctala desde GitHub.

### 3. Configurar las variables de entorno
En tu proyecto de Vercel → **Settings → Environment Variables**, agrega estas 4 (marca los 3 entornos en cada una):

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | la connection string de Neon |
| `ADMIN_EMAIL` | el correo con el que vas a entrar al panel (ej. `tucorreo@fitgurt.com`) |
| `ADMIN_PASSWORD` | la contraseña del panel — elige una nueva y segura, no la reutilices |
| `ADMIN_TOKEN_SECRET` | cualquier texto largo y aleatorio (ej. 40 caracteres). Sirve para firmar la sesión — no es una contraseña que uses en ningún formulario |

Guarda y vuelve a desplegar (**Deployments → ⋯ → Redeploy**) para que tomen efecto.

### 4. Probar
- Abre `tu-proyecto.vercel.app` → agrega algo al carrito → "Enviar pedido por WhatsApp" → el pedido queda guardado en paralelo.
- Haz clic en **"Panel ↗"** en el menú → entra con el `ADMIN_EMAIL` / `ADMIN_PASSWORD` que configuraste → deberías ver el pedido de prueba en **Pedidos**.

## Cómo usar el panel día a día
1. **Materia prima** (dentro de `enterprise.js`, sección Inventario): agrega tus insumos reales con su stock actual.
2. **Productos y recetas**: define precio de mayor, cantidad mínima, y qué materia prima consume cada unidad.
3. Cada pedido — del sitio o registrado a mano — descuenta la materia prima automáticamente.
4. El interruptor de cada producto en **Inventario** lo activa/pausa para la venta.

## Seguridad
- El panel ya no es una simulación: cada ruta sensible (`materials`, `products`, leer/editar `orders`) exige un token válido emitido por `/api/login`, verificado en el servidor con una firma criptográfica (`ADMIN_TOKEN_SECRET`). Alguien sin la contraseña no puede leer ni modificar nada, aunque adivine las URLs de la API.
- Solo la creación de pedidos (`POST /api/orders`) queda abierta a propósito, porque es lo que usa el carrito público.
- Si alguna vez sospechas que `ADMIN_PASSWORD` o `ADMIN_TOKEN_SECRET` se expusieron, cámbialos en Vercel y todas las sesiones activas quedan invalidadas al instante.

## Actualización: disponibilidad en vivo + panel al mayor

- El catálogo del sitio ahora consulta `/api/products` para saber qué está activo/pausado — si pausas un producto desde el panel, se refleja en la web en segundos (antes dependía de un archivo `stock.json` que ya no se usa, puedes borrarlo).
- Nuevo archivo `mayor.html`: panel separado para materia prima, recetas y pedidos a supermercados, enfocado en tus dos productos de mayor (`Yogurt natural 150gr` y `Yogurt natural 1 kilo`). Usa la misma sesión que `enterprise.html` — hay un enlace entre ambos.
- **Vuelve a correr `schema.sql` completo en el editor SQL de Neon** — es seguro, no borra nada (usa `IF NOT EXISTS` y `ON CONFLICT DO NOTHING`), solo agrega el producto nuevo `natural_150gr` que faltaba.

### Si el pedido del carrito sigue sin aparecer en el panel
Abre el sitio, abre las herramientas de desarrollador del navegador (F12) → pestaña "Network"/"Red", agrega algo al carrito y dale "Enviar pedido por WhatsApp". Busca una petición a `/api/orders`:
- Si **no aparece ninguna petición**: el archivo `index.html` desplegado todavía es una versión vieja — vuelve a subir el `index.html` de este paquete.
- Si aparece con **status 500 o error**: cópiame el mensaje de error que muestra la respuesta y lo reviso.
