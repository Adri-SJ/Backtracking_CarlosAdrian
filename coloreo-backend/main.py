from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Literal
from fastapi.middleware.cors import CORSMiddleware


# ----- Modelos de datos -----

class PeticionResolver(BaseModel):
    nodos: List[str]
    enlaces: List[List[str]]  # [["A","B"], ["B","C"], ...]
    max_colores: int

class Paso(BaseModel):
    nodo: str
    color: int
    accion: Literal["probar", "asignar", "conflicto", "backtrack"]

class RespuestaResolver(BaseModel):
    solucion: Dict[str, int]
    pasos: List[Paso]


app = FastAPI(title="Microservicio Coloreo Mapas con Backtracking")

# permitir peticiones desde el front (Vite en localhost)
origenes_permitidos = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes_permitidos,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ----- Lógica de backtracking -----

def construir_vecindad(nodos: List[str], enlaces: List[List[str]]) -> Dict[str, List[str]]:
    vecindad = {n: [] for n in nodos}
    for a, b in enlaces:
        if a in vecindad and b in vecindad:
            vecindad[a].append(b)
            vecindad[b].append(a)
    return vecindad


def es_color_valido(nodo: str, color: int, asignacion: Dict[str, int], vecindad: Dict[str, List[str]]) -> bool:
    """Revisa que ningún vecino tenga el mismo color."""
    for vecino in vecindad.get(nodo, []):
        if asignacion.get(vecino) == color:
            return False
    return True


def backtracking_coloreo(
    nodos: List[str],
    vecindad: Dict[str, List[str]],
    max_colores: int,
    asignacion: Dict[str, int],
    pasos: List[Dict],
    indice: int = 0
) -> bool:
    # Caso base: ya coloreamos todos los nodos
    if indice == len(nodos):
        return True

    nodo_actual = nodos[indice]

    for color in range(1, max_colores + 1):
        pasos.append({"nodo": nodo_actual, "color": color, "accion": "probar"})

        if es_color_valido(nodo_actual, color, asignacion, vecindad):
            asignacion[nodo_actual] = color
            pasos.append({"nodo": nodo_actual, "color": color, "accion": "asignar"})

            if backtracking_coloreo(nodos, vecindad, max_colores, asignacion, pasos, indice + 1):
                return True

            # backtrack
            pasos.append({"nodo": nodo_actual, "color": color, "accion": "backtrack"})
            del asignacion[nodo_actual]
        else:
            pasos.append({"nodo": nodo_actual, "color": color, "accion": "conflicto"})

    return False


# ----- Endpoint principal -----

@app.post("/resolver", response_model=RespuestaResolver)
def resolver_mapa(peticion: PeticionResolver):
    nodos = peticion.nodos
    enlaces = peticion.enlaces
    max_colores = peticion.max_colores

    vecindad = construir_vecindad(nodos, enlaces)
    pasos: List[Dict] = []
    asignacion: Dict[str, int] = {}

    hay_solucion = backtracking_coloreo(nodos, vecindad, max_colores, asignacion, pasos)

    if not hay_solucion:
        # si no hay solución, regresamos pasos, pero sin asignación
        return RespuestaResolver(solucion={}, pasos=[Paso(**p) for p in pasos])

    return RespuestaResolver(solucion=asignacion, pasos=[Paso(**p) for p in pasos])
