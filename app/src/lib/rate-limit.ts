/**
 * Simple in-memory rate limiting
 * For production with multiple serverless instances, consider using Redis (Upstash)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 60 * 1000); // 1 hour

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  limit: number;
  /**
   * Time window in milliseconds
   */
  window: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP address, email, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 5, window: 60 * 60 * 1000 } // 5 requests per hour
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // No entry exists - first request
  if (!entry) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + config.window,
    });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: now + config.window,
    };
  }

  // Entry exists but window has expired - reset
  if (now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + config.window,
    });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: now + config.window,
    };
  }

  // Entry exists and window is still active - check limit
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client IP address from request headers
 * Works with Vercel, Cloudflare, and other platforms
 */
export function getClientIP(headers: Headers): string {
  // Try various headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback to a default value if no IP found
  return 'unknown';
}
