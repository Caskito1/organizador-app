"use client";

import IconCamera from "@/app/components/icons/IconCamera";
import IconLogout from "@/app/components/icons/IconLogout";

export default function HomeHeader({
  nombre,
  iniciales,
  avatarUrl,
  saludo,
  onCameraClick,
   onLogout,
}) {
  return (
    <div className="flex items-center justify-between pt-14 pb-2">
      {/* Avatar + nombre */}
      <div className="flex items-center gap-4 ">
        <div
          className={` w-11 h-11 rounded-[14px] overflow-hidden flex items-center justify-center text-[16px] font-bold text-[var(--accent-light)] font-[var(--font)] shrink-0 border-[1.5px] border-[rgba(138,100,255,0.4)]
    ${
      avatarUrl
        ? "bg-transparent"
        : "bg-[linear-gradient(135deg,rgba(138,100,255,0.5),rgba(91,53,213,0.7))]"
    }
  `}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nombre}
              className="w-full h-full object-cover"
            />
          ) : (
            iniciales
          )}
        </div>

        <div>
          <p className="text-[11px] text-[var(--text-muted)] tracking-[0.3px]">
            {saludo} 
          </p>
          <h1 className="text-[17px] font-bold font-[var(--font)] text-[var(--text)] tracking-[-0.3px] leading-[1.2]">
            {nombre}
          </h1>
        </div>
      </div>

      {/* Cámara */}
      {/* <button
        onClick={onCameraClick}
        aria-label="Cámara / Pendientes"
        className="w-10 h-10 rounded-[12px] bg-[rgba(138,100,255,0.1)] border border-[rgba(138,100,255,0.25)] flex items-center justify-center cursor-pointer transition-colors duration-200 hover:bg-[rgba(138,100,255,0.2)]"
      >
        <IconCamera size={18} color="var(--accent2)" />
      </button> *
      
      /}
       {/* Logout */}
     <button
  onClick={onLogout}
  aria-label="Cerrar sesión"
  className="px-3 h-10 rounded-[12px] bg-[rgba(138,100,255,0.1)] border border-[rgba(138,100,255,0.25)] flex items-center gap-2 cursor-pointer transition-colors duration-200 hover:bg-[rgba(138,100,255,0.18)]"
>
  <IconLogout
    size={16}
    color="var(--accent2)"
  />

  <span className="text-[12px] font-semibold text-accent-light">
    Salir
  </span>
</button>
    </div>
  );
}
