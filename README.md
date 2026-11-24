# Organizador Personal — AppFinanciera

Aplicación web personal para registrar y analizar ingresos, gastos, gastos fijos y reintegros, con soporte para gastos compartidos entre grupos.

> Proyecto de portfolio. No incluye datos reales ni credenciales: la configuración se hace con variables de entorno locales.

## Funcionalidades

- Autenticación con Firebase Auth.
- Inicio con resumen y accesos rápidos.
- Ingresos por sueldo, bandas, freelance y otros.
- Gastos variables y gastos fijos, con navegación por mes y totales.
- Reintegros: obligaciones, entregas, devoluciones y condonaciones.
- Gastos compartidos por grupo.
- Taxonomías de categorías y gastos fijos.
- PWA instalable.

## Stack

- Next.js 16 (App Router) + React 19
- Firebase Auth + Firestore
- Tailwind CSS 4
- next-pwa
- Tests con Node Test Runner y Firebase Emulator Suite

## Estructura

```
app/
├── home/          resumen y accesos rápidos
├── ingresos/      ingresos por fuente
├── gastos/        gastos variables y fijos
├── gastos-fijos/  gastos fijos y balance
├── reintegros/    obligaciones y entregas
├── agregar/       alta de compras, ingresos y movimientos
└── login/         autenticación
lib/               Firebase, auth, grupos y taxonomías
tests/             unitarios, reglas de Firestore y harness
```

## Puesta en marcha

Requisitos: Node.js 20 o superior (requisito de Next.js 16) y npm.

```bash
npm install
cp .env.example .env.local     # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Abrir `http://localhost:3000`.

### Variables de entorno

`.env.local` no se versiona; [`.env.example`](.env.example) lista solo los nombres. Los valores se copian de la consola del proyecto de Firebase (Configuración del proyecto → Tus apps):

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Emulador local (opcional)

Para desarrollar contra el emulador de Firestore, crear `.env.development.local` con `NEXT_PUBLIC_USE_EMULATOR=true`. Solo lo carga `next dev`: `next build` y Vercel nunca conectan el emulador.

## Tests

```bash
npm run test:gastos
npm run test:rules
npm run harness
```

`test:rules` y `harness` (integración contra el emulador: reintegros y balance) requieren Firebase Emulator Suite (incluida en `devDependencies`) y Java instalado. `npm run seed:emulator` siembra datos de prueba en el emulador.

## Seguridad

- Las reglas de Firestore están versionadas en `firestore.rules`.
- Las claves de administración y los archivos `.env*` no se versionan.
- La API key web de Firebase es pública por diseño; se restringe por dominio en Google Cloud.

## Capturas

_(pendiente: agregar en `docs/screenshots/`)_
