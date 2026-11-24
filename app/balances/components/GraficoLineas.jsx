// balances/components/GraficoLineas.jsx
// Gráfico SVG inline (5.2, C-7). Sin librería: escala con negativos, cero,
// nulabilidad (corta la serie), promedio punteado y tooltip nativo (<title>).

"use client";

const ANCHO = 320;
const ALTO = 150;
const MARGEN_X = 10;
const MARGEN_Y = 18;

function esNumero(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

export default function GraficoLineas({
  labels = [],
  series = [],
  promedios = [],
  formatearValor = (valor) => String(valor),
  ariaLabel = "Gráfico de tendencia",
}) {
  const valores = series
    .flatMap((serie) => serie.values)
    .filter(esNumero);

  if (labels.length === 0 || valores.length === 0) return null;

  const minValor = Math.min(0, ...valores);
  const maxValor = Math.max(0, ...valores);
  const rango = maxValor - minValor || 1;
  const padding = rango * 0.1;
  const min = minValor - padding;
  const max = maxValor + padding;
  const anchoUtil = ANCHO - MARGEN_X * 2;
  const altoUtil = ALTO - MARGEN_Y * 2;
  const x = (indice) =>
    labels.length === 1
      ? ANCHO / 2
      : MARGEN_X + (indice * anchoUtil) / (labels.length - 1);
  const y = (valor) =>
    ALTO - MARGEN_Y - ((valor - min) / (max - min)) * altoUtil;
  const pasoEtiquetas = labels.length > 6 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {min < 0 && max > 0 && (
        <line
          x1={MARGEN_X}
          x2={ANCHO - MARGEN_X}
          y1={y(0)}
          y2={y(0)}
          stroke="rgba(180,170,220,0.25)"
          strokeDasharray="2 4"
        />
      )}

      {series.map((serie, indiceSerie) => {
        const promedio = promedios[indiceSerie];
        const segmentos = [];
        let actual = [];

        serie.values.forEach((valor, indice) => {
          if (esNumero(valor)) {
            actual.push(`${x(indice)},${y(valor)}`);
          } else if (actual.length > 0) {
            segmentos.push(actual.join(" "));
            actual = [];
          }
        });

        if (actual.length > 0) segmentos.push(actual.join(" "));

        return (
          <g key={serie.id}>
            {esNumero(promedio) && (
              <line
                x1={MARGEN_X}
                x2={ANCHO - MARGEN_X}
                y1={y(promedio)}
                y2={y(promedio)}
                stroke={serie.color}
                strokeDasharray="4 3"
                strokeOpacity="0.55"
              />
            )}

            {segmentos.map((puntos, indiceSegmento) => (
              <polyline
                key={`${serie.id}-seg-${indiceSegmento}`}
                points={puntos}
                fill="none"
                stroke={serie.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {serie.values.map((valor, indice) =>
              esNumero(valor) ? (
                <circle
                  key={`${serie.id}-p-${indice}`}
                  cx={x(indice)}
                  cy={y(valor)}
                  r="2.5"
                  fill={serie.color}
                >
                  <title>{`${labels[indice]}: ${formatearValor(valor)}`}</title>
                </circle>
              ) : null,
            )}
          </g>
        );
      })}

      {labels.map((label, indice) =>
        indice % pasoEtiquetas === 0 || indice === labels.length - 1 ? (
          <text
            key={`${label}-${indice}`}
            x={x(indice)}
            y={ALTO - 4}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
