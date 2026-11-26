// tarjetas/helpers/persistencia.js
// 6.1 — Capa PURA de persistencia de la tarjeta (sin SDK de Firebase).
//
// Plan: PROPUESTA-ETAPA-6.md §11.4. Contiene:
//   · TarjetasError (códigos de §11.6) y `nuevoId`.
//   · normalización tolerante (al leer).
//   · validadores (lanzan TarjetasError; devuelven el valor normalizado).
//   · transformaciones INMUTABLES sobre el mapa `tarjetas` (no mutan la entrada).
//
// DEFENSA EN PROFUNDIDAD (nota, NO se bloquea acá): la restricción de que solo
// se editen compras "nuevas" (cuota 1/n en un ciclo sin verificar) es de 6.2 (UI).
// Este módulo permite editar/eliminar cualquier compra del array; el guard de
// negocio lo pone la pantalla cuando exista.
//
// Los ids y los timestamps los pone el SERVICIO (persistencia.js es determinista
// para poder testearse con node --test sin emulador).

import { aDate } from "../../gastos/helpers/dateHelpers.js";
import { ESTADOS_CICLO } from "./estados.js";
import { esMoneda } from "./moneda.js";

export class TarjetasError extends Error {
  constructor(codigo, mensaje, { causa = null } = {}) {
    super(mensaje);

    this.name = "TarjetasError";
    this.codigo = codigo;
    this.causa = causa;
  }
}

export function nuevoId() {
  const cryptoObj = globalThis.crypto;

  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const TARJETA_ID_RE = /^[A-Za-z0-9_-]+$/;
const CICLO_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function esObjeto(valor) {
  return !!valor && typeof valor === "object" && !Array.isArray(valor);
}

function listaDeArreglo(valor) {
  if (Array.isArray(valor)) return valor.filter(esObjeto).map((item) => ({ ...item }));
  if (esObjeto(valor)) return Object.values(valor).filter(esObjeto).map((item) => ({ ...item }));
  return [];
}

function objetoDe(valor) {
  return esObjeto(valor) ? { ...valor } : {};
}

// ── normalización (tolerante; no lanza) ───────────────────────────────────

export function normalizarTarjeta(tarjeta) {
  const t = esObjeto(tarjeta) ? tarjeta : {};

  return {
    nombre: typeof t.nombre === "string" ? t.nombre : "",
    diaCierre: Number.isInteger(t.diaCierre) ? t.diaCierre : null,
    diaVencimiento: Number.isInteger(t.diaVencimiento) ? t.diaVencimiento : null,
    activa: typeof t.activa === "boolean" ? t.activa : true,
    retiradaDesde: typeof t.retiradaDesde === "string" ? t.retiradaDesde : null,
    compras: listaDeArreglo(t.compras),
    pagos: objetoDe(t.pagos),
    ciclos: objetoDe(t.ciclos),
    apertura: listaDeArreglo(t.apertura),
    createdAt: t.createdAt ?? null,
    updatedAt: t.updatedAt ?? null,
  };
}

export function normalizarTarjetas(raw) {
  if (!esObjeto(raw)) return {};

  const salida = {};

  for (const [tarjetaId, tarjeta] of Object.entries(raw)) {
    if (!esObjeto(tarjeta)) continue;
    salida[tarjetaId] = normalizarTarjeta(tarjeta);
  }

  return salida;
}

// ── validadores (lanzan TarjetasError; devuelven el valor normalizado) ────

export function validarTarjetaId(tarjetaId) {
  if (typeof tarjetaId !== "string" || !TARJETA_ID_RE.test(tarjetaId)) {
    throw new TarjetasError(
      "TARJETA_INVALIDA",
      `Identificador de tarjeta inválido: ${String(tarjetaId)}.`,
    );
  }
  return tarjetaId;
}

function requerirMoneda(moneda, codigo, contexto) {
  if (!esMoneda(moneda)) {
    throw new TarjetasError(
      codigo,
      `${contexto}: moneda inválida (${String(moneda)}).`,
    );
  }
  return moneda;
}

function esCicloCanonico(valor) {
  return typeof valor === "string" && CICLO_RE.test(valor);
}

export function validarConfig(config) {
  if (!esObjeto(config)) {
    throw new TarjetasError("TARJETA_INVALIDA", "Config de tarjeta inválida.");
  }

  const nombre = typeof config.nombre === "string" ? config.nombre.trim() : "";
  if (!nombre) {
    throw new TarjetasError("TARJETA_INVALIDA", "El nombre de la tarjeta es obligatorio.");
  }

  if (!Number.isInteger(config.diaCierre) || config.diaCierre < 1 || config.diaCierre > 28) {
    throw new TarjetasError("TARJETA_INVALIDA", "diaCierre debe ser un entero entre 1 y 28.");
  }

  if (
    !Number.isInteger(config.diaVencimiento) ||
    config.diaVencimiento < 1 ||
    config.diaVencimiento > 31
  ) {
    throw new TarjetasError("TARJETA_INVALIDA", "diaVencimiento debe ser un entero entre 1 y 31.");
  }

  if (config.activa !== undefined && typeof config.activa !== "boolean") {
    throw new TarjetasError("TARJETA_INVALIDA", "activa debe ser boolean.");
  }

  const retiradaDesde = config.retiradaDesde == null ? null : config.retiradaDesde;
  if (retiradaDesde !== null && !esCicloCanonico(retiradaDesde)) {
    throw new TarjetasError("TARJETA_INVALIDA", "retiradaDesde debe ser YYYY-MM o null.");
  }

  return {
    nombre,
    diaCierre: config.diaCierre,
    diaVencimiento: config.diaVencimiento,
    activa: config.activa ?? true,
    retiradaDesde,
  };
}

export function validarCompra(compra) {
  if (!esObjeto(compra)) {
    throw new TarjetasError("COMPRA_INVALIDA", "Compra inválida.");
  }

  const monto = Number(compra.monto);
  if (!Number.isInteger(monto) || monto <= 0) {
    throw new TarjetasError("COMPRA_INVALIDA", "monto debe ser un entero > 0.");
  }

  const cuotasTotal = compra.cuotasTotal === undefined ? 1 : Number(compra.cuotasTotal);
  if (!Number.isInteger(cuotasTotal) || cuotasTotal < 1) {
    throw new TarjetasError("COMPRA_INVALIDA", "cuotasTotal debe ser un entero >= 1.");
  }

  const moneda = requerirMoneda(compra.moneda, "COMPRA_INVALIDA", "Compra");

  if (!aDate(compra.fecha)) {
    throw new TarjetasError("COMPRA_INVALIDA", "fecha de la compra inválida.");
  }

  const tipo = compra.tipo ?? "personal";
  if (tipo !== "personal" && tipo !== "reintegro") {
    throw new TarjetasError("COMPRA_INVALIDA", "tipo debe ser personal o reintegro.");
  }

  const gastoVinculadoId =
    compra.gastoVinculadoId === undefined || compra.gastoVinculadoId === null
      ? null
      : compra.gastoVinculadoId;
  if (gastoVinculadoId !== null && typeof gastoVinculadoId !== "string") {
    throw new TarjetasError("COMPRA_INVALIDA", "gastoVinculadoId debe ser string o null.");
  }

  return {
    fecha: compra.fecha,
    detalle: typeof compra.detalle === "string" ? compra.detalle.trim() : "",
    monto,
    moneda,
    cuotasTotal,
    tipo,
    gastoVinculadoId,
  };
}

export function validarPago(pago) {
  if (!esObjeto(pago)) {
    throw new TarjetasError("PAGO_INVALIDO", "Pago inválido.");
  }

  const monto = Number(pago.monto);
  if (!Number.isInteger(monto) || monto <= 0) {
    throw new TarjetasError("PAGO_INVALIDO", "monto del pago debe ser un entero > 0.");
  }

  if (!aDate(pago.fecha)) {
    throw new TarjetasError("PAGO_INVALIDO", "fecha del pago inválida.");
  }

  return { monto, fecha: pago.fecha };
}

export function validarMonedaPago(moneda) {
  return requerirMoneda(moneda, "PAGO_INVALIDO", "Pago");
}

export function validarCicloKey(cicloKey) {
  if (!esCicloCanonico(cicloKey)) {
    throw new TarjetasError("CICLO_INVALIDO", `Ciclo inválido: ${String(cicloKey)}.`);
  }
  return cicloKey;
}

export function validarEstado(estado) {
  if (!ESTADOS_CICLO.includes(estado)) {
    throw new TarjetasError("CICLO_INVALIDO", `Estado de ciclo inválido: ${String(estado)}.`);
  }
  return estado;
}

export function validarApertura(plan) {
  if (!esObjeto(plan)) {
    throw new TarjetasError("APERTURA_INVALIDA", "Plan de apertura inválido.");
  }

  const descripcion =
    typeof plan.descripcion === "string" ? plan.descripcion.trim() : "";
  if (!descripcion) {
    throw new TarjetasError("APERTURA_INVALIDA", "La descripción del plan es obligatoria.");
  }

  const moneda = requerirMoneda(plan.moneda, "APERTURA_INVALIDA", "Apertura");

  const montoCuota = Number(plan.montoCuota);
  if (!Number.isInteger(montoCuota) || montoCuota <= 0) {
    throw new TarjetasError("APERTURA_INVALIDA", "montoCuota debe ser un entero > 0.");
  }

  const cuotasTotal = Number(plan.cuotasTotal);
  if (!Number.isInteger(cuotasTotal) || cuotasTotal < 1) {
    throw new TarjetasError("APERTURA_INVALIDA", "cuotasTotal debe ser un entero >= 1.");
  }

  if (!esCicloCanonico(plan.desdeCiclo)) {
    throw new TarjetasError("APERTURA_INVALIDA", "desdeCiclo debe ser YYYY-MM.");
  }

  return { descripcion, moneda, montoCuota, cuotasTotal, desdeCiclo: plan.desdeCiclo };
}

// ── transformaciones inmutables ───────────────────────────────────────────

function requerirTarjeta(tarjetas, tarjetaId) {
  const tarjeta = tarjetas?.[tarjetaId];
  if (!tarjeta) {
    throw new TarjetasError(
      "TARJETA_NO_ENCONTRADA",
      `No existe la tarjeta ${String(tarjetaId)}.`,
    );
  }
  return tarjeta;
}

function reemplazarTarjeta(tarjetas, tarjetaId, tarjeta) {
  return { ...tarjetas, [tarjetaId]: tarjeta };
}

export function conConfig(tarjetas, tarjetaId, config, { creadaEn = null } = {}) {
  const actual = tarjetas?.[tarjetaId] ?? null;
  const base = actual ?? {
    compras: [],
    pagos: {},
    ciclos: {},
    apertura: [],
    createdAt: creadaEn,
  };

  const tarjeta = { ...base, ...config };

  // createdAt es auditoría inmutable: nunca lo pisa la config.
  if (actual) tarjeta.createdAt = actual.createdAt;

  return { tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, tarjeta), tarjeta };
}

export function sinTarjeta(tarjetas, tarjetaId) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const nuevas = { ...tarjetas };

  delete nuevas[tarjetaId];

  return { tarjetas: nuevas, tarjeta };
}

export function conCompra(tarjetas, tarjetaId, compra) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const nueva = {
    ...tarjeta,
    compras: [...(tarjeta.compras ?? []), compra],
  };

  return { tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, nueva), compra };
}

export function conCompraEditada(tarjetas, tarjetaId, compraId, cambios) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const compras = tarjeta.compras ?? [];
  const indice = compras.findIndex((compra) => compra.id === compraId);

  if (indice === -1) {
    throw new TarjetasError("COMPRA_NO_ENCONTRADA", `No existe la compra ${String(compraId)}.`);
  }

  const actual = compras[indice];
  const fusion = { ...actual, ...(cambios ?? {}), id: actual.id, createdAt: actual.createdAt };
  const validada = validarCompra(fusion);
  const compra = { ...validada, id: actual.id, createdAt: actual.createdAt };

  const nuevas = [...compras];
  nuevas[indice] = compra;

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, { ...tarjeta, compras: nuevas }),
    compra,
  };
}

export function sinCompra(tarjetas, tarjetaId, compraId) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const compras = tarjeta.compras ?? [];
  const compra = compras.find((item) => item.id === compraId);

  if (!compra) {
    throw new TarjetasError("COMPRA_NO_ENCONTRADA", `No existe la compra ${String(compraId)}.`);
  }

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, {
      ...tarjeta,
      compras: compras.filter((item) => item.id !== compraId),
    }),
    compra,
  };
}

export function conPago(tarjetas, tarjetaId, cicloKey, moneda, pago) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const pagos = { ...(tarjeta.pagos ?? {}) };
  pagos[cicloKey] = { ...(pagos[cicloKey] ?? {}), [moneda]: pago };

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, { ...tarjeta, pagos }),
    pago,
  };
}

export function sinPago(tarjetas, tarjetaId, cicloKey, moneda) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const pagos = { ...(tarjeta.pagos ?? {}) };
  const ciclo = { ...(pagos[cicloKey] ?? {}) };
  const pago = ciclo[moneda] ?? null;

  // Borrado idempotente: si no existe, no es error (no hay PAGO_NO_ENCONTRADO).
  if (!pago) return { tarjetas, pago: null };

  delete ciclo[moneda];
  if (Object.keys(ciclo).length === 0) {
    delete pagos[cicloKey];
  } else {
    pagos[cicloKey] = ciclo;
  }

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, { ...tarjeta, pagos }),
    pago,
  };
}

export function conApertura(tarjetas, tarjetaId, plan) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const nueva = {
    ...tarjeta,
    apertura: [...(tarjeta.apertura ?? []), plan],
  };

  return { tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, nueva), plan };
}

export function conAperturaEditada(tarjetas, tarjetaId, planId, cambios) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const apertura = tarjeta.apertura ?? [];
  const indice = apertura.findIndex((plan) => plan.id === planId);

  if (indice === -1) {
    throw new TarjetasError(
      "APERTURA_NO_ENCONTRADA",
      `No existe el plan de apertura ${String(planId)}.`,
    );
  }

  const actual = apertura[indice];
  const fusion = { ...actual, ...(cambios ?? {}), id: actual.id };
  const validada = validarApertura(fusion);
  const plan = { ...validada, id: actual.id };

  const nuevas = [...apertura];
  nuevas[indice] = plan;

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, { ...tarjeta, apertura: nuevas }),
    plan,
  };
}

export function sinApertura(tarjetas, tarjetaId, planId) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const apertura = tarjeta.apertura ?? [];
  const plan = apertura.find((item) => item.id === planId);

  if (!plan) {
    throw new TarjetasError(
      "APERTURA_NO_ENCONTRADA",
      `No existe el plan de apertura ${String(planId)}.`,
    );
  }

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, {
      ...tarjeta,
      apertura: apertura.filter((item) => item.id !== planId),
    }),
    plan,
  };
}

export function conEstado(tarjetas, tarjetaId, cicloKey, estado) {
  const tarjeta = requerirTarjeta(tarjetas, tarjetaId);
  const ciclos = { ...(tarjeta.ciclos ?? {}) };

  // sin_verificar es el default IMPLÍCITO (§14.9): guardarlo BORRA la entrada
  // del ciclo (reset), no la persiste. Es el camino de borrado del estado.
  if (estado === "sin_verificar") {
    delete ciclos[cicloKey];
  } else {
    ciclos[cicloKey] = { estado };
  }

  return {
    tarjetas: reemplazarTarjeta(tarjetas, tarjetaId, { ...tarjeta, ciclos }),
    estado,
  };
}
