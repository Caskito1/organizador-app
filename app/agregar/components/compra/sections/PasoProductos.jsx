export default function PasoProductos({
  subcats,
  subcatId,
  setSubcatId,
  carrito,
  productosActivos,
  toggleProducto,
  setPaso,
  totalItems,
}) {
  return (
   <div className="flex flex-col gap-4">
      {Object.keys(subcats).length >
        1 && (
        <div className="flex gap-2 overflow-x-auto pb-[2px]">
          {Object.entries(
            subcats,
          ).map(([id, sub]) => (
            <button
              key={id}
              onClick={() =>
                setSubcatId(id)
              }
              className={`flex-shrink-0 px-4 py-[7px] rounded-full border text-[13px] cursor-pointer whitespace-nowrap transition-all ${subcatId === id ? "border-[rgba(138,100,255,0.55)] bg-[rgba(138,100,255,0.18)] text-[var(--accent-light)]" : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"}`}>
              {sub.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {productosActivos.map((p) => {
          const inCart =
            !!carrito[p.id];

          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                toggleProducto(p)
              }
              className={`w-full px-[14px] py-[13px] rounded-[13px] text-left border text-[13px] cursor-pointer flex items-center justify-between transition-all font-body 
                ${inCart ? (p.esOtros 
              ? "border-[rgba(94,224,197,0.5)] bg-[rgba(94,224,197,0.12)] text-[var(--user-b)]" 
              : "border-[rgba(138,100,255,0.55)] bg-[rgba(138,100,255,0.18)] text-[var(--accent-light)]") 
              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"}`}>
              <span>{p.nombre}</span>

              <span>
                {inCart
                  ? "✓"
                  : "+"}
              </span>
            </button>
          );
        })}
      </div>

     {totalItems > 0 && (
  <button
    onClick={() =>
      setPaso("resumen")
    }
    className="w-full mt-1 py-[14px] rounded-[16px] text-white text-[15px] font-bold font-display cursor-pointer bg-gradient-to-r from-[#9d7bff] to-[#5b35d5] shadow-[0_4px_24px_rgba(138,100,255,0.45)] transition-all active:scale-[0.99] hover:opacity-95">
    Continuar con {totalItems} producto
    {totalItems !== 1 ? "s" : ""}
  </button>
)}
    </div>
  );
}