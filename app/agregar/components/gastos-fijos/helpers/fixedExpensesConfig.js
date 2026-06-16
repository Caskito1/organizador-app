export const FIXED_EXPENSES = {
  servicios: {
    label: "Servicios",

    items: [
      {
        id: "alquiler",
        nombre: "Alquiler",
        compartido: true,
      },

      {
        id: "luz",
        nombre: "Luz",
        compartido: true,
      },

      {
        id: "internet",
        nombre: "Internet",
        compartido: true,
      },

      {
        id: "gastos_comunes",
        nombre: "Gastos Comunes",
        compartido: true,
      },

      {
        id: "tributos",
        nombre: "Tributos",
        compartido: true,
      },

      {
        id: "celular",
        nombre: "Celular",
        compartido: false,
      },

      {
        id: "oca",
        nombre: "OCA",
        compartido: false,
      },

      {
        id: "fondo_solidaridad",
        nombre: "Fondo Solidaridad",
        compartido: false,
      },
    ],
  },

  suscripciones: {
    label: "Suscripciones",

    items: [
      {
        id: "spotify",
        nombre: "Spotify",
        compartido: false,
      },

      {
        id: "drive",
        nombre: "Drive",
        compartido: false,
      },

      {
        id: "disney",
        nombre: "Disney+",
        compartido: true,
      },
    ],
  },
};