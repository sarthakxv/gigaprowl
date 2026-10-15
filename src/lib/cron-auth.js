// Vercel Cron auth. In production (or on Vercel) CRON_SECRET is required.
export function cronUnauthorized(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.get?.("authorization") || req.headers?.authorization;
  return !secret || auth !== `Bearer ${secret}`;
}
