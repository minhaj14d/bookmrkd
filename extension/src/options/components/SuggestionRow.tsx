import type { Suggestion } from "../../features/smart-collection/types";

interface Props {
  suggestion: Suggestion;
  expanded: boolean;
  onTogglePreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIgnore: () => void;
  busy?: boolean;
}

function pathLabel(segments: string[]): string {
  return segments.length ? segments.join(" > ") : "(root)";
}

export default function SuggestionRow({
  suggestion: s,
  expanded,
  onTogglePreview,
  onApprove,
  onReject,
  onIgnore,
  busy,
}: Props) {
  const from = pathLabel(s.preview.fromPath);
  const to = s.preview.toPath?.length ? pathLabel(s.preview.toPath) : null;

  return (
    <article className={`sca-row sca-row--${s.status}`}>
      <div className="sca-row-main">
        <strong className="sca-row-title">{s.preview.title}</strong>
        {s.kind === "move" && to ? (
          <p className="sca-row-path">
            {from} → {to}
          </p>
        ) : s.kind === "duplicate" ? (
          <p className="sca-row-path">{from} — duplicate</p>
        ) : (
          <p className="sca-row-path">{from}</p>
        )}
        <p className="sca-row-meta">
          Confidence {s.confidence}% · {s.providerId}
        </p>
        <p className="sca-row-reason">{s.reasoning}</p>
      </div>
      {expanded ? (
        <pre className="sca-preview-detail">
          {JSON.stringify(s.preview, null, 2)}
        </pre>
      ) : null}
      {s.status === "pending" ? (
        <div className="sca-row-actions">
          <button type="button" className="btn secondary" onClick={onTogglePreview}>
            {expanded ? "Hide" : "Preview"}
          </button>
          <button type="button" className="btn primary" onClick={onApprove} disabled={busy}>
            Approve
          </button>
          <button type="button" className="btn secondary" onClick={onReject} disabled={busy}>
            Reject
          </button>
          <button type="button" className="btn secondary" onClick={onIgnore} disabled={busy}>
            Ignore
          </button>
        </div>
      ) : (
        <span className="sca-status-badge">{s.status}</span>
      )}
    </article>
  );
}
