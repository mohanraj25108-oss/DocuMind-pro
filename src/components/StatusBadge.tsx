import type { ExpiryStatus } from "@/lib/constants";
import { formatRelativeDays } from "@/lib/constants";

interface StatusBadgeProps {
  status: ExpiryStatus;
  daysUntilExpiry?: number | null;
  compact?: boolean;
}

export function StatusBadge({
  status,
  daysUntilExpiry,
  compact = false,
}: StatusBadgeProps) {
  const styles: Record<
    ExpiryStatus,
    { label: string; bg: string; text: string; dot: string; border: string }
  > = {
    active: {
      label: "Active",
      bg: "#ECFDF3",
      text: "#16A36A",
      dot: "#16A36A",
      border: "#CBEFD9",
    },
    expiring_soon: {
      label: "Expiring soon",
      bg: "#FEF6E7",
      text: "#B87A14",
      dot: "#E6A23C",
      border: "#F8DFB1",
    },
    expired: {
      label: "Expired",
      bg: "#FEF0F0",
      text: "#DC5252",
      dot: "#DC5252",
      border: "#F7CACA",
    },
    no_expiry: {
      label: "No expiry",
      bg: "#F3F4F6",
      text: "#667085",
      dot: "#9CA3AF",
      border: "#E5E7EB",
    },
  };

  const s = styles[status];
  const text =
    compact && daysUntilExpiry !== undefined && daysUntilExpiry !== null
      ? formatRelativeDays(daysUntilExpiry)
      : daysUntilExpiry !== undefined && daysUntilExpiry !== null && status !== "active"
        ? `${s.label} · ${formatRelativeDays(daysUntilExpiry)}`
        : s.label;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums"
      style={{
        backgroundColor: s.bg,
        color: s.text,
        borderColor: s.border,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: s.dot }}
      />
      {text}
    </span>
  );
}
