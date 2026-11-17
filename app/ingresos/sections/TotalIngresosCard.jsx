export default function TotalIngresosCard({
  totalIngresos,
  totalUSD = 0,
  hayUSD = false,
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

      {/* 5.0 (D-9): los dólares NO se suman al total grande. Van en la misma
          fila que el conteo, del mismo tamaño y sin negrita, separados por
          «/», y solo si hay USD. */}
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-text-muted">
        {hayUSD && (
          <>
            <span className="text-[var(--user-b)]">
              US${" "}
              {totalUSD.toLocaleString(
                "es-AR",
              )}
            </span>

            <span aria-hidden="true" className="text-text-muted/50">
              /
            </span>
          </>
        )}

        <span>{totalTransacciones} ingresos</span>
      </p>
    </div>
  );
}