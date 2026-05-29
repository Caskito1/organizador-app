import { useState, useMemo } from "react";

import {
  CONTEXTOS,
  CATEGORIAS,
} from "@/lib/taxonomia";

export function useModoUnico() {
  const PASOS_U = [
    "contexto",
    "categoria",
    "subcategoria",
    "producto",
    "detalle",
  ];

  const [paso, setPaso] = useState("contexto");
  const [contexto, setContexto] = useState(null);
  const [catId, setCatId] = useState(null);
  const [subcatId, setSubcatId] = useState(null);
  const [producto, setProducto] = useState(null);
  const [esOtros, setEsOtros] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [tipo, setTipo] = useState("personal");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const subcats = useMemo(() => {
    if (!catId) return {};

    return CATEGORIAS[catId]?.subcategorias ?? {};
  }, [catId]);

  const productosBase = useMemo(() => {
    if (!catId || !subcatId) return [];

    return (
      CATEGORIAS[catId]?.subcategorias[subcatId]
        ?.productos ?? []
    );
  }, [catId, subcatId]);

  const productosConOtros = useMemo(() => {
    return [
      ...productosBase,
      {
        id: "__otros__",
        nombre: "Otros",
        unidad: "u",
        esOtros: true,
      },
    ];
  }, [productosBase]);

  const unidadActual = esOtros
    ? "u"
    : producto?.unidad ?? "u";

  function seleccionarContexto(c) {
    setContexto(c);

    setPaso("categoria");
  }

  function seleccionarCategoria(id) {
    setCatId(id);
    setSubcatId(null);
    setProducto(null);
    setEsOtros(false);

    const subkeys = Object.keys(
      CATEGORIAS[id]?.subcategorias ?? {},
    );

    if (subkeys.length === 1) {
      setSubcatId(subkeys[0]);

      setPaso("producto");
    } else {
      setPaso("subcategoria");
    }
  }

  function seleccionarSubcat(id) {
    setSubcatId(id);

    setProducto(null);

    setEsOtros(false);

    setPaso("producto");
  }

  function seleccionarProducto(p) {
    if (p.esOtros) {
      setProducto(null);

      setEsOtros(true);
    } else {
      setProducto(p);

      setEsOtros(false);
    }

    setDetalle("");

    setPaso("detalle");
  }

  return {
    PASOS_U,

    paso,
    setPaso,

    contexto,
    setContexto,

    catId,
    setCatId,

    subcatId,
    setSubcatId,

    producto,
    setProducto,

    esOtros,
    setEsOtros,

    cantidad,
    setCantidad,

    monto,
    setMonto,

    detalle,
    setDetalle,

    tipo,
    setTipo,

    selectedGroupId,
    setSelectedGroupId,

    subcats,

    productosConOtros,

    unidadActual,

    seleccionarContexto,

    seleccionarCategoria,

    seleccionarSubcat,

    seleccionarProducto,
  };
}