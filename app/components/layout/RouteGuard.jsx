"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";

import LoadingScreen from "../ui/LoadingScreen";

const publicRoutes = ["/login"];

export default function RouteGuard({ children }) {
  const { user, loading } = useAuth();

  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute =
    publicRoutes.includes(pathname);

  useEffect(() => {
    if (loading) return;

    // NO LOGUEADO
    if (!user && !isPublicRoute) {
      router.replace("/login");
    }

    // LOGUEADO
    if (user && isPublicRoute) {
      router.replace("/home");
    }
  }, [
    user,
    loading,
    pathname,
    isPublicRoute,
    router,
  ]);

  if (loading) {
    return (
      <LoadingScreen text="Cargando..." />
    );
  }

  // usuario no autorizado
  if (!user && !isPublicRoute) {
    return null;
  }

  // usuario logueado entrando a login
  if (user && isPublicRoute) {
    return null;
  }

  return children;
}