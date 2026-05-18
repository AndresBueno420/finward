import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

from extractor import extraer_transaccion
from models import ProcesarNotificacionRequest, ProcesarNotificacionResponse

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY no está configurada")
    yield


app = FastAPI(title="FinWard AI Service", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/internal/process", response_model=ProcesarNotificacionResponse)
def process_notification(req: ProcesarNotificacionRequest):
    # FastAPI ejecuta handlers síncronos en un threadpool, por lo que este
    # endpoint no bloquea el event loop aunque la llamada a Gemini sea bloqueante.
    try:
        transaccion, fallback = extraer_transaccion(req.texto, req.paquete)
        return ProcesarNotificacionResponse(
            transaccion=transaccion,
            fallback_categoria=fallback,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
