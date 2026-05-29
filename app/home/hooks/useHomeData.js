"use client";

import quickActions from "../helpers/quickActions";

export default function useHomeData(user) {
  const nombre =
    user?.displayName?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "Usuario";

  const iniciales = nombre
    .slice(0, 2)
    .toUpperCase();

  const avatarUrl = user?.photoURL;

  const hora = new Date().getHours();

  const saludo =
    hora < 12
      ? "Buenos días"
      : hora < 19
      ? "Buenas tardes"
      : "Buenas noches";

  return {
    nombre,
    iniciales,
    avatarUrl,
    saludo,
    quickActions,
  };
}