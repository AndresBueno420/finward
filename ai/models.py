from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TipoMovimiento(str, Enum):
    gasto   = "gasto"
    ingreso = "ingreso"


class Categoria(str, Enum):
    alimentacion    = "Alimentación"
    transporte      = "Transporte"
    entretenimiento = "Entretenimiento"
    suscripciones   = "Suscripciones"
    salud           = "Salud"
    ingreso         = "Ingreso"
    otros           = "Otros"


class TransaccionExtraida(BaseModel):
    comercio:   str             = Field(description="Nombre del comercio para gastos, o nombre del remitente para ingresos")
    monto:      float           = Field(description="Monto de la transacción, siempre positivo, sin símbolos de moneda")
    divisa:     str             = Field(default="COP", description="Código ISO de la moneda. Default COP para transacciones colombianas")
    fecha:      datetime | None = Field(default=None, description="Fecha y hora extraída del texto. null si no aparece explícitamente")
    banco:      str             = Field(description="Nombre del banco o app financiera que generó la notificación (ej: Bancolombia, Nu, Nequi)")
    tipo:       TipoMovimiento  = Field(description="'gasto' si el dinero sale de la cuenta, 'ingreso' si entra")
    categoria:  Categoria       = Field(description="Categoría del movimiento. Si tipo=ingreso, SIEMPRE debe ser 'Ingreso'")
    confidence: float           = Field(ge=0.0, le=1.0, description="Confianza del modelo entre 0.0 y 1.0")


class ProcesarNotificacionRequest(BaseModel):
    texto:     str = Field(description="Texto crudo de la notificación bancaria")
    timestamp: int = Field(description="Unix timestamp en milisegundos del momento de la notificación")
    paquete:   str = Field(description="Package name de la app que generó la notificación (ej: com.bancolombia.sucursalvirtual)")


class ProcesarNotificacionResponse(BaseModel):
    transaccion:        TransaccionExtraida
    fallback_categoria: bool = Field(description="True cuando la confianza fue baja y se asignó 'Otros' automáticamente")
