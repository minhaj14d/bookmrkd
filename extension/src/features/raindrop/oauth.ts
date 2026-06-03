import {
  loadRaindropCredentials,
  saveRaindropTokens,
  clearRaindropAuth,
} from "./storage";
import { raindropOAuthRedirectError, raindropTokenExchangeError } from "./oauth-errors";

// https://developer.raindrop.io/v1/authentication/token
const AUTH_BASE = "https://api.raindrop.io/v1/oauth/authorize";
const TOKEN_URL = "https://raindrop.io/oauth/access_token";

export function getRaindropRedirectUri(): string {
  return chrome.identity.getRedirectURL("raindrop");
}

export async function connectRaindrop(): Promise<void> {
  const creds = await loadRaindropCredentials();
  if (!creds?.clientId || !creds.clientSecret) {
    throw new Error(
      "Raindrop app credentials missing. Add VITE_RAINDROP_CLIENT_ID and VITE_RAINDROP_CLIENT_SECRET to .env at the repo root, then run npm run build."
    );
  }

  const redirectUri = getRaindropRedirectUri();
  const authUrl =
    `${AUTH_BASE}?response_type=code` +
    `&client_id=${encodeURIComponent(creds.clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Sign-in was cancelled or blocked. Check the Redirect URI in your Raindrop app settings."
    );
  }

  if (!responseUrl) throw new Error("Raindrop sign-in returned no URL.");

  const redirect = new URL(responseUrl);
  const code = redirect.searchParams.get("code");
  if (!code) {
    const errMsg = raindropOAuthRedirectError(redirect.searchParams.get("error"));
    throw new Error(errMsg || "No authorization code from Raindrop.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(raindropTokenExchangeError(data) + (res.status ? ` (${res.status})` : ""));
  }

  await saveRaindropTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  });
}

export async function disconnectRaindrop(): Promise<void> {
  await clearRaindropAuth();
}
