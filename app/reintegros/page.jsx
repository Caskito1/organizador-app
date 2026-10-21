// reintegros/page.jsx
// 4.3a — Reescritura consumiendo sections/ + acciones de pago (4.3):
// el modal de pago (DevolucionModal) se abre desde FilaReintegro
// («Agregar pago» / «Saldar deuda») en la pestaña Activos.
// Se conserva de 4.2: balance de stock Préstamos/Deudas (estética
// /gastos), pestañas Activos/Saldados, sección «Dinero del mes» (solo
// lectura con selector de mes), botón «Reintentar» y el reintento de la
// suscripción (solo unavailable, con tope). Sin confirmación bilateral
// (decisión 17/10/2026): las obligaciones de miembro cuentan en el
// balance de ambas partes. El stock de abiertas NO depende del mes (PO-1).
// 4.3b (21/10/2026): edición de monto SOLO en Activos — useEdiciones
// suscribe los eventos `edicion` de las obligaciones visibles (0 rids en
// Saldados ⇒ desuscribe todo) y EditarReintegroModal edita pago u
// obligación. CerradosSection no recibe nada de edición.

"use client";

import { useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import IconButton from "@/app/components/ui/IconButton";
import IconCalendar from "@/app/components/icons/IconCalendar";

import Appshell from "../components/layout/Appshell";
import MonthSelectorModal from "../gastos/components/MonthNavigator";

import useReintegros from "./hooks/useReintegros";
import useEdiciones from "./hooks/useEdiciones";
import { sentidoDelViewer, saldoDe } from "./helpers/modelo";
import ReintegrosHeader from "./sections/ReintegrosHeader";
import PendientesSection from "./sections/PendientesSection";
import CerradosSection from "./sections/CerradosSection";
import DevolucionModal from "./components/DevolucionModal";
import EditarReintegroModal from "./components/EditarReintegroModal";

function getMesLabel(date) {
  return date.toLocaleString("es-AR", { month: "long", year: "numeric" });
}

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function resumenDe(lista) {
  return {
    cantidad: lista.length,
    montoTotal: lista.reduce((a, r) => a + Number(r.monto || 0), 0),
    pendiente: lista.reduce((a, r) => a + saldoDe(r), 0),
  };
}

function ColumnaBalance({ titulo, resumen, etiquetaPendiente }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
        {titulo}
      </p>
      <p className="mt-[3px] text-[12px] text-text-muted">
        {resumen.cantidad} abiertas · Total {money(resumen.montoTotal)}
      </p>
      <p className="mt-[6px] text-[11px] text-text-muted">
        {etiquetaPendiente}
      </p>
      <p className="font-sora text-[22px] font-bold leading-none text-accent-light">
        {money(resumen.pendiente)}
      </p>
    </div>
  );
}

export default function ReintegrosPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [mesSel, setMesSel] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tab, setTab] = useState("activos");
  const [openPrestamos, setOpenPrestamos] = useState(true);
  const [openDeudas, setOpenDeudas] = useState(true);
  const [openMes, setOpenMes] = useState(false);
  // Modal de pago: { r, modo } — modo «parcial» | «saldar» (§9.4).
  const [pago, setPago] = useState(null);
  // Modal de edición de monto (4.3b): { modo, r, entrega? }.
  const [edicion, setEdicion] = useState(null);

  const {
    loading,
    error,
    reintentando,
    reintentar,
    pendientes,
    cerrados,
    devoluciones,
    entradasReintegros,
    salidasReintegros,
  } = useReintegros(mesSel);

  // (3) Balance de stock SOLO sobre abiertas (pendiente/parcial; sin
  // condonadas ni eliminadas) — ya vienen filtradas en `pendientes`.
  const prestamosAbiertas = pendientes.filter(
    (r) => sentidoDelViewer(r, uid) === "por_cobrar",
  );
  const deudasAbiertas = pendientes.filter(
    (r) => sentidoDelViewer(r, uid) === "por_devolver",
  );
  const prestamosCerrados = cerrados.filter(
    (r) => sentidoDelViewer(r, uid) === "por_cobrar",
  );
  const deudasCerradas = cerrados.filter(
    (r) => sentidoDelViewer(r, uid) === "por_devolver",
  );

  // Entregas agrupadas por obligación para las filas (sin eliminadas —
  // D-5: el filtro por campo ausente ya es el del modelo; acá se aplica
  // de forma defensiva sobre la constancia).
  const entregasPorObl = useMemo(() => {
    const mapa = new Map();
    for (const d of devoluciones) {
      if ("eliminacion" in d) continue;
      const arr = mapa.get(d.reintegroId) ?? [];
      arr.push(d);
      mapa.set(d.reintegroId, arr);
    }
    return mapa;
  }, [devoluciones]);

  const enActivos = tab === "activos";

  // 4.3b — Eventos `edicion` SOLO de las obligaciones visibles en Activos:
  // en Saldados rids vacíos ⇒ la suscripción se desuscribe toda y los chips
  // desaparecen (decisión 21/10/2026; ver EVIDENCIA-4.3.md §3.2). Si una
  // obligación se liquida, sale de `pendientes` ⇒ deja de suscribirse.
  const idsActivas = useMemo(
    () => (enActivos ? pendientes.map((r) => r.id) : []),
    [enActivos, pendientes],
  );
  const ediciones = useEdiciones(idsActivas);

  return (
    <Appshell>
      <ReintegrosHeader />

      {loading && (
        <p className="text-[13px] text-text-muted">Cargando reintegros…</p>
      )}

      {!loading && error && (
        <div className="rounded-[12px] border border-negative/30 bg-negative/10 px-4 py-3 text-[13px] text-negative">
          <p>No se pudieron cargar tus reintegros.</p>
          {reintentando && (
            <p className="mt-1 text-[12px] opacity-80">
              Reintentando conexión automáticamente…
            </p>
          )}
          {!reintentando && (
            <button
              type="button"
              onClick={reintentar}
              className="mt-2 cursor-pointer rounded-[12px] border border-negative/40 px-3 py-[6px] text-[12px] font-semibold text-negative transition-all hover:bg-negative/10"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* (3) Balance de reintegros — card estilo TotalMesCard */}
          <div className="mt-3 rounded-[22px] border border-[rgba(138,100,255,0.28)] bg-[linear-gradient(135deg,rgba(138,100,255,0.18),rgba(91,53,213,0.22))] px-[22px] py-5">
            <p className="mb-[10px] text-[11px] uppercase tracking-[0.5px] text-[rgba(200,174,255,0.65)]">
              Balance de reintegros
            </p>
            <div className="grid grid-cols-2 gap-4">
              <ColumnaBalance
                titulo="Préstamos"
                resumen={resumenDe(prestamosAbiertas)}
                etiquetaPendiente="Pendiente"
              />
              <ColumnaBalance
                titulo="Deudas"
                resumen={resumenDe(deudasAbiertas)}
                etiquetaPendiente="Pendiente"
              />
            </div>
          </div>

          {/* (4) Pestañas Activos / Saldados */}
          <div className="mb-3 mt-4 flex gap-2">
            {[
              { id: "activos", label: `Activos (${pendientes.length})` },
              { id: "saldados", label: `Saldados (${cerrados.length})` },
            ].map((op) => {
              const active = tab === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setTab(op.id)}
                  className={`flex-1 rounded-[14px] border px-3 py-[9px] text-[13px] transition-all ${
                    active
                      ? "border-accent/60 bg-accent/18 font-semibold text-accent-light"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>

          {/* Secciones según pestaña (4.3a) */}
          {enActivos ? (
            <PendientesSection
              prestamos={prestamosAbiertas}
              deudas={deudasAbiertas}
              entregasPorObl={entregasPorObl}
              openPrestamos={openPrestamos}
              onTogglePrestamos={() => setOpenPrestamos((v) => !v)}
              openDeudas={openDeudas}
              onToggleDeudas={() => setOpenDeudas((v) => !v)}
              onPagar={(r, modo) => setPago({ r, modo })}
              ediciones={ediciones}
              onEditarObligacion={(r) => setEdicion({ modo: "obligacion", r })}
              onEditarEntrega={(r, entrega) =>
                setEdicion({ modo: "pago", r, entrega })
              }
            />
          ) : (
            <CerradosSection
              prestamos={prestamosCerrados}
              deudas={deudasCerradas}
              entregasPorObl={entregasPorObl}
              openPrestamos={openPrestamos}
              onTogglePrestamos={() => setOpenPrestamos((v) => !v)}
              openDeudas={openDeudas}
              onToggleDeudas={() => setOpenDeudas((v) => !v)}
            />
          )}

          {/* (5) Dinero del mes — solo lectura, con selector de mes */}
          <div className="mt-4 overflow-hidden rounded-[20px] border border-border bg-[rgba(138,100,255,0.07)] backdrop-blur-[16px]">
            <div className="flex items-center px-[18px] py-4">
              <button
                type="button"
                onClick={() => setOpenMes((v) => !v)}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between border-none bg-transparent text-left"
              >
                <span className="min-w-0">
                  <span className="font-sora text-[15px] font-semibold text-text">
                    Dinero del mes
                  </span>
                  <span className="mt-[3px] block text-[10px] text-text-muted">
                    No incluido en Gastos/Ingresos
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(138,100,255,0.15)] text-accent2 transition-transform duration-200 ${
                    openMes ? "rotate-180" : "rotate-0"
                  }`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              <span className="ml-2 shrink-0">
                <IconButton onClick={() => setCalendarOpen(true)}>
                  <IconCalendar />
                </IconButton>
              </span>
            </div>

            {openMes && (
              <div className="flex flex-col gap-1 px-[18px] pb-4">
                <div className="flex justify-between border-b border-[rgba(138,100,255,0.1)] py-[10px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-text">
                      Entradas
                    </p>
                    <p className="mt-[2px] text-[11px] capitalize text-text-muted">
                      Por reintegros · {getMesLabel(mesSel)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-sora text-[14px] font-bold text-text">
                      {money(entradasReintegros)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between border-b border-[rgba(138,100,255,0.1)] py-[10px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-text">
                      Salidas
                    </p>
                    <p className="mt-[2px] text-[11px] capitalize text-text-muted">
                      Por reintegros · {getMesLabel(mesSel)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-sora text-[14px] font-bold text-text">
                      {money(salidasReintegros)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <MonthSelectorModal
        open={calendarOpen}
        value={mesSel}
        onClose={() => setCalendarOpen(false)}
        onSelect={setMesSel}
      />

      {/* Modal de pago (4.3a) — se monta solo al abrir */}
      {pago && (
        <DevolucionModal
          r={pago.r}
          modo={pago.modo}
          onClose={() => setPago(null)}
        />
      )}

      {/* Modal de edición de monto (4.3b) — se monta solo al abrir */}
      {edicion && (
        <EditarReintegroModal
          modo={edicion.modo}
          r={edicion.r}
          entrega={edicion.entrega}
          onClose={() => setEdicion(null)}
        />
      )}
    </Appshell>
  );
}
