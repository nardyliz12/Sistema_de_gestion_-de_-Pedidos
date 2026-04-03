from fastapi import APIRouter, HTTPException
from typing import List, Optional
from models.schemas import (
    PedidoOut, PedidoCreate, PedidoEstadoUpdate, PedidoRepartidorUpdate,
    RepartidorCreate, RepartidorUpdate, RepartidorOut,
    ProductoCreate, ProductoUpdate, ProductoOut,
    PagoCreate, PagoOut, StatsOut,
)
from services.database import (
    get_db,
    estado_to_front, estado_to_db,
    pay_estado_to_front, pay_estado_to_db,
    method_to_front, method_to_db,
    rep_estado_to_front,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

IVA = 0.21

# HELPERS
def _build_pedido(row, conn) -> dict:
    pedido_id = row["id"]

    # cliente
    c = conn.execute("SELECT * FROM Cliente WHERE id=?", (row["cliente_id"],)).fetchone()

    # repartidor
    rep = None
    if row["repartidor_id"]:
        r = conn.execute("SELECT * FROM Repartidor WHERE id=?", (row["repartidor_id"],)).fetchone()
        if r:
            rep = {"id": r["id"], "nombre": r["nombre"],
                   "telefono": r["telefono"],
                   "estado": rep_estado_to_front(r["estado"])}

    # productos
    prods = conn.execute("""
        SELECT pp.producto_id, pp.cantidad, pp.precio, p.nombre, p.categoria
        FROM PedidoProducto pp
        JOIN Producto p ON p.id = pp.producto_id
        WHERE pp.pedido_id = ?
    """, (pedido_id,)).fetchall()

    # historial
    hist = conn.execute("""
        SELECT id, estado, nota, fecha FROM HistorialPedido
        WHERE pedido_id = ? ORDER BY fecha ASC
    """, (pedido_id,)).fetchall()

    # pago
    pago_row = conn.execute("SELECT * FROM Pago WHERE pedido_id=?", (pedido_id,)).fetchone()
    pago = None
    if pago_row:
        pago = {"id": pago_row["id"],
                "metodo": method_to_front(pago_row["metodo"]),
                "estado": pay_estado_to_front(pago_row["estado"]),
                "monto":  pago_row["monto"],
                "fecha":  pago_row["fecha"]}

    return {
        "id":          pedido_id,
        "cliente":     {"id": c["id"], "nombre": c["nombre"],
                        "email": c["email"], "telefono": c["telefono"]},
        "repartidor":  rep,
        "direccion":   row["direccion"],
        "total":       row["total"],
        "estado":      estado_to_front(row["estado"]),
        "notas":       row["notas"],
        "fecha":       row["fecha"],
        "productos":   [{"producto_id": p["producto_id"],
                         "nombre":      p["nombre"],
                         "categoria":   p["categoria"],
                         "precio":      p["precio"],
                         "cantidad":    p["cantidad"]} for p in prods],
        "historial":   [{"id":    h["id"],
                         "estado": estado_to_front(h["estado"]),
                         "nota":   h["nota"],
                         "fecha":  h["fecha"]} for h in hist],
        "pago": pago,
    }


def _calc_total(items: list, conn) -> float:
    subtotal = 0.0
    for it in items:
        p = conn.execute("SELECT precio FROM Producto WHERE id=?",
                         (it.producto_id,)).fetchone()
        if p:
            subtotal += p["precio"] * it.cantidad
    return round(subtotal * (1 + IVA), 2)


# STATS
@router.get("/stats", response_model=StatsOut)
def get_stats():
    with get_db() as conn:
        total      = conn.execute("SELECT COUNT(*) FROM Pedido").fetchone()[0]
        pendientes = conn.execute("SELECT COUNT(*) FROM Pedido WHERE estado='pendiente'").fetchone()[0]
        en_proceso = conn.execute("SELECT COUNT(*) FROM Pedido WHERE estado IN ('en_proceso','en_camino')").fetchone()[0]
        completados= conn.execute("SELECT COUNT(*) FROM Pedido WHERE estado='completado'").fetchone()[0]
        cancelados = conn.execute("SELECT COUNT(*) FROM Pedido WHERE estado='cancelado'").fetchone()[0]
        ingresos   = conn.execute(
            "SELECT COALESCE(SUM(monto),0) FROM Pago WHERE estado='pagado'"
        ).fetchone()[0]
        return {
            "total_pedidos":    total,
            "pendientes":       pendientes,
            "en_proceso":       en_proceso,
            "completados":      completados,
            "cancelados":       cancelados,
            "ingresos_totales": round(ingresos, 2),
        }


#  PEDIDOS
@router.get("/pedidos", response_model=List[PedidoOut])
def list_pedidos(estado: Optional[str] = None, search: Optional[str] = None):
    with get_db() as conn:
        query = "SELECT * FROM Pedido"
        params: list = []

        conditions = []
        if estado and estado != "Todos":
            conditions.append("estado = ?")
            params.append(estado_to_db(estado))

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY fecha DESC"

        rows = conn.execute(query, params).fetchall()
        result = [_build_pedido(r, conn) for r in rows]

        if search:
            q = search.lower()
            result = [p for p in result if
                      q in str(p["id"]).lower() or
                      q in p["cliente"]["nombre"].lower() or
                      q in p["cliente"]["email"].lower()]
        return result


@router.get("/pedidos/{pedido_id}", response_model=PedidoOut)
def get_pedido(pedido_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        return _build_pedido(row, conn)


@router.post("/pedidos", response_model=PedidoOut, status_code=201)
def create_pedido(body: PedidoCreate):
    with get_db() as conn:
        # upsert cliente por email
        existing = conn.execute(
            "SELECT id FROM Cliente WHERE email=?", (body.cliente_email,)
        ).fetchone()
        if existing:
            cliente_id = existing["id"]
            conn.execute(
                "UPDATE Cliente SET nombre=?, telefono=? WHERE id=?",
                (body.cliente_nombre, body.cliente_telefono, cliente_id)
            )
        else:
            cur = conn.execute(
                "INSERT INTO Cliente (nombre, email, telefono) VALUES (?,?,?)",
                (body.cliente_nombre, body.cliente_email, body.cliente_telefono)
            )
            cliente_id = cur.lastrowid

        total = _calc_total(body.items, conn)

        cur = conn.execute(
            """INSERT INTO Pedido (cliente_id, direccion, total, estado, notas)
               VALUES (?, ?, ?, 'pendiente', ?)""",
            (cliente_id, body.direccion, total, body.notas)
        )
        pedido_id = cur.lastrowid

        for it in body.items:
            precio = conn.execute(
                "SELECT precio FROM Producto WHERE id=?", (it.producto_id,)
            ).fetchone()
            if not precio:
                raise HTTPException(400, f"Producto {it.producto_id} no existe")
            conn.execute(
                """INSERT INTO PedidoProducto (pedido_id, producto_id, cantidad, precio)
                   VALUES (?,?,?,?)""",
                (pedido_id, it.producto_id, it.cantidad, precio["precio"])
            )

        conn.execute(
            "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
            (pedido_id, "pendiente", "Pedido creado")
        )

        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


@router.put("/pedidos/{pedido_id}", response_model=PedidoOut)
def update_pedido(pedido_id: int, body: PedidoCreate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")

        # update client
        conn.execute(
            "UPDATE Cliente SET nombre=?, telefono=? WHERE id=?",
            (body.cliente_nombre, body.cliente_telefono, row["cliente_id"])
        )

        # recalc total & replace items
        total = _calc_total(body.items, conn)
        conn.execute(
            "UPDATE Pedido SET direccion=?, total=?, notas=? WHERE id=?",
            (body.direccion, total, body.notas, pedido_id)
        )
        conn.execute("DELETE FROM PedidoProducto WHERE pedido_id=?", (pedido_id,))
        for it in body.items:
            precio = conn.execute(
                "SELECT precio FROM Producto WHERE id=?", (it.producto_id,)
            ).fetchone()
            if not precio:
                raise HTTPException(400, f"Producto {it.producto_id} no existe")
            conn.execute(
                """INSERT INTO PedidoProducto (pedido_id, producto_id, cantidad, precio)
                   VALUES (?,?,?,?)""",
                (pedido_id, it.producto_id, it.cantidad, precio["precio"])
            )

        conn.execute(
            "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
            (row["estado"], row["estado"], "Pedido editado")
        )

        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


@router.patch("/pedidos/{pedido_id}/estado", response_model=PedidoOut)
def change_estado(pedido_id: int, body: PedidoEstadoUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        nuevo_estado = estado_to_db(body.estado)
        conn.execute("UPDATE Pedido SET estado=? WHERE id=?", (nuevo_estado, pedido_id))
        conn.execute(
            "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
            (pedido_id, nuevo_estado, body.nota or "")
        )
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


@router.patch("/pedidos/{pedido_id}/repartidor", response_model=PedidoOut)
def assign_repartidor(pedido_id: int, body: PedidoRepartidorUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        conn.execute(
            "UPDATE Pedido SET repartidor_id=? WHERE id=?",
            (body.repartidor_id, pedido_id)
        )
        nota = ""
        if body.repartidor_id:
            r = conn.execute(
                "SELECT nombre FROM Repartidor WHERE id=?", (body.repartidor_id,)
            ).fetchone()
            nota = f"Asignado a: {r['nombre']}" if r else f"Asignado: #{body.repartidor_id}"
        else:
            nota = "Repartidor removido"
        conn.execute(
            "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
            (pedido_id, row["estado"], nota)
        )
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


@router.delete("/pedidos/{pedido_id}", status_code=204)
def delete_pedido(pedido_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        conn.execute("DELETE FROM Pedido WHERE id=?", (pedido_id,))


#  PAGOS 
@router.post("/pedidos/{pedido_id}/pago", response_model=PedidoOut, status_code=201)
def register_pago(pedido_id: int, body: PagoCreate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        existing = conn.execute(
            "SELECT id FROM Pago WHERE pedido_id=?", (pedido_id,)
        ).fetchone()
        if existing:
            raise HTTPException(400, "Este pedido ya tiene un pago registrado")

        metodo_db = method_to_db(body.metodo)
        conn.execute(
            """INSERT INTO Pago (pedido_id, monto, metodo, estado)
               VALUES (?, ?, ?, 'pagado')""",
            (pedido_id, row["total"], metodo_db)
        )
        conn.execute(
            "UPDATE Pedido SET estado='en_proceso' WHERE id=?", (pedido_id,)
        )
        conn.execute(
            "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
            (pedido_id, "en_proceso", f"Pago registrado via {body.metodo}")
        )
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


#  HISTORIAL GLOBAL
@router.get("/historial")
def get_historial():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT h.id, h.pedido_id, h.estado, h.nota, h.fecha,
                   c.nombre as cliente_nombre
            FROM HistorialPedido h
            JOIN Pedido p ON p.id = h.pedido_id
            JOIN Cliente c ON c.id = p.cliente_id
            ORDER BY h.fecha DESC
        """).fetchall()
        return [
            {
                "id":             r["id"],
                "pedido_id":      r["pedido_id"],
                "estado":         estado_to_front(r["estado"]),
                "nota":           r["nota"],
                "fecha":          r["fecha"],
                "cliente_nombre": r["cliente_nombre"],
            }
            for r in rows
        ]


#  REPARTIDORES
@router.get("/repartidores", response_model=List[RepartidorOut])
def list_repartidores():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM Repartidor ORDER BY nombre").fetchall()
        return [{"id": r["id"], "nombre": r["nombre"],
                 "telefono": r["telefono"],
                 "estado": rep_estado_to_front(r["estado"])} for r in rows]


@router.post("/repartidores", response_model=RepartidorOut, status_code=201)
def create_repartidor(body: RepartidorCreate):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO Repartidor (nombre, telefono) VALUES (?,?)",
            (body.nombre, body.telefono)
        )
        r = conn.execute(
            "SELECT * FROM Repartidor WHERE id=?", (cur.lastrowid,)
        ).fetchone()
        return {"id": r["id"], "nombre": r["nombre"],
                "telefono": r["telefono"],
                "estado": rep_estado_to_front(r["estado"])}


@router.patch("/repartidores/{rep_id}", response_model=RepartidorOut)
def update_repartidor(rep_id: int, body: RepartidorUpdate):
    with get_db() as conn:
        r = conn.execute("SELECT * FROM Repartidor WHERE id=?", (rep_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Repartidor no encontrado")
        nombre   = body.nombre   or r["nombre"]
        telefono = body.telefono or r["telefono"]
        estado_map = {"Disponible": "disponible", "Ocupado": "ocupado", "Inactivo": "inactivo"}
        estado   = estado_map.get(body.estado, r["estado"]) if body.estado else r["estado"]
        conn.execute(
            "UPDATE Repartidor SET nombre=?, telefono=?, estado=? WHERE id=?",
            (nombre, telefono, estado, rep_id)
        )
        r = conn.execute("SELECT * FROM Repartidor WHERE id=?", (rep_id,)).fetchone()
        return {"id": r["id"], "nombre": r["nombre"],
                "telefono": r["telefono"],
                "estado": rep_estado_to_front(r["estado"])}


@router.delete("/repartidores/{rep_id}", status_code=204)
def delete_repartidor(rep_id: int):
    with get_db() as conn:
        r = conn.execute("SELECT id FROM Repartidor WHERE id=?", (rep_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Repartidor no encontrado")
        active = conn.execute(
            """SELECT COUNT(*) FROM Pedido
               WHERE repartidor_id=? AND estado NOT IN ('completado','cancelado')""",
            (rep_id,)
        ).fetchone()[0]
        if active:
            raise HTTPException(400, "Tiene pedidos activos. Reasigna primero.")
        conn.execute("DELETE FROM Repartidor WHERE id=?", (rep_id,))



#  PRODUCTOS
@router.get("/productos", response_model=List[ProductoOut])
def list_productos(categoria: Optional[str] = None):
    with get_db() as conn:
        if categoria:
            rows = conn.execute(
                "SELECT * FROM Producto WHERE categoria=? ORDER BY nombre",
                (categoria,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM Producto ORDER BY nombre").fetchall()
        return [dict(r) for r in rows]


@router.post("/productos", response_model=ProductoOut, status_code=201)
def create_producto(body: ProductoCreate):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO Producto (nombre, categoria, precio, stock) VALUES (?,?,?,?)",
            (body.nombre, body.categoria, body.precio, body.stock)
        )
        r = conn.execute("SELECT * FROM Producto WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(r)


@router.patch("/productos/{prod_id}", response_model=ProductoOut)
def update_producto(prod_id: int, body: ProductoUpdate):
    with get_db() as conn:
        r = conn.execute("SELECT * FROM Producto WHERE id=?", (prod_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Producto no encontrado")
        nombre    = body.nombre    if body.nombre    is not None else r["nombre"]
        categoria = body.categoria if body.categoria is not None else r["categoria"]
        precio    = body.precio    if body.precio    is not None else r["precio"]
        stock     = body.stock     if body.stock     is not None else r["stock"]
        conn.execute(
            "UPDATE Producto SET nombre=?, categoria=?, precio=?, stock=? WHERE id=?",
            (nombre, categoria, precio, stock, prod_id)
        )
        r = conn.execute("SELECT * FROM Producto WHERE id=?", (prod_id,)).fetchone()
        return dict(r)


@router.delete("/productos/{prod_id}", status_code=204)
def delete_producto(prod_id: int):
    with get_db() as conn:
        r = conn.execute("SELECT id FROM Producto WHERE id=?", (prod_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Producto no encontrado")
        conn.execute("DELETE FROM Producto WHERE id=?", (prod_id,))