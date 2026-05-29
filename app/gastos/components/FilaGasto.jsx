export default function FilaGasto({
  gasto,
  usuarioNombre,
}) {
  const fecha =
    gasto.createdAt?.toDate?.() ??
    new Date(gasto.createdAt);

  const subtitulo =
    gasto.tipo === "transferencia"
      ? `${gasto.detalle || "Transferencia"} · ${fecha.toLocaleDateString()}`
      : `${gasto.categoria} · ${fecha.toLocaleDateString()}`;

  return (
    <div className="flex justify-between border-b border-[rgba(138,100,255,0.1)] py-[10px]">
      <div>
        <p className="text-[14px] font-medium capitalize text-text">
          {gasto.producto}
        </p>

        <p className="mt-[2px] text-[11px] text-text-muted">
          {subtitulo}
        </p>
      </div>

      <div className="text-right">
        <p className="font-sora text-[14px] font-bold text-text">
          $
          {Number(
            gasto.monto,
          ).toLocaleString("es-AR")}
        </p>

        <span className="text-[11px] text-text-muted">
          {usuarioNombre}
        </span>
      </div>
    </div>
  );
}