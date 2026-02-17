import path from "path";
import fs from "fs";
import { STORE_FILE_PATH } from "./dataDir";

export type TrackRecord = { name: string; audioUrl?: string; audioPath?: string };
const tracks = new Map<string, TrackRecord>();
const usedSignatures = new Map<string, string>();

export type Artist = {
  id: string;
  wallet: string;
  name: string;
  imageUrl?: string;
  slug?: string;
  bio?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
};
const artistsByWallet = new Map<string, Artist[]>();
/** wallet -> trackId -> artistId */
const assignments = new Map<string, Map<string, string>>();
/** artistId -> like count */
const artistLikes = new Map<string, number>();
/** trackId -> play count */
const trackPlays = new Map<string, number>();

const STORE_FILE = STORE_FILE_PATH;
let loaded = false;

function loadFromFile() {
  if (loaded) return;
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    loaded = true;
    const data = JSON.parse(raw) as {
      tracks?: Record<string, TrackRecord>;
      usedSignatures?: Record<string, string>;
      artists?: Record<string, Artist[]>;
      assignments?: Record<string, Record<string, string>>;
      artistLikes?: Record<string, number>;
      trackPlays?: Record<string, number>;
    };
    if (data.tracks) {
      for (const [id, v] of Object.entries(data.tracks)) tracks.set(id, v);
    }
    if (data.usedSignatures) {
      for (const [sig, id] of Object.entries(data.usedSignatures)) usedSignatures.set(sig, id);
    }
    if (data.artists) {
      for (const [wallet, list] of Object.entries(data.artists)) artistsByWallet.set(wallet, list);
    }
    if (data.assignments) {
      for (const [wallet, map] of Object.entries(data.assignments)) {
        assignments.set(wallet, new Map(Object.entries(map)));
      }
    }
    if (data.artistLikes) {
      for (const [id, count] of Object.entries(data.artistLikes)) artistLikes.set(id, count);
    }
    if (data.trackPlays) {
      for (const [id, count] of Object.entries(data.trackPlays)) trackPlays.set(id, Number(count));
    }
  } catch (e) {
    loaded = true; // avoid tight retry loop; next write will re-read if needed
    if (process.env.NODE_ENV === "development") {
      console.warn("[trackStore] loadFromFile:", e instanceof Error ? e.message : e);
    }
  }
}

function saveToFile() {
  try {
    // Never overwrite store with empty tracks (e.g. after dev server restart / Fast Refresh cleared memory)
    if (tracks.size === 0 && fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, "utf-8");
        const data = JSON.parse(raw) as { tracks?: Record<string, TrackRecord> };
        if (data.tracks && Object.keys(data.tracks).length > 0) {
          loaded = false;
          loadFromFile();
          return;
        }
      } catch {
        // ignore
      }
    }
    const data = {
      tracks: Object.fromEntries(tracks),
      usedSignatures: Object.fromEntries(usedSignatures),
      artists: Object.fromEntries(artistsByWallet),
      assignments: Object.fromEntries(
        Array.from(assignments.entries()).map(([w, m]) => [w, Object.fromEntries(m)])
      ),
      artistLikes: Object.fromEntries(artistLikes),
      trackPlays: Object.fromEntries(trackPlays),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 0), "utf-8");
    loaded = false;
  } catch (e) {
    console.error("[trackStore] saveToFile failed:", e);
  }
}

export function getArtists(wallet: string): Artist[] {
  loadFromFile();
  return artistsByWallet.get(wallet) ?? [];
}

export function createArtist(wallet: string, name: string, imageUrl?: string): Artist {
  loadFromFile();
  const list = artistsByWallet.get(wallet) ?? [];
  const artist: Artist = { id: crypto.randomUUID(), wallet, name, imageUrl };
  list.push(artist);
  artistsByWallet.set(wallet, list);
  saveToFile();
  return artist;
}

export function updateArtist(
  wallet: string,
  artistId: string,
  updates: {
    name?: string;
    imageUrl?: string;
    slug?: string;
    bio?: string;
    youtubeUrl?: string;
    websiteUrl?: string;
  }
): Artist | null {
  loadFromFile();
  const list = artistsByWallet.get(wallet) ?? [];
  const idx = list.findIndex((a) => a.id === artistId);
  if (idx === -1) return null;
  const a = list[idx];
  if (updates.name !== undefined) a.name = updates.name;
  if (updates.imageUrl !== undefined) a.imageUrl = updates.imageUrl;
  if (updates.slug !== undefined) a.slug = updates.slug ? slugify(updates.slug) : undefined;
  if (updates.bio !== undefined) a.bio = updates.bio;
  if (updates.youtubeUrl !== undefined) a.youtubeUrl = updates.youtubeUrl;
  if (updates.websiteUrl !== undefined) a.websiteUrl = updates.websiteUrl;
  list[idx] = a;
  artistsByWallet.set(wallet, list);
  saveToFile();
  return a;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getArtistBySlug(slug: string): Artist | null {
  loadFromFile();
  const norm = slugify(slug);
  if (!norm) return null;
  for (const list of artistsByWallet.values()) {
    const found = list.find((a) => a.slug === norm);
    if (found) return found;
  }
  return null;
}

export function getArtistById(artistId: string): Artist | null {
  loadFromFile();
  for (const list of artistsByWallet.values()) {
    const found = list.find((a) => a.id === artistId);
    if (found) return found;
  }
  return null;
}

export function setAssignment(wallet: string, trackId: string, artistId: string | null): void {
  loadFromFile();
  let map = assignments.get(wallet);
  if (!map) {
    map = new Map();
    assignments.set(wallet, map);
  }
  if (artistId) map.set(trackId, artistId);
  else map.delete(trackId);
  saveToFile();
}

export function getTracksByArtist(wallet: string, artistId: string): string[] {
  loadFromFile();
  const map = assignments.get(wallet);
  if (!map) return [];
  return Array.from(map.entries())
    .filter(([, aid]) => aid === artistId)
    .map(([tid]) => tid);
}

export function getArtistLikes(artistId: string): number {
  loadFromFile();
  return artistLikes.get(artistId) ?? 0;
}

export function likeArtist(artistId: string): number {
  loadFromFile();
  const n = (artistLikes.get(artistId) ?? 0) + 1;
  artistLikes.set(artistId, n);
  saveToFile();
  return n;
}

export function deleteArtist(wallet: string, artistId: string): void {
  loadFromFile();
  const list = artistsByWallet.get(wallet) ?? [];
  const next = list.filter((a) => a.id !== artistId);
  if (next.length) artistsByWallet.set(wallet, next);
  else artistsByWallet.delete(wallet);
  const map = assignments.get(wallet);
  if (map) {
    for (const [tid, aid] of Array.from(map.entries())) {
      if (aid === artistId) map.delete(tid);
    }
    if (map.size === 0) assignments.delete(wallet);
    else assignments.set(wallet, map);
  }
  saveToFile();
}

export function registerTrack(audioUrl: string, name: string): string {
  loaded = false; // force re-read so we merge with latest file (e.g. from other workers)
  loadFromFile();
  const id = crypto.randomUUID();
  tracks.set(id, { name, audioUrl });
  saveToFile();
  return id;
}

/** Register a track that has audio saved locally (avoids expiring external URLs). */
export function registerTrackWithLocalFile(id: string, name: string, audioFileName: string): void {
  loaded = false; // force re-read from disk so we don't overwrite other workers' or parallel requests' tracks
  loadFromFile();
  tracks.set(id, { name, audioPath: audioFileName });
  saveToFile();
}

export function getTrack(id: string): TrackRecord | undefined {
  loadFromFile();
  return tracks.get(id);
}

export function isSignatureUsedForTrack(signature: string, trackId: string): boolean {
  loadFromFile();
  const usedFor = usedSignatures.get(signature);
  if (usedFor === undefined) return false;
  return usedFor !== trackId;
}

export function markSignatureUsed(signature: string, trackId: string): void {
  loadFromFile();
  usedSignatures.set(signature, trackId);
  saveToFile();
}

export function incrementTrackPlay(trackId: string): number {
  loadFromFile();
  const n = (trackPlays.get(trackId) ?? 0) + 1;
  trackPlays.set(trackId, n);
  saveToFile();
  return n;
}

export function getTrackPlays(trackId: string): number {
  loadFromFile();
  return trackPlays.get(trackId) ?? 0;
}

export type TrendingArtist = {
  artist: Artist;
  tracks: { id: string; name: string; plays: number }[];
  totalPlays: number;
};

/** Track IDs that have been unlocked (at least one payment verified). */
function getUnlockedTrackIds(): Set<string> {
  loadFromFile();
  return new Set(usedSignatures.values());
}

/** Trending: only artists and tracks that have been unlocked (paid) at least once. */
export function getTrending(): TrendingArtist[] {
  loadFromFile();
  const unlockedIds = getUnlockedTrackIds();
  const list: TrendingArtist[] = [];
  for (const [wallet, artists] of artistsByWallet) {
    const map = assignments.get(wallet);
    if (!map) continue;
    for (const artist of artists) {
      const trackIds = Array.from(map.entries())
        .filter(([, aid]) => aid === artist.id)
        .map(([tid]) => tid)
        .filter((tid) => unlockedIds.has(tid));
      if (trackIds.length === 0) continue;
      const tracksWithPlays = trackIds
        .map((tid) => {
          const t = getTrack(tid);
          if (!t) return null;
          const plays = trackPlays.get(tid) ?? 0;
          return { id: tid, name: t.name, plays };
        })
        .filter((x): x is { id: string; name: string; plays: number } => x !== null)
        .sort((a, b) => b.plays - a.plays);
      const totalPlays = tracksWithPlays.reduce((s, x) => s + x.plays, 0);
      list.push({ artist, tracks: tracksWithPlays, totalPlays });
    }
  }
  list.sort((a, b) => b.totalPlays - a.totalPlays);
  return list;
}
