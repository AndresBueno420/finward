import os

import google.generativeai as genai
import instructor
from dotenv import load_dotenv

from models import Categoria, TipoMovimiento, TransaccionExtraida

load_dotenv()

CONFIDENCE_THRESHOLD = 0.65

# El system_instruction va como campo separado en GenerativeModel para que Gemini
# lo trate con mayor peso que el user message.
_SYSTEM_PROMPT = """Eres un extractor de entidades financieras especializado en notificaciones push de apps bancarias colombianas.

FORMATO NUMÉRICO COLOMBIANO:
- Punto como separador de miles: $1.234.567
- Coma como separador decimal: $1.234.567,89
- Extrae el monto siempre como número positivo sin símbolos: 1234567.89

TIPO DE MOVIMIENTO — determínalo antes de asignar la categoría:
- gasto: el dinero SALE de la cuenta del usuario (compras, pagos, retiros, transferencias enviadas)
  Frases típicas: "Compra aprobada", "Pagaste", "Transferiste", "Retiro", "Débito"
- ingreso: el dinero ENTRA a la cuenta del usuario (transferencias recibidas, consignaciones, pagos recibidos)
  Frases típicas: "Recibiste", "Te enviaron", "Te consignaron", "Transferencia recibida",
                  "Depósito recibido", "Acreditado en tu cuenta", "Te pagaron", "Cobro recibido"

REGLA ABSOLUTA: si tipo = ingreso → categoría SIEMPRE es "Ingreso" sin excepción.

CATEGORÍAS PARA GASTOS:
- Alimentación: supermercados (Éxito, Jumbo, D1, Ara), restaurantes, cafeterías, delivery (Rappi Food, iFood, Domicilios.com)
- Transporte: Uber, InDriver, Cabify, taxis, combustible (Terpel, Primax), peajes, TransMilenio
- Entretenimiento: cine (Cinemark, Cine Colombia), videojuegos, Steam, streaming (Netflix, Spotify, Disney+, HBO, Prime)
- Suscripciones: pagos recurrentes mensuales o anuales a servicios digitales, SaaS, membresías
- Salud: farmacias (Cruz Verde, Droguería), médicos, clínicas, laboratorios, seguros (Compensar, Sura)
- Otros: comercios que no encajan claramente en ninguna categoría anterior

CAMPO comercio:
- Para gastos: nombre del establecimiento o servicio (ej: "RAPPI COLOMBIA SAS", "Netflix")
- Para ingresos: nombre del remitente tal como aparece en la notificación (ej: "Carlos García", "Empresa XYZ")

BANCO: identifícalo por el package name de la app o por el texto de la notificación.

CONFIANZA: asigna un valor bajo (< 0.6) cuando:
- El texto está incompleto o es ambiguo
- El comercio o remitente es desconocido o genérico
- No puedes determinar el monto con certeza
- El tipo de movimiento no es claro

Devuelve null en fecha si no aparece explícitamente en el texto."""

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

_model = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    system_instruction=_SYSTEM_PROMPT,
)

client = instructor.from_gemini(
    client=_model,
    mode=instructor.Mode.GEMINI_JSON,
)


def extraer_transaccion(texto: str, paquete: str) -> tuple[TransaccionExtraida, bool]:
    """
    Extrae entidades de una notificación bancaria usando Gemini + instructor.
    Retorna (transaccion, fallback_aplicado).
    fallback_aplicado=True cuando confidence < CONFIDENCE_THRESHOLD y se forzó Otros.
    Lanza InstructorRetryException si los 3 reintentos fallan.
    """
    resultado: TransaccionExtraida = client.chat.completions.create(
        response_model=TransaccionExtraida,
        messages=[
            {
                "role": "user",
                "content": f"App: {paquete}\nNotificación: {texto}",
            }
        ],
        max_retries=3,
    )

    # El fallback a "Otros" solo aplica a gastos con baja confianza.
    # Los ingresos siempre quedan como "Ingreso" independientemente del confidence.
    fallback = (
        resultado.confidence < CONFIDENCE_THRESHOLD
        and resultado.tipo == TipoMovimiento.gasto
    )
    if fallback:
        resultado.categoria = Categoria.otros

    return resultado, fallback
