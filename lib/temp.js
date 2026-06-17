export const GASTOS_FIJOS_COMPARTIDOS_MAP = {
  alquiler:       { id: "alquiler",       nombre: "Alquiler",          icon: "🏠", frecuencia: "mensual" },
  luz:            { id: "luz",            nombre: "Luz",               icon: "💡", frecuencia: "mensual" },
  gastos_comunes: { id: "gastos_comunes", nombre: "Gastos Comunes",    icon: "🏢", frecuencia: "mensual" },
  internet:       { id: "internet",       nombre: "Internet",          icon: "📡", frecuencia: "mensual" },
  tributos:       { id: "tributos",       nombre: "Tributos",          icon: "📋", frecuencia: "mensual" },
};
 
// Catálogo de personales disponibles para activar
export const GASTOS_FIJOS_PERSONALES_CATALOGO = [
  { id: "oca",               nombre: "OCA",               icon: "💳", frecuencia: "mensual" },
  { id: "celular",           nombre: "Celular",           icon: "📱", frecuencia: "mensual" },
  { id: "drive",             nombre: "Drive",             icon: "☁️", frecuencia: "anual"   },
  { id: "fondo_solidaridad", nombre: "Fondo Solidaridad", icon: "🤝", frecuencia: "mensual" },
  { id: "disney",            nombre: "Disney+",           icon: "🎬", frecuencia: "mensual" },
  { id: "spotify",           nombre: "Spotify",           icon: "🎵", frecuencia: "anual"   },
  { id: "candombe",          nombre: "Candombe",          icon: "🥁", frecuencia: "mensual" },
  { id: "otros",          nombre: "otros",          icon: "", frecuencia: "mensual" },
];
 
export const GASTOS_FIJOS_COMPARTIDOS = Object.values(GASTOS_FIJOS_COMPARTIDOS_MAP);