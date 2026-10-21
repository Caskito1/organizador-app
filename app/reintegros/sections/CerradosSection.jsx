// reintegros/sections/CerradosSection.jsx
// 4.3a — Pestaña «Saldados»: acordeones Préstamos / Deudas con las
// obligaciones cerradas (liquidadas o condonadas). Sin acciones de pago
// (onPagar no se pasa); el historial de entregas sigue visible (done:
// «historial visible»). El total de cada acordeón es el MONTO de la
// obligación (comportamiento de 4.2 sobre la pestaña saldada).

"use client";

import Acordeon from "../../gastos/components/Acordeon";
import FilaReintegro from "../components/FilaReintegro";

export default function CerradosSection({
  prestamos,
  deudas,
  entregasPorObl,
  openPrestamos,
  onTogglePrestamos,
  openDeudas,
  onToggleDeudas,
}) {
  const totalPrestamos = prestamos.reduce((a, r) => a + Number(r.monto || 0), 0);
  const totalDeudas = deudas.reduce((a, r) => a + Number(r.monto || 0), 0);

  function entregaDe(r) {
    return entregasPorObl.get(r.id) ?? [];
  }

  return (
    <div className="flex flex-col gap-3">
      <Acordeon
        titulo="Préstamos"
        total={totalPrestamos}
        subtitle={`${prestamos.length} ${
          prestamos.length === 1 ? "obligación" : "obligaciones"
        }`}
        open={openPrestamos}
        onToggle={onTogglePrestamos}
      >
        {prestamos.length === 0 ? (
          <p className="mt-3 text-[12px] text-text-muted">
            Sin préstamos saldados.
          </p>
        ) : (
          prestamos.map((r) => (
            <FilaReintegro key={r.id} r={r} entregas={entregaDe(r)} />
          ))
        )}
      </Acordeon>

      <Acordeon
        titulo="Deudas"
        total={totalDeudas}
        subtitle={`${deudas.length} ${
          deudas.length === 1 ? "obligación" : "obligaciones"
        }`}
        open={openDeudas}
        onToggle={onToggleDeudas}
      >
        {deudas.length === 0 ? (
          <p className="mt-3 text-[12px] text-text-muted">
            Sin deudas saldadas.
          </p>
        ) : (
          deudas.map((r) => (
            <FilaReintegro key={r.id} r={r} entregas={entregaDe(r)} />
          ))
        )}
      </Acordeon>
    </div>
  );
}
