/* ================================================================
   CLIENTE API — Capa de datos: clientes
   ----------------------------------------------------------------
   Incluye migración automática: extrae clientes únicos de los
   pedidos existentes la primera vez que se inicializa.
   ================================================================ */

const ClienteApi = (() => {

  const KEY = 'sgp_clientes';

  /* ── ID con contador ─────────────────────────────────────────── */
  function nextId() {
    const n = Store.get('sgp_cli_counter', 0) + 1;
    Store.set('sgp_cli_counter', n);
    return `CLI-${String(n).padStart(3, '0')}`;
  }

  /* ── Migración automática desde pedidos existentes ───────────── */
  function _migrate() {
    if (Store.get(KEY, null) !== null) return; // ya migrado

    const orders   = PedidoApi.getAllOrders();
    const seen     = new Set();
    const clientes = [];
    let   counter  = 0;

    orders.forEach(o => {
      const key = o.client.email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        counter++;
        clientes.push({
          id:        `CLI-${String(counter).padStart(3,'0')}`,
          name:      o.client.name,
          email:     o.client.email,
          phone:     o.client.phone,
          address:   o.client.address,
          createdAt: o.date,
        });
      }
    });

    Store.set(KEY, clientes);
    Store.set('sgp_cli_counter', counter);
  }

  /* ── CLIENTES CRUD ───────────────────────────────────────────── */
  function getAll() {
    _migrate();
    return Store.get(KEY, []);
  }

  function getById(id) {
    return getAll().find(c => c.id === id) ?? null;
  }

  function findByEmail(email) {
    return getAll().find(c => c.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  function save(cliente) {
    const all = getAll();
    const idx = all.findIndex(c => c.id === cliente.id);
    if (idx >= 0) all[idx] = cliente;
    else          all.push(cliente);
    Store.set(KEY, all);
    return cliente;
  }

  function remove(id) {
    Store.set(KEY, getAll().filter(c => c.id !== id));
  }

  function search(q) {
    if (!q) return getAll();
    const lq = q.toLowerCase();
    return getAll().filter(c =>
      c.name.toLowerCase().includes(lq)  ||
      c.email.toLowerCase().includes(lq) ||
      c.phone.includes(lq)
    );
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return { nextId, getAll, getById, findByEmail, save, remove, search };

})();
