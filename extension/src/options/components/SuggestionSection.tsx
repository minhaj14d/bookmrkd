import type { Suggestion, SuggestionKind } from "../../features/smart-collection/types";
import SuggestionRow from "./SuggestionRow";

const SECTION_TITLES: Record<SuggestionKind, string> = {
  move: "Move Suggestions",
  duplicate: "Duplicate Suggestions",
  folder_merge: "Folder Merge Suggestions",
  folder_split: "Folder Split Suggestions",
  folder_cleanup: "Folder Cleanup Suggestions",
  uncategorized: "Uncategorized Suggestions",
  tag: "Tag Suggestions",
  leave_unchanged: "Unchanged",
};

interface Props {
  kind: SuggestionKind;
  items: Suggestion[];
  expandedId: string | null;
  onTogglePreview: (id: string) => void;
  onApprove: (s: Suggestion) => void;
  onReject: (s: Suggestion) => void;
  onIgnore: (s: Suggestion) => void;
  onBulkApprove: (items: Suggestion[]) => void;
  onBulkReject: (items: Suggestion[]) => void;
  busy?: boolean;
}

export default function SuggestionSection({
  kind,
  items,
  expandedId,
  onTogglePreview,
  onApprove,
  onReject,
  onIgnore,
  onBulkApprove,
  onBulkReject,
  busy,
}: Props) {
  const pending = items.filter((i) => i.status === "pending");
  if (!items.length) return null;

  const handleBulkApprove = () => {
    if (!pending.length) return;
    if (!confirm(`Approve ${pending.length} ${SECTION_TITLES[kind]}?`)) return;
    onBulkApprove(pending);
  };

  const handleBulkReject = () => {
    if (!pending.length) return;
    if (!confirm(`Reject ${pending.length} ${SECTION_TITLES[kind]}?`)) return;
    onBulkReject(pending);
  };

  return (
    <section className="sca-section">
      <header className="sca-section-head">
        <h3>
          {SECTION_TITLES[kind]} ({items.length})
        </h3>
        {pending.length > 0 ? (
          <div className="sca-bulk">
            <button type="button" className="btn secondary" onClick={handleBulkApprove} disabled={busy}>
              Approve all
            </button>
            <button type="button" className="btn secondary" onClick={handleBulkReject} disabled={busy}>
              Reject all
            </button>
          </div>
        ) : null}
      </header>
      <ul className="sca-list">
        {items.map((s) => (
          <li key={s.id}>
            <SuggestionRow
              suggestion={s}
              expanded={expandedId === s.id}
              onTogglePreview={() => onTogglePreview(s.id)}
              onApprove={() => onApprove(s)}
              onReject={() => onReject(s)}
              onIgnore={() => onIgnore(s)}
              busy={busy}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
