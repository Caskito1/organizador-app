"use client";

export default function FixedExpenseStatus({ estado, pagoHasta }) {
  const config = {
    sin_registrar: {
      label: "Sin registrar",
      className: "bg-white/5 text-text-muted border-white/10",
    },
    pendiente_pago: {
      label: "Pendiente de pago",
      className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    },
    pendiente_saldar: {
      label: "Pendiente de saldar",
      className: "bg-red-500/10 text-red-300 border-red-500/20",
    },
    saldado: {
      label: "Saldado ✓",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    },
    pagado_hasta: {
      label: pagoHasta ? `Pago hasta ${formatPeriodo(pagoHasta)}` : "Al día ✓",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    },
  };

  const current = config[estado] ?? config.sin_registrar;

  return (
    <span className={`rounded-full border px-3 py-[4px] text-[11px] font-semibold whitespace-nowrap ${current.className}`}>
      {current.label}
    </span>
  );
}

function formatPeriodo(periodo) {
  // "2027-12" → "dic 2027"
  const [y, m] = periodo.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${meses[parseInt(m) - 1]} ${y}`;
}