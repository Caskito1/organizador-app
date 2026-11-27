// tests/unit/tarjetaPersistencia.test.mjs
// 6.1 — capa pura de persistencia (sin emulador). Protege
// PROPUESTA-ETAPA-6.md §11.4: normalización, validadores y transformaciones
// inmutables (con/sin) sobre el mapa `tarjetas`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TarjetasError,
  nuevoId,
  normalizarTarjeta,
  normalizarTarjetas,
  validarTarjetaId,
  validarConfig,
  validarCompra,
  validarPago,
  validarMonedaPago,
  validarCicloKey,
  validarEstado,
  validarApertura,
  conConfig,
  sinTarjeta,
  conCompra,
  conCompraEditada,
  sinCompra,
  conPago,
  sinPago,
  conApertura,
  conAperturaEditada,
  sinApertura,
  conEstado,
} from "../../app/tarjetas/helpers/persistencia.js";

function lanza(fn, codigo) {
  assert.throws(
    fn,
    (error) => error instanceof TarjetasError && error.codigo === codigo,
  );
}

function fecha(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

function compraBase(over = {}) {
  return {
    fecha: fecha(2026, 10, 10),
    detalle: "  Heladera  ",
    monto: 108000,
    moneda: "UYU",
    cuotasTotal: 6,
    tipo: "personal",
    gastoVinculadoId: null,
    ...over,
  };
}

function planBase(over = {}) {
  return {
    descripcion: "  opencodeGo  ",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal: 12,
    desdeCiclo: "2026-10",
    ...over,
  };
}

function tarjetaCon(over = {}) {
  return {
    nombre: "OCA",
    diaCierre: 18,
    diaVencimiento: 30,
    activa: true,
    retiradaDesde: null,
    compras: [],
    pagos: {},
    ciclos: {},
    apertura: [],
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

// ── normalización ─────────────────────────────────────────────────────────

test("normalizarTarjetas: null/ausente → {} y objetos tolerantes", () => {
  assert.deepEqual(normalizarTarjetas(undefined), {});
  assert.deepEqual(normalizarTarjetas(null), {});

  const normalizado = normalizarTarjetas({
    oca: {
      nombre: "OCA",
      compras: { a: { id: "a" }, b: { id: "b" } },
      pagos: null,
      apertura: [{ id: "p1" }],
      activa: undefined,
    },
    basura: 42,
  });

  assert.deepEqual(Object.keys(normalizado), ["oca"]);
  assert.equal(normalizado.oca.compras.length, 2);
  assert.deepEqual(normalizado.oca.compras.map((c) => c.id), ["a", "b"]);
  assert.deepEqual(normalizado.oca.pagos, {});
  assert.equal(normalizado.oca.apertura.length, 1);
  assert.equal(normalizado.oca.activa, true);
  assert.equal(normalizado.oca.retiradaDesde, null);
  assert.equal(normalizado.oca.diaCierre, null);
});

test("normalizarTarjeta: defaults y copias", () => {
  const t = normalizarTarjeta({ nombre: "OCA", diaCierre: 18, diaVencimiento: 30 });
  assert.deepEqual(t.compras, []);
  assert.deepEqual(t.pagos, {});
  assert.deepEqual(t.ciclos, {});
  assert.deepEqual(t.apertura, []);
  assert.equal(t.activa, true);
  assert.equal(t.retiradaDesde, null);
});

// ── validadores ───────────────────────────────────────────────────────────

test("validarTarjetaId", () => {
  assert.equal(validarTarjetaId("oca"), "oca");
  assert.equal(validarTarjetaId("visa-1"), "visa-1");
  lanza(() => validarTarjetaId(""), "TARJETA_INVALIDA");
  lanza(() => validarTarjetaId("oca 1"), "TARJETA_INVALIDA");
  lanza(() => validarTarjetaId(3), "TARJETA_INVALIDA");
});

test("validarConfig: normaliza y valida", () => {
  const cfg = validarConfig({ nombre: "  OCA  ", diaCierre: 18, diaVencimiento: 30 });
  assert.deepEqual(cfg, {
    nombre: "OCA",
    diaCierre: 18,
    diaVencimiento: 30,
    activa: true,
    retiradaDesde: null,
  });

  assert.equal(validarConfig({ nombre: "OCA", diaCierre: 1, diaVencimiento: 31, activa: false }).activa, false);
  assert.equal(
    validarConfig({ nombre: "OCA", diaCierre: 18, diaVencimiento: 30, retiradaDesde: "2026-12" }).retiradaDesde,
    "2026-12",
  );

  lanza(() => validarConfig({ nombre: "", diaCierre: 18, diaVencimiento: 30 }), "TARJETA_INVALIDA");
  lanza(() => validarConfig({ nombre: "OCA", diaCierre: 0, diaVencimiento: 30 }), "TARJETA_INVALIDA");
  lanza(() => validarConfig({ nombre: "OCA", diaCierre: 29, diaVencimiento: 30 }), "TARJETA_INVALIDA");
  lanza(() => validarConfig({ nombre: "OCA", diaCierre: 18, diaVencimiento: 32 }), "TARJETA_INVALIDA");
  lanza(() => validarConfig({ nombre: "OCA", diaCierre: 18, diaVencimiento: 30, activa: "sí" }), "TARJETA_INVALIDA");
  lanza(() => validarConfig({ nombre: "OCA", diaCierre: 18, diaVencimiento: 30, retiradaDesde: "2026-13" }), "TARJETA_INVALIDA");
});

test("validarCompra: normaliza y valida", () => {
  const c = validarCompra(compraBase());
  assert.equal(c.monto, 108000);
  assert.equal(c.moneda, "UYU");
  assert.equal(c.cuotasTotal, 6);
  assert.equal(c.detalle, "Heladera");
  assert.equal(c.tipo, "personal");
  assert.equal(c.gastoVinculadoId, null);
  assert.equal(c.contraparteNombre, null);
  assert.ok(c.fecha instanceof Date);

  const conNombre = validarCompra(compraBase({ contraparteNombre: "  Bruno  " }));
  assert.equal(conNombre.contraparteNombre, "Bruno");

  const minimo = validarCompra({ monto: 12000, moneda: "UYU", fecha: fecha(2026, 10, 1) });
  assert.equal(minimo.cuotasTotal, 1);
  assert.equal(minimo.tipo, "personal");
  assert.equal(minimo.gastoVinculadoId, null);

  lanza(() => validarCompra(compraBase({ monto: 1.5 })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ monto: 0 })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ cuotasTotal: 0 })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ moneda: "EUR" })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ fecha: "no-es-fecha" })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ tipo: "otro" })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ gastoVinculadoId: 123 })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ contraparteNombre: 123 })), "COMPRA_INVALIDA");
  lanza(() => validarCompra(compraBase({ contraparteNombre: "   " })), "COMPRA_INVALIDA");
});

test("normalizarTarjeta: conserva y recorta contraparteNombre de las compras", () => {
  const t = normalizarTarjeta({
    ...tarjetaCon(),
    compras: [
      { id: "c1", contraparteNombre: "  Bruno  " },
      { id: "c2" },
      { id: "c3", contraparteNombre: "   " },
    ],
  });

  assert.equal(t.compras[0].contraparteNombre, "Bruno");
  assert.equal("contraparteNombre" in t.compras[1], false);
  assert.equal("contraparteNombre" in t.compras[2], false);
});

test("validarPago / validarMonedaPago", () => {
  const p = validarPago({ monto: 86000, fecha: fecha(2026, 12, 30) });
  assert.equal(p.monto, 86000);
  assert.ok(p.fecha instanceof Date);

  assert.equal(validarMonedaPago("UYU"), "UYU");
  assert.equal(validarMonedaPago("USD"), "USD");

  lanza(() => validarPago({ monto: 1.5, fecha: fecha(2026, 12, 30) }), "PAGO_INVALIDO");
  lanza(() => validarPago({ monto: 0, fecha: fecha(2026, 12, 30) }), "PAGO_INVALIDO");
  lanza(() => validarPago({ monto: 100, fecha: "no" }), "PAGO_INVALIDO");
  lanza(() => validarMonedaPago("EUR"), "PAGO_INVALIDO");
});

test("validarApertura: normaliza y valida", () => {
  const p = validarApertura(planBase());
  assert.equal(p.descripcion, "opencodeGo");
  assert.equal(p.moneda, "UYU");
  assert.equal(p.montoCuota, 5000);
  assert.equal(p.cuotasTotal, 12);
  assert.equal(p.desdeCiclo, "2026-10");

  lanza(() => validarApertura(planBase({ descripcion: "  " })), "APERTURA_INVALIDA");
  lanza(() => validarApertura(planBase({ moneda: "EUR" })), "APERTURA_INVALIDA");
  lanza(() => validarApertura(planBase({ montoCuota: 0 })), "APERTURA_INVALIDA");
  lanza(() => validarApertura(planBase({ cuotasTotal: 0 })), "APERTURA_INVALIDA");
  lanza(() => validarApertura(planBase({ desdeCiclo: "2026-13" })), "APERTURA_INVALIDA");
});

test("ciclo y estado", () => {
  assert.equal(validarCicloKey("2026-12"), "2026-12");
  lanza(() => validarCicloKey("2026-13"), "CICLO_INVALIDO");
  lanza(() => validarCicloKey("2026-1"), "CICLO_INVALIDO");

  assert.equal(validarEstado("por_pagar"), "por_pagar");
  assert.equal(validarEstado("pagada"), "pagada");
  assert.equal(validarEstado("sin_verificar"), "sin_verificar");
  lanza(() => validarEstado("raro"), "CICLO_INVALIDO");
});

test("nuevoId: string no vacío y distinto entre llamadas", () => {
  const a = nuevoId();
  const b = nuevoId();
  assert.equal(typeof a, "string");
  assert.ok(a.length > 0);
  assert.notEqual(a, b);
});

// ── transformaciones ──────────────────────────────────────────────────────

test("conConfig: crea con la estructura completa", () => {
  const cfg = validarConfig({ nombre: "OCA", diaCierre: 18, diaVencimiento: 30 });
  const r = conConfig({}, "oca", cfg, { creadaEn: "T0" });

  assert.equal(r.tarjeta.nombre, "OCA");
  assert.equal(r.tarjeta.createdAt, "T0");
  assert.deepEqual(r.tarjeta.compras, []);
  assert.deepEqual(r.tarjeta.pagos, {});
  assert.deepEqual(r.tarjeta.ciclos, {});
  assert.deepEqual(r.tarjeta.apertura, []);
});

test("conConfig: actualiza config sin borrar el detalle ni createdAt", () => {
  const inicial = {
    oca: tarjetaCon({
      compras: [{ id: "c1" }],
      pagos: { "2026-12": { UYU: { monto: 1 } } },
      createdAt: "T0",
    }),
  };
  const antes = JSON.stringify(inicial);
  const cfg = validarConfig({ nombre: "Visa", diaCierre: 20, diaVencimiento: 5 });

  const r = conConfig(inicial, "oca", cfg);

  assert.equal(r.tarjeta.nombre, "Visa");
  assert.equal(r.tarjeta.diaCierre, 20);
  assert.equal(r.tarjeta.createdAt, "T0");
  assert.deepEqual(r.tarjeta.compras, [{ id: "c1" }]);
  assert.deepEqual(r.tarjeta.pagos, { "2026-12": { UYU: { monto: 1 } } });
  assert.equal(JSON.stringify(inicial), antes, "no muta la entrada");
});

test("sinTarjeta: borra una y conserva las demás", () => {
  const base = { oca: tarjetaCon(), visa: tarjetaCon({ nombre: "Visa" }) };
  const r = sinTarjeta(base, "oca");

  assert.equal(r.tarjeta.nombre, "OCA");
  assert.equal(r.tarjetas.oca, undefined);
  assert.ok(r.tarjetas.visa);
  lanza(() => sinTarjeta(base, "nope"), "TARJETA_NO_ENCONTRADA");
});

test("conCompra / conCompraEditada / sinCompra", () => {
  const validada = validarCompra(compraBase());
  const c1 = { id: "c1", ...validada, createdAt: "T1" };

  const alta = conCompra({ oca: tarjetaCon() }, "oca", c1);
  assert.deepEqual(alta.tarjetas.oca.compras.map((c) => c.id), ["c1"]);

  const c2 = { id: "c2", ...validarCompra(compraBase({ monto: 50000 })), createdAt: "T2" };
  const conDos = conCompra(alta.tarjetas, "oca", c2);
  assert.deepEqual(conDos.tarjetas.oca.compras.map((c) => c.id), ["c1", "c2"]);

  const editada = conCompraEditada(conDos.tarjetas, "oca", "c1", { monto: 77000 });
  assert.equal(editada.compra.monto, 77000);
  assert.equal(editada.compra.id, "c1");
  assert.equal(editada.compra.createdAt, "T1");
  assert.equal(editada.tarjetas.oca.compras[1].id, "c2");
  assert.equal(editada.tarjetas.oca.compras[1].monto, 50000);

  lanza(
    () => conCompraEditada(conDos.tarjetas, "oca", "c1", { monto: 1.5 }),
    "COMPRA_INVALIDA",
  );
  lanza(() => conCompraEditada(conDos.tarjetas, "oca", "nope", { monto: 100 }), "COMPRA_NO_ENCONTRADA");

  const eliminada = sinCompra(conDos.tarjetas, "oca", "c1");
  assert.equal(eliminada.compra.id, "c1");
  assert.deepEqual(eliminada.tarjetas.oca.compras.map((c) => c.id), ["c2"]);
  lanza(() => sinCompra(conDos.tarjetas, "oca", "nope"), "COMPRA_NO_ENCONTRADA");
});

test("conPago / sinPago: conserva la otra moneda y limpia el ciclo vacío", () => {
  const pagoUyu = { monto: 86000, fecha: fecha(2026, 12, 30) };
  const pagoUsd = { monto: 500, fecha: fecha(2026, 12, 30) };

  const r1 = conPago({ oca: tarjetaCon() }, "oca", "2026-12", "UYU", pagoUyu);
  assert.equal(r1.tarjetas.oca.pagos["2026-12"].UYU.monto, 86000);

  const r2 = conPago(r1.tarjetas, "oca", "2026-12", "USD", pagoUsd);
  assert.equal(r2.tarjetas.oca.pagos["2026-12"].UYU.monto, 86000);
  assert.equal(r2.tarjetas.oca.pagos["2026-12"].USD.monto, 500);

  const r3 = sinPago(r2.tarjetas, "oca", "2026-12", "UYU");
  assert.equal(r3.pago.monto, 86000);
  assert.deepEqual(Object.keys(r3.tarjetas.oca.pagos["2026-12"]), ["USD"]);

  const r4 = sinPago(r3.tarjetas, "oca", "2026-12", "USD");
  assert.equal(r4.pago.monto, 500);
  assert.equal(r4.tarjetas.oca.pagos["2026-12"], undefined, "limpia el ciclo vacío");

  const r5 = sinPago(r4.tarjetas, "oca", "2026-12", "UYU");
  assert.equal(r5.pago, null, "borrado idempotente");
});

test("conApertura / conAperturaEditada / sinApertura", () => {
  const p1 = { id: "p1", ...validarApertura(planBase()) };
  const p2 = { id: "p2", ...validarApertura(planBase({ descripcion: "Peñarol", moneda: "USD" })) };

  const alta = conApertura({ oca: tarjetaCon() }, "oca", p1);
  assert.deepEqual(alta.tarjetas.oca.apertura.map((p) => p.id), ["p1"]);

  const conDos = conApertura(alta.tarjetas, "oca", p2);
  assert.deepEqual(conDos.tarjetas.oca.apertura.map((p) => p.id), ["p1", "p2"]);

  const editada = conAperturaEditada(conDos.tarjetas, "oca", "p1", { montoCuota: 6000 });
  assert.equal(editada.plan.montoCuota, 6000);
  assert.equal(editada.plan.id, "p1");
  assert.equal(editada.tarjetas.oca.apertura[1].id, "p2");

  lanza(() => conAperturaEditada(conDos.tarjetas, "oca", "p1", { montoCuota: 0 }), "APERTURA_INVALIDA");
  lanza(() => conAperturaEditada(conDos.tarjetas, "oca", "nope", { montoCuota: 1 }), "APERTURA_NO_ENCONTRADA");

  const eliminada = sinApertura(conDos.tarjetas, "oca", "p1");
  assert.equal(eliminada.plan.id, "p1");
  assert.deepEqual(eliminada.tarjetas.oca.apertura.map((p) => p.id), ["p2"]);
  lanza(() => sinApertura(conDos.tarjetas, "oca", "nope"), "APERTURA_NO_ENCONTRADA");
});

test("conEstado: set y reset (sin_verificar borra la entrada)", () => {
  const r1 = conEstado({ oca: tarjetaCon() }, "oca", "2026-12", "por_pagar");
  assert.deepEqual(r1.tarjetas.oca.ciclos["2026-12"], { estado: "por_pagar" });

  const r2 = conEstado(r1.tarjetas, "oca", "2026-12", "sin_verificar");
  assert.equal(r2.tarjetas.oca.ciclos["2026-12"], undefined);
  assert.equal(r2.estado, "sin_verificar");
});
