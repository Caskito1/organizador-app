import FixedExpenseCard from "../components/FixedExpenseCard";

export default function CompartidosSection({
  gastos,
  openItems,
  toggleItem,
  registrarGasto,
  registrarPago,
  saldarPendiente,
  userId,
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted font-medium px-1">
        Compartidos
      </p>
      {gastos.map((gasto) => (
        <FixedExpenseCard
          key={gasto.id}
          gasto={gasto}
          open={openItems[gasto.id] ?? false}
          onToggle={() => toggleItem(gasto.id)}
          registrarGasto={registrarGasto}
          registrarPago={registrarPago}
          saldarPendiente={saldarPendiente}
          userId={userId}
        />
      ))}
    </div>
  );
}