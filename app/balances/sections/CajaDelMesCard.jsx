// balances/sections/CajaDelMesCard.jsx
// Bloque 1 «Caja del mes» (5.2, C-2): hero con la caja esperada al cierre,
// subtítulo con el movimiento y el ledger completo. Condonaciones como memo.
// El monto de cada flujo lleva su signo; la etiqueta no lleva +/−/=.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";

import BotonOpciones from "../components/BotonOpciones";
import {
  formatearMonto,
  formatearMontoConSigno,
  formatearUSD,
} from "../helpers/formato";

function montoVisible(monto, conSigno) {
  if (monto === null || monto === undefined) return "—";

  return conSigno ? formatearMontoConSigno(monto) : formatearMonto(monto);
}

function FilaLedger({
  etiqueta,
  monto,
  detalle,
  destacada = false,
  conSigno = true,
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-[5px]">
      <div className="min-w-0">
        <p
          className={`text-[12px] ${
            destacada ? "font-semibold text-text" : "text-text-muted"
          }`}
        >
          {etiqueta}
        </p>

        {detalle && (
          <p className="mt-[1px] text-[10px] text-text-muted">{detalle}</p>
        )}
      </div>

      <span
        className={`font-sora text-[13px] font-semibold ${
          destacada ? "text-accent-light" : "text-text"
        }`}
      >
        {montoVisible(monto, conSigno)}
      </span>
    </div>
  );
}

function origenTexto(origen) {
  if (origen === "arrastre") return "arrastrada del cierre anterior";
  if (origen === "ancla") return "ancla manual";

  return "sin definir";
}

export default function CajaDelMesCard({
  fila,
  onInversiones,
  onAncla,
}) {
  const balance = fila.balance;
  const condonaciones = balance.condonaciones;
  const hayCondonaciones =
    condonaciones.ganadas > 0 || condonaciones.perdidas > 0;

  return (
    <GlassCard className="relative">
      <div className="absolute right-3 top-3">
        <BotonOpciones
          etiqueta="Cargar inversiones del mes"
          onClick={onInversiones}
        />
      </div>

      <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
        Caja esperada al cierre
      </p>

      <p className="mt-1 font-sora text-[30px] font-bold leading-none text-text">
        {fila.cajaEsperadaAlCierre === null
          ? "—"
          : formatearMonto(fila.cajaEsperadaAlCierre)}
      </p>

      <p className="mt-1 text-[12px] text-text-muted">
        Movimiento {formatearMontoConSigno(balance.movimientoEsperado)}
      </p>

      <div className="mt-4 border-t border-border pt-3">
        <FilaLedger
          etiqueta="Caja al inicio"
          monto={fila.cajaAlInicio}
          detalle={origenTexto(fila.origenInicio)}
          conSigno={false}
        />

        <FilaLedger
          etiqueta="Ingresos"
          monto={balance.ingresos.uyu}
          detalle={
            balance.ingresos.usd > 0
              ? formatearUSD(balance.ingresos.usd)
              : null
          }
        />

        <FilaLedger
          etiqueta="Egresos"
          monto={-balance.egresos.total}
        />

        <FilaLedger
          etiqueta="Resultado del mes"
          monto={balance.resultado}
          destacada
        />

        <FilaLedger
          etiqueta="Reintegros (neto)"
          monto={balance.reintegros.neto}
        />

        <FilaLedger
          etiqueta="Inversiones (neto)"
          monto={balance.inversiones}
        />

        <FilaLedger
          etiqueta="Movimiento del mes"
          monto={balance.movimientoEsperado}
          destacada
        />
      </div>

      {hayCondonaciones && (
        <p className="mt-3 rounded-[10px] bg-white/4 px-3 py-2 text-[10px] text-text-muted">
          Perdonado este mes: ganadas {formatearMonto(condonaciones.ganadas)} ·
          perdidas {formatearMonto(condonaciones.perdidas)}. No mueve la caja.
        </p>
      )}

      {fila.cajaAlInicio === null && (
        <div className="mt-3 rounded-[12px] border border-border2 bg-white/4 px-3 py-3">
          <p className="text-[11px] text-text-muted">
            Falta la caja al inicio de este mes.
          </p>

          <button
            type="button"
            onClick={onAncla}
            className="mt-2 cursor-pointer rounded-[12px] border border-accent2/40 px-3 py-[6px] text-[12px] font-semibold text-accent-light transition-all hover:bg-accent/10"
          >
            Definir caja al inicio
          </button>
        </div>
      )}
    </GlassCard>
  );
}
