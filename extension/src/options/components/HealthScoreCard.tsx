import type { HealthFactors } from "../../features/smart-collection/types";

interface Props {
  score: number;
  factors?: HealthFactors;
}

export default function HealthScoreCard({ score, factors }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <section className="sca-health" aria-label="Bookmark library health">
      <h2>Your bookmark library health is {pct}/100</h2>
      <div className="sca-health-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="sca-health-fill" style={{ width: `${pct}%` }} />
      </div>
      {factors ? (
        <p className="help sca-health-factors">
          Duplicates {(factors.duplicateRatio * 100).toFixed(0)}% · Uncategorized{" "}
          {(factors.uncategorizedRatio * 100).toFixed(0)}% · Avg depth {factors.avgDepth.toFixed(1)} ·
          Fragmentation {(factors.fragmentationRatio * 100).toFixed(0)}%
        </p>
      ) : null}
    </section>
  );
}
