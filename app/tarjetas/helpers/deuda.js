// tarjetas/helpers/deuda.js
// 6.0 — Modelo PURO de la tarjeta: desglose del ciclo y stock.
//
// Plan: PROPUESTA-ETAPA-6.md §10.8. Tres agregados (no confundirlos):
//   · a pagar          = cuotas de ESTE ciclo (personal + reintegro + apertura)
//   · deuda por vencer = cuotas FUTURAS (después de este ciclo)
//   · deuda total      = a pagar + deuda por vencer (todo el saldo vivo)
//
// §8.1 cita la deuda por vencer (90.000); §8.2 cita la deuda total (399.000).
//
// ATENCIÓN (ajuste iii, para 6.2): `personales` es SOLO compras de tipo
// "personal" — NO incluye apertura. La apertura va en su propio campo
// `apertura`, y `total = personales + reintegros + apertura`. La UI debe sumar
// la apertura UNA sola vez (mostrarla aparte, o plegarla en personales), nunca
// dos veces.
//
// La compra de reintegro SÍ suma a `total` (la tarjeta cobra sus cuotas): el
// reintegro es una cuenta por cobrar aparte, no un descuento del resumen.
//
// Bimoneda: las sumas por moneda usan `sumarPorMoneda` (ingresosMoneda.js) para
// no duplicar la regla «UYU y USD nunca se suman».

import {
  UYU,
  USD,
  monedaDe,
  sumarObjetosPorMoneda,
  sumarPorMoneda,
} from "./moneda.js";
import {
  cuotaEnCiclo,
  cuotasRestantesDe,
  deudaRestanteDe,
} from "./cuota.js";
import {
  aPagarAperturaEnCiclo,
  cuotasRestantesApertura,
  deudaRestanteApertura,
} from "./apertura.js";

function listaDe(coleccion) {
  if (!coleccion) return [];
  return Array.isArray(coleccion) ? coleccion : Object.values(coleccion);
}

// Lista de { moneda, monto } → { UYU, USD } sin mezclar monedas.
function porMoneda(items) {
  return {
    [UYU]: sumarPorMoneda(items, UYU),
    [USD]: sumarPorMoneda(items, USD),
  };
}

export function desgloseCiclo({
  compras,
  apertura,
  cicloKey,
  diaCierre,
  diaVencimiento,
} = {}) {
  const itemsPersonales = [];
  const itemsReintegros = [];
  const itemsDeuda = [];
  let cuotasDelCiclo = 0;
  let cuotasPorVencer = 0;

  for (const compra of listaDe(compras)) {
    const cuota = cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento);
    if (cuota) {
      const item = { moneda: monedaDe(compra), monto: cuota.monto };
      if (compra?.tipo === "reintegro") {
        itemsReintegros.push(item);
      } else {
        itemsPersonales.push(item);
      }
      cuotasDelCiclo += 1;
    }

    // Stock futuro: solo si la compra ya empezó y le quedan cuotas.
    const restantes = cuotasRestantesDe(compra, cicloKey, diaCierre, diaVencimiento);
    if (restantes > 0) {
      itemsDeuda.push({
        moneda: monedaDe(compra),
        monto: deudaRestanteDe(compra, cicloKey, diaCierre, diaVencimiento),
      });
      cuotasPorVencer += restantes;
    }
  }

  const aperturaDelCiclo = aPagarAperturaEnCiclo(apertura, cicloKey);

  for (const plan of listaDe(apertura)) {
    const restantes = cuotasRestantesApertura(plan, cicloKey);
    if (restantes > 0) {
      itemsDeuda.push({
        moneda: monedaDe(plan),
        monto: deudaRestanteApertura(plan, cicloKey),
      });
      cuotasPorVencer += restantes;
    }
  }

  const personales = porMoneda(itemsPersonales);
  const reintegros = porMoneda(itemsReintegros);
  const deudaPorVencer = porMoneda(itemsDeuda);
  const total = sumarObjetosPorMoneda([
    personales,
    reintegros,
    aperturaDelCiclo,
  ]);

  return {
    personales,
    reintegros,
    apertura: aperturaDelCiclo,
    total,
    deudaPorVencer,
    cuotasDelCiclo,
    cuotasPorVencer,
  };
}

// Atajos del contrato.
export function aPagarDelCiclo(args) {
  return desgloseCiclo(args).total;
}

export function deudaPorVencer(args) {
  return desgloseCiclo(args).deudaPorVencer;
}

export function deudaTotal(args) {
  const desglose = desgloseCiclo(args);
  return sumarObjetosPorMoneda([desglose.total, desglose.deudaPorVencer]);
}
