"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });

export function useAuth() { return useContext(Ctx); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchMe = useCallback(async () => {
    try {
      const me = await auth.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const logout = async () => {
    await auth.logout().catch(() => {});
    setUser(null);
    router.replace("/login");
  };

  return (
    <Ctx.Provider value={{ user, loading, logout }}>
      {children}
    </Ctx.Provider>
  );
}
