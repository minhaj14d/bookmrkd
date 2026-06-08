const PROVIDERS = [
  { id: "rule", label: "Local rules (offline)" },
  { id: "transformers", label: "Local embeddings (MiniLM)" },
  { id: "gemini", label: "Google Gemini (optional)" },
  { id: "openai", label: "OpenAI (optional)" },
] as const;

interface Props {
  scaProvider: string;
  onProviderChange: (id: string) => void;
  networkWarning: boolean;
}

export default function ProviderSettingsPanel({
  scaProvider,
  onProviderChange,
  networkWarning,
}: Props) {
  return (
    <div className="sca-provider-panel">
      <label className="field">
        <span>Analysis provider</span>
        <select
          value={scaProvider}
          onChange={(e) => onProviderChange(e.target.value)}
          aria-label="Analysis provider"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {networkWarning ? (
        <p className="help sca-network-warn">
          May send bookmark titles and URLs to a third-party API. Your API key stays on this device.
        </p>
      ) : null}
      {scaProvider === "gemini" ? (
        <p className="help">
          Free Gemini keys can hit rate limits. Prefer <strong>Local rules</strong> or{" "}
          <strong>Local embeddings</strong> for large libraries.
        </p>
      ) : null}
      {scaProvider === "transformers" ? (
        <p className="help sca-embeddings-note">
          First use downloads the MiniLM model (~25&nbsp;MB, cached locally). Keep this tab open until
          analysis finishes.
        </p>
      ) : null}
    </div>
  );
}
