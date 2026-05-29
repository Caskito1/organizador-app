import IconMoney from "@/app/components/icons/IconMoney";
import IconShopping from "@/app/components/icons/IconShopping";
import IconCalendar from "@/app/components/icons/IconCalendar";
import IconStats from "@/app/components/icons/IconStats";

const quickActions = [
  
  {
    icon: IconStats,
    label: "Ver ingresos",
    sub: "Sueldo, bandas y freelance",
    path: "/ingresos",
    color: "var(--user-b)",
    colorBg: "rgba(138,100,255,0.1)",
    colorBorder: "rgba(138,100,255,0.22)",
    disabled: false,
  },
  {
    icon: IconMoney,
    label: "Ver gastos",
    sub: "Resumen y desglose del mes",
    path: "/gastos",
    color: "var(--accent)",
    colorBg: "rgba(138,100,255,0.1)",
    colorBorder: "rgba(138,100,255,0.22)",
    disabled: false,
  },

  {
    icon: IconShopping,
    label: "Lista de compras",
    sub: "Próximamente",
    path: null,
    color: "var(--text-muted)",
    colorBg: "rgba(255,255,255,0.03)",
    colorBorder: "rgba(255,255,255,0.07)",
    disabled: true,
  },

  {
    icon: IconCalendar,
    label: "Pendientes",
    sub: "Próximamente",
    path: null,
    color: "var(--text-muted)",
    colorBg: "rgba(255,255,255,0.03)",
    colorBorder: "rgba(255,255,255,0.07)",
    disabled: true,
  },

  {
    icon: IconStats,
    label: "Estadísticas",
    sub: "Próximamente",
    path: null,
    color: "var(--text-muted)",
    colorBg: "rgba(255,255,255,0.03)",
    colorBorder: "rgba(255,255,255,0.07)",
    disabled: true,
  },
];

export default quickActions;