"use client";

import { useState } from "react";
import FixedExpenseStatus from "./FixedExpenseStatus";
import PagarModal from "./PagarModal";


export default function FixedExpenseCard({
  gasto,
  open,
  onToggle,
  registrarGasto,
  registrarPago,
  saldarPendiente,
  userId,
}) {
  const [pagarOpen, setPagarOpen] = useState(false);
  const { entry, estado, miParticipante, otroParticipante } = gasto;
 

  const montoMostrar = entry?.montoTotal ?? gasto?.montoDefault ?? null;
  const vencimiento = entry?.vencimiento ?? null;

  const yaCumpleMiParte =
    (miParticipante?.pagado ?? 0) >= (miParticipante?.corresponde ?? 0);
  const yoDebo =
    estado === "pendiente_saldar" &&
    (miParticipante?.pagado ?? 0) < (miParticipante?.corresponde ?? 0);

  const mostrarBoton =
    estado !== "saldado" &&
    !(estado === "pendiente_saldar" && yaCumpleMiParte);

  const buttonLabel = {
    sin_registrar: "＋ Registrar gasto",
    pendiente_pago: "💳 Registrar pago",
    pendiente_saldar: "🤝 Saldar mi parte",
    pagado_hasta: "✏ Actualizar pago",
  }[estado];

  const tieneDetalle = estado !== "saldado";

  async function handleAction() {
    if (estado === "pendiente_saldar" && yoDebo) {
      await saldarPendiente?.({ expenseId: gasto.id });
      return;
    }
    setPagarOpen(true);
  }

  const saldoPendienteOtro = estado === "pendiente_saldar"
    ? Math.max(0, (otroParticipante?.corresponde ?? 0) - (otroParticipante?.pagado ?? 0))
    : 0;

  const saldoPendienteMio = estado === "pendiente_saldar"
    ? Math.max(0, (miParticipante?.corresponde ?? 0) - (miParticipante?.pagado ?? 0))
    : 0;

  function getSubtext() {
    if (estado === "pagado_hasta") return `Pago hasta ${formatPeriodo(entry.pagoHasta)}`;
    if (montoMostrar) {
      const base = `$${Number(montoMostrar).toLocaleString("es-AR")}`;
      return vencimiento ? `${base} · vence ${vencimiento}` : base;
    }
    return "Sin registrar este mes";
  }

  // Color del subtext: blanco si hay monto, gris si no
  const subtextColor = montoMostrar ? "text-text" : "text-text-muted";

  return (
    <>
      <div className="overflow-hidden rounded-[20px] border border-border bg-[rgba(138,100,255,0.07)] backdrop-blur-[16px]">

        {/* HEADER */}
        <div
          onClick={tieneDetalle ? onToggle : undefined}
          className={`flex w-full items-center justify-between px-5 py-4 text-left border-none bg-transparent ${
            tieneDetalle ? "cursor-pointer" : "cursor-default"
          }`}
        >
          {/* NOMBRE + MONTO */}
          <div className="min-w-0">
            <p className="font-sora text-[15px] font-semibold text-text">
              {gasto.nombre}
            </p>
            <p className={`text-[12px] mt-[1px] truncate font-medium ${subtextColor}`}>
              {getSubtext()}
            </p>
          </div>

          {/* STATUS + CHEVRON */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <FixedExpenseStatus estado={estado} pagoHasta={entry?.pagoHasta} />
            {tieneDetalle && (
              <div className={`flex h-6 w-6 items-center justify-center rounded-[8px] bg-[rgba(138,100,255,0.15)] text-accent2 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* DETALLE */}
        {open && (
          <div className="border-t border-border px-5 py-4 flex flex-col gap-3">

            {/* Info deuda compartidos */}
            {gasto.categoria === "compartido" && estado === "pendiente_saldar" && (
              <div className="flex flex-col gap-[6px]">
                {yaCumpleMiParte && saldoPendienteOtro > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-muted">Te deben</span>
                    <span className="font-semibold text-[var(--user-b)]">
                      ${saldoPendienteOtro.toLocaleString("es-AR")}
                    </span>
                  </div>
                )}
                {yoDebo && saldoPendienteMio > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-muted">Debés</span>
                    <span className="font-semibold text-[var(--negative)]">
                      ${saldoPendienteMio.toLocaleString("es-AR")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {mostrarBoton && (
              <button
                onClick={handleAction}
                className="w-full rounded-[14px] border border-accent/30 bg-accent/8 px-4 py-[10px] text-[13px] font-semibold text-accent-light transition-all hover:bg-accent/15"
              >
                {buttonLabel}
              </button>
            )}

            {/* Esperando al otro */}
            {estado === "pendiente_saldar" && yaCumpleMiParte && (
              <p className="text-[12px] text-text-muted text-center">
                Esperando que salden su parte
              </p>
            )}
          </div>
        )}
      </div>

      {pagarOpen && (
        <PagarModal
          gasto={gasto}
          estado={estado}
          onClose={() => setPagarOpen(false)}
          onSave={async ({ monto, vencimiento, pagoHasta }) => {
            if (estado === "sin_registrar" || estado === "pagado_hasta") {
              await registrarGasto({
                expenseId: gasto.id,
                montoTotal: monto,
                vencimiento,
                pagoHasta,
              });
            }
            if (estado === "pendiente_pago") {
              await registrarPago({ expenseId: gasto.id });
            }
            setPagarOpen(false);
          }}
        />
      )}
    </>
  );
}

function formatPeriodo(periodo) {
  if (!periodo) return "";
  const [y, m] = periodo.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${meses[parseInt(m) - 1]} ${y}`;
}