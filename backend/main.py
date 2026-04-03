import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.database import init_db
from routes.admin   import router as admin_router
from routes.cliente import router as cliente_router

app = FastAPI(
    title="Sistema de Gestión de Pedidos",
    version="1.0.0",
    description="API para la vista de administrador y la vista de cliente.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(cliente_router)

@app.on_event("startup")
def on_startup():
    init_db()
    print("Base de datos lista")


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "SGP API corriendo 🚀"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)