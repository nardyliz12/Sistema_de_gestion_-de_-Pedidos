/* ================================================================
   VIEW: CLIENTES
   ================================================================ */
function viewClientes() {
  const clientes = ClienteApi.getAll();
  const orders   = PedidoApi.getAllOrders();

  // Enriquecer cada cliente con sus estadísticas de pedidos
  const enriched = clientes.map(c => {
    const clientOrders = orders.filter(o =>
      o.client.email.toLowerCase() === c.email.toLowerCase()
    );
    const totalSpent = clientOrders
      .filter(o => o.payment?.status === 'Pagado')
      .reduce((s, o) => s + o.payment.amount, 0);
    const lastOrder = clientOrders.sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    return { ...c, orderCount: clientOrders.length, totalSpent, lastOrder };
  });

  const totalRevenue  = enriched.reduce((s, c) => s + c.totalSpent, 0);
  const conPedidos    = enriched.filter(c => c.orderCount > 0).length;

  const rows = enriched.length === 0
    ? `<tr class="empty-row"><td colspan="6"><span class="empty-icon">👥</span><p>No hay clientes registrados aún.</p></td></tr>`
    : enriched.map(c => `
        <tr>
          <td>
            <div class="cell-client">
              <strong>${c.name}</strong>
              <small>${c.email}</small>
            </div>
          </td>
          <td>${c.phone}</td>
          <td style="text-align:center">
            <span class="badge ${c.orderCount > 0 ? 'badge-info' : 'badge-neutral'}">${c.orderCount}</span>
          </td>
          <td><strong>${fmt(c.totalSpent)}</strong></td>
          <td style="white-space:nowrap">
            ${c.lastOrder ? fmtDate(c.lastOrder.date) : '<span class="text-muted text-sm">—</span>'}
          </td>
          <td>
            <div class="action-group">
              ${c.lastOrder
                ? `<button class="icon-btn icon-primary" title="Ver último pedido" onclick="go('detalle-${c.lastOrder.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                   </button>`
                : ''}
              <button class="icon-btn icon-danger" title="Eliminar" onclick="confirmDeleteCliente('${c.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join('');

  return `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Clientes</h1>
        <p>Directorio de clientes del sistema</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Clientes</span>
        <span class="stat-value">${clientes.length}</span>
      </div>
      <div class="stat-card s-info">
        <span class="stat-label">Con Pedidos</span>
        <span class="stat-value">${conPedidos}</span>
      </div>
      <div class="stat-card s-success">
        <span class="stat-label">Sin Pedidos</span>
        <span class="stat-value">${clientes.length - conPedidos}</span>
      </div>
      <div class="stat-card s-primary">
        <span class="stat-label">Ingresos Totales</span>
        <span class="stat-value" style="font-size:1.4rem">${fmt(totalRevenue)}</span>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th style="text-align:center">Pedidos</th>
            <th>Total Pagado</th>
            <th>Último Pedido</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function afterClientes() {
  // Reservado para búsqueda futura
}

/* ================================================================
   ACCIONES: CLIENTES
   ================================================================ */
function confirmDeleteCliente(id) {
  const c = ClienteApi.getById(id);
  if (!c) return;
  showModal(`
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-size:2.5rem;margin-bottom:12px">👤</div>
      <h3 style="font-family:var(--font-head);font-size:1.1rem;margin-bottom:8px">Eliminar cliente</h3>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:22px">
        ¿Eliminar a <strong>${c.name}</strong> del directorio?<br>
        <span style="font-size:0.8rem">Sus pedidos existentes no se verán afectados.</span>
      </p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="doDeleteCliente('${id}')">Sí, eliminar</button>
      </div>
    </div>`);
}

function doDeleteCliente(id) {
  ClienteApi.remove(id);
  closeModal();
  toast('Cliente eliminado del directorio', 'info');
  go('clientes');
}
