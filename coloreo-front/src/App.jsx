import { useState, useEffect, useRef } from "react";
import axios from "axios";
import html2canvas from "html2canvas";
import "./App.css";

const coloresPaleta = ["#fca5a5", "#93c5fd", "#a7f3d0", "#fde68a", "#c4b5fd"];

// Mapas de ejemplo (prediseñados)
const mapasEjemplo = {
  "4regiones": {
    nombre: "Mapa 4 regiones (cuadro)",
    nodos: ["A", "B", "C", "D"],
    enlaces: [
      ["A", "B"],
      ["A", "C"],
      ["B", "D"],
      ["C", "D"],
    ],
    layout: {
      A: { top: "5%", left: "8%", width: "40%", height: "40%" },
      B: { top: "5%", left: "52%", width: "40%", height: "40%" },
      C: { top: "52%", left: "8%", width: "40%", height: "40%" },
      D: { top: "52%", left: "52%", width: "40%", height: "40%" },
    },
  },
  "6regiones": {
    nombre: "Mapa 6 regiones (tipo países)",
    nodos: ["Norte", "Centro", "Sur", "Oeste", "Este", "Isla"],
    enlaces: [
      ["Norte", "Centro"],
      ["Centro", "Sur"],
      ["Oeste", "Centro"],
      ["Este", "Centro"],
      ["Sur", "Este"],
      ["Isla", "Sur"],
    ],
    layout: {
      Norte: { top: "2%", left: "30%", width: "40%", height: "25%" },
      Centro: { top: "27%", left: "28%", width: "44%", height: "25%" },
      Sur: { top: "52%", left: "30%", width: "40%", height: "25%" },
      Oeste: { top: "27%", left: "5%", width: "20%", height: "30%" },
      Este: { top: "27%", left: "72%", width: "20%", height: "30%" },
      Isla: { top: "75%", left: "70%", width: "20%", height: "20%" },
    },
  },
};

function App() {
  // grafo (regiones y vecindades)
  const [nodos, setNodos] = useState(["A", "B", "C", "D"]);
  const [enlaces, setEnlaces] = useState([
    ["A", "B"],
    ["B", "C"],
    ["C", "D"],
    ["D", "A"],
    ["A", "C"],
  ]);

  const [layoutRegiones, setLayoutRegiones] = useState({});

  // control de entrada manual
  const [nombreNodoNuevo, setNombreNodoNuevo] = useState("");
  const [nodo1, setNodo1] = useState("");
  const [nodo2, setNodo2] = useState("");

  // mapa seleccionado
  const [mapaSeleccionado, setMapaSeleccionado] = useState("manual");

  // configuración de colores
  const [maxColores, setMaxColores] = useState(3);

  // animación / backtracking
  const [pasos, setPasos] = useState([]);
  const [indicePaso, setIndicePaso] = useState(0);
  const [asignacion, setAsignacion] = useState({});
  const [enAnimacion, setEnAnimacion] = useState(false);
  const [velocidad, setVelocidad] = useState(600); // ms
  const [pasoActual, setPasoActual] = useState(null);

  // estado general
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // ref del mapa para capturar imagen
  const mapaRef = useRef(null);

  // ===== animación de pasos =====
  useEffect(() => {
    if (!enAnimacion || pasos.length === 0) return;
    if (indicePaso >= pasos.length) {
      setEnAnimacion(false);
      return;
    }

    const id = setTimeout(() => {
      aplicarPaso(pasos[indicePaso]);
      setIndicePaso((prev) => prev + 1);
    }, velocidad);

    return () => clearTimeout(id);
  }, [enAnimacion, pasos, indicePaso, velocidad]);

  const aplicarPaso = (paso) => {
    if (!paso) return;
    // solo movemos el borde, el mapa ya está coloreado con la solución final
    setPasoActual(paso);
    if (paso.accion === "asignar") {
      setAsignacion((prev) => ({
        ...prev,
        [paso.nodo]: paso.color,
      }));
    } else if (paso.accion === "backtrack") {
      setAsignacion((prev) => {
        const copia = { ...prev };
        delete copia[paso.nodo];
        return copia;
      });
    }
  };

  // ===== cargar mapas de ejemplo =====
  const cargarMapaEjemplo = (idMapa) => {
    if (idMapa === "manual") {
      setNodos([]);
      setEnlaces([]);
      setLayoutRegiones({});
    } else if (mapasEjemplo[idMapa]) {
      const m = mapasEjemplo[idMapa];
      setNodos(m.nodos);
      setEnlaces(m.enlaces);
      setLayoutRegiones(m.layout || {});
    }

    setAsignacion({});
    setPasos([]);
    setIndicePaso(0);
    setPasoActual(null);
    setEnAnimacion(false);
  };

  // layout automático para modo manual
  useEffect(() => {
    if (mapaSeleccionado !== "manual") return;
    if (nodos.length === 0) {
      setLayoutRegiones({});
      return;
    }

    const filas = Math.ceil(Math.sqrt(nodos.length));
    const cols = filas;
    const nuevoLayout = {};
    nodos.forEach((n, idx) => {
      const fila = Math.floor(idx / cols);
      const col = idx % cols;
      const width = 100 / cols;
      const height = 100 / filas;
      nuevoLayout[n] = {
        top: `${fila * height + 3}%`,
        left: `${col * width + 3}%`,
        width: `${width - 6}%`,
        height: `${height - 6}%`,
      };
    });
    setLayoutRegiones(nuevoLayout);
  }, [nodos, mapaSeleccionado]);

  // ===== llamado al backend =====
  const manejarResolver = async () => {
    if (nodos.length === 0) {
      setError("Agrega regiones o selecciona un mapa de ejemplo antes de resolver.");
      return;
    }

    setCargando(true);
    setError("");
    setAsignacion({});
    setPasos([]);
    setIndicePaso(0);
    setEnAnimacion(false);
    setPasoActual(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

      const resp = await axios.post(`${API_URL}/resolver`, {
        nodos,
        enlaces,
        max_colores: maxColores,
      });

      const datos = resp.data;
      const solucionFinal = datos.solucion || {};
      setPasos(datos.pasos || []);

      if (Object.keys(solucionFinal).length === 0) {
        setError("No se encontró una solución con esa configuración.");
        return;
      }

      // pintamos el mapa final correcto
      setAsignacion(solucionFinal);

      // animación = solo movimiento de borde
      setIndicePaso(0);
      setEnAnimacion(true);
      setPasoActual(null);
    } catch (e) {
      console.error(e);
      setError("Error al conectar con el microservicio.");
    } finally {
      setCargando(false);
    }
  };

  // ===== manejo del grafo manual =====
  const agregarNodo = () => {
    const nombre = nombreNodoNuevo.trim();
    if (!nombre) return;
    if (nodos.includes(nombre)) {
      alert("Ese nombre de región ya existe.");
      return;
    }
    setNodos([...nodos, nombre]);
    setNombreNodoNuevo("");
  };

  const agregarEnlace = () => {
    if (!nodo1 || !nodo2 || nodo1 === nodo2) return;
    const yaExiste = enlaces.some(
      (e) =>
        (e[0] === nodo1 && e[1] === nodo2) ||
        (e[0] === nodo2 && e[1] === nodo1)
    );
    if (yaExiste) {
      alert("Ese enlace ya existe.");
      return;
    }
    setEnlaces([...enlaces, [nodo1, nodo2]]);
    setNodo1("");
    setNodo2("");
  };

  const borrarTodoGrafo = () => {
    if (!window.confirm("¿Seguro que quieres borrar el mapa actual?")) return;
    setNodos([]);
    setEnlaces([]);
    setAsignacion({});
    setPasos([]);
    setIndicePaso(0);
    setPasoActual(null);
    setLayoutRegiones({});
  };

  // ===== descargar imagen del mapa =====
  const descargarMapaImagen = async () => {
    if (!mapaRef.current) return;
    try {
      const canvas = await html2canvas(mapaRef.current, {
        backgroundColor: "#e5e7eb",
      });
      const dataURL = canvas.toDataURL("image/png");
      const enlace = document.createElement("a");
      enlace.href = dataURL;
      enlace.download = "mapa_coloreado.png";
      enlace.click();
    } catch (e) {
      console.error(e);
      alert("No se pudo generar la imagen del mapa.");
    }
  };

  // ===== UI =====
  return (
    <div className="app-root">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1>Coloreo de Mapas con Backtracking</h1>
            <p className="app-subtitle">
              Configura un mapa, deja que el motor en Python lo resuelva y
              descarga la imagen del mapa coloreado.
            </p>
          </div>
          <div className="app-tag">Proyecto · Optimización</div>
        </header>

        <main className="app-main">
          {/* Columna izquierda: configuración y control */}
          <section className="col col-config">
            {/* 1. Grafo / mapa */}
            <div className="tarjeta seccion">
              <h2>1. Mapa / Grafo (regiones y vecindad)</h2>
              <p>
                Elige un mapa de ejemplo o crea el tuyo agregando regiones y
                vecindad. El motor de backtracking se encargará del coloreo.
              </p>

              <div className="fila">
                <label>Mapa:</label>
                <select
                  value={mapaSeleccionado}
                  onChange={(e) => {
                    const id = e.target.value;
                    setMapaSeleccionado(id);
                    cargarMapaEjemplo(id);
                  }}
                >
                  <option value="manual">Dibujar mapa manualmente</option>
                  <option value="4regiones">Mapa 4 regiones (cuadro)</option>
                  <option value="6regiones">Mapa 6 regiones (tipo países)</option>
                </select>
              </div>

              {mapaSeleccionado === "manual" && (
                <>
                  <div className="fila">
                    <input
                      placeholder="Nombre región (ej. Zona1)"
                      value={nombreNodoNuevo}
                      onChange={(e) => setNombreNodoNuevo(e.target.value)}
                    />
                    <button onClick={agregarNodo}>Agregar región</button>
                    <button onClick={borrarTodoGrafo} className="btn-peligro">
                      Limpiar mapa
                    </button>
                  </div>

                  <div className="fila">
                    <select
                      value={nodo1}
                      onChange={(e) => setNodo1(e.target.value)}
                    >
                      <option value="">Región 1</option>
                      {nodos.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>

                    <select
                      value={nodo2}
                      onChange={(e) => setNodo2(e.target.value)}
                    >
                      <option value="">Región 2</option>
                      {nodos.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>

                    <button onClick={agregarEnlace}>Agregar vecindad</button>
                  </div>
                </>
              )}

              <div className="info-grafo">
                <div>
                  <strong>Regiones:</strong>{" "}
                  {nodos.length ? nodos.join(", ") : "ninguna"}
                </div>
                <div>
                  <strong>Vecindades:</strong>{" "}
                  {enlaces.length === 0
                    ? "ninguna"
                    : enlaces.map((e, i) => `${e[0]}-${e[1]}`).join(", ")}
                </div>
              </div>
            </div>

            {/* 2. Configuración de colores */}
            <div className="tarjeta seccion">
              <h2>2. Configurar desafío</h2>
              <p>Define cuántos colores puede usar el algoritmo.</p>
              <div className="fila">
                <label>Colores permitidos (2 a 5):</label>
                <input
                  type="number"
                  min={2}
                  max={5}
                  value={maxColores}
                  onChange={(e) =>
                    setMaxColores(parseInt(e.target.value || "2"))
                  }
                />
              </div>
            </div>

            {/* 3. Resolver */}
            <div className="tarjeta seccion">
              <h2>3. Resolver con Backtracking</h2>
              <p>
                Envía el mapa al microservicio en Python, observa el proceso y
                analiza los pasos del algoritmo.
              </p>

              <div className="fila fila-botones">
                <button
                  onClick={manejarResolver}
                  disabled={cargando || nodos.length === 0}
                >
                  {cargando ? "Resolviendo..." : "Resolver con Backtracking"}
                </button>

                <button
                  onClick={() => setEnAnimacion((prev) => !prev)}
                  disabled={pasos.length === 0}
                >
                  {enAnimacion ? "Pausar animación" : "Reanudar animación"}
                </button>

                <button
                  onClick={() => {
                    if (indicePaso < pasos.length) {
                      aplicarPaso(pasos[indicePaso]);
                      setIndicePaso((prev) => prev + 1);
                    }
                  }}
                  disabled={pasos.length === 0 || indicePaso >= pasos.length}
                >
                  Siguiente paso
                </button>
              </div>

              <div className="fila">
                <label>Velocidad (ms entre pasos):</label>
                <input
                  type="range"
                  min={200}
                  max={1200}
                  step={100}
                  value={velocidad}
                  onChange={(e) => setVelocidad(parseInt(e.target.value))}
                />
                <span>{velocidad} ms</span>
              </div>

              {error && <p className="error">{error}</p>}
            </div>
          </section>

          {/* Columna derecha: mapa y pasos */}
          <section className="col col-visual">
            {/* 4. Visualización del mapa */}
            <div className="tarjeta seccion">
              <h2>4. Visualizar mapa coloreado</h2>
              <p className="texto-ayuda">
                El mapa final respeta que regiones vecinas no compartan color.
                El borde muestra el estado del algoritmo:{" "}
                <strong>amarillo</strong> = probando,{" "}
                <strong>rojo</strong> = conflicto,{" "}
                <strong>verde</strong> = asignado,{" "}
                <strong>morado</strong> = backtracking.
              </p>

              <div className="mapa-contenedor" ref={mapaRef}>
                <div className="mapa-fondo" />
                {nodos.map((nodo) => {
                  const layout = layoutRegiones[nodo] || {
                    top: "10%",
                    left: "10%",
                    width: "30%",
                    height: "20%",
                  };

                  const colorIdx = (asignacion[nodo] || 0) - 1;
                  const color =
                    colorIdx >= 0 ? coloresPaleta[colorIdx] : "#e5e7eb";

                  let borde = "#4b5563";
                  let sombra = "none";

                  if (pasoActual && pasoActual.nodo === nodo) {
                    if (pasoActual.accion === "probar") {
                      borde = "#fbbf24";
                    } else if (pasoActual.accion === "conflicto") {
                      borde = "#ef4444";
                    } else if (pasoActual.accion === "asignar") {
                      borde = "#22c55e";
                    } else if (pasoActual.accion === "backtrack") {
                      borde = "#6366f1";
                    }
                    sombra = "0 0 10px rgba(15, 23, 42, 0.45)";
                  }

                  return (
                    <div
                      key={nodo}
                      className="region-mapa"
                      style={{
                        top: layout.top,
                        left: layout.left,
                        width: layout.width,
                        height: layout.height,
                        backgroundColor: color,
                        borderColor: borde,
                        boxShadow: sombra,
                      }}
                    >
                      <span className="region-nombre">{nodo}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* pasos + descarga */}
            <div className="tarjeta seccion">
              <h2>5. Pasos y descarga</h2>
              <p className="texto-ayuda">
                Revisa el razonamiento del backtracking y descarga la imagen
                del mapa coloreado para tu reporte.
              </p>

              <div className="pasos-log">
                <h3>Pasos del backtracking</h3>
                {pasos.length === 0 ? (
                  <p>Ejecuta el algoritmo para ver los pasos.</p>
                ) : (
                  <ul>
                    {pasos.slice(0, indicePaso).map((p, i) => (
                      <li key={i}>
                        [{i + 1}] región <strong>{p.nodo}</strong> color{" "}
                        <strong>{p.color}</strong> →{" "}
                        <em>{p.accion}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="fila fila-descarga">
                <button
                  onClick={descargarMapaImagen}
                  disabled={Object.keys(asignacion).length === 0}
                >
                  Descargar mapa como imagen
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
