export function loadColor(pct: number): string {
  if (pct >= 90) return "var(--critical)";
  if (pct >= 75) return "var(--warning)";
  if (pct >= 55) return "var(--info)";
  return "var(--healthy)";
}

export const SEV_COLOR: Record<string, string> = {
  info:     "var(--info)",
  healthy:  "var(--healthy)",
  warning:  "var(--warning)",
  critical: "var(--critical)",
  network:  "var(--network)",
  gpu:      "var(--gpu)",
  offline:  "#4a5160",
};

export function sevColor(name: string): string {
  return SEV_COLOR[name] ?? name;
}
