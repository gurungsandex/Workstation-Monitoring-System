"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { workstations as wsApi, type FleetStats, type EnrolledWorkstation } from "./api";

export interface HistPoint {
  time: string;
  avg_cpu: number;
  avg_ram: number;
  avg_disk: number;
}

export interface FleetData {
  fleet: FleetStats | null;
  rows: EnrolledWorkstation[];
  history: HistPoint[];
  loading: boolean;
  error: string;
  lastUpdated: Date | null;
}

// Merge a live WebSocket metric update into a workstation row
export function mergeMetric(
  rows: EnrolledWorkstation[],
  workstation_id: string,
  data: Record<string, number>,
  status: string,
  score: number,
): EnrolledWorkstation[] {
  return rows.map((ws) => {
    if (ws.id !== workstation_id) return ws;
    return {
      ...ws,
      status,
      health_score: score,
      snap_cpu_usage:    data.cpu_usage    ?? ws.snap_cpu_usage,
      snap_ram_used_pct: data.ram_used_pct ?? ws.snap_ram_used_pct,
      snap_disk_used_pct:data.disk_used_pct?? ws.snap_disk_used_pct,
      snap_gpu_load:     data.gpu_load     ?? ws.snap_gpu_load,
      last_seen_at: new Date().toISOString(),
    } as EnrolledWorkstation;
  });
}

export function useFleetData(tickCount: number) {
  const [data, setData] = useState<FleetData>({
    fleet: null, rows: [], history: [], loading: true, error: "", lastUpdated: null,
  });
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [fleet, { rows }, history] = await Promise.all([
        wsApi.fleet(),
        wsApi.list({ limit: "200" }),
        fetch(
          (process.env.NEXT_PUBLIC_API_URL ?? "/api") + "/metrics/fleet/history",
          { credentials: "include" }
        ).then((r) => r.ok ? r.json() : []),
      ]);
      setData({
        fleet, rows, history: history as HistPoint[],
        loading: false, error: "", lastUpdated: new Date(),
      });
    } catch (e: unknown) {
      setData((prev) => ({
        ...prev, loading: false,
        error: e instanceof Error ? e.message : "Failed to load",
      }));
    }
  }, []);

  // Initial load + refresh every 30s
  useEffect(() => {
    load();
    fetchedRef.current = true;
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  // Re-run on tick (driven by live context)
  useEffect(() => {
    if (tickCount > 0 && fetchedRef.current) load();
  }, [tickCount, load]);

  return { data, setData };
}
