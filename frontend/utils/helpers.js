/* ================================================================
   CATÁLOGO DE PRODUCTOS
   ================================================================ */
const CATALOG = [
  { id:'p1',  name:'Laptop Dell XPS 15',             category:'Electrónica',    price:1359.97 },
  { id:'p2',  name:'Mouse Logitech MX Master 3',     category:'Accesorios',     price:99.99   },
  { id:'p3',  name:'Teclado Mecánico Keychron',      category:'Accesorios',     price:89.99   },
  { id:'p4',  name:'Monitor LG 27" 4K',              category:'Electrónica',    price:449.99  },
  { id:'p5',  name:'Webcam Logitech C920',           category:'Accesorios',     price:79.99   },
  { id:'p6',  name:'Auriculares Sony WH-1000XM4',    category:'Audio',          price:349.99  },
  { id:'p7',  name:'SSD Samsung 1TB',                category:'Almacenamiento', price:129.99  },
  { id:'p8',  name:'Silla Ergonómica Herman Miller',  category:'Muebles',        price:899.99  },
  { id:'p9',  name:'iPad Pro 12.9"',                 category:'Electrónica',    price:1099.00 },
  { id:'p10', name:'Hub USB-C Anker 7 en 1',         category:'Accesorios',     price:49.99   },
];

const IVA_RATE = 0.21;

/* ================================================================
   STORAGE HELPER
   ================================================================ */
const Store = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

/* ================================================================
   FORMATTERS
   ================================================================ */
function fmt(n)    { return `$ ${parseFloat(n).toFixed(2)}`; }
function now()     { return new Date().toISOString(); }

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })
    + ', ' + dt.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
}

/* ================================================================
   CÁLCULOS
   ================================================================ */
function subtotal(items) { return items.reduce((s, i) => s + i.price * i.quantity, 0); }
function total(items)    { const s = subtotal(items); return s + s * IVA_RATE; }

/* ================================================================
   BADGES
   ================================================================ */
function statusBadge(s) {
  const map = {
    'Pendiente':  'badge-warning',
    'En Proceso': 'badge-info',
    'En Camino':  'badge-violet',
    'Completado': 'badge-success',
    'Cancelado':  'badge-danger',
  };
  return map[s] || 'badge-neutral';
}

function dotClass(s) {
  const map = {
    'Pendiente':  'd-warning',
    'En Proceso': 'd-info',
    'En Camino':  'd-primary',
    'Completado': 'd-success',
    'Cancelado':  'd-danger',
  };
  return map[s] || '';
}

function payBadge(s) {
  return s === 'Pagado' ? 'badge-success' : s === 'Fallido' ? 'badge-danger' : 'badge-warning';
}

/* ================================================================
   FORMATO TARJETA
   ================================================================ */
function fmtCard(el) {
  el.value = el.value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19);
}

function fmtExp(el) {
  let v = el.value.replace(/\D/g,'');
  if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2);
  el.value = v.slice(0,5);
}

/* ================================================================
   TOAST
   ================================================================ */
function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const icons = { success:'✓', error:'✗', info:'ℹ' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-ico">${icons[type] || '✓'}</span><span>${msg}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}

/* ================================================================
   MODAL
   ================================================================ */
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
