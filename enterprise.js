const el = (id) => document.getElementById(id);
const STATUS_LABELS = { pendiente: 'Por preparar', listo: 'Listo', entregado: 'Entregado' };
const STATUS_NEXT = { pendiente: 'listo', listo: 'entregado', entregado: null };

let materials = [], products = [], orders = [], activeFilter = 'all';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (window.FITGURT_TOKEN || '') };
}

async function api(url, opts) {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  if (res.status === 401) {
    localStorage.removeItem('fitgurt-enterprise-session');
    window.location.replace('enterprise-login.html');
    throw new Error('Sesión expirada');
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error de servidor');
  if (res.status === 204) return null;
  return res.json();
}

function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

async function loadAll() {
  [materials, products, orders] = await Promise.all([
    api('/api/materials'),
    api('/api/products?all=1'),
    api('/api/orders'),
  ]);
  renderDate();
  renderMetrics();
  renderChart();
  renderTopProducts();
  renderOrders();
  renderStock();
  renderCustomers();
  renderCatalog();
}

function renderDate() {
  const label = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
  const eyebrow = document.querySelector('.topbar .eyebrow');
  if (eyebrow) eyebrow.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function renderMetrics() {
  const todayOrders = orders.filter((o) => isToday(o.created_at));
  const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  el('todaySales').textContent = todaySales.toFixed(2);
  el('todayOrders').textContent = todayOrders.length;
  el('pendingOrders').textContent = orders.filter((o) => o.status === 'pendiente').length;
  el('activeProducts').textContent = products.filter((p) => p.active).length;
}

function renderChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const totals = days.map((d) =>
    orders.filter((o) => new Date(o.created_at).toDateString() === d.toDateString()).reduce((s, o) => s + Number(o.total), 0)
  );
  const max = Math.max(1, ...totals);
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const bars = document.querySelector('.bars');
  const weekTotal = totals.reduce((a, b) => a + b, 0);
  document.querySelector('.sales-panel strong').innerHTML = `$${weekTotal.toFixed(2).split('.')[0]}<span>.${weekTotal.toFixed(2).split('.')[1]}</span>`;
  bars.innerHTML = days
    .map((d, i) => {
      const pct = Math.round((totals[i] / max) * 100);
      const isCurrent = d.toDateString() === new Date().toDateString();
      return `<i style="--h:${Math.max(pct, 3)}%" class="${isCurrent ? 'current' : ''}"><b>$${totals[i].toFixed(0)}</b><small>${labels[d.getDay()]}</small></i>`;
    })
    .join('');
}

function renderTopProducts() {
  const totals = {};
  orders.forEach((o) => (o.items || []).forEach((it) => {
    const key = it.product_name;
    totals[key] = totals[key] || { name: key, qty: 0, revenue: 0 };
    totals[key].qty += it.qty;
    totals[key].revenue += Number(it.unit_price) * it.qty;
  }));
  const top = Object.values(totals).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const dots = ['fresa', 'granola', 'mora'];
  const ol = document.querySelector('.top-products ol');
  ol.innerHTML = top.length
    ? top.map((p, i) => `<li><span class="product-dot ${dots[i % 3]}"></span><div><strong>${p.name}</strong><small>${p.qty} unidades vendidas</small></div><b>$${p.revenue.toFixed(2)}</b></li>`).join('')
    : '<li><div><strong>Todavía no hay ventas</strong><small>Aparecerán aquí en cuanto registres pedidos</small></div></li>';
}

function renderOrders() {
  const query = (el('orderSearch')?.value || '').toLowerCase().trim();
  const statusMap = { pending: 'pendiente', ready: 'listo', delivery: 'entregado' };
  const visible = orders.filter(
    (o) => (activeFilter === 'all' || o.status === statusMap[activeFilter]) &&
      `#${o.id} ${o.customer || ''}`.toLowerCase().includes(query)
  );
  el('ordersTable').innerHTML = visible
    .map((o) => {
      const next = STATUS_NEXT[o.status];
      return `<tr>
        <td><strong class="order-id">#${o.id}</strong><small>${new Date(o.created_at).toLocaleDateString('es-VE')}</small></td>
        <td><strong>${o.customer || 'Sin nombre'}</strong><small>${o.phone || ''}</small></td>
        <td>${o.delivery || (o.channel === 'mayor' ? 'Venta al mayor' : 'Retiro / delivery')}</td>
        <td><strong>$${Number(o.total).toFixed(2)}</strong></td>
        <td><span class="status ${o.status === 'pendiente' ? 'pending' : o.status === 'listo' ? 'ready' : 'delivery'}">${STATUS_LABELS[o.status]}</span></td>
        <td>${next ? `<button class="advance-order" data-id="${o.id}" data-next="${next}">${next === 'listo' ? 'Marcar listo' : 'Marcar entregado'}</button>` : '<button class="row-action" aria-label="Pedido entregado">•••</button>'}</td>
      </tr>`;
    })
    .join('');
  el('emptyOrders').hidden = visible.length !== 0;
  el('orderCount').textContent = orders.filter((o) => o.status === 'pendiente').length;
  document.querySelectorAll('.advance-order').forEach((button) => {
    button.onclick = async () => {
      await api('/api/orders', { method: 'PUT', body: JSON.stringify({ id: Number(button.dataset.id), status: button.dataset.next }) });
      showToast(`Pedido #${button.dataset.id} actualizado.`);
      await loadAll();
    };
  });
}

function renderStock() {
  el('stockList').innerHTML = products
    .map(
      (p) => `<label class="stock-item">
        <span class="product-dot ${p.active ? 'fresa' : 'mora'}"></span>
        <div><strong>${p.name}</strong><small class="${p.active ? '' : 'off'}">${p.active ? 'Disponible para vender' : 'Pausado temporalmente'}</small></div>
        <input class="switch" data-id="${p.id}" type="checkbox" ${p.active ? 'checked' : ''}>
      </label>`
    )
    .join('');
  const activeCount = products.filter((p) => p.active).length;
  el('stockAvailable').textContent = activeCount;
  el('stockNotice').textContent = '● Conectado a la base de datos';
  document.querySelectorAll('.switch').forEach((toggle) => {
    toggle.onchange = async () => {
      const p = products.find((x) => x.id === toggle.dataset.id);
      await api('/api/products', {
        method: 'PUT',
        body: JSON.stringify({ id: p.id, retailPrice: p.retail_price, wholesalePrice: p.wholesale_price, wholesaleMin: p.wholesale_min, active: toggle.checked }),
      });
      showToast('Inventario actualizado.');
      await loadAll();
    };
  });
}

function renderCustomers() {
  const records = Object.values(
    orders.reduce((acc, o) => {
      const name = o.customer || 'Sin nombre';
      if (!acc[name]) acc[name] = { name, amount: 0, count: 0 };
      acc[name].amount += Number(o.total);
      acc[name].count++;
      return acc;
    }, {})
  ).sort((a, b) => b.amount - a.amount);

  el('customerTotal').textContent = records.length;
  el('returningCustomers').textContent = records.filter((c) => c.count > 1).length;
  el('customersList').innerHTML = records
    .slice(0, 4)
    .map(
      (c) => `<div class="customer-row">
        <span class="customer-avatar">${c.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
        <div><strong>${c.name}</strong><small>${c.count} pedido${c.count === 1 ? '' : 's'} registrado${c.count === 1 ? '' : 's'}</small></div>
        <div class="customer-value"><b>$${c.amount.toFixed(2)}</b><span>${c.count > 1 ? 'RECURRENTE' : 'NUEVO'}</span></div>
      </div>`
    )
    .join('');
  el('emptyCustomers').hidden = records.length !== 0;
}

function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let openCatalogId = null;

function renderCatalog() {
  el('catalogList').innerHTML = products
    .map((p) => {
      const flavors = Array.isArray(p.flavors) ? p.flavors : [];
      const isOpen = openCatalogId === p.id;
      return `
      <div class="catalog-row">
        ${p.image ? `<img class="catalog-thumb" src="${p.image}" alt="${p.name}">` : `<div class="catalog-thumb empty">Sin foto</div>`}
        <div>
          <strong>${p.name}</strong>
          <div style="font-size:12px;color:var(--soft);">$${Number(p.retail_price).toFixed(2)} · ${p.active ? 'Activo' : 'Pausado'} · ${flavors.length} sabor(es)</div>
        </div>
        <button class="secondary" onclick="toggleCatalogEdit('${p.id}')">${isOpen ? 'Cerrar' : 'Editar'}</button>
        <div class="catalog-edit ${isOpen ? 'open' : ''}" id="catedit-${p.id}">
          <label>Nombre</label><input type="text" id="catname-${p.id}" value="${p.name}">
          <label>Precio menudeo ($)</label><input type="number" step="0.01" id="catprice-${p.id}" value="${p.retail_price}">
          <label>Foto</label><input type="file" accept="image/*" id="catimg-${p.id}">
          <label>Sabores (marca si NO está disponible)</label>
          <div id="catflavors-${p.id}">
            ${flavors.map((f, i) => `
              <div class="flavor-row" data-flavor="${i}">
                <input type="text" value="${f.label}" class="flavor-label">
                <label style="display:flex;align-items:center;gap:4px;font-size:11.5px;font-weight:500;white-space:nowrap;"><input type="checkbox" class="flavor-avail" ${f.available === false ? '' : 'checked'}> disponible</label>
                <button class="secondary" type="button" onclick="this.closest('[data-flavor]').remove()">Quitar</button>
              </div>`).join('')}
          </div>
          <button class="secondary" type="button" onclick="addFlavorRow('${p.id}')" style="margin-top:6px;">+ Agregar sabor</button>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <button class="primary" type="button" onclick="saveCatalogProduct('${p.id}')">Guardar cambios</button>
            <button class="secondary" type="button" onclick="toggleCatalogActive('${p.id}', ${!p.active})">${p.active ? 'Pausar producto' : 'Activar producto'}</button>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

function toggleCatalogEdit(id) {
  openCatalogId = openCatalogId === id ? null : id;
  renderCatalog();
}

function addFlavorRow(id) {
  const wrap = el('catflavors-' + id);
  const div = document.createElement('div');
  div.className = 'flavor-row';
  div.dataset.flavor = 'new';
  div.innerHTML = `<input type="text" value="" class="flavor-label" placeholder="Nombre del sabor"><label style="display:flex;align-items:center;gap:4px;font-size:11.5px;font-weight:500;white-space:nowrap;"><input type="checkbox" class="flavor-avail" checked> disponible</label><button class="secondary" type="button" onclick="this.closest('[data-flavor]').remove()">Quitar</button>`;
  wrap.appendChild(div);
}

async function toggleCatalogActive(id, value) {
  const p = products.find((x) => x.id === id);
  await api('/api/products', {
    method: 'PUT',
    body: JSON.stringify({ id, retailPrice: p.retail_price, wholesalePrice: p.wholesale_price, wholesaleMin: p.wholesale_min, active: value }),
  });
  showToast(value ? 'Producto activado.' : 'Producto pausado.');
  await loadAll();
}

async function saveCatalogProduct(id) {
  const p = products.find((x) => x.id === id);
  const name = el('catname-' + id).value;
  const retailPrice = Number(el('catprice-' + id).value);
  const flavorRows = [...el('catflavors-' + id).children];
  const flavors = flavorRows.map((row) => ({
    label: row.querySelector('.flavor-label').value.trim(),
    available: row.querySelector('.flavor-avail').checked,
  })).filter((f) => f.label);

  const fileInput = el('catimg-' + id);
  let image = p.image;
  if (fileInput.files[0]) image = await fileToDataUrl(fileInput.files[0]);

  await api('/api/products', {
    method: 'PUT',
    body: JSON.stringify({
      id, name, retailPrice, wholesalePrice: p.wholesale_price, wholesaleMin: p.wholesale_min,
      active: p.active, image, flavors,
    }),
  });
  showToast('Catálogo actualizado.');
  await loadAll();
}

el('newProductForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = el('npId').value.trim().replace(/\s+/g, '_').toLowerCase();
  const name = el('npName').value.trim();
  const retailPrice = Number(el('npPrice').value);
  const fileInput = el('npImage');
  let image = null;
  if (fileInput.files[0]) image = await fileToDataUrl(fileInput.files[0]);
  try {
    await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', id, name, retailPrice, image, category: 'menudeo' }),
    });
    el('npMsg').style.color = 'var(--moss)';
    el('npMsg').textContent = 'Producto agregado.';
    e.target.reset();
    await loadAll();
  } catch (err) {
    el('npMsg').style.color = 'var(--berry)';
    el('npMsg').textContent = err.message;
  }
};

el('newOrder').onclick = () => el('orderDialog').showModal();
el('saveOrder').onclick = async (event) => {
  const name = el('customerName'), total = el('orderTotal');
  if (!name.checkValidity() || !total.checkValidity()) { event.preventDefault(); return; }
  try {
    await api('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: name.value,
        channel: 'menudeo',
        delivery: el('deliveryType').value,
        lines: [{ productId: null, name: 'Pedido manual', qty: 1, unitPrice: Number(total.value) }],
      }),
    });
    showToast('Pedido registrado y agregado a preparación.');
    name.value = total.value = '';
    await loadAll();
  } catch (err) {
    event.preventDefault();
    showToast(err.message);
  }
};

el('exportStock').onclick = () =>
  downloadCsv('fitgurt-inventario.csv', 'producto,disponible\n' + products.map((p) => `"${p.name}",${p.active ? 'si' : 'no'}`).join('\n'));

el('exportCustomers').onclick = () => {
  const records = Object.values(
    orders.reduce((acc, o) => {
      const name = o.customer || 'Sin nombre';
      if (!acc[name]) acc[name] = { name, amount: 0, count: 0 };
      acc[name].amount += Number(o.total);
      acc[name].count++;
      return acc;
    }, {})
  );
  downloadCsv('fitgurt-clientes.csv', 'cliente,pedidos,total_usd\n' + records.map((c) => `"${c.name}",${c.count},${c.amount.toFixed(2)}`).join('\n'));
  showToast('Exportación de clientes lista.');
};

el('orderSearch').oninput = renderOrders;
document.querySelectorAll('.filter').forEach((button) => {
  button.onclick = () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
    renderOrders();
  };
});
el('showAllOrders').onclick = () => {
  activeFilter = 'all';
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item.dataset.filter === 'all'));
  el('orderSearch').value = '';
  renderOrders();
  el('pedidos').scrollIntoView({ behavior: 'smooth' });
};
document.querySelector('.menu-toggle').onclick = () => document.querySelector('.sidebar').classList.toggle('open');

loadAll().catch((err) => showToast(err.message));
