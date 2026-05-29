"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AppShell from "../components/layout/Appshell";
import useHomeData from "./hooks/useHomeData";
import HomeHeader from "./sections/HomeHeader";
import QuickActions from "./sections/QuickActions";

export default function Home() {
  const { user } = useAuth();

  const router = useRouter();

  const {
    nombre,
    iniciales,
    avatarUrl,
    saludo,
    quickActions,
  } = useHomeData(user);

  async function handleLogout() {
    try {
      await signOut(auth);

      router.push("/login");
    } catch (err) {
      console.error(err);
    }
  }

  if (!user) return null;

  return (
    <AppShell>
      <div className="max-w-[430px] mx-auto relative z-[1]">
        <HomeHeader
          nombre={nombre}
          iniciales={iniciales}
          avatarUrl={avatarUrl}
          saludo={saludo}
          onLogout={handleLogout}
        />

        <QuickActions
          actions={quickActions}
          onNavigate={(path) =>
            router.push(path)
          }
        />
      </div>
    </AppShell>
  );
}