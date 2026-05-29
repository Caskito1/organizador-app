"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import {
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

import Appshell from "../components/layout/Appshell";

import IconDashboard from "../components/icons/IconDashboard";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleEmailAuth(e) {
    e.preventDefault();

    setLoading(true);

    setError("");

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      router.push("/home");
    } catch (e) {
      setError(
        "Email o contraseña incorrectos",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Appshell publicPage>
      <div className="min-h-screen flex items-center justify-center px-5 py-6">
        <div className="relative z-[1] w-full max-w-sm flex flex-col gap-6">
          {/* Logo / título */}

          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center bg-gradient-to-br from-accent/35 to-violet-deep/50 border border-accent/50">
              <IconDashboard
                size={28}
                color="var(--accent-light)"
              />
            </div>

            <div className="text-center">
              <h1 className="text-[26px] font-bold tracking-[-0.5px] font-display text-text">
                Organizador Personal
              </h1>
            </div>
          </div>

          {/* Card */}

          <div className="flex flex-col gap-4 rounded-[24px] px-6 py-7 backdrop-blur-[24px] bg-glass border border-border2">
            {/* Form */}

            <form
              onSubmit={handleEmailAuth}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-medium tracking-[0.3px] text-text-muted">
                  EMAIL
                </label>

                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-medium tracking-[0.3px] text-text-muted">
                  CONTRASEÑA
                </label>

                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value,
                    )
                  }
                  required
                />
              </div>

              {error && (
                <div className="rounded-[10px] px-[14px] py-[10px] text-[13px] bg-negative/10 border border-negative/30 text-negative">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[14px] py-[14px] text-[15px] font-semibold font-display text-white mt-1 transition-all duration-200 hover:opacity-95 active:scale-[0.985] bg-gradient-to-b from-[#8f68ff] to-[#6038dd] shadow-[0_4px_16px_rgba(138,100,255,0.22)]"
              >
                {loading
                  ? "..."
                  : "Iniciar sesión"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Appshell>
  );
}