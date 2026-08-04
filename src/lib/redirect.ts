export function normalizeRedirect(value: string | null): string {
  // Accept either encoded or raw redirectTo values. Decode only once when needed.
  if (!value) return "/dashboard";

  // Try decodeURIComponent safely
  let decoded = value;
  try {
    const maybeDecoded = decodeURIComponent(value);
    // If decoding produced a string that looks like a path, prefer it
    if (maybeDecoded.startsWith("/")) decoded = maybeDecoded;
  } catch (e) {
    // ignore and use original
  }

  // Prevent external redirects
  if (!decoded.startsWith("/")) return "/dashboard";
  // Prevent redirect loops back into auth
  if (decoded.startsWith("/auth")) return "/dashboard";

  return decoded;
}

export function appendHash(path: string, hash: string | null | undefined): string {
  if (!hash) return path;
  // Ensure hash starts with '#'
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  return `${path}${h}`;
}

export function buildRedirectForProvider(redirectPath: string, hash?: string | null): string {
  // Build a redirect path including optional hashfragment, then encode for use as a query param
  const full = appendHash(redirectPath, hash);
  return encodeURIComponent(full);
}
