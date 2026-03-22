type ItemPaneSectionProps = {
  data: {
    title: string;
    creators: string;
    year: string;
    abstractPreview: string;
    keyText: string;
  } | null;
  showSelectedText?: boolean;
  selectedText: string;
};

type InfoRowProps = {
  label: string;
  value: string;
  highlighted?: boolean;
};

function InfoRow({ label, value, highlighted = false }: InfoRowProps) {
  return (
    <div style={styles.row}>
      <div style={styles.label}>{label}</div>
      <div
        style={{
          ...styles.value,
          ...(highlighted ? styles.highlightedValue : null),
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ItemPaneSection({
  data,
  showSelectedText = false,
  selectedText,
}: ItemPaneSectionProps) {
  if (!data) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyTitle}>No item selected</div>
        <div style={styles.emptyText}>Select an item to inspect it here.</div>
      </div>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.hero}>
        <div style={styles.kicker}>InSitu AI</div>
        <div style={styles.title}>{data.title}</div>
        <div style={styles.meta}>
          <span>{data.creators}</span>
          <span style={styles.metaDot}>|</span>
          <span>{data.year}</span>
        </div>
      </div>

      <div style={styles.grid}>
        <InfoRow label="Creators" value={data.creators} />
        <InfoRow label="Year" value={data.year} />
        <InfoRow label="Abstract" value={data.abstractPreview} />
        <InfoRow label="Key" value={data.keyText} />
        {showSelectedText ? (
          <InfoRow
            label="Selected Text"
            value={selectedText || "No selection captured yet"}
            highlighted
          />
        ) : null}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    color: "var(--fill-primary)",
    fontSize: "13px",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px",
    borderRadius: "10px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--accent-blue) 12%, transparent), color-mix(in srgb, var(--material-sidepane) 85%, transparent))",
    border: "1px solid color-mix(in srgb, var(--accent-blue) 18%, transparent)",
  },
  kicker: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.7,
  },
  title: {
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.35,
    wordBreak: "break-word",
  },
  meta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    opacity: 0.85,
  },
  metaDot: {
    opacity: 0.45,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--material-sidepane)",
    border:
      "1px solid color-mix(in srgb, var(--fill-primary) 10%, transparent)",
  },
  label: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    opacity: 0.65,
  },
  value: {
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  highlightedValue: {
    color: "var(--accent-blue)",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "16px 12px",
    color: "var(--fill-primary)",
  },
  emptyTitle: {
    fontSize: "15px",
    fontWeight: 700,
  },
  emptyText: {
    opacity: 0.7,
  },
};
