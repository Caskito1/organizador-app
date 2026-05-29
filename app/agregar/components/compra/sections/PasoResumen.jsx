"use client";

import { CATEGORIAS, UNIDADES } from "@/lib/taxonomia";
import SectionLabel from "@/app/components/ui/SectionLabel";


export default function PasoResumen({
  carrito,
  removeItem,
  updateItem,
  setPaso,
  totalGeneral,
  tipo,
  setTipo,
  groups,
  loadingGroups,
  selectedGroupId,
  setSelectedGroupId,
  handleSubmit,
  loading,
  canFinish,
  totalItems,
}) {
  return (
    <div className="flex flex-col gap-4">

      {/* ITEMS */}
      <div className="flex flex-col gap-2">
        {Object.entries(carrito).map(([key, it]) => (
          <div
            key={key}
            className="bg-[rgba(138,100,255,0.07)] backdrop-blur-[16px] border border-[var(--border)] rounded-[18px] p-[14px_16px] flex flex-col gap-2"
          >

            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[var(--text)] font-display">
                  {it.esOtros ? it.detalle || "Otros" : it.nombre}
                </p>

                <p className="text-[11px] text-[var(--text-muted)] mt-[2px]">
                  {CATEGORIAS[it.catId]?.label}
                  {it.subcatId
                    ? ` · ${CATEGORIAS[it.catId]?.subcategorias[it.subcatId]?.label}`
                    : ""}
                </p>
              </div>

              <button
                onClick={() => removeItem(key)}
                className="w-[28px] h-[28px] rounded-[8px] bg-[rgba(255,123,156,0.12)] border border-[rgba(255,123,156,0.2)] text-[var(--negative)] flex items-center justify-center cursor-pointer text-[14px] flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* OTROS */}
            {it.esOtros && (
              <div>
                <SectionLabel>¿Qué es? (requerido)</SectionLabel>
                <input
                  type="text"
                  placeholder="Ej: Papel higiénico..."
                  value={it.detalle}
                  onChange={(e) => updateItem(key, "detalle", e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-[var(--text)] rounded-[14px] px-4 py-3 outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(138,100,255,0.35)]"
                />
              </div>
            )}

            {/* CANTIDAD + MONTO */}
            <div className="flex gap-2">

              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--text-muted)] mb-[6px]">
                  Cant. ({UNIDADES[it.unidad]?.label ?? it.unidad})
                </p>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={it.cantidad}
                    onChange={(e) => updateItem(key, "cantidad", e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-[var(--text)] rounded-[14px] px-4 py-3 pr-[42px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(138,100,255,0.35)] text-[14px]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--accent2)]">
                    {UNIDADES[it.unidad]?.label ?? it.unidad}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--text-muted)] mb-[6px]">
                  Monto ($)
                </p>

                <div className="relative">
                  <input
                    type="number"
                    value={it.monto}
                    onChange={(e) => updateItem(key, "monto", e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-[var(--text)] rounded-[14px] px-4 py-3 pl-[28px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(138,100,255,0.35)] text-[14px]"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[var(--accent-light)]">
                    $
                  </span>
                </div>
              </div>

            </div>

            {/* DETALLE */}
            {!it.esOtros && (
              <input
                type="text"
                placeholder="Detalle opcional (marca, variedad...)"
                value={it.detalle}
                onChange={(e) => updateItem(key, "detalle", e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-[var(--text)] rounded-[14px] px-4 py-3 outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(138,100,255,0.35)] text-[13px]"
              />
            )}
          </div>
        ))}
      </div>

      {/* AGREGAR */}
      <button
        onClick={() => setPaso("productos")}
        className="w-full p-[13px] rounded-[14px] border border-dashed border-[rgba(138,100,255,0.35)] bg-[rgba(138,100,255,0.05)] text-[var(--accent2)] text-[14px] font-body cursor-pointer"
      >
        + Agregar más productos
      </button>

      {/* TOTAL */}
      {totalGeneral > 0 && (
        <div className="bg-gradient-to-br from-[rgba(138,100,255,0.15)] to-[rgba(91,53,213,0.18)] backdrop-blur-[20px] border border-[rgba(138,100,255,0.28)] rounded-[18px] p-[16px_20px] flex justify-between items-center">
          <span className="text-[13px] text-[var(--text-muted)]">
            Total de la compra
          </span>
          <span className="text-[22px] font-bold text-[var(--accent-light)] tracking-[-0.5px]">
            ${totalGeneral.toLocaleString("es-AR")}
          </span>
        </div>
      )}

      {/* TIPO */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Tipo de gasto</SectionLabel>

        <div className="flex gap-2">
          {[
            { id: "personal", label: "Personal" },
            { id: "compartido", label: "Compartido" },
          ].map((t) => {
            const active = tipo === t.id;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                className={`flex-1 p-[13px] rounded-[14px] border text-[14px] cursor-pointer font-body transition-all ${
                  active
                    ? "border-[rgba(138,100,255,0.55)] bg-[rgba(138,100,255,0.18)] text-[var(--accent-light)] font-semibold shadow-[0_0_14px_rgba(138,100,255,0.2)]"
                    : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* GRUPOS */}
      {tipo === "compartido" && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Grupo</SectionLabel>

          {loadingGroups ? (
            <p className="text-[13px] text-[var(--text-muted)]">Cargando...</p>
          ) : (
            groups.map((g) => {
              const active = selectedGroupId === g.id;

              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full p-[13px_16px] rounded-[14px] text-left border text-[14px] font-body transition-all ${
                    active
                      ? "border-[rgba(138,100,255,0.55)] bg-[rgba(138,100,255,0.18)] text-[var(--accent-light)] font-semibold shadow-[0_0_14px_rgba(138,100,255,0.2)]"
                      : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--text)]"
                  }`}
                >
                  {g.name}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* SUBMIT */}
      <button
        onClick={handleSubmit}
        disabled={loading || !canFinish}
        className={`w-full p-[15px] rounded-[16px] text-white text-[15px] font-bold font-display transition-all ${
          !canFinish || loading
            ? "bg-[rgba(138,100,255,0.3)] cursor-default"
            : "bg-gradient-to-r from-[#9d7bff] to-[#5b35d5] cursor-pointer shadow-[0_4px_24px_rgba(138,100,255,0.45)]"
        }`}
      >
        {loading
          ? "Guardando..."
          : `Guardar ${totalItems} gasto${totalItems !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}