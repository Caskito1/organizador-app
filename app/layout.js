import { AuthProvider } from "@/lib/AuthContext";
import { GroupProvider } from "@/lib/GroupContext";

import RouteGuard from "./components/layout/RouteGuard";

import "./globals.css";

export const metadata = {
  title: "Finanzas",
  description:
    "Control de gastos personales y compartidos",
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