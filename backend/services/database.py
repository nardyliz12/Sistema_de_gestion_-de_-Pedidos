import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "database.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


_DB_TO_FRONT = {
    "pendiente":   "Pendiente",
    "en_proceso":  "En Proceso",
    "en_camino":   "En Camino",
    "completado":  "Completado",
    "cancelado":   "Cancelado",
}
_FRONT_TO_DB = {v: k for k, v in _DB_TO_FRONT.items()}

_PAY_DB_TO_FRONT = {
    "pendiente": "Pendiente",
    "pagado":    "Pagado",
    "fallido":   "Fallido",
}
_PAY_FRONT_TO_DB = {v: k for k, v in _PAY_DB_TO_FRONT.items()}

_METHOD_DB_TO_FRONT = {
    "tarjeta_credito": "Tarjeta de Crédito",
    "tarjeta_debito":  "Tarjeta de Débito",
    "yape":            "Yape",
    "plin":            "Plin",
    "transferencia":   "Transferencia Bancaria",
}
_METHOD_FRONT_TO_DB = {v: k for k, v in _METHOD_DB_TO_FRONT.items()}

_REP_ESTADO_DB_TO_FRONT = {
    "disponible": "Disponible",
    "ocupado":    "Ocupado",
    "inactivo":   "Inactivo",
}

def estado_to_front(estado: str) -> str:
    return _DB_TO_FRONT.get(estado, estado)

def estado_to_db(estado: str) -> str:
    return _FRONT_TO_DB.get(estado, estado.lower().replace(" ", "_"))

def pay_estado_to_front(estado: str) -> str:
    return _PAY_DB_TO_FRONT.get(estado, estado)

def pay_estado_to_db(estado: str) -> str:
    return _PAY_FRONT_TO_DB.get(estado, estado.lower())

def method_to_front(method: str) -> str:
    return _METHOD_DB_TO_FRONT.get(method, method)

def method_to_db(method: str) -> str:
    return _METHOD_FRONT_TO_DB.get(method, method.lower().replace(" ", "_"))

def rep_estado_to_front(estado: str) -> str:
    return _REP_ESTADO_DB_TO_FRONT.get(estado, estado)


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Cliente (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    telefono TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Repartidor (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT NOT NULL,
    telefono TEXT NOT NULL,
    estado   TEXT NOT NULL
             CHECK(estado IN ('disponible', 'ocupado', 'inactivo'))
             DEFAULT 'disponible'
);

CREATE TABLE IF NOT EXISTS Producto (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre    TEXT    NOT NULL,
    categoria TEXT    NOT NULL DEFAULT 'General',
    precio    REAL    NOT NULL,
    stock     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Pedido (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id    INTEGER NOT NULL,
    repartidor_id INTEGER,
    direccion     TEXT    NOT NULL,
    total         REAL    NOT NULL DEFAULT 0,
    estado        TEXT    NOT NULL
                  CHECK(estado IN (
                      'pendiente', 'en_proceso',
                      'en_camino', 'completado', 'cancelado'
                  ))
                  DEFAULT 'pendiente',
    notas         TEXT,
    fecha         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id)    REFERENCES Cliente(id)    ON DELETE CASCADE,
    FOREIGN KEY (repartidor_id) REFERENCES Repartidor(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS PedidoProducto (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id   INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad    INTEGER NOT NULL DEFAULT 1,
    precio      REAL    NOT NULL,
    FOREIGN KEY (pedido_id)   REFERENCES Pedido(id)   ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES Producto(id)
);

CREATE TABLE IF NOT EXISTS HistorialPedido (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    estado    TEXT    NOT NULL,
    nota      TEXT,
    fecha     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES Pedido(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Pago (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER UNIQUE NOT NULL,
    monto     REAL    NOT NULL,
    metodo    TEXT    NOT NULL
              CHECK(metodo IN (
                  'tarjeta_credito', 'tarjeta_debito',
                  'yape', 'plin', 'transferencia'
              )),
    estado    TEXT    NOT NULL
              CHECK(estado IN ('pendiente', 'pagado', 'fallido'))
              DEFAULT 'pendiente',
    fecha     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES Pedido(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pedido_cliente    ON Pedido(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_repartidor ON Pedido(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_pedido_estado     ON Pedido(estado);
CREATE INDEX IF NOT EXISTS idx_historial_pedido  ON HistorialPedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pago_pedido       ON Pago(pedido_id);
"""

SEED = """
INSERT OR IGNORE INTO Repartidor (id, nombre, telefono, estado) VALUES
    (1, 'Carlos Quispe', '+51 987 654 321', 'disponible'),
    (2, 'Ana Mamani',    '+51 976 543 210', 'disponible'),
    (3, 'Luis Flores',   '+51 965 432 109', 'inactivo');

INSERT OR IGNORE INTO Producto (id, nombre, categoria, precio, stock) VALUES
    (1,  'Laptop Dell XPS 15',            'Electrónica',    1359.97, 10),
    (2,  'Mouse Logitech MX Master 3',    'Accesorios',       99.99, 50),
    (3,  'Teclado Mecánico Keychron',     'Accesorios',       89.99, 30),
    (4,  'Monitor LG 27" 4K',             'Electrónica',     449.99, 15),
    (5,  'Webcam Logitech C920',          'Accesorios',       79.99, 40),
    (6,  'Auriculares Sony WH-1000XM4',   'Audio',           349.99, 20),
    (7,  'SSD Samsung 1TB',               'Almacenamiento',  129.99, 60),
    (8,  'Silla Ergonómica Herman Miller','Muebles',         899.99,  5),
    (9,  'iPad Pro 12.9"',                'Electrónica',    1099.00,  8),
    (10, 'Hub USB-C Anker 7 en 1',        'Accesorios',       49.99, 70);

INSERT OR IGNORE INTO Cliente (id, nombre, email, telefono) VALUES
    (1, 'María González', 'maria.gonzalez@email.com', '+51 923 556 843');

INSERT OR IGNORE INTO Pedido (id, cliente_id, repartidor_id, direccion, total, estado, notas, fecha) VALUES
    (1, 1, NULL,
     'Av. Javier Prado 123, San Isidro',
     1751.47,
     'pendiente',
     'Envío urgente solicitado',
     '2026-03-28 10:30:00');

INSERT OR IGNORE INTO PedidoProducto (pedido_id, producto_id, cantidad, precio) VALUES
    (1, 1, 1, 1359.97),
    (1, 3, 1,   89.99);

INSERT OR IGNORE INTO HistorialPedido (pedido_id, estado, nota, fecha) VALUES
    (1, 'pendiente', 'Pedido creado', '2026-03-28 10:30:00');
"""


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
        conn.executescript(SEED)