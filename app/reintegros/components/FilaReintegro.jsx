// reintegros/components/FilaReintegro.jsx
// 4.3a — Fila de obligación con historial de entregas y acciones de pago
// («Agregar pago» / «Saldar deuda» → DevolucionModal, §9.2/§9.4 de la
// PROPUESTA Etapa 3). Absorbe la `FilaObl` de 4.2. Las acciones solo se
// muestran sobre obligaciones ABIERTAS (pendiente/parcial con saldo > 0) y
// cuando la sección las habilita (pestaña Activos); en Cerrados queda el
// historial sin acciones. Los pagos se ordenan por `fechaPago` ascendente.

"use client";

import { estadoDe, saldoDe } from "../helpers/modelo";

const ETIQUETA_ESTADO = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  liquidado: "Liquidada",
  condonado: "Condonada",
};

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function fechaCorta(fecha) {
  const d = fecha?.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-AR");
}

export default function FilaReintegro({ r, entregas, onPagar }) {
  const estado = estadoDe(r);
  const saldo = saldoDe(r);
  const devuelto = Number(r.devuelto || 0);
  const monto = Number(r.monto || 0);
  const fecha = (r.createdAt?.toDate?.() ?? new Date(r.createdAt))
    .toLocaleDateString("es-AR");

  const pagos = [...(entregas ?? [])].sort(
    (a, b) =>
      (a.fechaPago?.toDate?.() ?? new Date(a.fechaPago)) -
      (b.fechaPago?.toDate?.() ?? new Date(b.fechaPago)),
  );

  const abierta = (estado === "pendiente" || estado === "parcial") && saldo > 0;
  const conAcciones = !!onPagar && abierta;

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
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="font-sora text-[14px] font-bold text-text">
            {money(monto)}
          </p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {ETIQUETA_ESTADO[estado]}
          </p>
        </div>
      </div>

      {/* Historial de entregas (visible también en Cerrados — done) */}
      {pagos.length > 0 && (
        <div className="mt-2 rounded-[12px] border border-[rgba(138,100,255,0.14)] bg-[rgba(138,100,255,0.05)] px-3 py-2">
          <p className="mb-[4px] text-[10px] uppercase tracking-[0.5px] text-text-muted">
            Pagos
          </p>
          {pagos.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 py-[2px] text-[11px] text-text-muted"
            >
              <span className="min-w-0 truncate">
                {fechaCorta(e.fechaPago)} · {e.realizadoPorNombre}
                {e.detalle ? ` · ${e.detalle}` : ""}
              </span>
              <span className="flex-shrink-0 font-sora font-semibold text-text">
                {money(e.monto)}
              </span>
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
