export function toggleProducto({
  producto,
  carrito,
  setCarrito,
  catId,
  subcatId,
  contexto,
}) {
  const key = producto.id;

  setCarrito((prev) => {
    if (prev[key]) {
      const next = { ...prev };

      delete next[key];

      return next;
    }

    return {
      ...prev,

      [key]: {
        productoId: producto.id,

        nombre: producto.nombre,

        unidad: producto.unidad ?? "u",

        catId,

        subcatId,

        contextoId: contexto?.id,

        esOtros:
          producto.esOtros ?? false,

        cantidad: "",

        monto: "",

        detalle: "",
      },
    };
  });
}

export function updateItem({
  key,
  field,
  value,
  setCarrito,
}) {
  setCarrito((prev) => ({
    ...prev,

    [key]: {
      ...prev[key],

      [field]: value,
    },
  }));
}

export function removeItem({
  key,
  setCarrito,
}) {
  setCarrito((prev) => {
    const next = { ...prev };

    delete next[key];

    return next;
  });
}