"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const AuthContext = createContext(null);

const AUTH_RESOLVE_TIMEOUT_MS = 8000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!cancelled) {
          setUser(firebaseUser ?? null);
        }
      });
    } catch (e) {
      console.error("Auth observer: no se pudo crear la suscripción:", e);
      queueMicrotask(() => {
        setUser((current) => (current === undefined ? null : current));
      });
    }

    const safety = setTimeout(() => {
      setUser((current) => (current === undefined ? null : current));
    }, AUTH_RESOLVE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearTimeout(safety);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}