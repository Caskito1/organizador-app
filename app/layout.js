import { AuthProvider } from "@/lib/AuthContext";
import { GroupProvider } from "@/lib/GroupContext";

import RouteGuard from "./components/layout/RouteGuard";

import "./globals.css";

export const metadata = {
  title: "Organizador Personal",

  description:
    "Gestión de gastos, hábitos y organización personal",

  manifest: "/manifest.json",


  icons: {
    icon: "/icons/logo-organizador-192x192.png",
    apple: "/icons/logo-organizador-512x512.png",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Organizador",
  },
  
};
export const viewport = {
  themeColor: "#7c5cfc",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="es">
      <head>
        <link
          rel="manifest"
          href="/manifest.json"
        />

        <meta
          name="theme-color"
          content="#7c5cfc"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-title"
          content="Finanzas"
        />
      </head>

      <body
        style={{
          backgroundColor: "#0f0f13",
          color: "#f0f0f5",
        }}
      >
        <AuthProvider>
          <GroupProvider>
            <RouteGuard>
              {children}
            </RouteGuard>
          </GroupProvider>
        </AuthProvider>
      </body>
    </html>
  );
}