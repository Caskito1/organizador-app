import { useState, useMemo } from "react";

import { useRouter } from "next/navigation";

import { CATEGORIAS } from "@/lib/taxonomia";

import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";

import submitCompra from "../helpers/submitCompra";

export default function useModoCompra({ onBack }) {
  const router = useRouter();

  const { user } = useAuth();

  const { groups, loadingGroups } =
    useGroups();

  const PASOS_C = [
    "contexto",
    "categoria",
    "productos",
    "resumen",
  ];

  const [loading, setLoading] =
    useState(false);

  const [paso, setPaso] =
    useState("contexto");

  const [contexto, setContexto] =
    useState(null);

  const [catId, setCatId] =
    useState(null);

  const [subcatId, setSubcatId] =
    useState(null);

  const [carrito, setCarrito] =
    useState({});

  const [tipo, setTipo] =
    useState("personal");

  const [
    selectedGroupId,
    setSelectedGroupId,
  ] = useState("");

  const subcats = useMemo(() => {
    if (!catId) return {};

    return (
      CATEGORIAS[catId]
        ?.subcategorias ?? {}
    );
  }, [catId]);

  const productosActivos =
    useMemo(() => {
      if (!catId || !subcatId)
        return [];

      return [
        ...(CATEGORIAS[catId]
          ?.subcategorias[subcatId]
          ?.productos ?? []),

        {
          id: "__otros__",
          nombre: "Otros",
          unidad: "u",
          esOtros: true,
        },
      ];
    }, [catId, subcatId]);

  const totalItems =
    Object.keys(carrito).length;

  const totalGeneral =
    Object.values(carrito).reduce(
      (acc, it) =>
        acc +
        (Number(it.monto) || 0),
      0,
    );

  const pasoIdx =
    PASOS_C.indexOf(paso);

  const canFinish =
    totalItems > 0 &&
    Object.values(carrito).every(
      (it) =>
        it.monto &&
        (!it.esOtros ||
          it.detalle?.trim()),
    ) &&
    (tipo !== "compartido" ||
      selectedGroupId);

  const titulos = {
    contexto: "¿Dónde fue?",
    categoria: "¿Qué categoría?",
    productos: "¿Qué productos?",
    resumen: "Resumen de compra",
  };

  function seleccionarContexto(c) {
    setContexto(c);

    setPaso("categoria");
  }

  function seleccionarCategoria(id) {
    setCatId(id);

    const subkeys = Object.keys(
      CATEGORIAS[id]
        ?.subcategorias ?? {},
    );

    setSubcatId(subkeys[0] ?? null);

    setPaso("productos");
  }

  function toggleProducto(p) {
    const key = p.id;

    setCarrito((prev) => {
      if (prev[key]) {
        const next = { ...prev };

        delete next[key];

        return next;
      }

      return {
        ...prev,

        [key]: {
          productoId: p.id,
          nombre: p.nombre,
          unidad: p.unidad ?? "u",
          catId,
          subcatId,
          contextoId: contexto?.id,
          esOtros: p.esOtros ?? false,
          cantidad: "",
          monto: "",
          detalle: "",
        },
      };
    });
  }

  function updateItem(
    key,
    field,
    value,
  ) {
    setCarrito((prev) => ({
      ...prev,

      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  }

  function removeItem(key) {
    setCarrito((prev) => {
      const next = { ...prev };

      delete next[key];

      return next;
    });
  }

  function volverPaso() {
    if (paso === "resumen") {
      return setPaso("productos");
    }

    if (paso === "productos") {
      return setPaso("categoria");
    }

    if (paso === "categoria") {
      return setPaso("contexto");
    }

    onBack();
  }

  async function handleSubmit() {
  try {
    setLoading(true);

    await submitCompra({
      carrito,
      user,
      tipo,
      selectedGroupId,
    });

    router.push("/gastos");
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}

  return {
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

    // setters
    setPaso,
    setSubcatId,
    setTipo,
    setSelectedGroupId,

    // actions
    toggleProducto,
    updateItem,
    removeItem,

    seleccionarContexto,
    seleccionarCategoria,
    volverPaso,

    handleSubmit,
  };
}