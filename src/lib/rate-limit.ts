type RateEntry = { count: number; resetAt: number };

const buckets = new Map<string, RateEntry>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  buckets.set(key, entry);
  return { allowed: true, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}
