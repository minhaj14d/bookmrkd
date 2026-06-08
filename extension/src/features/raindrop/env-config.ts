import type { RaindropAppCredentials } from "./types";

/** Baked in at build time from VITE_RAINDROP_* in repo `.env`. */
export function getRaindropEnvCredentials(): RaindropAppCredentials | null {
  const clientId = String(import.meta.env.VITE_RAINDROP_CLIENT_ID || "").trim();
  const clientSecret = String(import.meta.env.VITE_RAINDROP_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Personal testing only — copy from Raindrop app → Test token (skips OAuth). */
export function getRaindropTestToken(): string | null {
  const token = String(import.meta.env.VITE_RAINDROP_TEST_TOKEN || "").trim();
  return token || null;
}

export function hasRaindropEnvCredentials(): boolean {
  return getRaindropEnvCredentials() != null || getRaindropTestToken() != null;
}

/** OAuth app baked at build time (public Connect flow). */
export function hasRaindropOAuthApp(): boolean {
  return getRaindropEnvCredentials() != null;
}

/** Raindrop features enabled (OAuth app or dev test token). */
export function isRaindropFeatureAvailable(): boolean {
  return hasRaindropOAuthApp() || getRaindropTestToken() != null;
}

export function usesRaindropTestToken(): boolean {
  return getRaindropTestToken() != null;
}
