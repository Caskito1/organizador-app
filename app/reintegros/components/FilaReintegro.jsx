// reintegros/components/FilaReintegro.jsx
// 4.3a — Fila de obligación con historial de entregas y acciones de pago
// («Agregar pago» / «Saldar deuda» → DevolucionModal, §9.2/§9.4 de la
// PROPUESTA Etapa 3). Absorbe la `FilaObl` de 4.2. Las acciones solo se
// muestran sobre obligaciones ABIERTAS (pendiente/parcial con saldo > 0) y
// cuando la sección las habilita (pestaña Activos); en Cerrados queda el
// historial sin acciones. Los pagos se ordenan por `fechaPago` ascendente.
// 4.3b (21/10/2026): edición de monto SOLO en Activos — «Editar» por pago
// (ambas partes) y «Editar monto» de la obligación (solo registrador), más
// chips «Editado: $300 → $200 · 21/10» (evento `edicion`, último por
// obligación y por entrega). Sin `ediciones`/callbacks (pestaña Saldados)
// no se muestra nada de edición.
// 4.3c (21/10/2026): chip «Dinero»/«Ítem» derivado del documento con
// tipoDineroDe (sin suscripciones): se ve en Activos y en Saldados. Si la
// obligación por_cobrar no trae movimientoInicialTipo (vieja) → sin chip.
// 4.3-bis (23/10/2026): las acciones de obligación y de cada pago viven en
// el menú ⋮ («Acciones», área táctil 30×30 px, hoja `MenuAccionesSheet`
// montada en page.jsx — fuera de los acordeones y bajo el BottomNav) —
// los botones chicos inline de 4.3b se retiraron
// para no duplicar entradas. Menú por permisos/estado: abierta → Editar
// monto (registrador), Perdonar deuda (acreedor), Eliminar (registrador,
// rojo, al final); CERRADAS (liquidada/perdonada) → sin menú (regla
// estricta 24/10/2026; D-9 opción B RETIRADA); pagos solo en Activos →
// Editar monto → Eliminar (ambas partes). Sin acciones → sin ícono. Sello
// de estado «Condonada» → «Perdonada» (etiqueta de UI; el modelo sigue en
// `condonacion`).
// 5.0-fecha (17/11/2026): la fecha visible de la fila sale de la FECHA
// EFECTIVA (`fecha` con fallback a `createdAt`), igual que los cálculos; el
// menú de la obligación pasa a CUATRO acciones (Editar monto · Editar fecha ·
// Perdonar deuda · Eliminar) y la edición de fecha agrega su chip propio
// («Fecha editada»), independiente del chip de monto.

"use client";

import { useAuth } from "@/lib/AuthContext";
import { estadoDe, saldoDe, tipoDineroDe, fechaEfectivaDe } from "../helpers/modelo";

const ETIQUETA_ESTADO = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  liquidado: "Liquidada",
  condonado: "Perdonada",
};

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function fechaCorta(fecha) {
  const d = fecha?.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-AR");
}

function fechaDiaMes(fecha) {
  const d = fecha?.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function ChipEdicion({ ev }) {
  if (!ev) return null;
  return (
    <span className="mt-[4px] inline-block rounded-[8px] border border-accent/30 bg-accent/12 px-2 py-[2px] text-[10px] font-medium text-accent-light">
      Editado: {money(ev.montoAnterior)} → {money(ev.montoNuevo)} ·{" "}
      {fechaDiaMes(ev.createdAt)}
    </span>
  );
}

// 5.0-fecha (P-2, opción 1) — chip de la edición de FECHA: la fecha nueva y
// cuándo se editó. `fechaAnterior` puede ser null (doc sin `fecha`): no se
// muestra, no se inventa.
function ChipFechaEdicion({ ev }) {
  if (!ev) return null;
  return (
    <span className="mt-[4px] inline-block rounded-[8px] border border-accent/30 bg-accent/12 px-2 py-[2px] text-[10px] font-medium text-accent-light">
      Fecha editada: {fechaDiaMes(ev.fechaNueva)} ·{" "}
      {fechaDiaMes(ev.createdAt)}
    </span>
  );
}

// 4.3c — chip discreto Dinero/Ítem (discreto, solo lectura del doc).
function ChipTipoDinero({ r }) {
  const tipo = tipoDineroDe(r);
  if (!tipo) return null;
  return (
    <span className="mt-[4px] inline-block rounded-[8px] border border-border bg-white/4 px-2 py-[2px] text-[10px] font-medium text-text-muted">
      {tipo === "dinero" ? "Dinero" : "Ítem"}
    </span>
  );
}

// 4.3-bis — disparador del menú ⋮ («Acciones», área táctil 40×40 px).
function BotonMenu({ etiqueta, abierto, onAbrir }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-haspopup="menu"
      aria-expanded={abierto}
      onClick={onAbrir}
      className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[10px] text-text-muted/60 transition-colors hover:bg-white/6 hover:text-text-muted"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
  );
}

export default function FilaReintegro({
  r,
  entregas,
  onPagar,
  ediciones,
  onEditarObligacion,
  onEditarFecha,
  onEditarEntrega,
  onAccionObligacion,
  onAccionEntrega,
  onMenuAbrir,
  menuActivo = null,
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const estado = estadoDe(r);
  const saldo = saldoDe(r);
  const devuelto = Number(r.devuelto || 0);
  const monto = Number(r.monto || 0);
  const fecha = fechaEfectivaDe(r)?.toLocaleDateString("es-AR") ?? "";

  const pagos = [...(entregas ?? [])].sort(
    (a, b) =>
      (a.fechaPago?.toDate?.() ?? new Date(a.fechaPago)) -
      (b.fechaPago?.toDate?.() ?? new Date(b.fechaPago)),
  );

  const abierta = (estado === "pendiente" || estado === "parcial") && saldo > 0;
  const conAcciones = !!onPagar && abierta;
  // Edición (4.3b): callbacks solo en Activos; chips de edición igual.
  const conEdicionPago = conAcciones && !!onEditarEntrega;
  const evObl = ediciones?.obligacion ?? null;
  const evFecha = ediciones?.fecha ?? null;

  // 4.3-bis — permisos de la fila (mismas reglas que los helpers).
  const esRegistrador = r.registradoPor === uid;
  const esAcreedor =
    r.contraparteUid == null
      ? esRegistrador
      : esRegistrador
        ? r.sentido === "por_cobrar"
        : (r.participantes || []).includes(uid) && r.sentido === "por_devolver";

  // Acciones de la OBLIGACIÓN por permisos y estado (4.3-bis).
  const accionesObl = [];
  if (onAccionObligacion) {
    if (abierta) {
      if (esRegistrador && onEditarObligacion) {
        accionesObl.push({
          id: "editar",
          label: "Editar monto",
          onSelect: () => onEditarObligacion(r),
        });
      }
      // 5.0-fecha (U-2): operación INDEPENDIENTE del monto.
      if (esRegistrador && onEditarFecha) {
        accionesObl.push({
          id: "editar-fecha",
          label: "Editar fecha",
          onSelect: () => onEditarFecha(r),
        });
      }
      if (esAcreedor) {
        accionesObl.push({
          id: "perdonar",
          label: "Perdonar deuda",
          onSelect: () => onAccionObligacion(r, "condonar"),
        });
      }
      if (esRegistrador) {
        accionesObl.push({
          id: "eliminar",
          label: "Eliminar",
          danger: true,
          onSelect: () => onAccionObligacion(r, "eliminar-obligacion"),
        });
      }
    }
    // CERRADAS (liquidada/perdonada) sin menú: regla estricta 24/10/2026.
    // D-9 opción B (perdonada → Eliminar) quedó RETIRADA.
  }

  // Acciones de cada PAGO: solo en Activos (abierta con callbacks).
  function accionesDe(e) {
    const items = [];
    if (conAcciones && onEditarEntrega) {
      items.push({
        id: "editar",
        label: "Editar monto",
        onSelect: () => onEditarEntrega(r, e),
      });
    }
    if (conAcciones && onAccionEntrega) {
      items.push({
        id: "eliminar",
        label: "Eliminar",
        danger: true,
        onSelect: () => onAccionEntrega(r, e, "eliminar-pago"),
      });
    }
    return items;
  }

  return (
    <div className="border-b border-[rgba(138,100,255,0.1)] py-[10px]">
      <div className="flex justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium capitalize text-text">
            {r.concepto}
          </p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {r.contraparteNombre} · {fecha}
          </p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            Saldado {money(devuelto)} · Pendiente {money(saldo)}
          </p>
          <ChipEdicion ev={evObl} />
          <ChipFechaEdicion ev={evFecha} />
          <ChipTipoDinero r={r} />
        </div>

        <div className="flex-shrink-0">
          {/* Estructura del header del acordeón: col monto+texto | botón. */}
          <div className="flex items-center gap-[10px]">
            <div className="flex flex-col items-end">
              <p className="font-sora text-[14px] font-bold text-text">
                {money(monto)}
              </p>
              <p className="mt-[2px] text-[11px] text-text-muted">
                {ETIQUETA_ESTADO[estado]}
              </p>
            </div>
            {/* Menú ⋮ de la obligación (4.3-bis): columna propia. */}
            {accionesObl.length > 0 && (
              <BotonMenu
                etiqueta="Acciones"
                abierto={
                  !!menuActivo && !menuActivo.entrega && menuActivo.r.id === r.id
                }
                onAbrir={() =>
                  onMenuAbrir?.({ r, entrega: null, items: accionesObl })
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Historial de entregas (visible también en Cerrados — done) */}
      {pagos.length > 0 && (
        <div className="mt-2 rounded-[12px] border border-[rgba(138,100,255,0.14)] bg-[rgba(138,100,255,0.05)] px-3 py-2">
          <p className="mb-[4px] text-[10px] uppercase tracking-[0.5px] text-text-muted">
            Pagos
          </p>
          {pagos.map((e) => (
            <div key={e.id} className="py-[2px] text-[11px] text-text-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {fechaCorta(e.fechaPago)} · {e.realizadoPorNombre}
                  {e.detalle ? ` · ${e.detalle}` : ""}
                </span>
                <span className="flex flex-shrink-0 items-center gap-[10px]">
                  <span className="font-sora font-semibold text-text">
                    {money(e.monto)}
                  </span>
                  {/* Menú ⋮ del pago (4.3-bis): solo si hay acciones. */}
                  {accionesDe(e).length > 0 && (
                    <BotonMenu
                      etiqueta="Acciones"
                      abierto={
                        !!menuActivo && menuActivo.entrega?.id === e.id
                      }
                      onAbrir={() =>
                        onMenuAbrir?.({ r, entrega: e, items: accionesDe(e) })
                      }
                    />
                  )}
                </span>
              </div>
              {conEdicionPago && (
                <ChipEdicion ev={ediciones?.entregas?.[e.id]} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Acciones de pago — solo obligación abierta y pestaña Activos */}
      {conAcciones && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onPagar(r, "parcial")}
            className="flex-1 cursor-pointer rounded-[12px] border border-accent/50 bg-accent/15 px-3 py-[7px] text-[12px] font-semibold text-accent-light transition-all hover:bg-accent/25"
          >
            Agregar pago
          </button>
          <button
            type="button"
            onClick={() => onPagar(r, "saldar")}
            className="flex-1 cursor-pointer rounded-[12px] bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] px-3 py-[7px] text-[12px] font-bold text-white transition-all hover:scale-[1.01]"
          >
            Saldar deuda
          </button>
        </div>
      )}
    </div>
  );
}
