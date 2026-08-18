import { neon } from '@neondatabase/serverless';
import { requireAuth } from './_auth.js';

const sql = neon(process.env.DATABASE_URL);

// Arma el documentoElectronico a partir de un pedido guardado.
// Ajusta los nombres de campo exactos según la documentación final de tu proveedor
// (HKA / Unidigital u otro) — esta es una base fiel al esquema que compartiste.
function buildDocumentoElectronico(order, items, seller) {
  const isExento = false; // cambia si algún producto aplica exento de IVA
  const tasaIVA = 16; // ajusta a la tasa vigente
  const gravado = items.reduce((s, it) => s + Number(it.unit_price) * it.qty, 0);
  const iva = isExento ? 0 : Math.round(gravado * (tasaIVA / 100) * 100) / 100;

  return {
    encabezado: {
      identificacionDocumento: {
        tipoDocumento: '01', // 01 = Factura (confirma el código exacto con tu proveedor)
        numeroDocumento: String(order.id),
        fechaEmision: new Date(order.created_at).toISOString(),
        moneda: 'VES',
        tipoTransaccion: 'VENTA',
      },
      vendedor: {
        rif: seller.rif,
        razonSocial: seller.razonSocial,
        direccion: seller.direccion,
      },
      comprador: {
        rif: order.customer_rif || '',
        razonSocial: order.customer || '',
        direccion: order.delivery || '',
        telefono: order.phone || '',
      },
      totales: {
        montoGravado: gravado,
        montoExento: 0,
        subTotal: gravado,
        totalIVA: iva,
        totalPagar: gravado + iva,
        descuento: 0,
      },
    },
    detallesItems: items.map((it, i) => ({
      numeroLinea: i + 1,
      codigo: it.product_id || 'MANUAL',
      descripcion: it.product_name,
      cantidad: it.qty,
      precioUnitario: Number(it.unit_price),
      montoTotal: Number(it.unit_price) * it.qty,
      alicuotaIVA: tasaIVA,
      valorIVA: Math.round(Number(it.unit_price) * it.qty * (tasaIVA / 100) * 100) / 100,
    })),
    infoAdicional: [{ campo: 'canal', valor: order.channel }],
  };
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Método no permitido');
  }

  const providerUrl = process.env.SENIAT_PROVIDER_URL;
  const providerToken = process.env.SENIAT_API_TOKEN;
  const sellerRif = process.env.SELLER_RIF;
  const sellerName = process.env.SELLER_RAZON_SOCIAL;
  const sellerAddress = process.env.SELLER_DIRECCION;

  if (!providerUrl || !providerToken || !sellerRif || !sellerName) {
    return res.status(501).json({
      error:
        'La facturación electrónica todavía no está configurada. Faltan variables de entorno: SENIAT_PROVIDER_URL, SENIAT_API_TOKEN, SELLER_RIF, SELLER_RAZON_SOCIAL, SELLER_DIRECCION.',
    });
  }

  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Falta orderId' });

    const [order] = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`;

    const documento = buildDocumentoElectronico(order, items, {
      rif: sellerRif,
      razonSocial: sellerName,
      direccion: sellerAddress,
    });

    const providerRes = await fetch(providerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ documentoElectronico: documento }),
    });
    const providerData = await providerRes.json();

    if (!providerRes.ok || providerData.codigo !== '200') {
      return res.status(502).json({ error: 'El proveedor fiscal rechazó el documento', detail: providerData });
    }

    const numeroControl = providerData.resultado?.numeroControl || null;
    await sql`UPDATE orders SET control_number = ${numeroControl}, invoiced_at = now() WHERE id = ${orderId}`;

    return res.status(200).json({ numeroControl, raw: providerData });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error de servidor', detail: String(err.message || err) });
  }
}
