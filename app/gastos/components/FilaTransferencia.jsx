const CONCEPTO_LABEL = {
  alquiler: "Alquiler",
  tarjeta: "Tarjeta de crédito",
  otros: "Otros",
};

export default function FilaTransferencia({ transferencia, userId }) {
  const fecha =
    transferencia.createdAt?.toDate?.() ??
    new Date(transferencia.createdAt);

  const esRecibida = transferencia.paraUid === userId;

  const concepto =
    transferencia.concepto === "otros"
      ? transferencia.detalle || "Otros"
      : CONCEPTO_LABEL[transferencia.concepto] ?? transferencia.concepto;

  return (
    <div className="flex justify-between border-b border-[rgba(138,100,255,0.1)] py-[10px] gap-3">

      {/* IZQUIERDA */}
      <div className="flex flex-col gap-[3px] min-w-0">
        {/* Tipo + fecha */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold ${
              esRecibida ? "text-[var(--user-b)]" : "text-[var(--negative)]"
            }`}
          >
            {esRecibida ? "↓ Transferencia recibida" : "↑ Transferencia enviada"}
          </span>
          <span className="text-[10px] text-text-muted">
            {fecha.toLocaleDateString("es-AR")}
          </span>
        </div>

        {/* Concepto */}
        <p className="text-[14px] font-medium text-text truncate">
          {concepto}
        </p>

        {/* De → Para */}
        <p className="text-[11px] text-text-muted">
          De {transferencia.deNombre} → {transferencia.paraNombre}
        </p>
      </div>

      {/* DERECHA — monto */}
      <div className="text-right self-center flex-shrink-0">
        <p
          className={`font-sora text-[14px] font-bold ${
            esRecibida ? "text-[var(--user-b)]" : "text-[var(--negative)]"
          }`}
        >
          {esRecibida ? "+" : "-"}$
          {Number(transferencia.monto).toLocaleString("es-AR")}
        </p>
      </div>
    </div>
  );
}