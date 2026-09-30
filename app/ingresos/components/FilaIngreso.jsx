export default function FilaIngreso({
  ingreso,
}) {
  const fecha =
    ingreso.createdAt?.toDate?.() ??
    new Date(ingreso.createdAt);

  const titulo =
    ingreso.detalle ?? "Ingreso";

  return (
    <div className="flex justify-between border-b border-[rgba(94,224,197,0.08)] py-[10px]">

      <div>

        <p className="text-[14px] font-medium text-text">
          {titulo}
        </p>

        <p className="mt-[2px] text-[11px] text-text-muted">
          {fecha.toLocaleDateString()}
        </p>
      </div>

      <div className="self-center text-right">
        <p className="font-sora text-[15px] font-bold text-[var(--user-b)]">
          +$
          {Number(
            ingreso.monto,
          ).toLocaleString("es-AR")}
        </p>
      </div>
    </div>
  );
}