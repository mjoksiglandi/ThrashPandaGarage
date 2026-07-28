type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 4_096;
const CLEANUP_INTERVAL = 256;
let insertionsUntilCleanup = CLEANUP_INTERVAL;

function deleteExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function canCreateBucket(now: number): boolean {
  insertionsUntilCleanup -= 1;
  if (
    insertionsUntilCleanup === 0 ||
    buckets.size >= MAX_BUCKETS
  ) {
    deleteExpiredBuckets(now);
    insertionsUntilCleanup = CLEANUP_INTERVAL;
  }
  return buckets.size < MAX_BUCKETS;
}

export function checkRateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket) {
      if (!canCreateBucket(now)) {
        return false;
      }
    } else {
      buckets.delete(key);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
