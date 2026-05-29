export default function TotalIngresosCard({
  totalIngresos,
  totalTransacciones,
}) {
  return (
    <div className="mt-3 rounded-[22px] border border-[rgba(94,224,197,0.22)] bg-[linear-gradient(135deg,rgba(94,224,197,0.12),rgba(54,180,150,0.18))] px-[22px] py-5">

      <p className="mb-[4px] text-[11px] uppercase tracking-[0.5px] text-[rgba(180,255,235,0.7)]">
        Total ingresos
      </p>

      <p className="font-sora text-[34px] font-bold leading-none text-[var(--user-b)]">
        $
        {totalIngresos.toLocaleString(
          "es-AR",
        )}
      </p>

      <p className="mt-1 text-[12px] text-text-muted">
        {totalTransacciones} ingresos
      </p>
    </div>
  );
}