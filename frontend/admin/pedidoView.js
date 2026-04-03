/* ================================================================
   VIEW: PEDIDOS
   ================================================================ */
function viewPedidos() {
  const orders = PedidoApi.getAllOrders();

  const filtered = orders.filter(o => {
    const q      = State.searchQ.toLowerCase();
    const matchQ = !q || o.id.toLowerCase().includes(q)
                      || o.client.name.toLowerCase().includes(q)
                      || o.client.email.toLowerCase().includes(q);
    const matchS = State.statusFilter === 'Todos' || o.status === State.statusFilter;
    return matchQ && matchS;
  });

  const stats = {
    total:     orders.length,
    pending:   orders.filter(o => o.status === 'Pendiente').length,
    inProcess: orders.filter(o => ['En Proceso','En Camino'].includes(o.status)).length,
    done:      orders.filter(o => o.status === 'Completado').length,
  };

  const rows = filtered.length === 0
    ? `<tr class="empty-row"><td colspan="8"><span class="empty-icon">📋</span><p>No se encontraron pedidos</p></td></tr>`
    : filtered.map(o => `
        <tr>
          <td class="cell-id">${o.id}</td>
          <td><div class="cell-client"><strong>${o.client.name}</strong><small>${o.client.email}</small></div></td>
          <td>${o.products.length} prod.</td>
          <td><strong>${fmt(total(o.products))}</strong></td>
          <td><span class="badge ${statusBadge(o.status)}">${o.status}</span></td>
          <td>${o.payment ? `<span class="badge ${payBadge(o.payment.status)}">${o.payment.status}</span>` : '<span class="badge badge-neutral">Sin pago</span>'}</td>
          <td style="white-space:nowrap">${fmtDate(o.date)}</td>
          <td>
            <div class="action-group">
              <button class="icon-btn icon-primary" title="Ver detalle" onclick="go('detalle-${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="icon-btn" title="Editar" onclick="go('editar-${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn icon-danger" title="Eliminar" onclick="confirmDelete('${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join('');

  return `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Pedidos</h1>
        <p>Gestiona y visualiza todos los pedidos del sistema</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Pedidos</span>
        <span class="stat-value">${stats.total}</span>
      </div>
      <div class="stat-card s-warning">
        <span class="stat-label">Pendientes</span>
        <span class="stat-value">${stats.pending}</span>
      </div>
      <div class="stat-card s-info">
        <span class="stat-label">En Proceso</span>
        <span class="stat-value">${stats.inProcess}</span>
      </div>
      <div class="stat-card s-success">
        <span class="stat-label">Completados</span>
        <span class="stat-value">${stats.done}</span>
      </div>
    </div>

    <div class="filter-bar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="search-inp" type="text" placeholder="Buscar por número, cliente o email..." value="${State.searchQ}">
      </div>
      <select id="status-sel" class="filter-select">
        ${['Todos','Pendiente','En Proceso','En Camino','Completado','Cancelado'].map(s =>
          `<option value="${s}" ${State.statusFilter===s?'selected':''}>${s === 'Todos' ? 'Todos los estados' : s}</option>`
        ).join('')}
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Pago</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function afterPedidos() {
  document.getElementById('search-inp')?.addEventListener('input', e => {
    State.searchQ = e.target.value; render();
  });
  document.getElementById('status-sel')?.addEventListener('change', e => {
    State.statusFilter = e.target.value; render();
  });
}

/* ================================================================
   CONFIRM / DELETE PEDIDO
   ================================================================ */
function confirmDelete(id) {
  const o = PedidoApi.getOrderById(id);
  if (!o) return;
  showModal(`
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-size:2.5rem;margin-bottom:12px">🗑️</div>
      <h3 style="font-family:var(--font-head);font-size:1.1rem;margin-bottom:8px">Eliminar pedido</h3>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:22px">¿Seguro que deseas eliminar <strong>${id}</strong>? Esta acción no se puede deshacer.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="doDelete('${id}')">Sí, eliminar</button>
      </div>
    </div>`);
}

function doDelete(id) {
  PedidoApi.removeOrder(id);
  closeModal();
  toast('Pedido eliminado', 'info');
  render();
}

/* ================================================================
   VIEW: DETALLE
   ================================================================ */
function viewDetalle(id) {
  const o = PedidoApi.getOrderById(id);
  if (!o) return '<p>Pedido no encontrado.</p>';

  const sub  = subtotal(o.products);
  const iva  = sub * IVA_RATE;
  const tot  = sub + iva;
  const rep  = o.repartidorId ? PedidoApi.getRepById(o.repartidorId) : null;
  const reps = PedidoApi.getAllReps();

  const tlItems = [...o.history].reverse().map(h => `
    <div class="timeline-item">
      <div class="tl-dot ${dotClass(h.status)}"></div>
      <div class="tl-content">
        <div class="tl-header">
          <span class="tl-status">${h.status}</span>
          <span class="tl-date">${fmtDate(h.date)}</span>
        </div>
        ${h.note ? `<p class="tl-note">${h.note}</p>` : ''}
      </div>
    </div>`).join('');

  return `
    <div class="page-header">
      <button class="back-btn" onclick="go('pedidos')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
      <div class="page-header-text">
        <h1>${o.id}</h1>
        <p>${fmtDate(o.date)}</p>
      </div>
      <div class="header-actions">
        <span class="badge ${statusBadge(o.status)} badge-lg">${o.status}</span>
        <button class="btn btn-secondary" onclick="go('editar-${o.id}')">✏️ Editar</button>
        ${!o.payment ? `<button class="btn btn-primary" onclick="go('pago-${o.id}')">💳 Pagar</button>` : ''}
        <button class="btn btn-danger" onclick="confirmDelete('${o.id}')">🗑️</button>
      </div>
    </div>

    <div class="detail-layout">
      <!-- COLUMNA IZQUIERDA -->
      <div>
        <div class="card">
          <p class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Información del Cliente
          </p>
          <div class="info-field"><label>Nombre</label><span>${o.client.name}</span></div>
          <div class="info-field"><label>📧 Email</label><span>${o.client.email}</span></div>
          <div class="info-field"><label>📞 Teléfono</label><span>${o.client.phone}</span></div>
          <div class="info-field"><label>📍 Dirección</label><span>${o.client.address}</span></div>
        </div>

        <div class="card">
          <p class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Repartidor Asignado
          </p>
          ${rep
            ? `<div class="info-field"><label>Nombre</label><span>${rep.name}</span></div>
               <div class="info-field"><label>📞 Teléfono</label><span>${rep.phone}</span></div>`
            : `<p class="text-muted text-sm">Sin repartidor asignado</p>`}
          <div class="rep-select-row">
            <select id="rep-sel">
              <option value="">— Seleccionar repartidor —</option>
              ${reps.filter(r => r.active).map(r =>
                `<option value="${r.id}" ${o.repartidorId === r.id ? 'selected' : ''}>${r.name}</option>`
              ).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="assignRep('${o.id}')">Asignar</button>
          </div>
        </div>

        ${o.notes ? `
          <div class="card">
            <p class="card-title">📝 Notas</p>
            <p class="text-sm" style="color:var(--text-secondary);font-style:italic">${o.notes}</p>
          </div>` : ''}

        ${o.payment ? `
          <div class="card">
            <p class="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Información de Pago
            </p>
            <div class="info-field"><label>Método</label><span>${o.payment.method}</span></div>
            <div class="info-field"><label>Estado</label><span class="badge ${payBadge(o.payment.status)}">${o.payment.status}</span></div>
            <div class="info-field"><label>Monto</label><span><strong>${fmt(o.payment.amount)}</strong></span></div>
            <div class="info-field"><label>Fecha</label><span>${fmtDate(o.payment.date)}</span></div>
          </div>` : ''}

        <div class="card">
          <p class="card-title">🔄 Cambiar Estado</p>
          <div class="status-form">
            <select id="new-status">
              ${['Pendiente','En Proceso','En Camino','Completado','Cancelado'].map(s =>
                `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`
              ).join('')}
            </select>
            <input type="text" id="status-note" placeholder="Nota opcional...">
            <button class="btn btn-primary" onclick="changeStatus('${o.id}')">Actualizar Estado</button>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA -->
      <div>
        <div class="card">
          <p class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            Productos
          </p>
          ${o.products.map(p => `
            <div class="product-line">
              <div class="product-line-info">
                <strong>${p.name}</strong>
                <small>${p.category} · Cant: ${p.quantity}</small>
              </div>
              <div class="product-line-price">
                <strong>${fmt(p.price * p.quantity)}</strong>
                <small>${fmt(p.price)} c/u</small>
              </div>
            </div>`).join('')}
          <div class="totals-block">
            <div class="total-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
            <div class="total-row"><span>IVA (21%)</span><span>${fmt(iva)}</span></div>
            <div class="total-row final"><span>Total</span><span>${fmt(tot)}</span></div>
          </div>
        </div>

        <div class="card">
          <p class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Historial del Pedido
          </p>
          <div class="timeline mt-1">${tlItems}</div>
        </div>
      </div>
    </div>`;
}

function assignRep(orderId) {
  const o     = PedidoApi.getOrderById(orderId);
  const repId = document.getElementById('rep-sel')?.value;
  if (!o) return;
  o.repartidorId = repId || null;
  if (repId) {
    const rep = PedidoApi.getRepById(repId);
    o.history.push({ date:now(), status:o.status, note:`Asignado a: ${rep?.name || repId}` });
  }
  PedidoApi.saveOrder(o);
  toast(repId ? 'Repartidor asignado ✓' : 'Repartidor removido');
  render();
}

function changeStatus(orderId) {
  const o       = PedidoApi.getOrderById(orderId);
  const newStat = document.getElementById('new-status')?.value;
  const note    = document.getElementById('status-note')?.value?.trim();
  if (!o || !newStat) return;
  o.status = newStat;
  o.history.push({ date:now(), status:newStat, note: note || '' });
  PedidoApi.saveOrder(o);
  toast(`Estado actualizado: ${newStat}`);
  render();
}

/* ================================================================
   VIEW: FORM (NUEVO / EDITAR)
   ================================================================ */
function viewForm(orderId) {
  const o = orderId ? PedidoApi.getOrderById(orderId) : null;
  if (orderId && !o) return '<p>Pedido no encontrado.</p>';
  const c = o?.client || {};

  return `
    <div class="page-header">
      <button class="back-btn" onclick="State.cart=[];go('${o ? 'detalle-'+o.id : 'pedidos'}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
      <div class="page-header-text">
        <h1>${o ? 'Editar Pedido' : 'Nuevo Pedido'}</h1>
        <p>Completa la información para ${o ? 'editar el' : 'crear un nuevo'} pedido</p>
      </div>
    </div>

    <div class="order-form-layout">
      <!-- IZQUIERDA: Cliente + Productos -->
      <div>
        <div class="card">
          <p class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Información del Cliente
          </p>
          <div class="form-grid-2">
            <div class="form-group"><label>Nombre Completo *</label><input id="cl-name"    type="text"  value="${c.name||''}"    placeholder="Ingrese su nombre"></div>
            <div class="form-group"><label>Email *</label>          <input id="cl-email"   type="email" value="${c.email||''}"   placeholder="cliente@gmail.com"></div>
          </div>
          <div class="form-grid-2">
            <div class="form-group"><label>Teléfono *</label>       <input id="cl-phone"   type="text"  value="${c.phone||''}"   placeholder="+51 9XX XXX XXX"></div>
            <div class="form-group"><label>Dirección *</label>      <input id="cl-address" type="text"  value="${c.address||''}" placeholder="Av. Robles 343 – SMP"></div>
          </div>
        </div>

        <div class="card">
          <p class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
            Seleccionar Productos
          </p>
          <div class="product-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="prod-search" class="product-search-input" type="text" placeholder="Buscar producto..." value="${State.productQ}" oninput="onProductSearch(this.value)">
          </div>
          <div class="products-grid" id="prod-grid">${renderProductCards()}</div>
        </div>
      </div>

      <!-- DERECHA: Carrito -->
      <div class="cart-sticky">
        <div class="card">
          <p class="card-title" id="cart-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>
            Carrito (${State.cart.length})
          </p>
          <div id="cart-items">${renderCartItems()}</div>
          <div id="cart-totals" class="totals-block">${renderCartTotals()}</div>
          <div class="form-group mt-2">
            <label>Notas del pedido</label>
            <textarea id="order-notes" placeholder="Instrucciones especiales, envío urgente...">${o?.notes||''}</textarea>
          </div>
          <button class="btn btn-primary btn-full btn-lg mt-1" onclick="submitOrder()">
            ${o ? '💾 Guardar Cambios' : '✅ Crear Pedido'}
          </button>
        </div>
      </div>
    </div>`;
}

function renderProductCards() {
  const q = State.productQ.toLowerCase();
  return CATALOG
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    .map(p => {
      const inCart = State.cart.find(c => c.id === p.id);
      return `
        <div class="product-card ${inCart ? 'in-cart' : ''}">
          <div class="product-card-info">
            <strong>${p.name}</strong>
            <small>${p.category}</small>
            <span class="pcp">${fmt(p.price)}</span>
          </div>
          ${inCart
            ? `<div class="qty-ctrl">
                <button onclick="updateQty('${p.id}',-1)">−</button>
                <span>${inCart.quantity}</span>
                <button onclick="updateQty('${p.id}',1)">+</button>
               </div>`
            : `<button class="add-btn" onclick="addToCart('${p.id}')">+</button>`}
        </div>`;
    }).join('');
}

function renderCartItems() {
  if (State.cart.length === 0) return `
    <div class="cart-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>
      No hay nada en el carrito...
    </div>`;
  return State.cart.map(i => `
    <div class="cart-item">
      <div class="cart-item-info">
        <strong>${i.name}</strong>
        <small>x${i.quantity} × ${fmt(i.price)}</small>
      </div>
      <div class="cart-item-right">
        <strong>${fmt(i.price * i.quantity)}</strong>
        <button class="remove-btn" onclick="removeFromCart('${i.id}')" title="Quitar">×</button>
      </div>
    </div>`).join('');
}

function renderCartTotals() {
  const sub = subtotal(State.cart);
  const iva = sub * IVA_RATE;
  const tot = sub + iva;
  return `
    <div class="total-row"><span>Productos</span><span>${State.cart.length}</span></div>
    <div class="total-row"><span>Unidades</span><span>${State.cart.reduce((s,p)=>s+p.quantity,0)}</span></div>
    <div class="total-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
    <div class="total-row"><span>IVA (21%)</span><span>${fmt(iva)}</span></div>
    <div class="total-row final"><span>Total</span><span>${fmt(tot)}</span></div>`;
}

function afterForm() {
  // Los handlers están inline — nada extra necesario
}

function onProductSearch(val) {
  State.productQ = val;
  const grid = document.getElementById('prod-grid');
  if (grid) grid.innerHTML = renderProductCards();
}

function addToCart(pid) {
  const p = CATALOG.find(x => x.id === pid);
  if (!p) return;
  const existing = State.cart.find(c => c.id === pid);
  if (existing) existing.quantity++;
  else State.cart.push({ ...p, quantity:1 });
  refreshCart();
}

function removeFromCart(pid) {
  State.cart = State.cart.filter(c => c.id !== pid);
  refreshCart();
}

function updateQty(pid, delta) {
  const item = State.cart.find(c => c.id === pid);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) State.cart = State.cart.filter(c => c.id !== pid);
  refreshCart();
}

function refreshCart() {
  const grid  = document.getElementById('prod-grid');
  const items = document.getElementById('cart-items');
  const tots  = document.getElementById('cart-totals');
  const title = document.getElementById('cart-title');
  if (grid)  grid.innerHTML  = renderProductCards();
  if (items) items.innerHTML = renderCartItems();
  if (tots)  tots.innerHTML  = renderCartTotals();
  if (title) title.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>
    Carrito (${State.cart.length})`;
}

function submitOrder() {
  const name    = document.getElementById('cl-name')?.value?.trim();
  const email   = document.getElementById('cl-email')?.value?.trim();
  const phone   = document.getElementById('cl-phone')?.value?.trim();
  const address = document.getElementById('cl-address')?.value?.trim();
  const notes   = document.getElementById('order-notes')?.value?.trim();

  if (!name || !email || !phone || !address) { toast('Completa todos los campos del cliente', 'error'); return; }
  if (State.cart.length === 0)              { toast('Agrega al menos un producto al carrito', 'error'); return; }

  const client = { name, email, phone, address };

  // Sincroniza con ClienteApi (agrega si no existe)
  if (!ClienteApi.findByEmail(email)) {
    ClienteApi.save({ id: ClienteApi.nextId(), ...client, createdAt: now() });
  }

  if (State.editingId) {
    const o = PedidoApi.getOrderById(State.editingId);
    if (o) {
      o.client   = client;
      o.products = State.cart.map(p => ({ ...p }));
      o.notes    = notes;
      o.history.push({ date:now(), status:o.status, note:'Pedido editado' });
      PedidoApi.saveOrder(o);
    }
    toast('Pedido actualizado correctamente ✓');
    const editedId = State.editingId;
    State.cart = []; State.editingId = null;
    go('detalle-' + editedId);
  } else {
    const newOrder = {
      id:          PedidoApi.nextId(),
      client,
      products:    State.cart.map(p => ({ ...p })),
      status:      'Pendiente',
      date:        now(),
      notes,
      repartidorId: null,
      payment:     null,
      history:     [{ date:now(), status:'Pendiente', note:'Pedido creado' }],
    };
    PedidoApi.saveOrder(newOrder);
    toast('¡Pedido creado exitosamente! ✓');
    State.cart = []; State.editingId = null;
    go('pedidos');
  }
}

/* ================================================================
   VIEW: PAGO
   ================================================================ */
function viewPago(id) {
  const o = PedidoApi.getOrderById(id);
  if (!o) return '<p>Pedido no encontrado.</p>';
  if (o.payment) return `<p style="padding:40px;text-align:center">Este pedido ya tiene un pago registrado. <button class="btn btn-secondary" onclick="go('detalle-${id}')">← Volver</button></p>`;

  const tot = total(o.products);

  return `
    <div class="page-header">
      <button class="back-btn" onclick="go('detalle-${id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
      <div class="page-header-text">
        <h1>Pago en Línea</h1>
        <p>Pedido ${id} · ${o.client.name}</p>
      </div>
    </div>

    <div class="payment-wrap">
      <div class="payment-inner">
        <div class="card">
          <div class="payment-hero">
            <div class="payment-amount">${fmt(tot)}</div>
            <p class="payment-desc">${o.products.length} producto(s) · Pedido ${id}</p>
          </div>

          <p class="card-title">Método de Pago</p>
          <div class="pay-methods">
            ${PagoApi.METHODS.map((m, i) => `
              <label class="pay-method ${i===0?'checked':''}">
                <input type="radio" name="pay-meth" value="${m.val}" ${i===0?'checked':''} onchange="onPayMethodChange(this)">
                <span class="pay-method-icon">${m.icon}</span>
                <span class="pay-method-label">${m.val}</span>
              </label>`).join('')}
          </div>

          <div id="card-fields">
            <div class="form-group"><label>Número de Tarjeta</label><input type="text" id="cn" placeholder="1234 5678 9012 3456" maxlength="19" oninput="fmtCard(this)"></div>
            <div class="form-grid-2">
              <div class="form-group"><label>Vencimiento</label><input type="text" id="ce" placeholder="MM/AA" maxlength="5" oninput="fmtExp(this)"></div>
              <div class="form-group"><label>CVV</label><input type="password" id="cv" placeholder="•••" maxlength="3"></div>
            </div>
            <div class="form-group"><label>Nombre en la tarjeta</label><input type="text" id="cname" placeholder="${o.client.name}"></div>
          </div>

          <button class="btn btn-primary btn-full btn-lg" id="pay-btn" onclick="processPayment('${id}')">
            🔒 Pagar ${fmt(tot)}
          </button>
          <p class="secure-note">🔒 Pago simulado — datos no almacenados</p>
        </div>
      </div>
    </div>`;
}

function afterPago() {
  document.querySelectorAll('input[name="pay-meth"]').forEach(r => {
    r.addEventListener('change', () => onPayMethodChange(r));
  });
}

function onPayMethodChange(el) {
  document.querySelectorAll('.pay-method').forEach(l => l.classList.remove('checked'));
  el.closest('.pay-method').classList.add('checked');
  const isCard = el.value.includes('Tarjeta');
  const cf = document.getElementById('card-fields');
  if (cf) cf.style.display = isCard ? 'block' : 'none';
}

function processPayment(orderId) {
  const method = document.querySelector('input[name="pay-meth"]:checked')?.value;
  const btn    = document.getElementById('pay-btn');
  const o      = PedidoApi.getOrderById(orderId);

  if (!method) { toast('Selecciona un método de pago', 'error'); return; }
  if (!o) return;

  btn.disabled    = true;
  btn.textContent = '⏳ Procesando...';

  PagoApi.process(
    orderId,
    method,
    ({ status, date }) => {
      // Éxito
      o.payment = { method, status, amount: total(o.products), date };
      o.status  = 'En Proceso';
      o.history.push({ date, status:'En Proceso', note:`Pago exitoso via ${method}` });
      PedidoApi.saveOrder(o);
      toast('✅ Pago procesado exitosamente');
      go('detalle-' + orderId);
    },
    ({ date }) => {
      // Fallo — FIX: reactiva el botón para que el usuario pueda reintentar
      o.history.push({ date, status:o.status, note:'Intento de pago fallido' });
      PedidoApi.saveOrder(o);
      btn.disabled  = false;
      btn.innerHTML = `🔒 Pagar ${fmt(total(o.products))}`;
      toast('❌ Pago rechazado. Intenta con otro método.', 'error');
    }
  );
}

/* ================================================================
   VIEW: HISTORIAL
   ================================================================ */
function viewHistorial() {
  const orders = PedidoApi.getAllOrders();

  const allEvents = [];
  orders.forEach(o => {
    o.history.forEach(h => allEvents.push({ ...h, orderId:o.id, clientName:o.client.name }));
  });
  allEvents.sort((a,b) => new Date(b.date) - new Date(a.date));

  const revenue = orders
    .filter(o => o.payment?.status === 'Pagado')
    .reduce((s,o) => s + o.payment.amount, 0);

  const tlItems = allEvents.map(e => `
    <div class="timeline-item clickable" onclick="go('detalle-${e.orderId}')">
      <div class="tl-dot ${dotClass(e.status)}"></div>
      <div class="tl-content">
        <div class="tl-header">
          <span class="tl-status">${e.status}</span>
          <span class="tl-date">${fmtDate(e.date)}</span>
        </div>
        <span class="tl-order">${e.orderId} — ${e.clientName}</span>
        ${e.note ? `<p class="tl-note">${e.note}</p>` : ''}
      </div>
    </div>`).join('');

  return `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Historial de Pedidos</h1>
        <p>Registro completo de todos los eventos del sistema</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Pedidos</span>
        <span class="stat-value">${orders.length}</span>
      </div>
      <div class="stat-card s-success">
        <span class="stat-label">Completados</span>
        <span class="stat-value">${orders.filter(o=>o.status==='Completado').length}</span>
      </div>
      <div class="stat-card s-danger">
        <span class="stat-label">Cancelados</span>
        <span class="stat-value">${orders.filter(o=>o.status==='Cancelado').length}</span>
      </div>
      <div class="stat-card s-primary">
        <span class="stat-label">Ingresos</span>
        <span class="stat-value" style="font-size:1.4rem">${fmt(revenue)}</span>
      </div>
    </div>

    <div class="card">
      <p class="card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Línea de Tiempo
        <span style="margin-left:auto;font-family:var(--font-body);font-weight:400;color:var(--text-muted);font-size:0.8rem">${allEvents.length} eventos — clic en un evento para ver el pedido</span>
      </p>
      <div class="timeline">
        ${allEvents.length === 0
          ? '<p class="text-muted text-sm" style="padding:20px 0">No hay eventos registrados.</p>'
          : tlItems}
      </div>
    </div>`;
}

/* ================================================================
   VIEW: REPARTIDORES
   ================================================================ */
function viewRepartidores() {
  const repartidores = PedidoApi.getAllReps();
  const orders       = PedidoApi.getAllOrders();

  const cards = repartidores.map(r => {
    const active    = orders.filter(o => o.repartidorId === r.id && !['Completado','Cancelado'].includes(o.status)).length;
    const completed = orders.filter(o => o.repartidorId === r.id && o.status === 'Completado').length;
    return `
      <div class="rep-card ${r.active ? '' : 'inactive'}">
        <div class="rep-header">
          <div class="rep-avatar">${r.name.charAt(0)}</div>
          <div>
            <p class="rep-name">${r.name}</p>
            <p class="rep-phone">${r.phone}</p>
          </div>
        </div>
        <div class="rep-stats-row">
          <div class="rep-stat">
            <span class="rep-stat-val">${active}</span>
            <span class="rep-stat-lbl">Activos</span>
          </div>
          <div class="rep-stat">
            <span class="rep-stat-val">${completed}</span>
            <span class="rep-stat-lbl">Completados</span>
          </div>
        </div>
        <div class="rep-footer">
          <span class="badge ${r.active ? 'badge-success' : 'badge-neutral'}">${r.active ? 'Activo' : 'Inactivo'}</span>
          <button class="btn btn-secondary btn-sm" onclick="toggleRep('${r.id}')">${r.active ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRep('${r.id}')">Eliminar</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Repartidores</h1>
        <p>Gestión del equipo de reparto y asignaciones</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="showRepForm()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Repartidor
        </button>
      </div>
    </div>

    <div id="rep-form-area"></div>
    <div class="reps-grid" id="reps-grid">${cards || '<p class="text-muted">No hay repartidores registrados.</p>'}</div>`;
}

function showRepForm() {
  document.getElementById('rep-form-area').innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <p class="card-title">Nuevo Repartidor</p>
      <div class="form-grid-2">
        <div class="form-group"><label>Nombre *</label><input id="rep-n" type="text" placeholder="Nombre completo"></div>
        <div class="form-group"><label>Teléfono *</label><input id="rep-p" type="text" placeholder="+51 9XX XXX XXX"></div>
      </div>
      <div class="form-btns">
        <button class="btn btn-secondary" onclick="document.getElementById('rep-form-area').innerHTML=''">Cancelar</button>
        <button class="btn btn-primary" onclick="addRep()">Guardar Repartidor</button>
      </div>
    </div>`;
  document.getElementById('rep-n')?.focus();
}

function addRep() {
  const name  = document.getElementById('rep-n')?.value?.trim();
  const phone = document.getElementById('rep-p')?.value?.trim();
  if (!name || !phone) { toast('Completa nombre y teléfono', 'error'); return; }
  PedidoApi.saveRep({ id:'r'+Date.now(), name, phone, active:true });
  toast('Repartidor agregado ✓');
  go('repartidores');
}

function toggleRep(id) {
  const r = PedidoApi.getRepById(id);
  if (!r) return;
  r.active = !r.active;
  PedidoApi.saveRep(r);
  render();
}

function deleteRep(id) {
  const r = PedidoApi.getRepById(id);
  if (!r) return;
  const assigned = PedidoApi.getAllOrders()
    .some(o => o.repartidorId === id && !['Completado','Cancelado'].includes(o.status));
  if (assigned) { toast('Tiene pedidos activos asignados. Reasigna primero.', 'error'); return; }
  showModal(`
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-size:2.5rem;margin-bottom:12px">🚴</div>
      <h3 style="font-family:var(--font-head);font-size:1.1rem;margin-bottom:8px">Eliminar repartidor</h3>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:22px">¿Eliminar a <strong>${r.name}</strong>?</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="doDeleteRep('${id}')">Sí, eliminar</button>
      </div>
    </div>`);
}

function doDeleteRep(id) {
  PedidoApi.removeRep(id);
  closeModal();
  toast('Repartidor eliminado', 'info');
  go('repartidores');
}
