type AccessTokenClaims = {
  sub: string;
  email: string;
};

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return atob(normalized + "=".repeat(padding));
}

/**
 * Reads the `sub`/`email` claims out of a JWT's payload for display purposes only.
 * This does NOT verify the token's signature — the backend is the sole source of
 * truth for whether the token is valid; every real API call re-verifies it there.
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const parts = token.split(".");
  const payloadSegment = parts[1];
  if (parts.length !== 3 || payloadSegment === undefined) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(base64UrlDecode(payloadSegment));
    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    const { sub, email } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || typeof email !== "string") {
      return null;
    }

    return { sub, email };
  } catch {
    return null;
  }
}
