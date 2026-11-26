// tarjetas/sections/ComprasCicloCard.jsx
// Compras + resumen en UN solo card (6.2, ajuste visual):
//   título · lista de compras · raya interna · resumen al pie.
// Si el ciclo no tiene datos, solo «Sin datos de este mes» (sin resumen de ceros).

"use client";

import GlassCard from "@/app/components/layout/GlassCard";
import { formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

import FilaCompra from "../components/FilaCompra";

function Monto({ valor, grande }) {
  return (
    <span className="text-right">
      <span
        className={`block font-sora font-semibold text-text ${
          grande ? "text-[15px]" : "text-[13px]"
        }`}
      >
        {formatearMonto(valor.UYU)}
      </span>
      {valor.USD > 0 && (
        <span
          className={`block text-[var(--user-b)] ${
            grande ? "text-[11px]" : "text-[10px]"
          }`}
        >
          {formatearUSD(valor.USD)}
        </span>
      )}
    </span>
  );
}

function FilaResumen({ etiqueta, valor, detalle, total }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[5px]">
      <div className="min-w-0">
        <p
          className={`font-semibold text-text ${
            total ? "text-[13px]" : "text-[12px]"
          }`}
        >
          {etiqueta}
        </p>
        {detalle && (
          <p className="mt-[1px] text-[10px] text-text-muted">{detalle}</p>
        )}
      </div>
      <Monto valor={valor} grande={total} />
    </div>
  );
}

export default function ComprasCicloCard({
  comprasCiclo,
  resumen,
  esEditable,
  onMenu,
}) {
  const sinDatos = comprasCiclo.length === 0;

  return (
    <GlassCard>
      <p className="text-[13px] font-semibold text-text">Compras del ciclo</p>

      {sinDatos ? (
        <p className="mt-3 text-[12px] text-text-muted">
          Sin datos de este mes.
        </p>
      ) : (
        <>
          <div className="mt-2">
            {comprasCiclo.map(({ compra, cuota }) => (
              <FilaCompra
                key={compra.id}
                compra={compra}
                cuota={cuota}
                editable={esEditable(compra)}
                onMenu={onMenu}
              />
            ))}
          </div>

          <div className="mt-3 border-t border-border pt-2">
            <FilaResumen etiqueta="Personales" valor={resumen.personales} />
            <FilaResumen etiqueta="Reintegros" valor={resumen.reintegros} />
            <FilaResumen etiqueta="Total" valor={resumen.total} total />
            <FilaResumen
              etiqueta="Deuda total"
              valor={resumen.deudaTotal}
              detalle={`${resumen.cuotasTotales} cuota(s)`}
            />
          </div>
        </>
      )}
    </GlassCard>
  );
}
