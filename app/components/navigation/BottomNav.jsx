"use client";

import {
  useRouter,
  usePathname,
} from "next/navigation";

import IconHome from "@/app/components/icons/IconCasa";
import IconMoney from "@/app/components/icons/IconMoney";
import IconShopping from "@/app/components/icons/IconShopping";
import IconCalendar from "@/app/components/icons/IconCalendar";
 import IconPlus from "@/app/components/icons/IconPlus";

export default function BottomNav({
  onAddClick,
}) {
  const router = useRouter();

  const pathname =
    usePathname();

  const navItems = [
    {
      icon: IconHome,

      label: "Inicio",

      path: "/home",

      active:
        pathname === "/home",
    },

    {
      icon: IconMoney,

      label: "Gastos",

      path: "/gastos",

      active:
        pathname === "/gastos",
    },

    null,

    {
      icon: IconShopping,

      label: "Compras",

      path: "/compras",

      active: false,

      disabled: true,
    },

    {
      icon: IconCalendar,

      label: "Pendientes",

      path: "/pendientes",

      active: false,

      disabled: true,
    },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 px-4 pb-5">
      <div className="relative flex items-center justify-around rounded-[28px] border border-[rgba(138,100,255,0.22)] bg-[rgba(13,10,30,0.85)] px-2 py-[14px] backdrop-blur-[28px]">
        {navItems.map((item) => {
          if (item === null) {
            return (
              <button
                key="fab"
                onClick={
                  onAddClick
                }
                aria-label="Agregar"
                className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border-none bg-[linear-gradient(135deg,#9d7bff,#5b35d5)] shadow-[0_6px_24px_rgba(138,100,255,0.5)] transition-transform duration-200 hover:scale-[1.08] cursor-pointer"
              >
                <IconPlus
                  size={24}
                  color="white"
                />
              </button>
            );
          }

          const Icon =
            item.icon;

          return (
            <button
              key={item.path}
              onClick={() =>
                !item.disabled &&
                router.push(
                  item.path,
                )
              }
              className={`flex flex-1 flex-col items-center gap-[3px] rounded-[12px] border-none bg-transparent px-[10px] py-1 transition-colors ${
                item.disabled
                  ? "cursor-default"
                  : "cursor-pointer"
              }`}
              style={{
                color:
                  item.active
                    ? "var(--accent2)"
                    : "var(--text-muted)",
                minWidth: "48px",
              }}
            >
              <Icon
                size={22}
                color="currentColor"
                opacity={
                  item.disabled
                    ? 0.4
                    : 1
                }
              />

              <span
                className={`font-body text-[10px] tracking-[0.2px] ${
                  item.active
                    ? "font-semibold"
                    : "font-normal"
                }`}
                style={{
                  opacity:
                    item.disabled
                      ? 0.35
                      : 1,
                }}
              >
                {item.label}
              </span>

              {item.active && (
                <div className="mt-[1px] h-1 w-1 rounded-full bg-accent2" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}