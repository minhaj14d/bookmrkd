const PROVIDERS = [
  { id: "rule", label: "Local rules (offline)" },
  { id: "transformers", label: "Local embeddings (MiniLM)" },
  { id: "gemini", label: "Google Gemini (optional)" },
  { id: "openai", label: "OpenAI (optional)" },
  { id: "desktop", label: "Desktop GGUF bridge (optional)" },
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
          aria-label="Smart Collection provider"
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
          Selected provider may send bookmark titles and URLs to a third-party API. Keys stay on your device.
        </p>
      ) : null}
      {scaProvider === "desktop" ? (
        <p className="help">
          Install the bookmrkd native host (<code>io.bookmrkd.llm_bridge</code>) to score via local GGUF.
        </p>
      ) : null}
    </div>
  );
}
