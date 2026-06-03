/** Maps Raindrop OAuth redirect/query and token API errors (see developer.raindrop.io). */
export function raindropOAuthRedirectError(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "access_denied":
      return "You declined access to Raindrop.";
    case "invalid_application_status":
      return "Raindrop blocked this app (token limit or suspension). Check your app in Raindrop Integrations.";
    default:
      return `Raindrop OAuth error: ${error}`;
  }
}

export function raindropTokenExchangeError(data: {
  error?: string;
  errorMessage?: string;
  message?: string;
}): string {
  if (data.error === "bad_authorization_code") {
    return "Invalid authorization code — try Connect Raindrop again (redirect URI must match exactly).";
  }
  return data.errorMessage || data.message || data.error || "Token exchange failed";
}
