import Acordeon from "../components/Acordeon";
import FilaTransferencia from "../components/FilaTransferencia";

// Ícono flecha doble (transferencia)
function IconTransferencia() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export default function TransferenciasSection({
  transferencias,
  userId,
  open,
  onToggle,
}) {
  // Para el total del acordeón: ingresos positivos, egresos negativos → neto
  const neto = transferencias.reduce((acc, t) => {
    const monto = Number(t.monto || 0);
    return t.paraUid === userId ? acc + monto : acc - monto;
  }, 0);

  const totalDisplay = Math.abs(neto);

  return (
    <Acordeon
      titulo="Transferencias"
      icon={<IconTransferencia />}
      total={totalDisplay}
      open={open}
      onToggle={onToggle}
    >
      {transferencias.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-text-muted">
          Sin transferencias este mes
        </p>
      ) : (
        transferencias.map((t) => (
          <FilaTransferencia
            key={t.id}
            transferencia={t}
            userId={userId}
          />
        ))
      )}
    </Acordeon>
  );
}