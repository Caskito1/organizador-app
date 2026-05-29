"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

import AppBackground from "./AppBackground";
import PageContainer from "./PageContainer";

import BottomNav from "../navigation/BottomNav";

const hideNavRoutes = [
  "/login",
];

export default function AppShell({
  children,
}) {
  const router = useRouter();

  const pathname = usePathname();

  const hideBottomNav =
    hideNavRoutes.includes(pathname);

  return (
    <AppBackground>
      <PageContainer>
        {children}

        {!hideBottomNav && (
          <div style={{ height: "90px" }} />
        )}
      </PageContainer>

      {!hideBottomNav && (
        <BottomNav
          onAddClick={() =>
            router.push("/agregar")
          }
        />
      )}
    </AppBackground>
  );
}