// reintegros/sections/PendientesSection.jsx
// 4.3a — Pestaña «Activos»: acordeones Préstamos / Deudas (estilo /gastos)
// con FilaReintegro + acciones de pago (Agregar pago / Saldar deuda).
// El total de cada acordeón es el SALDO PENDIENTE (comportamiento de 4.2
// sobre la pestaña activa).

"use client";

import Acordeon from "../../gastos/components/Acordeon";
import FilaReintegro from "../components/FilaReintegro";
import { saldoDe } from "../helpers/modelo";

export default function PendientesSection({
  prestamos,
  deudas,
  entregasPorObl,
  openPrestamos,
  onTogglePrestamos,
  openDeudas,
  onToggleDeudas,
  onPagar,
}) {
  const totalPrestamos = prestamos.reduce((a, r) => a + saldoDe(r), 0);
  const totalDeudas = deudas.reduce((a, r) => a + saldoDe(r), 0);

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
            Sin préstamos abiertos.
          </p>
        ) : (
          prestamos.map((r) => (
            <FilaReintegro
              key={r.id}
              r={r}
              entregas={entregaDe(r)}
              onPagar={onPagar}
            />
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
            Sin deudas abiertas.
          </p>
        ) : (
          deudas.map((r) => (
            <FilaReintegro
              key={r.id}
              r={r}
              entregas={entregaDe(r)}
              onPagar={onPagar}
            />
          ))
        )}
      </Acordeon>
    </div>
  );
}
