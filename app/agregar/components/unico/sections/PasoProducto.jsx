export default function PasoProducto({
  productosConOtros,
  producto,
  esOtros,
  seleccionarProducto,
}) {
  const isSelected = (p) =>
    p.esOtros ? esOtros : producto?.id === p.id;

  return (
    <div className="grid grid-cols-2 gap-2">
      {productosConOtros.map((p) => {
        const active = isSelected(p);

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => seleccionarProducto(p)}
            className={`
              w-full px-[14px] py-[11px]
              rounded-[13px] text-left
              border backdrop-blur-[12px]
              flex items-center justify-between
              text-[13px] font-normal
              transition-all duration-150
              font-body cursor-pointer

              ${
                active
                  ? p.esOtros
                    ? "border-[rgba(94,224,197,0.5)] bg-[rgba(94,224,197,0.12)] text-[var(--user-b)] font-semibold"
                    : "border-[rgba(138,100,255,0.55)] bg-[rgba(138,100,255,0.18)] text-[var(--accent-light)] font-semibold"
                  : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"
              }
            `}
          >
            <span>{p.nombre}</span>

            {p.esOtros && (
              <span className="text-[10px] opacity-60">+detalle</span>
            )}
          </button>
        );
      })}
    </div>
  );
}