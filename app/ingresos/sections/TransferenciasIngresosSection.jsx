import Acordeon from "@/app/gastos/components/Acordeon";

import FilaTransferencia from "@/app/gastos/components/FilaTransferencia";

export default function TransferenciasIngresosSection({
  transferencias,
  open,
  onToggle,
}) {
  return (
    <Acordeon
      titulo="Transferencias"
      total={transferencias.reduce(
        (a, t) =>
          a + Number(t.monto || 0),
        0,
      )}
      open={open}
      onToggle={onToggle}
    >
      {transferencias.map((t) => (
        <FilaTransferencia
          key={t.id}
          transferencia={t}
          userId={t.paraUid}
        />
      ))}
    </Acordeon>
  );
}