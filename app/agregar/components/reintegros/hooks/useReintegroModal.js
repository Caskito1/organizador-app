// agregar/components/reintegros/hooks/useReintegroModal.js
// Estado del ReintegroModal (4.2, ajustes 17/10/2026): un SOLO selector
// «¿Con quién?» con la unión de miembros de todos los grupos del usuario
// (dedup, sin el propio uid) + «Persona externa»; el groupId se DEDUCE (1
// grupo compartido → ese; varios → picker «¿En qué grupo?»; externa → null).
// Movimiento inicial DERIVADO: por_cobrar → salida; por_devolver → ninguno
// por defecto con checkbox «Me entró dinero» → entrada. Monto: dígitos,
// tope 12. Resolución de nombres R-5: solo cuenta nombre de doc existente
// (displayName o email); sin doc → null (NO se persiste uid.slice ni "").

"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";

const MAX_MONTO_DIGITOS = 12;

export function useReintegroModal() {
  const { user } = useAuth();
  const { groups, loadingGroups } = useGroups();

  const [sentido, setSentido] = useState("por_cobrar");
  const [meEntroDinero, setMeEntroDinero] = useState(false);

  const [contraparteTipo, setContraparteTipo] = useState(null); // 'miembro' | 'externa'
  const [contraparteUid, setContraparteUid] = useState("");
  const [nombreExterno, setNombreExterno] = useState("");

  // Solo se usa cuando el miembro elegido comparte VARIOS grupos conmigo.
  const [grupoSel, setGrupoSel] = useState(null);

  const [concepto, setConcepto] = useState("");
  const [detalle, setDetalle] = useState("");

  // Monto: SOLO dígitos crudos (tope 12); la vista formatea sin decimales.
  const [montoDigits, setMontoDigits] = useState("");

  // uid → nombre resuelto | null | ausente (undefined). null = doc
  // inexistente o sin nombre: canSubmit lo bloquea (nunca se persiste un
  // fallback de uid) y el modal muestra el aviso (ajuste 5a). Ausente =
  // aún resolviendo: NO es error, no avisa (solo `null` dispara el aviso).
  const [nombres, setNombres] = useState({});

  // rid ÚNICO por apertura del modal: si un intento por timeout de UI terminó
  // commiteando, el reintento reutiliza el mismo doc (nunca duplica).
  // Lazy state (no ref): se genera exactamente una vez por montaje.
  const [rid] = useState(() => doc(collection(db, "reintegros")).id);

  // Unión de miembros de TODOS los grupos (ajuste 1): sin el propio uid
  // (solo la otra parte), deduplicada.
  const miembrosUid = useMemo(() => {
    const base = groups.flatMap((g) => g.members ?? []);
    return [...new Set(base)].filter((u) => u && u !== user?.uid);
  }, [groups, user?.uid]);

  // Único caso sin miembros: solo se ofrece la contraparte EXTERNA.
  const soloExterna = !loadingGroups && miembrosUid.length === 0;

  // Resolución de nombres (R-5, ajuste 8): users por docId. Solo un doc
  // EXISTENTE con displayName o email produce nombre usable; si no, null
  // (el botón queda con fallback visual de uid.slice pero canSubmit=false).
  useEffect(() => {
    if (miembrosUid.length === 0) return;

    let cancelled = false;

    async function fetchNombres() {
      const resoluciones = await Promise.all(
        miembrosUid.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const data = snap.data();
              return [
                uid,
                data.displayName || data.email?.split("@")[0] || null,
              ];
            }
            return [uid, null];
          } catch {
            return [uid, null];
          }
        }),
      );
      if (!cancelled) {
        setNombres(Object.fromEntries(resoluciones));
      }
    }

    fetchNombres();

    return () => {
      cancelled = true;
    };
  }, [miembrosUid]);

  // Grupos que comparten conmigo Y con el miembro elegido (ajuste 1).
  const gruposCompartidos = useMemo(() => {
    if (contraparteTipo !== "miembro" || !contraparteUid) return [];
    return groups.filter(
      (g) =>
        (g.members ?? []).includes(contraparteUid) &&
        (g.members ?? []).includes(user?.uid),
    );
  }, [groups, contraparteTipo, contraparteUid, user?.uid]);

  // groupId DEDUCIDO: exacto un grupo compartido → ese; varios → el que
  // eligió el usuario (obligatorio si hay varios); 0 o externa → null.
  const groupId = useMemo(() => {
    if (contraparteTipo !== "miembro" || !contraparteUid) return null;
    if (gruposCompartidos.length === 1) return gruposCompartidos[0].id;
    if (gruposCompartidos.length > 1) {
      const valido = gruposCompartidos.some((g) => g.id === grupoSel);
      return valido ? grupoSel : null;
    }
    return null;
  }, [contraparteTipo, contraparteUid, gruposCompartidos, grupoSel]);

  function seleccionarMiembro(uid) {
    setContraparteTipo("miembro");
    setContraparteUid(uid);
    setGrupoSel(null);
  }

  function seleccionarExterna() {
    setContraparteTipo("externa");
    setContraparteUid("");
    setGrupoSel(null);
  }

  function seleccionarGrupo(id) {
    setGrupoSel(id);
  }

  function cambiarSentido(nuevo) {
    setSentido(nuevo);
  }

  function toggleMeEntroDinero() {
    setMeEntroDinero((v) => !v);
  }

  function setMonto(valor) {
    setMontoDigits(valor.replace(/\D/g, "").slice(0, MAX_MONTO_DIGITOS));
  }

  const montoDisplay = montoDigits
    ? Number(montoDigits).toLocaleString("es-AR")
    : "";
  const monto = montoDigits ? Number(montoDigits) : 0;

  // Movimiento inicial DERIVADO (ajuste 2): por_cobrar → salida (el fondo
  // salió de caja al prestar); por_devolver → ninguno salvo que el usuario
  // marque que ya le entró el dinero (efectivo o transferencia).
  const movimientoInicial =
    sentido === "por_cobrar" ? "salida" : meEntroDinero ? "entrada" : "ninguno";

  // Ajuste 8: para miembros, el nombre debe estar RESUELTO (doc existente);
  // para externas, el nombre escrito. Nunca "" ni uid.slice como payload.
  const nombreMiembroResuelto =
    contraparteTipo === "miembro" && !!contraparteUid
      ? nombres[contraparteUid]
      : null;

  const contraparteValida = soloExterna
    ? !!nombreExterno.trim()
    : contraparteTipo === "miembro"
      ? !!nombreMiembroResuelto &&
        (gruposCompartidos.length <= 1 || !!groupId)
      : contraparteTipo === "externa"
        ? !!nombreExterno.trim()
        : false;

  const contraparteNombre =
    contraparteTipo === "miembro"
      ? nombreMiembroResuelto || ""
      : nombreExterno.trim();

  const canSubmit =
    !!user && !!concepto.trim() && monto > 0 && contraparteValida;

  return {
    rid,

    groups,
    loadingGroups,
    gruposCompartidos,
    grupoSel,
    seleccionarGrupo,

    miembrosUid,
    nombres,
    soloExterna,

    sentido,
    cambiarSentido,
    contraparteTipo,
    contraparteUid,
    seleccionarMiembro,
    seleccionarExterna,
    nombreExterno,
    setNombreExterno,

    concepto,
    setConcepto,
    detalle,
    setDetalle,

    monto,
    montoDisplay,
    setMonto,

    movimientoInicial,
    meEntroDinero,
    toggleMeEntroDinero,

    contraparteNombre,
    groupId,
    canSubmit,
  };
}
