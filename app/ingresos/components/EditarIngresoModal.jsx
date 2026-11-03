"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";

import SectionLabel from "@/app/components/ui/SectionLabel";
import { BANDAS } from "@/app/agregar/components/ingresos/hooks/useModoIngreso";
import {
  fechaLocal,
  hoyISO,
  isoDeFecha,
} from "@/app/gastos/helpers/dateHelpers";

const TIPOS = [
  { id: "sueldo", label: "Sueldo" },
  { id: "banda", label: "Bandas" },
  { id: "freelance", label: "Freelance" },
  { id: "otros", label: "Otros" },
];

// 4.5-fecha: edición de ingresos (antes no existía). Mismo patrón que
// EditarGastoModal: `fecha` editable, `createdAt` nunca se envía.
export default function EditarIngresoModal({
  ingreso,
  onClose,
  onSave,
  onDelete,
}) {
  const [monto, setMonto] = useState(
    String(ingreso.monto ?? ""),
  );

  const [detalle, setDetalle] = useState(
    ingreso.detalle ?? "",
  );

  const [tipo, setTipo] = useState(
    ingreso.tipo ?? "sueldo",
  );

  const [subtipo, setSubtipo] = useState(
    ingreso.subtipo ?? "",
  );

  // Documento histórico sin `fecha`: se inicializa con `createdAt`; al
  // guardar queda con `fecha` (upgrade perezoso, sin backfill).
  const [fechaISO, setFechaISO] = useState(() =>
    isoDeFecha(ingreso.fecha ?? ingreso.createdAt),
  );

  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const detalleRequired =
    tipo === "freelance" || tipo === "otros";

  const canSave =
    monto &&
    fechaISO &&
    tipo &&
    (tipo !== "banda" || subtipo) &&
    (!detalleRequired || detalle.trim());

  async function handleSave() {
    if (!canSave) return;

    setLoading(true);

    try {
      await onSave({
        monto: Number(monto),

        fecha: Timestamp.fromDate(
          fechaLocal(fechaISO),
        ),

        detalle: detalle.trim() || null,

        tipo,

        subtipo:
          tipo === "banda" ? subtipo : null,
      });

      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);

    try {
      await onDelete(ingreso.id);

      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] rounded-t-[28px] bg-[rgba(18,14,28,0.97)] border-t border-border px-5 pt-5 pb-[120px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[4px] w-[40px] rounded-full bg-[rgba(255,255,255,0.15)]" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sora text-[17px] font-bold text-text">
            Editar ingreso
          </h2>

          <button
            onClick={() => setConfirmDelete(true)}
            className="text-[12px] text-[var(--negative)] border border-[rgba(255,100,100,0.25)] rounded-full px-3 py-[4px]"
          >
            🗑 Eliminar
          </button>
        </div>

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="mb-4 rounded-[14px] border border-[rgba(255,100,100,0.3)] bg-[rgba(255,100,100,0.08)] px-4 py-3">
            <p className="text-[13px] text-text mb-3">
              ¿Seguro que querés eliminar este ingreso?
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 rounded-[12px] bg-[rgba(255,100,100,0.2)] border border-[rgba(255,100,100,0.3)] py-[10px] text-[13px] font-semibold text-[var(--negative)]"
              >
                Sí, eliminar
              </button>

              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-[12px] border border-border bg-white/3 py-[10px] text-[13px] text-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* MONTO */}
          <div>
            <SectionLabel>Monto ($)</SectionLabel>

            <div className="relative overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4">
              <div className="flex items-center gap-1">
                <span className="font-sora text-[22px] font-bold text-accent-light">
                  $
                </span>

                <input
                  type="number"
                  value={monto}
                  onChange={(e) =>
                    setMonto(e.target.value)
                  }
                  className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>

          {/* FECHA DEL INGRESO (4.5-fecha) */}
          <div>
            <SectionLabel>
              Fecha del ingreso
            </SectionLabel>

            <input
              type="date"
              max={hoyISO()}
              value={fechaISO}
              onChange={(e) =>
                setFechaISO(e.target.value)
              }
            />

            <p className="mt-1 text-[11px] text-text-muted">
              Define en qué mes cuenta este ingreso.
            </p>
          </div>

          {/* DETALLE */}
          <div>
            <SectionLabel>
              {detalleRequired
                ? "Detalle (requerido)"
                : "Detalle (opcional)"}
            </SectionLabel>

            <input
              type="text"
              placeholder="Ej: Sueldo octubre..."
              value={detalle}
              onChange={(e) =>
                setDetalle(e.target.value)
              }
            />
          </div>

          {/* TIPO */}
          <div>
            <SectionLabel>Tipo de ingreso</SectionLabel>

            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTipo(t.id);

                    if (t.id !== "banda") {
                      setSubtipo("");
                    }
                  }}
                  className={`rounded-[12px] border px-3 py-[10px] text-left text-[13px] transition-all ${
                    tipo === t.id
                      ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* BANDA */}
          {tipo === "banda" && (
            <div>
              <SectionLabel>Banda</SectionLabel>

              <div className="flex flex-col gap-2">
                {BANDAS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      setSubtipo(b.id)
                    }
                    className={`w-full rounded-[14px] border px-4 py-[13px] text-left text-[14px] transition-all ${
                      subtipo === b.id
                        ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                        : "border-border bg-white/3 text-text"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SUBMIT */}
          <button
            onClick={handleSave}
            disabled={loading || !canSave}
            className={`w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
              !canSave || loading
                ? "bg-accent/30 cursor-default"
                : "bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] cursor-pointer"
            }`}
          >
            {loading
              ? "Guardando..."
              : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
