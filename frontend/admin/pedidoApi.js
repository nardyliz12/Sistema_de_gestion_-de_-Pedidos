/* ================================================================
   PEDIDO API — Capa de datos: pedidos y repartidores
   ----------------------------------------------------------------
   Hoy habla con localStorage.
   Mañana habla con el backend Python.
   El resto de la app NO sabe la diferencia — solo cambia este archivo.
   ================================================================ */

const PedidoApi = (() => {

  /* ── Datos iniciales ─────────────────────────────────────────── */
  function _defaultReps() {
    return [
      { id:'r1', name:'Carlos Quispe', phone:'+51 987 654 321', active:true  },
      { id:'r2', name:'Ana Mamani',    phone:'+51 976 543 210', active:true  },
      { id:'r3', name:'Luis Flores',   phone:'+51 965 432 109', active:false },
    ];
  }

  function _defaultOrders() {
    return [{
      id:          'PED-2026-001',
      client:      { name:'María González', email:'maria.gonzalez@email.com', phone:'+51 923 556 843', address:'Av. Javier Prado 123, San Isidro' },
      products:    [ { ...CATALOG[0], quantity:1 }, { ...CATALOG[2], quantity:1 } ],
      status:      'Pendiente',
      date:        '2026-03-28T10:30:00',
      notes:       'Envío urgente solicitado',
      repartidorId: null,
      payment:     null,
      history:     [{ date:'2026-03-28T10:30:00', status:'Pendiente', note:'Pedido creado' }],
    }];
  }

  /* ── ID con contador — corrige el bug de IDs duplicados ─────── */
  function nextId() {
    const yr = new Date().getFullYear();
    const n  = Store.get('sgp_id_counter', 0) + 1;
    Store.set('sgp_id_counter', n);
    return `PED-${yr}-${String(n).padStart(3, '0')}`;
  }

  /* ── PEDIDOS CRUD ────────────────────────────────────────────── */
  function getAllOrders() {
    return Store.get('sgp_orders', null) ?? _defaultOrders();
  }

  function getOrderById(id) {
    return getAllOrders().find(o => o.id === id) ?? null;
  }

  function saveOrder(order) {
    const all = getAllOrders();
    const idx = all.findIndex(o => o.id === order.id);
    if (idx >= 0) all[idx] = order;
    else          all.push(order);
    Store.set('sgp_orders', all);
  }

  function removeOrder(id) {
    Store.set('sgp_orders', getAllOrders().filter(o => o.id !== id));
  }

  /* ── REPARTIDORES CRUD ───────────────────────────────────────── */
  function getAllReps() {
    return Store.get('sgp_reps', null) ?? _defaultReps();
  }

  function getRepById(id) {
    return getAllReps().find(r => r.id === id) ?? null;
  }

  function saveRep(rep) {
    const all = getAllReps();
    const idx = all.findIndex(r => r.id === rep.id);
    if (idx >= 0) all[idx] = rep;
    else          all.push(rep);
    Store.set('sgp_reps', all);
  }

  function removeRep(id) {
    Store.set('sgp_reps', getAllReps().filter(r => r.id !== id));
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return {
    nextId,
    getAllOrders, getOrderById, saveOrder, removeOrder,
    getAllReps,   getRepById,   saveRep,   removeRep,
  };

})();
