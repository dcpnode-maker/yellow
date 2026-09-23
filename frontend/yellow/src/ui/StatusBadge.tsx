export type StatusTone = "verified" | "warning" | "urgent" | "neutral";

const icons: Record<StatusTone, string> = {
  verified: "✓",
  warning: "!",
  urgent: "×",
  neutral: "—",
};

export function StatusBadge({ tone, children }: Readonly<{ tone: StatusTone; children: string }>) {
  return (
    <span className={`status-badge status-${tone}`}>
      <span aria-hidden="true">{icons[tone]}</span>
      {children}
    </span>
  );
}

