from fastapi import APIRouter, HTTPException
from typing import List, Optional
from models.schemas import (
    PedidoOut, PedidoCreate, PagoCreate,
    ProductoOut, ClienteOut,
)
from services.database import (
    get_db,
    estado_to_front, estado_to_db,
    pay_estado_to_front,
    method_to_front, method_to_db,
    rep_estado_to_front,
)
import random

router = APIRouter(prefix="/cliente", tags=["Cliente"])

IGV = 0.18


def _build_pedido(row, conn) -> dict:
    pedido_id = row["id"]

    c = conn.execute("SELECT * FROM Cliente WHERE id=?", (row["cliente_id"],)).fetchone()

    rep = None
    if row["repartidor_id"]:
        r = conn.execute(
            "SELECT * FROM Repartidor WHERE id=?", (row["repartidor_id"],)
        ).fetchone()
        if r:
            rep = {"id": r["id"], "nombre": r["nombre"],
                   "telefono": r["telefono"],
                   "estado": rep_estado_to_front(r["estado"])}

    prods = conn.execute("""
        SELECT pp.producto_id, pp.cantidad, pp.precio, p.nombre, p.categoria
        FROM PedidoProducto pp
        JOIN Producto p ON p.id = pp.producto_id
        WHERE pp.pedido_id = ?
    """, (pedido_id,)).fetchall()

    hist = conn.execute("""
        SELECT id, estado, nota, fecha FROM HistorialPedido
        WHERE pedido_id = ? ORDER BY fecha ASC
    """, (pedido_id,)).fetchall()

    pago_row = conn.execute(
        "SELECT * FROM Pago WHERE pedido_id=?", (pedido_id,)
    ).fetchone()
    pago = None
    if pago_row:
        pago = {"id":     pago_row["id"],
                "metodo": method_to_front(pago_row["metodo"]),
                "estado": pay_estado_to_front(pago_row["estado"]),
                "monto":  pago_row["monto"],
                "fecha":  pago_row["fecha"]}

    return {
        "id":         pedido_id,
        "cliente":    {"id": c["id"], "nombre": c["nombre"],
                       "email": c["email"], "telefono": c["telefono"]},
        "repartidor": rep,
        "direccion":  row["direccion"],
        "total":      row["total"],
        "estado":     estado_to_front(row["estado"]),
        "notas":      row["notas"],
        "fecha":      row["fecha"],
        "productos":  [{"producto_id": p["producto_id"],
                        "nombre":      p["nombre"],
                        "categoria":   p["categoria"],
                        "precio":      p["precio"],
                        "cantidad":    p["cantidad"]} for p in prods],
        "historial":  [{"id":    h["id"],
                        "estado": estado_to_front(h["estado"]),
                        "nota":   h["nota"],
                        "fecha":  h["fecha"]} for h in hist],
        "pago": pago,
    }


def _calc_total(items, conn) -> float:
    subtotal = 0.0
    for it in items:
        p = conn.execute(
            "SELECT precio FROM Producto WHERE id=?", (it.producto_id,)
        ).fetchone()
        if p:
            subtotal += p["precio"] * it.cantidad
    return round(subtotal * (1 + IGV), 2)


#  PRODUCTOS (catálogo público)
@router.get("/productos", response_model=List[ProductoOut])
def get_catalogo(categoria: Optional[str] = None):
    with get_db() as conn:
        if categoria:
            rows = conn.execute(
                "SELECT * FROM Producto WHERE categoria=? AND stock>0 ORDER BY nombre",
                (categoria,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM Producto WHERE stock>0 ORDER BY nombre"
            ).fetchall()
        return [dict(r) for r in rows]


#  MIS PEDIDOS
@router.get("/pedidos", response_model=List[PedidoOut])
def mis_pedidos(email: str):
    """Devuelve todos los pedidos del cliente identificado por email."""
    with get_db() as conn:
        cliente = conn.execute(
            "SELECT id FROM Cliente WHERE email=?", (email,)
        ).fetchone()
        if not cliente:
            return []
        rows = conn.execute(
            "SELECT * FROM Pedido WHERE cliente_id=? ORDER BY fecha DESC",
            (cliente["id"],)
        ).fetchall()
        return [_build_pedido(r, conn) for r in rows]


@router.get("/pedidos/{pedido_id}", response_model=PedidoOut)
def get_mi_pedido(pedido_id: int, email: str):
    """Detalle de un pedido — valida que pertenezca al email indicado."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        c = conn.execute(
            "SELECT email FROM Cliente WHERE id=?", (row["cliente_id"],)
        ).fetchone()
        if not c or c["email"] != email:
            raise HTTPException(403, "No tienes acceso a este pedido")
        return _build_pedido(row, conn)


@router.post("/pedidos", response_model=PedidoOut, status_code=201)
def crear_pedido(body: PedidoCreate):
    with get_db() as conn:
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
            (pedido_id, "pendiente", "Pedido creado por cliente")
        )

        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


#  PAGO (cliente paga su pedido)
@router.post("/pedidos/{pedido_id}/pago", response_model=PedidoOut)
def pagar(pedido_id: int, body: PagoCreate, email: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Pedido no encontrado")
        c = conn.execute(
            "SELECT email FROM Cliente WHERE id=?", (row["cliente_id"],)
        ).fetchone()
        if not c or c["email"] != email:
            raise HTTPException(403, "No tienes acceso a este pedido")

        existing = conn.execute(
            "SELECT id FROM Pago WHERE pedido_id=?", (pedido_id,)
        ).fetchone()
        if existing:
            raise HTTPException(400, "Este pedido ya tiene un pago registrado")

        # simular pasarela: 92% éxito
        exito = random.random() > 0.08
        estado_pago = "pagado" if exito else "fallido"
        metodo_db   = method_to_db(body.metodo)

        conn.execute(
            """INSERT INTO Pago (pedido_id, monto, metodo, estado)
               VALUES (?, ?, ?, ?)""",
            (pedido_id, row["total"], metodo_db, estado_pago)
        )

        if exito:
            conn.execute(
                "UPDATE Pedido SET estado='en_proceso' WHERE id=?", (pedido_id,)
            )
            conn.execute(
                "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
                (pedido_id, "en_proceso", f"Pago exitoso via {body.metodo}")
            )
        else:
            conn.execute(
                "INSERT INTO HistorialPedido (pedido_id, estado, nota) VALUES (?,?,?)",
                (pedido_id, row["estado"], "Intento de pago fallido")
            )

        row = conn.execute("SELECT * FROM Pedido WHERE id=?", (pedido_id,)).fetchone()
        return _build_pedido(row, conn)


#  PERFIL CLIENTE
@router.get("/perfil", response_model=ClienteOut)
def get_perfil(email: str):
    with get_db() as conn:
        c = conn.execute(
            "SELECT * FROM Cliente WHERE email=?", (email,)
        ).fetchone()
        if not c:
            raise HTTPException(404, "Cliente no encontrado")
        return dict(c)