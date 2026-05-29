export function calcularTotal(gastos = []) {
  return gastos.reduce(
    (acc, g) => acc + Number(g.monto || 0),
    0,
  );
}

// Solo lo que el usuario efectivamente pagó — sin asumir divisiones
export function calcularTotalGastos({
  gastosPersonales,
  gastosPorGrupo,
  userId,
}) {
  const totalPersonal = calcularTotal(gastosPersonales);

  const totalGrupos = gastosPorGrupo.reduce((acc, { gastos }) => {
    const miParte = gastos
      .filter((g) => g.usuario === userId)
      .reduce((a, g) => a + Number(g.monto || 0), 0);
    return acc + miParte;
  }, 0);

  return totalPersonal + totalGrupos;
}

// Transferencias recibidas = ingresos
export function calcularTotalIngresos({ gastosPorGrupo, userId }) {
  return gastosPorGrupo.reduce((acc, { recibi }) => acc + recibi, 0);
}

// Neto = gastos - ingresos
export function calcularNeto({ totalGastos, totalIngresos }) {
  return totalGastos - totalIngresos;
}