import { Shell } from "@/components/shell/Shell";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  return (
    <Shell title="Fleet Dashboard" subtitle="Real-time overview across all monitored workstations">
      <Dashboard />
    </Shell>
  );
}
