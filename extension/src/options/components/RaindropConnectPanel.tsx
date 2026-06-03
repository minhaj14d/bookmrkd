import { useCallback, useEffect, useState } from "react";
import {
  connectRaindrop,
  disconnectRaindrop,
  getRaindropRedirectUri,
} from "../../features/raindrop/oauth";
import {
  hasRaindropEnvCredentials,
  usesRaindropTestToken,
} from "../../features/raindrop/env-config";
import { isRaindropConnected } from "../../features/raindrop/storage";

interface Props {
  onConnectionChange?: (connected: boolean) => void;
}

export default function RaindropConnectPanel({ onConnectionChange }: Props) {
  const [configured, setConfigured] = useState(hasRaindropEnvCredentials());
  const [connected, setConnected] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setConfigured(hasRaindropEnvCredentials());
    const ok = await isRaindropConnected();
    setConnected(ok);
    onConnectionChange?.(ok);
    try {
      setRedirectUri(getRaindropRedirectUri());
    } catch {
      setRedirectUri("");
    }
  }, [onConnectionChange]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const connect = async () => {
    if (!configured) {
      setStatus(
        "Add VITE_RAINDROP_CLIENT_ID and VITE_RAINDROP_CLIENT_SECRET to .env, then rebuild the extension."
      );
      return;
    }
    setBusy(true);
    setStatus("Opening Raindrop sign-in…");
    try {
      await connectRaindrop();
      await refresh();
      setStatus("Connected to Raindrop.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectRaindrop();
      await refresh();
      setStatus("Disconnected from Raindrop.");
    } finally {
      setBusy(false);
    }
  };

  const copyRedirect = async () => {
    if (!redirectUri) return;
    await navigator.clipboard.writeText(redirectUri);
    setStatus("Redirect URI copied — paste it in Raindrop → Settings → Integrations → your app.");
  };

  return (
    <section className="sca-raindrop-panel block">
      <h3 className="block-title">Raindrop.io</h3>
      <p className="help">
        OAuth app credentials come from your repo <code>.env</code> (see <code>.env.example</code>).
        Create an app at{" "}
        <a href="https://app.raindrop.io/settings/integrations" target="_blank" rel="noopener noreferrer">
          Raindrop Integrations
        </a>
        , then rebuild after editing <code>.env</code>.
      </p>

      {usesRaindropTestToken() ? (
        <p className="help sca-raindrop-ok">
          Using <strong>Test token</strong> from <code>.env</code> — no Connect step needed (personal use only).
        </p>
      ) : configured ? (
        <p className="help sca-raindrop-ok">Raindrop OAuth app credentials loaded from build.</p>
      ) : (
        <p className="help sca-source-warn">
          Not configured — set <code>VITE_RAINDROP_CLIENT_ID</code> and <code>VITE_RAINDROP_CLIENT_SECRET</code> in{" "}
          <code>.env</code>, then run <code>npm run build</code> in <code>extension/</code>.
        </p>
      )}

      <div className="sca-raindrop-actions">
        {!usesRaindropTestToken() && !connected ? (
          <button
            type="button"
            className="btn primary"
            onClick={connect}
            disabled={busy || !configured}
          >
            Connect Raindrop
          </button>
        ) : !usesRaindropTestToken() ? (
          <button type="button" className="btn secondary" onClick={disconnect} disabled={busy}>
            Disconnect
          </button>
        ) : null}
      </div>

      {connected || usesRaindropTestToken() ? (
        <p className="help sca-raindrop-ok">Ready — choose <strong>Raindrop</strong> as data source below.</p>
      ) : null}

      {!usesRaindropTestToken() && redirectUri ? (
        <div className="sca-redirect-uri">
          <span className="label">Redirect URI (add in Raindrop app)</span>
          <code className="sca-redirect-code">{redirectUri}</code>
          <button type="button" className="btn secondary" onClick={copyRedirect}>
            Copy redirect URI
          </button>
        </div>
      ) : null}

      {status ? <p className="help">{status}</p> : null}
    </section>
  );
}
