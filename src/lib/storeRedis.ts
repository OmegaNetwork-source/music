/**
 * Redis persistence for track store when UPSTASH_REDIS_REST_URL is set (e.g. on Vercel).
 * Single key "music-studio:store" holds the full store JSON.
 */

import { Redis } from "@upstash/redis";

const REDIS_KEY = "music-studio:store";

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export type StoreSnapshot = {
  tracks: Record<string, { name: string; audioUrl?: string; audioPath?: string; blobUrl?: string; lyrics?: string }>;
  usedSignatures: Record<string, string>;
  artists: Record<string, { id: string; wallet: string; name: string; imageUrl?: string; slug?: string; bio?: string; youtubeUrl?: string; websiteUrl?: string }[]>;
  assignments: Record<string, Record<string, string>>;
  artistLikes: Record<string, number>;
  trackPlays: Record<string, number>;
};

export async function loadFromRedis(): Promise<StoreSnapshot | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(REDIS_KEY);
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as StoreSnapshot) : (raw as StoreSnapshot);
  } catch (e) {
    console.error("[storeRedis] load failed:", e);
    return null;
  }
}

export async function saveToRedis(snapshot: StoreSnapshot): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(REDIS_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.error("[storeRedis] save failed:", e);
  }
}
