export function normalizeRedirect(value: string | null): string {
  if (!value) return "/profile";

  let decoded = value;
  try {
    const maybeDecoded = decodeURIComponent(value);
    if (maybeDecoded.startsWith("/")) decoded = maybeDecoded;
  } catch {
    // Keep the original value when decoding fails.
  }

  // Prevent external redirects and auth loops.
  if (!decoded.startsWith("/")) return "/profile";
  if (decoded.startsWith("/auth")) return "/profile";

  return decoded;
}

export function appendHash(path: string, hash: string | null | undefined): string {
  if (!hash) return path;
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  return `${path}${h}`;
}

export function buildRedirectForProvider(redirectPath: string, hash?: string | null): string {
  const full = appendHash(redirectPath, hash);
  return encodeURIComponent(full);
}
