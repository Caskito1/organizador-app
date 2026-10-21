// reintegros/hooks/useEdiciones.js
// 4.3b — Suscripción a los eventos `edicion` de las obligaciones visibles
// en la pestaña Activos (chips «Editado…», decisión 21/10/2026). Una
// listener por obligación activa (los eventos no admiten collection-group:
// el get va por rid). NO rompe la página si una suscripción falla (permisos
// o red): se avisa por consola y esa obligación queda sin chips, el resto
// sigue funcionando. Se desuscribe al cambiar de pestaña (`rids` vacíos) o
// cuando una obligación deja de estar activa (sale de `rids`). Al mapear se
// filtra por `entidad` (obligación vs entrega) y se conserva SOLO el último
// evento de cada una.

"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

function msDe(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  const parsed = Date.parse(t);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function useEdiciones(rids) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // Clave estable para las deps: el array cambia de identidad en cada
  // render; la clave solo cuando cambian los rids reales.
  const ridsKey = useMemo(
    () => [...new Set(rids ?? [])].sort().join(","),
    [rids],
  );

  const [data, setData] = useState({});

  useEffect(() => {
    if (!uid || !ridsKey) return;

    const unsubs = [];
    for (const rid of ridsKey.split(",")) {
      const unsub = onSnapshot(
        query(
          collection(db, "reintegros", rid, "eventos"),
          where("tipo", "==", "edicion"),
        ),
        (snap) => {
          let obligacion = null;
          const entregas = {};
          for (const d of snap.docs) {
            const ev = { id: d.id, ...d.data() };
            if (ev.entidad === "obligacion") {
              if (
                !obligacion ||
                msDe(ev.createdAt) >= msDe(obligacion.createdAt)
              ) {
                obligacion = ev;
              }
            } else if (ev.entidad === "entrega" && ev.entregaId) {
              const actual = entregas[ev.entregaId];
              if (!actual || msDe(ev.createdAt) >= msDe(actual.createdAt)) {
                entregas[ev.entregaId] = ev;
              }
            }
          }
          setData((prev) => ({ ...prev, [rid]: { obligacion, entregas } }));
        },
        (err) => {
          // Falla de permisos o red: NO rompe la página; esta obligación
          // queda sin chips y el resto de las suscripciones sigue viva.
          console.warn(
            `[useEdiciones] sin eventos de ${rid}:`,
            err?.code ?? err,
          );
        },
      );
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) {
        try {
          unsub();
        } catch {
          // ya desuscrito
        }
      }
    };
  }, [uid, ridsKey]);

  // Salida filtrada a los rids VIGENTES: al salir de la lista (cambio de
  // pestaña u obligación ya no activa) desaparecen sus chips de inmediato.
  const ridsVigentes = useMemo(
    () => new Set(ridsKey ? ridsKey.split(",") : []),
    [ridsKey],
  );

  return useMemo(() => {
    const out = {};
    for (const rid of ridsVigentes) {
      if (data[rid]) out[rid] = data[rid];
    }
    return out;
  }, [data, ridsVigentes]);
}
