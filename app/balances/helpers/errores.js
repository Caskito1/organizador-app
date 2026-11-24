// balances/helpers/errores.js
// Error tipado de la página /balances (lectura/escritura/validación).

export class BalancesError extends Error {
  constructor(codigo, mensaje, { causa = null } = {}) {
    super(mensaje);

    this.name = "BalancesError";
    this.codigo = codigo;
    this.causa = causa;
  }
}
