import Acordeon from "../components/Acordeon";

const ESTADO_CONFIG = {
  pendiente_pago:    { label: "Pendiente", className: "text-amber-300" },
  pendiente_saldar:  { label: "Sin saldar", className: "text-red-300" },
  saldado:           { label: "Saldado ✓", className: "text-emerald-300" },
  pagado_hasta:      { label: "Al día ✓",  className: "text-emerald-300" },
};

function FilaFijo({ entry }) {
  const config = ESTADO_CONFIG[entry.estado] ?? ESTADO_CONFIG.pendiente_pago;

  return (
    <div className="flex items-center justify-between border-b border-[rgba(138,100,255,0.1)] py-[10px]">
      <p className="text-[14px] font-medium text-text">
        {entry.nombre}
      </p>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`text-[11px] font-semibold ${config.className}`}>
          {config.label}
        </span>
        <p className="font-sora text-[14px] font-bold text-text">
          ${Number(entry.montoTotal).toLocaleString("es-AR")}
        </p>
      </div>
    </div>
  );
}

export default function GastosFijosSection({
  fixedCompartidos,
  fixedPersonales,
  totalFixedReal,
  totalFixed,
  open,
  onToggle,
}) {
  const total = fixedCompartidos.length + fixedPersonales.length;

  return (
    <Acordeon
      titulo="Gastos Fijos"
      total={totalFixed}
      subtitle={`Total real: $${Number(totalFixedReal).toLocaleString("es-AR")}`}
      open={open}
      onToggle={onToggle}
      empty={total === 0}
    >
      {/* COMPARTIDOS */}
      {fixedCompartidos.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] uppercase tracking-[0.5px] text-text-muted font-medium mb-[6px]">
            Compartidos
          </p>
          {fixedCompartidos.map((e) => (
            <FilaFijo key={e.id} entry={e} />
          ))}
        </div>
      )}

      {/* PERSONALES */}
      {fixedPersonales.length > 0 && (
        <div className={fixedCompartidos.length > 0 ? "pt-3" : "pt-1"}>
          <p className="text-[10px] uppercase tracking-[0.5px] text-text-muted font-medium mb-[6px]">
            Personales
          </p>
          {fixedPersonales.map((e) => (
            <FilaFijo key={e.id} entry={e} />
          ))}
        </div>
      )}
    </Acordeon>
  );
}