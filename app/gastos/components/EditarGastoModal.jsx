"use client";

import { useState } from "react";
import { CATEGORIAS, CONTEXTOS } from "@/lib/taxonomia";
import SectionLabel from "@/app/components/ui/SectionLabel";
import { useGroups } from "@/lib/GroupContext";

export default function EditarGastoModal({ gasto, onClose, onSave, onDelete }) {
  const { groups, loadingGroups } = useGroups();

  const [monto, setMonto] = useState(String(gasto.monto ?? ""));
  const [detalle, setDetalle] = useState(gasto.detalle ?? "");
  const [catId, setCatId] = useState(gasto.categoria ?? "");
  const [tipo, setTipo] = useState(gasto.tipo ?? "personal");
  const [selectedGroupId, setSelectedGroupId] = useState(gasto.groupId ?? "");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = monto && (tipo !== "compartido" || selectedGroupId);

  async function handleSave() {
    if (!canSave) return;
    setLoading(true);
    try {
      await onSave({
        monto: Number(monto),
        detalle: detalle.trim() || null,
        categoria: catId || null,
        tipo,
        groupId: tipo === "compartido" ? selectedGroupId : null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await onDelete(gasto.id);
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
            Editar gasto
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
            <p className="text-[13px] text-text mb-3">¿Seguro que querés eliminar este gasto?</p>
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
          {/* PRODUCTO */}
          <div>
            <SectionLabel>Producto</SectionLabel>
            <div className="rounded-[14px] border border-border bg-white/3 px-4 py-3">
              <p className="text-[14px] text-text-muted">{gasto.producto}</p>
            </div>
          </div>

          {/* MONTO */}
          <div>
            <SectionLabel>Monto ($)</SectionLabel>
            <div className="relative overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4">
              <div className="flex items-center gap-1">
                <span className="font-sora text-[22px] font-bold text-accent-light">$</span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>

          {/* DETALLE */}
          <div>
            <SectionLabel>Detalle (opcional)</SectionLabel>
            <input
              type="text"
              placeholder="Ej: Marca, variedad..."
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
            />
          </div>

          {/* CATEGORÍA */}
          <div>
            <SectionLabel>Categoría</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORIAS).map(([id, cat]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCatId(id)}
                  className={`rounded-[12px] border px-3 py-[10px] text-left text-[13px] transition-all ${
                    catId === id
                      ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* TIPO */}
          <div>
            <SectionLabel>Tipo de gasto</SectionLabel>
            <div className="flex gap-2">
              {[{ id: "personal", label: "Personal" }, { id: "compartido", label: "Compartido" }].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={`flex-1 rounded-[14px] border px-[13px] py-[13px] text-[14px] transition-all ${
                    tipo === t.id
                      ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                      : "border-border bg-white/3 text-text-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* GRUPO */}
          {tipo === "compartido" && (
            <div>
              <SectionLabel>Grupo</SectionLabel>
              {loadingGroups ? (
                <p className="text-[13px] text-text-muted">Cargando...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`w-full rounded-[14px] border px-4 py-[13px] text-left text-[14px] transition-all ${
                        selectedGroupId === g.id
                          ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                          : "border-border bg-white/3 text-text"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
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
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}