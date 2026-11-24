// balances/sections/DetalleSection.jsx
// Bloque 5 «Detalle del mes» (5.2, C-8): filas de sección, sin ítems.
// Los egresos y reintegros se proyectan del contrato de 5.1; los ingresos por
// tipo se derivan con las piezas puras (helpers/detalleMes.js).

"use client";

import Acordeon from "@/app/gastos/components/Acordeon";

import { formatearMonto, formatearUSD } from "../helpers/formato";

function FilaDetalle({ label, monto, detalle }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[4px]">
      <span className="text-[12px] text-text-muted">{label}</span>

      <div className="text-right">
        <span className="font-sora text-[12px] font-semibold text-text">
          {formatearMonto(monto)}
        </span>
        {detalle && (
          <p className="text-[10px] text-[var(--user-b)]">{detalle}</p>
        )}
      </div>
    </div>
  );
}

export default function DetalleSection({
  detalle,
  balance,
  openSection,
  onToggle,
}) {
  const usd = balance.ingresos.usd;

  return (
    <div className="flex flex-col gap-[10px]">
      <p className="text-[12px] tracking-[0.5px] text-text-muted">
        DETALLE DEL MES
      </p>

      <Acordeon
        titulo="Ingresos"
        total={balance.ingresos.uyu}
        subtitle={usd > 0 ? formatearUSD(usd) : undefined}
        open={openSection === "ingresos"}
        onToggle={() => onToggle("ingresos")}
        empty={detalle.ingresos.length === 0}
        formatearTotal={formatearMonto}
      >
        {detalle.ingresos.map((fila) => (
          <FilaDetalle
            key={fila.id}
            label={fila.label}
            monto={fila.uyu}
            detalle={fila.usd > 0 ? formatearUSD(fila.usd) : null}
          />
        ))}
      </Acordeon>

      <Acordeon
        titulo="Egresos"
        total={balance.egresos.total}
        open={openSection === "egresos"}
        onToggle={() => onToggle("egresos")}
        empty={balance.egresos.total === 0}
        formatearTotal={formatearMonto}
      >
        {detalle.egresos.map((fila) => (
          <FilaDetalle key={fila.id} label={fila.label} monto={fila.monto} />
        ))}
      </Acordeon>

      <Acordeon
        titulo="Reintegros"
        total={balance.reintegros.neto}
        open={openSection === "reintegros"}
        onToggle={() => onToggle("reintegros")}
        empty={
          balance.reintegros.entradas === 0 &&
          balance.reintegros.salidas === 0
        }
        formatearTotal={formatearMonto}
      >
        {detalle.reintegros.map((fila) => (
          <FilaDetalle key={fila.id} label={fila.label} monto={fila.monto} />
        ))}
      </Acordeon>
    </div>
  );
}
