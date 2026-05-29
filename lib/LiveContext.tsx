"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { tick } from "./data";

interface LiveCtx {
  live: boolean;
  setLive: (v: boolean) => void;
  tickCount: number;
}

const Ctx = createContext<LiveCtx>({ live: true, setLive: () => {}, tickCount: 0 });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState(true);
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => {
      tick();
      setTickCount((x) => x + 1);
    }, 2500);
    return () => clearInterval(iv);
  }, [live]);

  return <Ctx.Provider value={{ live, setLive, tickCount }}>{children}</Ctx.Provider>;
}

export function useLive() {
  return useContext(Ctx);
}
