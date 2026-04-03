/* ================================================================
   PAGO API — Simulación de pagos
   ----------------------------------------------------------------
   Hoy simula en frontend con setTimeout.
   Mañana reemplaza process() con un fetch() a la pasarela real.
   El resto de la app no cambia.
   ================================================================ */

const PagoApi = (() => {

  const METHODS = [
    { val:'Tarjeta de Crédito',     icon:'💳', card:true  },
    { val:'Tarjeta de Débito',      icon:'💳', card:true  },
    { val:'Yape',                   icon:'📱', card:false },
    { val:'Plin',                   icon:'📱', card:false },
    { val:'Transferencia Bancaria', icon:'🏦', card:false },
  ];

  const SUCCESS_RATE = 0.92; // 92% de éxito simulado

  /**
   * Procesa un pago de forma asíncrona.
   * @param {string}   orderId   - ID del pedido
   * @param {string}   method    - Método de pago seleccionado
   * @param {Function} onSuccess - callback({ method, status, date })
   * @param {Function} onFailure - callback({ method, status, date })
   */
  function process(orderId, method, onSuccess, onFailure) {
    setTimeout(() => {
      const ok = Math.random() < SUCCESS_RATE;
      const payload = { method, status: ok ? 'Pagado' : 'Fallido', date: now() };
      if (ok) onSuccess(payload);
      else    onFailure(payload);
    }, 2000);
  }

  return { METHODS, process };

})();
