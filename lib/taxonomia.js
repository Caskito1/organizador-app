// taxonomia.js
// Archivo de configuración local — no se guarda en Firestore.
// Para agregar/editar productos base, editá directamente este archivo.
// Los productos custom del usuario se guardan en Firestore y se mergean en runtime.

// Nota: cada subcategoría incluye automáticamente un producto "otros" al final
// (lo agrega el componente agregar.jsx, no está hardcodeado acá)

export const CONTEXTOS = [
  { id: "hogar", label: "Hogar" },
  { id: "toques", label: "Toques" },
  { id: "ensayos", label: "Ensayos" },
  { id: "salidas", label: "Salidas" },
  { id: "oficina", label: "Oficina" },
  { id: "otros", label: "Otros" },
];

// SVG icons por contexto (inline, para usar en JSX)
export const CONTEXTO_ICONS = {
  hogar: "home",
  toques: "music",
  ensayos: "guitar",
  salidas: "beer",
  oficina: "briefcase",
  otros: "more",
};

export const UNIDADES = {
  kg: { label: "kg", tipo: "peso" },
  g: { label: "g", tipo: "peso" },
  l: { label: "L", tipo: "volumen" },
  ml: { label: "ml", tipo: "volumen" },
  u: { label: "u", tipo: "unidad" },
  paq: { label: "paq", tipo: "paquete" },
  caja: { label: "caja", tipo: "paquete" },
  docena: { label: "doc", tipo: "unidad" },
  maple: { label: "maple", tipo: "unidad" },
  rollo: { label: "rollo", tipo: "unidad" },
  mes: { label: "mes", tipo: "tiempo" },
};

export const CATEGORIAS = {
  alimentos: {
    label: "Alimentos",
    icon: "leaf",
    subcategorias: {
      surtido: {
        label: "Surtido",
        productos: [
          { id: "harina_0", nombre: "Harina 0", unidad: "kg" },
          { id: "harina_000", nombre: "Harina 000", unidad: "kg" },
          { id: "harina_integral", nombre: "Harina Integral", unidad: "kg" },
          { id: "levadura", nombre: "Levadura", unidad: "g" },
          { id: "azucar", nombre: "Azúcar", unidad: "kg" },
          { id: "azucar_imp", nombre: "Azúcar Impalpable", unidad: "kg" },
          { id: "sal", nombre: "Sal", unidad: "kg" },
          { id: "aceite", nombre: "Aceite", unidad: "l" },
          { id: "miel", nombre: "Miel", unidad: "kg" },
          { id: "dulce_leche", nombre: "Dulce de Leche", unidad: "kg" },
          { id: "pan_rallado", nombre: "Pan Rallado", unidad: "kg" },
          { id: "condimentos", nombre: "Condimentos", unidad: "u" },
          { id: "leche", nombre: "Leche", unidad: "l" },
          { id: "cafe", nombre: "Café", unidad: "kg" },
          { id: "cocoa", nombre: "Cocoa", unidad: "kg" },
          { id: "te", nombre: "Té", unidad: "paq" },
          { id: "queso_rayado", nombre: "Queso Rallado", unidad: "kg" },
          { id: "chocolate", nombre: "Chocolate", unidad: "kg" },
          { id: "cobertura", nombre: "Cobertura", unidad: "kg" },
          { id: "huevos", nombre: "Huevos", unidad: "maple" },
          { id: "granola", nombre: "Granola", unidad: "kg" },
          { id: "yerba", nombre: "Yerba", unidad: "kg" },
          { id: "lentejas", nombre: "Lentejas", unidad: "kg" },
          { id: "garbanzos", nombre: "Garbanzos", unidad: "kg" },
          { id: "royal", nombre: "Royal", unidad: "u" },
          { id: "salsa_tomate", nombre: "Salsa de Tomate", unidad: "u" },
          { id: "manteca", nombre: "Manteca", unidad: "u" },
          { id: "pasta", nombre: "Pasta", unidad: "kg" },
          { id: "arroz", nombre: "Arroz", unidad: "kg" },
          { id: "monas", nombre: "Moñas", unidad: "kg" },
        ],
      },
      verduleria: {
        label: "Verdulería",
        productos: [
          { id: "frutas_verduras", nombre: "Frutas y Verduras", unidad: "u" },
        ],
      },
      carniceria: {
        label: "Carnicería",
        productos: [
          { id: "carne_picada", nombre: "Carne Picada", unidad: "kg" },
          { id: "carne", nombre: "Carne", unidad: "kg" },
        ],
      },
      polleria: {
        label: "Pollería",
        productos: [
          { id: "supremas", nombre: "Supremas", unidad: "kg" },
          { id: "milanesas", nombre: "Milanesas", unidad: "kg" },
        ],
      },
      fiambreria: {
        label: "Fiambrería",
        productos: [
          { id: "jamon", nombre: "Jamón", unidad: "g" },
          { id: "queso_muzza", nombre: "Queso Muzza", unidad: "g" },
          { id: "queso_dambo", nombre: "Queso Dambo", unidad: "g" },
          { id: "queso_sandwich", nombre: "Queso Sandwich", unidad: "g" },
          { id: "panceta", nombre: "Panceta", unidad: "g" },
          { id: "salame", nombre: "Salame", unidad: "g" },
          { id: "provolone", nombre: "Queso Provolone", unidad: "g" },
        ],
      },
      panaderia: {
        label: "Panadería",
        productos: [
          { id: "tortugas", nombre: "Tortugas", unidad: "u" },
          { id: "biscochos", nombre: "Biscochos", unidad: "u" },
          { id: "pan", nombre: "Pan", unidad: "u" },
        ],
      },
      rotiseria: {
  label: "Rotisería",
  productos: [
    {
      id: "rotiseria",
      nombre: "Rotisería",
      unidad: "u",
    },
  ],
},
      congelados: {
        label: "Congelados",
        productos: [
          { id: "papas_fritas_c", nombre: "Papas Fritas", unidad: "kg" },
        ],
      },
      snacks: {
        label: "Snacks",
        productos: [
          { id: "papas_fritas_s", nombre: "Papas Fritas", unidad: "paq" },
          { id: "mani", nombre: "Maní", unidad: "paq" },
          { id: "mani_choco", nombre: "Maní con Chocolate", unidad: "paq" },
          { id: "chocolate_s", nombre: "Chocolate", unidad: "u" },
        ],
      },
      
    },
  },

  bebidas: {
    label: "Bebidas",
    icon: "cup",
    subcategorias: {
      refrescos: {
        label: "Refrescos",
        productos: [
          { id: "coca_cola", nombre: "Coca Cola", unidad: "l" },
          { id: "guarana", nombre: "Guaraná", unidad: "l" },
        ],
      },
      alcohol: {
        label: "Alcohol",
        productos: [
          { id: "cerveza", nombre: "Cerveza", unidad: "u" },
          { id: "whisky", nombre: "Whisky", unidad: "l" },
          { id: "vino", nombre: "Vino", unidad: "l" },
        ],
      },
      agua: {
        label: "Agua",
        productos: [{ id: "agua", nombre: "Agua", unidad: "l" }],
      },
    },
  },

  transporte: {
    label: "Transporte",
    icon: "car",
    subcategorias: {
      transporte: {
        label: "Transporte",
        productos: [
          { id: "taxi", nombre: "Taxi", unidad: "u" },
          { id: "uber", nombre: "Uber", unidad: "u" },
          { id: "bondi", nombre: "Bondi", unidad: "u" },
          { id: "combustible", nombre: "Combustible", unidad: "l" },
        ],
      },
    },
  },

  limpieza: {
    label: "Limpieza",
    icon: "sparkles",
    subcategorias: {
      limpieza: {
        label: "Limpieza",
        productos: [
        { id: "jane",                  nombre: "Jane",                  unidad: "l"  },
        { id: "fabuloso",              nombre: "Fabuloso",              unidad: "l"  },
        { id: "aerosol",               nombre: "Aerosol",               unidad: "u"  },
        { id: "trapos_piso",           nombre: "Trapos de Piso",        unidad: "u"  },
        { id: "franelas",              nombre: "Franelas",              unidad: "u"  },
        { id: "blem",                  nombre: "Blem",                  unidad: "u"  },
        { id: "cera",                  nombre: "Cera",                  unidad: "u"  },
        { id: "detergente",            nombre: "Detergente",            unidad: "l"  },
        { id: "jabon_ropa",            nombre: "Jabón Ropa",            unidad: "kg" },
        { id: "suavizante",            nombre: "Suavizante",            unidad: "l"  },
        { id: "esponja",               nombre: "Esponja",               unidad: "u"  },
        { id: "esponja_aluminio",      nombre: "Esponja de Aluminio",   unidad: "u"  },
        { id: "cepillo_limpieza",      nombre: "Cepillo",               unidad: "u"  },
        { id: "bolsa_basura_bano",     nombre: "Bolsa Basura Baño",     unidad: "paq"},
        { id: "bolsa_basura_cocina",   nombre: "Bolsa Basura Cocina",   unidad: "paq"},
        { id: "limpia_vidrios",        nombre: "Limpia Vidrios",        unidad: "u"  },
        { id: "cif",                   nombre: "CIF",                   unidad: "u"  },
        ],
      },
    },
  },
  cocina: {
    label: "Cocina",
    icon: "chef",
    subcategorias: {
      cocina: {
        label: "Cocina",
        productos: [
          {
            id: "papel_film",
            nombre: "Papel Film",
            unidad: "u",
          },
          {
            id: "papel_cocina",
            nombre: "Papel Cocina",
            unidad: "u",
          },
          {
            id: "papel_manteca",
            nombre: "Papel Manteca",
            unidad: "u",
          },
        ],
      },
    },
  },
  higiene: {
    label: "Higiene",
    icon: "droplet",
    subcategorias: {
      higiene: {
        label: "Higiene Personal",
        productos: [
          { id: "jabon_mano", nombre: "Jabón de Mano", unidad: "u" },
          { id: "shampoo", nombre: "Shampoo", unidad: "u" },
          { id: "pasta_dientes", nombre: "Pasta de Dientes", unidad: "u" },
          { id: "desodorante", nombre: "Desodorante", unidad: "u" },
          { id: "acondicionador", nombre: "Acondicionador", unidad: "u" },
          { id: "cepillo_dientes", nombre: "Cepillo de Dientes", unidad: "u" },
          { id: "forros", nombre: "Forros", unidad: "u" },
          { id: "gel", nombre: "Gel", unidad: "u" },
          {
            id: "gillette",
            nombre: "Gillette",
            unidad: "u",
          },
          {
            id: "crema_hidratante",
            nombre: "Crema Hidratante",
            unidad: "u",
          },
          {
            id: "papel_higienico",
            nombre: "Papel Higiénico",
            unidad: "paq",
          },
          {
            id: "toallitas",
            nombre: "Toallitas",
            unidad: "paq",
          },
          {
            id: "tampones",
            nombre: "Tampones",
            unidad: "paq",
          },
          {
            id: "repelente",
            nombre: "Repelente",
            unidad: "u",
          },
        ],
      },
    },
  },
gastronomia: {
  label: "Gastronomía",
  icon: "utensils",
  subcategorias: {
    gastronomia: {
      label: "Gastronomía",
      productos: [
        {
          id: "restaurante",
          nombre: "Restaurante",
          unidad: "u",
        },

        {
          id: "bar",
          nombre: "Bar",
          unidad: "u",
        },

        {
          id: "delivery",
          nombre: "Delivery",
          unidad: "u",
        },
      ],
    },
  },
},
  suscripciones: {
    label: "Suscripciones",
    icon: "star",
    subcategorias: {
      suscripciones: {
        label: "Suscripciones",
        productos: [
          { id: "disney", nombre: "Disney+", unidad: "mes" },
          { id: "socio_peniarol", nombre: "Socio Peñarol", unidad: "mes" },
        ],
      },
    },
  },

  servicios: {
    label: "Servicios",
    icon: "zap",
    subcategorias: {
      servicios: {
        label: "Servicios del Hogar",
        productos: [
          { id: "luz", nombre: "Luz", unidad: "mes" },
          { id: "internet", nombre: "Internet", unidad: "mes" },
          { id: "gastos_comunes", nombre: "Gastos Comunes", unidad: "mes" },
          { id: "tributos", nombre: "Tributos", unidad: "mes" },
          { id: "alquiler", nombre: "Alquiler", unidad: "mes" },
          { id: "celular", nombre: "Celular", unidad: "mes" },
          { id: "oca", nombre: "OCA", unidad: "mes" },
          {
            id: "fondo_solidaridad",
            nombre: "Fondo Solidaridad",
            unidad: "mes",
          },
        ],
      },
    },
  },

  finanzas: {
    label: "Finanzas",
    icon: "dollar",
    subcategorias: {
      finanzas: {
        label: "Finanzas",
        productos: [
          { id: "fondo_centenario", nombre: "Fondo Centenario", unidad: "u" },
          { id: "etf", nombre: "ETF", unidad: "u" },
          { id: "prex", nombre: "Prex", unidad: "u" },
          { id: "itau_dolares", nombre: "Itaú Dólares", unidad: "u" },
          { id: "transferencias", nombre: "Transferencias", unidad: "u" },
        ],
      },
    },
  },

  educacion: {
    label: "Educación",
    icon: "book",
    subcategorias: {
      educacion: {
        label: "Educación",
        productos: [
          { id: "clases", nombre: "Clases", unidad: "mes" },
          { id: "cursos", nombre: "Cursos", unidad: "u" },
        ],
      },
    },
  },

  elsita: {
    label: "Elsita",
    icon: "paw",
    subcategorias: {
      elsita: {
        label: "Elsita",
        productos: [
          { id: "comida_gato", nombre: "Comida", unidad: "kg" },
          { id: "arena_gato", nombre: "Arena", unidad: "kg" },
          { id: "juguetes_gato", nombre: "Juguetes", unidad: "u" },
          { id: "pastillas_gato", nombre: "Pastillas", unidad: "u" },
          { id: "snacks_gato", nombre: "Snacks", unidad: "u" },
        ],
      },
    },
  },

  compras: {
    label: "Compras",
    icon: "bag",
    subcategorias: {
      compras: {
        label: "Compras",
        productos: [
          { id: "ropa", nombre: "Ropa", unidad: "u" },
          { id: "calzado", nombre: "Calzado", unidad: "u" },
          { id: "electronica", nombre: "Electrónica", unidad: "u" },
          { id: "hogar_deco", nombre: "Hogar / Deco", unidad: "u" },
        ],
      },
    },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getUnidadProducto(productoId) {
  for (const cat of Object.values(CATEGORIAS)) {
    for (const subcat of Object.values(cat.subcategorias)) {
      const prod = subcat.productos.find((p) => p.id === productoId);
      if (prod) return prod.unidad;
    }
  }
  return "u";
}

export function getAllProductosBase() {
  const result = [];
  for (const [catId, cat] of Object.entries(CATEGORIAS)) {
    for (const [subcatId, subcat] of Object.entries(cat.subcategorias)) {
      for (const prod of subcat.productos) {
        result.push({ ...prod, catId, subcatId });
      }
    }
  }
  return result;
}
