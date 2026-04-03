from pydantic import BaseModel, EmailStr
from typing import Optional, List


# CLIENTE
class ClienteCreate(BaseModel):
    nombre:   str
    email:    str
    telefono: str

class ClienteOut(ClienteCreate):
    id: int


# REPARTIDOR
class RepartidorCreate(BaseModel):
    nombre:   str
    telefono: str

class RepartidorUpdate(BaseModel):
    nombre:   Optional[str] = None
    telefono: Optional[str] = None
    estado:   Optional[str] = None   
class RepartidorOut(BaseModel):
    id:       int
    nombre:   str
    telefono: str
    estado:   str   


# PRODUCTO
class ProductoCreate(BaseModel):
    nombre:    str
    categoria: str = "General"
    precio:    float
    stock:     int  = 0

class ProductoUpdate(BaseModel):
    nombre:    Optional[str]   = None
    categoria: Optional[str]   = None
    precio:    Optional[float] = None
    stock:     Optional[int]   = None

class ProductoOut(ProductoCreate):
    id: int


# PEDIDO
class ItemPedido(BaseModel):
    producto_id: int
    cantidad:    int = 1

class PedidoCreate(BaseModel):
    cliente_nombre:   str
    cliente_email:    str
    cliente_telefono: str
    direccion:        str
    notas:            Optional[str] = None
    items:            List[ItemPedido]

class PedidoEstadoUpdate(BaseModel):
    estado: str          
    nota:   Optional[str] = None

class PedidoRepartidorUpdate(BaseModel):
    repartidor_id: Optional[int] = None   

class ProductoLineaOut(BaseModel):
    producto_id: int
    nombre:      str
    categoria:   str
    precio:      float
    cantidad:    int

class HistorialItemOut(BaseModel):
    id:     int
    estado: str
    nota:   Optional[str]
    fecha:  str

class PagoOut(BaseModel):
    id:       int
    metodo:   str
    estado:   str
    monto:    float
    fecha:    str

class PedidoOut(BaseModel):
    id:           int
    cliente:      ClienteOut
    repartidor:   Optional[RepartidorOut]
    direccion:    str
    total:        float
    estado:       str
    notas:        Optional[str]
    fecha:        str
    productos:    List[ProductoLineaOut]
    historial:    List[HistorialItemOut]
    pago:         Optional[PagoOut]


class PagoCreate(BaseModel):
    metodo: str 


class StatsOut(BaseModel):
    total_pedidos:    int
    pendientes:       int
    en_proceso:       int
    completados:      int
    cancelados:       int
    ingresos_totales: float