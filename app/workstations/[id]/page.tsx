import { Shell } from "@/components/shell/Shell";

export default function WorkstationDetailPage({ params }: { params: { id: string } }) {
  return (
    <Shell title="Workstation Detail">
      <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 14 }}>
        Detail for: {params.id} — coming soon
      </div>
    </Shell>
  );
}
