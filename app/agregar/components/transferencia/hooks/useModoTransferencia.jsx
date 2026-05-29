import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";

export function useModoTransferencia() {
  const { user } = useAuth();
  const { groups, loadingGroups } = useGroups();

  const PASOS_T = ["grupo", "detalle"];

  const [paso, setPaso] = useState("grupo");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [miembros, setMiembros] = useState([]); // [{ uid, displayName }]
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [destinatarioUid, setDestinatarioUid] = useState("");
  const [destinatarioNombre, setDestinatarioNombre] = useState("");

  const [concepto, setConcepto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState("");

  const CONCEPTOS = [
    { id: "alquiler", label: "Alquiler" },
    { id: "tarjeta", label: "Tarjeta de crédito" },
    { id: "otros", label: "Otros" },
  ];

  // Cuando se elige grupo → cargar miembros desde colección users
  useEffect(() => {
    if (!selectedGroupId || !user) return;

    async function fetchMiembros() {
      setLoadingMembers(true);
      setMiembros([]);
      setDestinatarioUid("");
      setDestinatarioNombre("");

      try {
        const grupoRef = doc(db, "groups", selectedGroupId);
        const grupoSnap = await getDoc(grupoRef);
        if (!grupoSnap.exists()) return;

        const memberUids = grupoSnap.data().members ?? [];

        // Filtrar uid propio — solo mostrar los otros
        const otrosUids = memberUids.filter((uid) => uid !== user.uid);

        // Buscar cada uid en colección users
        const resoluciones = await Promise.all(
          otrosUids.map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              if (userSnap.exists()) {
                const data = userSnap.data();
                return {
                  uid,
                  displayName: data.displayName || data.email?.split("@")[0] || uid.slice(0, 8),
                };
              }
              return { uid, displayName: uid.slice(0, 8) + "..." };
            } catch {
              return { uid, displayName: uid.slice(0, 8) + "..." };
            }
          }),
        );

        setMiembros(resoluciones);

        // Si solo hay uno, preseleccionarlo automáticamente
        if (resoluciones.length === 1) {
          setDestinatarioUid(resoluciones[0].uid);
          setDestinatarioNombre(resoluciones[0].displayName);
        }
      } catch (err) {
        console.error("Error fetching miembros:", err);
      } finally {
        setLoadingMembers(false);
      }
    }

    fetchMiembros();
  }, [selectedGroupId, user]);

  function seleccionarGrupo(groupId) {
    setSelectedGroupId(groupId);
  }

  function seleccionarDestinatario(uid, nombre) {
    setDestinatarioUid(uid);
    setDestinatarioNombre(nombre);
  }

  function irADetalle() {
    setPaso("detalle");
  }

  const canProceed =
    !!selectedGroupId && !!destinatarioUid && !loadingMembers;

  const canSubmit =
    !!monto &&
    !!concepto &&
    (concepto !== "otros" || detalle.trim());

  return {
    PASOS_T,
    paso,
    setPaso,

    groups,
    loadingGroups,
    selectedGroupId,
    seleccionarGrupo,

    miembros,
    loadingMembers,
    destinatarioUid,
    destinatarioNombre,
    seleccionarDestinatario,

    concepto,
    setConcepto,

    detalle,
    setDetalle,

    monto,
    setMonto,

    canProceed,
    canSubmit,
    CONCEPTOS,

    irADetalle,
  };
}