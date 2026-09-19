// Vercel Cron auth. In production (or on Vercel) CRON_SECRET is required.
import { isProductionRuntime } from "@/lib/constants";

export function cronUnauthorized(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.get?.("authorization") || req.headers?.authorization;
  if (isProductionRuntime()) return !secret || auth !== `Bearer ${secret}`;
  if (secret) return auth !== `Bearer ${secret}`;
  return false;
}
