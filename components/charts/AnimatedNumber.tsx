"use client";
import { useEffect, useRef, useState } from "react";

function useTween(target: number, dur = 650) {
  const [val, setVal] = useState(target);
  const ref = useRef({ from: target, start: 0, raf: 0 });
  useEffect(() => {
    const o = ref.current;
    o.from = val;
    o.start = performance.now();
    const step = (t: number) => {
      const k = Math.min((t - o.start) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      setVal(o.from + (target - o.from) * e);
      if (k < 1) o.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(o.raf);
    o.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(o.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

export { useTween };

interface Props {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}

export function AnimatedNumber({ value, decimals = 0, className = "", suffix = "" }: Props) {
  const v = useTween(value);
  return <span className={className}>{v.toFixed(decimals)}{suffix}</span>;
}
