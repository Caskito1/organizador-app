// agregar/components/reintegros/ReintegroModal.jsx
// Modal de ALTA de obligación (4.2, ajustes 17/10/2026) — un solo paso.
// Un SOLO selector «¿Con quién?» (unión de miembros + externa), grupo
// deducido, movimiento inicial derivado (checkbox solo por_devolver), sin
// selector manual. Tras el éxito redirige a /reintegros. El rid se genera
// UNA vez al abrir (hook) y se reutiliza en cada reintento; el timeout de
// UI (~15 s) no cancela la escritura en curso: si más tarde tiene éxito,
// se redirige igual (solo si el componente sigue montado).

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

import { useReintegroModal } from "./hooks/useReintegroModal";
import { submitReintegro } from "./helpers/submitReintegro";
import { ReintegroError } from "./helpers/submitDevolucion";

const TIMEOUT_UI_MS = 15000;

function mensajeDeError(e) {
  if (e instanceof ReintegroError) {
    if (e.code === "MONTO_INVALIDO") {
      return "El monto debe ser un número entero en pesos, mayor a $0.";
    }
    if (e.code === "VALIDACION") {
      return e.message || "Revisá los datos ingresados.";
    }
    return e.message || "No se pudo guardar.";
  }
  // Ajuste 7: solo corte de red real. failed-precondition y aborted son
  // errores de reglas/índices (no de conexión): mensaje genérico (el
  // handler de errores ya loguea e.code en consola).
  if (["unavailable", "deadline-exceeded"].includes(e?.code)) {
    return "No hay conexión. Intentá de nuevo.";
  }
  if (e?.code === "permission-denied") {
    return "No se pudo guardar (permisos). Revisá tu sesión e intentá de nuevo.";
  }
  return "No se pudo guardar. Intentá de nuevo.";
}

export default function ReintegroModal({ onClose }) {
  const router = useRouter();
  const { user } = useAuth();
  const m = useReintegroModal();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Ajuste 7: tras un timeout, los campos quedan bloqueados mientras puede
  // haber una escritura en vuelo con ESTOS datos (un reintento reutiliza el
  // mismo rid; si el primer intento llegó, se conserva ese resultado).
  const [timeoutModo, setTimeoutModo] = useState(false);

  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  // Ajuste 5c: intento en vuelo tras timeout (no cancelable). Si el usuario
  // cierra el modal mientras tanto, la escritura puede completarse igual: se
  // lo avisa y pide confirmación antes de cerrar.
  const enVueloRef = useRef(false);

  const hoy = new Date().toLocaleDateString("es-AR");

  async function handleGuardar() {
    if (!m.canSubmit || loading) return;

    setLoading(true);
    setError(null);
    enVueloRef.current = true;

    const args = {
      db,
      uid: user.uid,
      uidNombre:
        user.displayName || user.email?.split("@")[0] || "Usuario",
      sentido: m.sentido,
      monto: m.monto,
      contraparteUid: m.contraparteUid || null,
      contraparteNombre: m.contraparteNombre,
      groupId: m.groupId,
      concepto: m.concepto,
      detalle: m.detalle,
      movimientoInicial: m.movimientoInicial,
      rid: m.rid,
    };

    let timeoutTimer;
    const timeout = new Promise((resolve) => {
      timeoutTimer = setTimeout(() => resolve("timeout"), TIMEOUT_UI_MS);
    });
    const intento = submitReintegro(args)
      .then(() => "ok")
      .catch((err) => ({ err }));

    const resultado = await Promise.race([intento, timeout]);
    clearTimeout(timeoutTimer);
    if (resultado !== "timeout") enVueloRef.current = false;

    if (resultado === "timeout") {
      // La transacción sigue en curso (no se puede cancelar): si más tarde
      // tiene éxito, redirigimos de todos modos — SOLO si seguimos montados
      // (si el usuario cerró el modal, no empujar una ruta desde un hook
      // desmontado). Bloqueamos los campos: un reintento con otros datos
      // podría pisar (o quedar pisado por) el intento en vuelo.
      setError(
        "No hay conexión. Reintentá: si el primer intento llegó a guardarse, se conserva ese registro.",
      );
      setTimeoutModo(true);
      setLoading(false);
      intento
        .then((r) => {
          enVueloRef.current = false;
          if (r === "ok" && montadoRef.current) router.push("/reintegros");
        })
        .catch(() => {
          enVueloRef.current = false;
        });
      return;
    }

    if (resultado?.err) {
      const e = resultado.err;
      console.error("[ReintegroModal]", e?.code, e);

      // Un reintento tras timeout puede pisar un intento que YA commiteó:
      // el mismo rid sobre un doc existente es denegado por reglas; si el
      // doc existe, el alta original sí salió → éxito.
      if (e?.code === "permission-denied") {
        try {
          const snap = await getDoc(doc(db, "reintegros", m.rid));
          if (snap.exists()) {
            router.push("/reintegros");
            return;
          }
        } catch {
          // sin lectura posible: mostrar el error original
        }
      }

      setError(mensajeDeError(e));
      setLoading(false);
      // Errores definitivos (no de red): se libera el bloqueo de campos.
      if (!["unavailable", "deadline-exceeded"].includes(e?.code)) {
        setTimeoutModo(false);
      }
      return;
    }

    router.push("/reintegros");
    onClose();
  }

  const botonActivo = m.canSubmit && !loading;

  const bloqueado = timeoutModo;

  // Ajuste 5a: solo `null` (resuelto y sin nombre) dispara el aviso.
  // `undefined` = aún cargando: sin aviso rojo; el botón muestra el fallback
  // visual y `canSubmit` ya bloquea el guardado hasta que se resuelva.
  const miembroSinNombre =
    m.contraparteTipo === "miembro" &&
    !!m.contraparteUid &&
    m.nombres[m.contraparteUid] === null;

  function intentarCerrar() {
    if (loading) return;
    if (timeoutModo && enVueloRef.current) {
      const cerrar = window.confirm(
        "Hay un intento de guardado en curso: puede completarse y quedar registrado aunque cierres. ¿Cerrar de todos modos?",
      );
      if (!cerrar) return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={intentarCerrar}
    >
      <div
        className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-t border-border bg-[rgba(18,14,28,0.97)] px-5 pb-8 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[4px] w-[40px] rounded-full bg-[rgba(255,255,255,0.15)]" />

        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          Nuevo reintegro
        </h2>
        <p className="mb-4 text-[12px] text-text-muted">
          ¿Qué pasó? Registrá quién le debe a quién.
        </p>

        {/* TIPO / SENTIDO */}
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-text-muted">
            Tipo
          </p>
          <div className="flex gap-2">
            {[
              { id: "por_cobrar", label: "Presté (me deben)" },
              { id: "por_devolver", label: "Me prestaron (debo devolver)" },
            ].map((op) => {
              const active = m.sentido === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => m.cambiarSentido(op.id)}
                  disabled={bloqueado}
                  className={`flex-1 rounded-[14px] border px-3 py-[11px] text-left text-[13px] transition-all ${
                    active
                      ? "border-accent/60 bg-accent/18 font-semibold text-accent-light"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTRAPARTE — un solo selector: unión de miembros + externa */}
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-text-muted">
            ¿Con quién?
          </p>

          {!m.soloExterna && (
            <div className="flex flex-wrap gap-2">
              {m.miembrosUid.map((uid) => {
                const active =
                  m.contraparteTipo === "miembro" &&
                  m.contraparteUid === uid;
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => m.seleccionarMiembro(uid)}
                    disabled={bloqueado}
                    className={`rounded-[14px] border px-3 py-[9px] text-[13px] transition-all ${
                      active
                        ? "border-[rgba(94,224,197,0.55)] bg-[rgba(94,224,197,0.12)] font-semibold text-[var(--user-b)]"
                        : "border-border bg-white/3 text-text"
                    }`}
                  >
                    {m.nombres[uid] || uid.slice(0, 8) + "..."}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={m.seleccionarExterna}
                disabled={bloqueado}
                className={`rounded-[14px] border px-3 py-[9px] text-[13px] transition-all ${
                  m.contraparteTipo === "externa"
                    ? "border-accent/60 bg-accent/18 font-semibold text-accent-light"
                    : "border-border bg-white/3 text-text"
                }`}
              >
                Persona externa
              </button>
            </div>
          )}

          {miembroSinNombre && (
            <p className="text-[11px] leading-[1.5] text-negative">
              No se pudo resolver el nombre de esta persona (no figura en tus
              contactos). Usá «Persona externa» y escribí su nombre.
            </p>
          )}

          {/* Grupo SOLO si el miembro elegido comparte varios grupos conmigo */}
          {m.contraparteTipo === "miembro" &&
            m.gruposCompartidos.length > 1 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-text-muted">
                  ¿En qué grupo?
                </p>
                <div className="flex flex-wrap gap-2">
                  {m.gruposCompartidos.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => m.seleccionarGrupo(g.id)}
                      disabled={bloqueado}
                      className={`rounded-[14px] border px-3 py-[9px] text-[13px] transition-all ${
                        m.grupoSel === g.id
                          ? "border-accent/60 bg-accent/18 font-semibold text-accent-light"
                          : "border-border bg-white/3 text-text"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {(m.soloExterna || m.contraparteTipo === "externa") && (
            <div className="flex flex-col gap-[6px]">
              <input
                type="text"
                placeholder="Nombre de la persona"
                value={m.nombreExterno}
                onChange={(e) => m.setNombreExterno(e.target.value)}
                disabled={bloqueado}
              />
            </div>
          )}
        </div>

        {/* TÍTULO (concepto) */}
        <div className="mb-4 flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium tracking-[0.3px] text-text-muted">
            TÍTULO
          </label>
          <input
            type="text"
            placeholder="Ej: Alquiler de octubre, entrada del mueble…"
            value={m.concepto}
            onChange={(e) => m.setConcepto(e.target.value)}
            disabled={bloqueado}
          />
        </div>

        {/* MONTO — solo dígitos (tope 12), formato entero sin decimales */}
        <div className="relative mb-4 overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4">
          <p className="mb-[6px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
            MONTO ($)
          </p>
          <div className="flex items-center gap-1">
            <span className="font-sora text-[22px] font-bold leading-none text-accent-light">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={m.montoDisplay}
              onChange={(e) => m.setMonto(e.target.value)}
              disabled={bloqueado}
              className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* DETALLE (opcional) */}
        <div className="mb-4 flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium tracking-[0.3px] text-text-muted">
            DETALLE (opcional)
          </label>
          <input
            type="text"
            placeholder="Información adicional"
            value={m.detalle}
            onChange={(e) => m.setDetalle(e.target.value)}
            disabled={bloqueado}
          />
        </div>

        {/* FECHA — no editable en alta (§9.3) */}
        <div className="mb-4 rounded-[14px] border border-border bg-white/3 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.4px] text-text-muted">
            Fecha
          </p>
          <p className="text-[14px] text-text">{hoy} (se registra al guardar)</p>
        </div>

        {/* DINERO ENTRADO — solo por_devolver; deriva movimientoInicial */}
        {m.sentido === "por_devolver" && (
          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-white/3 px-4 py-3">
            <input
              type="checkbox"
              checked={m.meEntroDinero}
              onChange={m.toggleMeEntroDinero}
              disabled={bloqueado}
              className="mt-[3px]"
            />
            <span className="text-[13px] leading-[1.5] text-text">
              Me entró dinero (efectivo o transferencia)
            </span>
          </label>
        )}

        <p className="mb-4 text-[11px] leading-[1.5] text-text-muted">
          Los reintegros van por fuera de Gastos e Ingresos: no registran
          dinero en caja por sí solos. Si el movimiento ya está (o corresponde
          registrarlo) como gasto o ingreso, hacelo por separado en Agregar.
        </p>

        {error && (
          <div className="mb-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
            {error}
          </div>
        )}

        {/* SUBMIT — sigue habilitado tras timeout (el reintento reutiliza rid) */}
        <button
          type="button"
          onClick={handleGuardar}
          disabled={!botonActivo}
          className={`w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
            !botonActivo
              ? "cursor-default bg-accent/30"
              : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
          }`}
        >
          {loading ? "Guardando…" : "Registrar obligación"}
        </button>
      </div>
    </div>
  );
}
