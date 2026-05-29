"use client";

import { CATEGORIAS } from "@/lib/taxonomia";

import useModoCompra from "./compra/hooks/useModoCompra";

import PasoContexto from "./compra/sections/PasoContexto";
import PasoCategoria from "./compra/sections/PasoCategoria";
import PasoProductos from "./compra/sections/PasoProductos";
import PasoResumen from "./compra/sections/PasoResumen";
import BackBtn from "@/app/components/ui/BackBtn";
import StepBar from "@/app/components/ui/StepBar";

export default function ModoCompra({ onBack }) {
  const {
    // state
    paso,
    contexto,
    catId,
    subcatId,
    carrito,
    tipo,
    selectedGroupId,
    loading,
    groups,
    loadingGroups,

    // derived
    subcats,
    productosActivos,
    totalItems,
    totalGeneral,
    pasoIdx,
    canFinish,
    titulos,

    // actions
    setPaso,
    setSubcatId,
    setTipo,
    setSelectedGroupId,

    toggleProducto,
    updateItem,
    removeItem,

    seleccionarContexto,
    seleccionarCategoria,
    volverPaso,

    handleSubmit,
  } = useModoCompra({ onBack });

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 pt-14 pb-4">
        <BackBtn onClick={volverPaso} />

        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[18px] font-bold text-[var(--text)] tracking-[-0.4px]">
            {titulos[paso]}
          </h1>

          {contexto && (
            <p className="text-[11px] text-[var(--text-muted)] mt-[3px]">
              {[contexto.label, catId && CATEGORIAS[catId]?.label]
                .filter(Boolean)
                .join(" › ")}
            </p>
          )}
        </div>

        {totalItems > 0 && paso !== "resumen" && (
          <button
            onClick={() => setPaso("resumen")}
            className="flex items-center gap-[6px] px-[13px] py-[7px] rounded-full border border-[rgba(138,100,255,0.4)] bg-[rgba(138,100,255,0.15)] text-[var(--accent-light)] text-[13px] font-semibold font-body cursor-pointer flex-shrink-0"
          >
            <span className="bg-[var(--accent)] text-white rounded-full w-[18px] h-[18px] inline-flex items-center justify-center text-[11px] font-bold">
              {totalItems}
            </span>
            Ver
          </button>
        )}
      </div>

      <StepBar current={pasoIdx + 1} total={4} />

      {/* CONTEXTO */}
      {paso === "contexto" && (
        <PasoContexto
          contexto={contexto}
          seleccionarContexto={seleccionarContexto}
        />
      )}

      {/* CATEGORIA */}
      {paso === "categoria" && (
        <PasoCategoria
          catId={catId}
          seleccionarCategoria={seleccionarCategoria}
        />
      )}

      {/* PRODUCTOS */}
      {paso === "productos" && (
        <PasoProductos
          subcats={subcats}
          subcatId={subcatId}
          setSubcatId={setSubcatId}
          carrito={carrito}
          productosActivos={productosActivos}
          toggleProducto={toggleProducto}
          totalItems={totalItems}
          setPaso={setPaso}
        />
      )}

      {/* RESUMEN */}
      {paso === "resumen" && (
        <PasoResumen
          carrito={carrito}
          removeItem={removeItem}
          updateItem={updateItem}
          setPaso={setPaso}
          totalGeneral={totalGeneral}
          tipo={tipo}
          setTipo={setTipo}
          groups={groups}
          loadingGroups={loadingGroups}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          handleSubmit={handleSubmit}
          loading={loading}
          canFinish={canFinish}
          totalItems={totalItems}
        />
      )}
    </>
  );
}
