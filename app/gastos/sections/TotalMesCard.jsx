export default function TotalMesCard({
  totalGastos,
  totalTransacciones,
}) {
  return (
    <div className="mt-3 rounded-[22px] border border-[rgba(138,100,255,0.28)] bg-[linear-gradient(135deg,rgba(138,100,255,0.18),rgba(91,53,213,0.22))] px-[22px] py-5">
      <p className="mb-[4px] text-[11px] text-[rgba(200,174,255,0.65)] uppercase tracking-[0.5px]">
        Total del mes
      </p>

      <p className="font-sora text-[34px] font-bold text-accent-light leading-none">
        $
        {Number(
          totalGastos,
        ).toLocaleString("es-AR")}
      </p>

      <p className="mt-1 text-[12px] text-text-muted">
        {totalTransacciones} transacciones
      </p>
    </div>
  );
}