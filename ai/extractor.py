import os

import google.generativeai as genai
import instructor
from dotenv import load_dotenv

from models import Categoria, TransaccionExtraida

load_dotenv()

CONFIDENCE_THRESHOLD = 0.65

# El system_instruction va como campo separado en GenerativeModel para que Gemini
# lo trate con mayor peso que el user message.
_SYSTEM_PROMPT = """Eres un extractor de entidades financieras especializado en notificaciones push de apps bancarias colombianas.

FORMATO NUMÉRICO COLOMBIANO:
- Punto como separador de miles: $1.234.567
- Coma como separador decimal: $1.234.567,89
- Extrae el monto siempre como número positivo sin símbolos: 1234567.89

CATEGORÍAS Y CRITERIOS:
- Alimentación: supermercados (Éxito, Jumbo, D1, Ara), restaurantes, cafeterías, delivery de comida (Rappi, iFood, Domicilios.com)
- Transporte: Uber, InDriver, Cabify, taxis, combustible (Terpel, Primax), peajes, TransMilenio
- Entretenimiento: cine (Cinemark, Cine Colombia), videojuegos, Steam, plataformas de streaming (Netflix, Spotify, Disney+, HBO, Prime)
- Suscripciones: pagos recurrentes mensuales o anuales a servicios digitales, SaaS, membresías (distinto de Entretenimiento cuando el contexto es claramente una suscripción)
- Salud: farmacias (Cruz Verde, Droguería), médicos, clínicas, laboratorios, seguros de salud (Compensar, Sura)
- Otros: comercios que no encajan claramente en ninguna categoría anterior

BANCO: identifícalo por el package name de la app o por el texto de la notificación.

CONFIANZA: asigna un valor bajo (< 0.6) cuando:
- El texto está incompleto o es ambiguo
- El comercio es genérico o desconocido
- No puedes determinar el monto con certeza
- La categoría no es clara

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

    fallback = resultado.confidence < CONFIDENCE_THRESHOLD
    if fallback:
        resultado.categoria = Categoria.otros

    return resultado, fallback
