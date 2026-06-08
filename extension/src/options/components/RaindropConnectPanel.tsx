import { useCallback, useEffect, useState } from "react";
import {
  connectRaindrop,
  disconnectRaindrop,
  getRaindropRedirectUri,
} from "../../features/raindrop/oauth";
import { hasRaindropOAuthApp } from "../../features/raindrop/env-config";
import { isRaindropConnected } from "../../features/raindrop/storage";

interface Props {
  onConnectionChange?: (connected: boolean) => void;
}

export default function RaindropConnectPanel({ onConnectionChange }: Props) {
  const [connected, setConnected] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
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

  if (!hasRaindropOAuthApp()) return null;

  const connect = async () => {
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
    setStatus("Redirect URI copied.");
  };

  return (
    <section className="sca-raindrop-panel block">
      <h3 className="block-title">Raindrop.io (optional)</h3>
      <p className="help">
        Connect your Raindrop account to analyze collections and apply approved moves. You sign in with
        Raindrop; bookmrkd does not store your Raindrop password.
      </p>

      <div className="sca-raindrop-actions">
        {!connected ? (
          <button type="button" className="btn primary" onClick={connect} disabled={busy}>
            Connect Raindrop
          </button>
        ) : (
          <button type="button" className="btn standard" onClick={disconnect} disabled={busy}>
            Disconnect
          </button>
        )}
      </div>

      {connected ? (
        <p className="help sca-raindrop-ok">Connected — choose Raindrop as the data source below.</p>
      ) : null}

      {!connected && redirectUri ? (
        <div className="sca-redirect-uri">
          <span className="label">Redirect URI (for Raindrop app setup)</span>
          <code className="sca-redirect-code">{redirectUri}</code>
          <button type="button" className="btn standard" onClick={copyRedirect}>
            Copy redirect URI
          </button>
        </div>
      ) : null}

      {status ? <p className="help">{status}</p> : null}
    </section>
  );
}
