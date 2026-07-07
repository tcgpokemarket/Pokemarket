import type { NextResponse } from "next/server";

export function applySecurityHeaders(response: NextResponse) {
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; media-src 'self' https: data:; script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: wss:; frame-src 'self' https://accounts.google.com https://www.youtube.com https://player.vimeo.com; object-src 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com"
  );
  return response;
}
