// balances/sections/TendenciaSection.jsx
// Bloque 4 «Tendencia» (5.2, C-7): 12 meses, tres gráficos SVG con su métrica.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";

import GraficoLineas from "../components/GraficoLineas";
import {
  filasConCierre,
  filasDesdePrimerDato,
} from "../helpers/cadenaSaldos";
import { etiquetaMesCorto, formatearMonto } from "../helpers/formato";

function Tarjeta({ titulo, children }) {
  return (
    <GlassCard padding="p-4">
      <p className="text-[12px] font-semibold text-text">{titulo}</p>
      <div className="mt-2">{children}</div>
    </GlassCard>
  );
}

function detallePromedios(metricas) {
  const ingresos =
    metricas.promedioIngresos === null
      ? "—"
      : formatearMonto(metricas.promedioIngresos);
  const egresos =
    metricas.promedioEgresos === null
      ? "—"
      : formatearMonto(metricas.promedioEgresos);

  return `Promedio · ingresos ${ingresos} · egresos ${egresos}`;
}

export default function TendenciaSection({ filas, metricas }) {
  const dibujadas = filasDesdePrimerDato(filas);

  if (dibujadas.length === 0) {
    return (
      <GlassCard>
        <p className="text-[13px] font-semibold text-text">Tendencia</p>
        <p className="mt-1 text-[12px] text-text-muted">
          Todavía no hay meses con datos.
        </p>
      </GlassCard>
    );
  }

  const labels = dibujadas.map((fila) => etiquetaMesCorto(fila.mes));
  const conCierre = filasConCierre(filas);
  const labelsCierre = conCierre.map((fila) => etiquetaMesCorto(fila.mes));

  const seriesIngresos = [
    {
      id: "ingresos",
      color: "var(--positive)",
      values: dibujadas.map((fila) => fila.balance.ingresos.uyu),
    },
    {
      id: "egresos",
      color: "var(--negative)",
      values: dibujadas.map((fila) => fila.balance.egresos.total),
    },
  ];

  const seriesMovimiento = [
    {
      id: "movimiento",
      color: "var(--accent2)",
      values: dibujadas.map((fila) => fila.balance.movimientoEsperado),
    },
  ];

  const seriesContraste = [
    {
      id: "esperada",
      color: "var(--accent2)",
      values: conCierre.map((fila) => fila.cajaEsperadaAlCierre),
    },
    {
      id: "real",
      color: "var(--user-b)",
      values: conCierre.map((fila) => fila.cajaRealAlCierre),
    },
  ];

  return (
    <div className="flex flex-col gap-[10px]">
      <p className="text-[12px] tracking-[0.5px] text-text-muted">
        TENDENCIA · 12 MESES
      </p>

      <Tarjeta titulo="Ingresos vs egresos">
        <GraficoLineas
          labels={labels}
          series={seriesIngresos}
          promedios={[metricas.promedioIngresos, metricas.promedioEgresos]}
          formatearValor={formatearMonto}
          ariaLabel="Ingresos y egresos por mes"
        />

        <p className="mt-1 text-[10px] text-text-muted">
          {detallePromedios(metricas)}
        </p>
      </Tarjeta>

      <Tarjeta titulo="Movimiento del mes">
        <GraficoLineas
          labels={labels}
          series={seriesMovimiento}
          formatearValor={formatearMonto}
          ariaLabel="Movimiento del mes"
        />

        <p className="mt-1 text-[10px] text-text-muted">
          Acumulado del período: {formatearMonto(metricas.acumuladoMovimiento)}
        </p>
      </Tarjeta>

      <Tarjeta titulo="Esperado vs real">
        {metricas.mesesConCierre === 0 ? (
          <p className="py-3 text-[11px] text-text-muted">
            Sin cierres cargados.
          </p>
        ) : (
          <>
            <GraficoLineas
              labels={labelsCierre}
              series={seriesContraste}
              formatearValor={formatearMonto}
              ariaLabel="Caja esperada y real al cierre"
            />

            <p className="mt-1 text-[10px] text-text-muted">
              Gap promedio:{" "}
              {metricas.promedioGap === null
                ? "—"
                : formatearMonto(metricas.promedioGap)}
            </p>
          </>
        )}
      </Tarjeta>
    </div>
  );
}
