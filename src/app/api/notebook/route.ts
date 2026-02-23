import { NextRequest, NextResponse } from "next/server";
import * as storeRedis from "@/lib/storeRedis";

const NOTEBOOK_MAX = 20;
const NOTEBOOK_KEY_PREFIX = "music-studio:notebook:";

export type NotebookEntry = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
};

async function getNotebook(wallet: string): Promise<NotebookEntry[]> {
  const redis = storeRedis.getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get<string>(NOTEBOOK_KEY_PREFIX + wallet);
    if (raw == null) return [];
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function setNotebook(wallet: string, entries: NotebookEntry[]): Promise<void> {
  const redis = storeRedis.getRedis();
  if (!redis) return;
  await redis.set(NOTEBOOK_KEY_PREFIX + wallet, JSON.stringify(entries));
}

/** GET /api/notebook?wallet= – list entries */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet?.trim()) {
    return NextResponse.json({ success: false, error: "Missing wallet" }, { status: 400 });
  }
  const entries = await getNotebook(wallet.trim());
  return NextResponse.json({ success: true, entries });
}

/** POST /api/notebook – create entry. Body: { wallet, title?, content } */
export async function POST(req: NextRequest) {
  const redis = storeRedis.getRedis();
  if (!redis) {
    return NextResponse.json({ success: false, error: "Notebook not available" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled";
  const content = typeof body.content === "string" ? body.content : "";
  if (!wallet) {
    return NextResponse.json({ success: false, error: "Missing wallet" }, { status: 400 });
  }
  const entries = await getNotebook(wallet);
  if (entries.length >= NOTEBOOK_MAX) {
    return NextResponse.json(
      { success: false, error: `Notebook limit reached (max ${NOTEBOOK_MAX} entries). Delete one to add more.` },
      { status: 403 }
    );
  }
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const entry: NotebookEntry = { id, title: title || "Untitled", content, createdAt };
  entries.unshift(entry);
  await setNotebook(wallet, entries);
  return NextResponse.json({ success: true, entry });
}

/** PATCH /api/notebook – update entry. Body: { wallet, id, title?, content? } */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const id = typeof body.id === "string" ? body.id : "";
  if (!wallet || !id) {
    return NextResponse.json({ success: false, error: "Missing wallet or id" }, { status: 400 });
  }
  const entries = await getNotebook(wallet);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
  }
  if (typeof body.title === "string") entries[idx].title = body.title.trim() || "Untitled";
  if (typeof body.content === "string") entries[idx].content = body.content;
  await setNotebook(wallet, entries);
  return NextResponse.json({ success: true, entry: entries[idx] });
}

/** DELETE /api/notebook?id=&wallet= */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet?.trim() || !id) {
    return NextResponse.json({ success: false, error: "Missing wallet or id" }, { status: 400 });
  }
  const entries = await getNotebook(wallet.trim());
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) {
    return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
  }
  await setNotebook(wallet.trim(), next);
  return NextResponse.json({ success: true });
}
