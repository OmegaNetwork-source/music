"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import Link from "next/link";
import { OmegaMusicLogo } from "@/components/OmegaMusicLogo";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_DECIMALS = 6;
const PREVIEW_SECONDS = 25;
const UNLOCK_AMOUNT_RAW = 500_000; // 0.50 USDC (6 decimals)

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function TrackCard({
  track,
  artist,
  artists,
  isUnlocked,
  downloadSignature,
  isPaying,
  onPay,
  onLoad,
  onRemove,
  onAssignArtist,
  onRename,
  onPlay,
  previewSeconds,
}: {
  track: { id: string; name: string; artistId?: string; audioUrl?: string };
  artist?: Artist | null;
  artists: Artist[];
  isUnlocked: boolean;
  downloadSignature?: string;
  isPaying: boolean;
  onPay: () => void;
  onLoad: () => void;
  onRemove: () => void;
  onAssignArtist: (artistId: string | null) => void;
  onRename?: (name: string) => void;
  onPlay?: () => void;
  previewSeconds: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlayReportRef = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(track.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isLegacy = Boolean(track.audioUrl);
  const fullAudioUrl =
    isUnlocked && downloadSignature
      ? `/api/track/${track.id}/download?signature=${encodeURIComponent(downloadSignature)}`
      : null;
  const audioSrc =
    isLegacy && isUnlocked
      ? track.audioUrl!
      : fullAudioUrl ?? (isLegacy ? track.audioUrl! : `/api/track/${track.id}/preview`);
  const handleTimeUpdate = () => {
    if (isUnlocked) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.currentTime >= previewSeconds) {
      el.pause();
      el.currentTime = 0;
    }
  };
  const handlePlay = () => {
    if (onPlay && Date.now() - lastPlayReportRef.current > 3000) {
      lastPlayReportRef.current = Date.now();
      onPlay();
    }
  };
  const saveRename = () => {
    const name = editNameValue.trim() || track.name;
    if (name !== track.name && onRename) onRename(name);
    setEditingName(false);
  };
  if (loadFailed) {
    return (
      <div className="rounded-2xl p-4 border border-amber-500/30 bg-amber-500/10">
        <h4 className="text-sm font-bold text-white truncate mb-1">{track.name}</h4>
        <p className="text-xs text-amber-200/90 mb-3">
          Track no longer available (e.g. from before a server restart).
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/80"
        >
          Remove from history
        </button>
      </div>
    );
  }

  return (
    <div className="group relative bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-all duration-300 border border-white/5 hover:border-white/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
          🎵
        </div>
        <div className="min-w-0 flex-1">
          {editingName && onRename ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") { setEditNameValue(track.name); setEditingName(false); } }}
              className="w-full text-sm font-bold text-white bg-white/10 rounded-lg px-2 py-1 border border-white/20 focus:outline-none focus:ring-1 focus:ring-white/40"
              autoFocus
            />
          ) : (
            <h4
              className={`text-sm font-bold text-white truncate ${onRename ? "cursor-pointer hover:text-white/90 hover:underline" : ""}`}
              title={onRename ? "Click to rename" : undefined}
              onClick={() => onRename && (setEditNameValue(track.name), setEditingName(true))}
            >
              {track.name}
            </h4>
          )}
          {artist ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-5 h-5 rounded-full bg-white/20 overflow-hidden shrink-0">
                {artist.imageUrl ? (
                  <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/70">
                    {artist.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-white/50 truncate">{artist.name}</span>
            </div>
          ) : null}
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
            {previewSeconds}s preview • {isUnlocked ? "Full download unlocked" : "Pay 0.50 USDC for full"}
          </p>
        </div>
      </div>
      {artists.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <label className="text-[10px] text-white/40 shrink-0">Artist:</label>
          <select
            value={track.artistId ?? ""}
            onChange={(e) => onAssignArtist(e.target.value || null)}
            className="glass-input text-xs py-1.5 px-2 rounded-lg flex-1 min-w-0"
          >
            <option value="">— None —</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}
      <audio
        ref={audioRef}
        key={audioSrc}
        className="w-full h-8 mb-2 opacity-80 hover:opacity-100 transition-opacity"
        controls
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onError={() => setLoadFailed(true)}
      />
      <p className="text-[10px] text-white/40 mb-3">
        {isUnlocked ? "Full track" : `Preview limited to ${previewSeconds} seconds`}
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
        {isUnlocked ? (
          isLegacy ? (
            <a
              href={track.audioUrl}
              download={`${track.name.replace(/\s+/g, "_")}.mp3`}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/20 text-xs font-semibold text-center text-white/70 hover:text-white transition-colors"
            >
              Download full
            </a>
          ) : downloadSignature ? (
            <a
              href={`/api/track/${track.id}/download?signature=${encodeURIComponent(downloadSignature)}`}
              download={`${track.name.replace(/\s+/g, "_")}.mp3`}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/20 text-xs font-semibold text-center text-white/70 hover:text-white transition-colors"
            >
              Download full
            </a>
          ) : (
            <span className="flex-1 py-2 rounded-lg bg-white/5 text-xs font-semibold text-center text-white/50">
              Download full
            </span>
          )
        ) : (
          <button
            onClick={onPay}
            disabled={isPaying}
            className="flex-1 py-2 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-400/30 text-xs font-semibold text-center text-emerald-200 hover:text-white transition-colors disabled:opacity-50"
          >
            {isPaying ? "Confirm in Phantom…" : "Unlock full — 0.50 USDC"}
          </button>
        )}
        <button
          onClick={onLoad}
          className="flex-1 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-xs font-semibold text-center text-pink-300 hover:text-white transition-colors"
        >
          Load
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="py-2 px-3 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/30 text-xs font-semibold text-white/60 hover:text-red-300 transition-colors"
          title="Remove from history"
        >
          Remove
        </button>
        </div>
      </div>
    </div>
  );
}

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "Electronic", "R&B", "Jazz",
  "Country", "Indie", "Classical", "Lo-fi", "K-Pop", "Metal", "Reggae"
];

export default function Home() {
  const [genre, setGenre] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [theme, setTheme] = useState("");
  const [mood, setMood] = useState("");
  const [lyricsStyle, setLyricsStyle] = useState("");
  const [contentDirection, setContentDirection] = useState("");

  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackName, setTrackName] = useState("Untitled");
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const LIBRARY_KEY = "music-studio-library";
  const UNLOCKED_KEY = "music-studio-unlocked";

  const [library, setLibrary] = useState<{ id: string; name: string; artistId?: string; audioUrl?: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [lastGeneratedTracks, setLastGeneratedTracks] = useState<{ id: string; name: string; artistId?: string; audioUrl?: string }[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [showCreateArtist, setShowCreateArtist] = useState(false);
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistImage, setNewArtistImage] = useState<string | null>(null);
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [editingSlugArtistId, setEditingSlugArtistId] = useState<string | null>(null);
  const [editingSlugValue, setEditingSlugValue] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [editingProfileArtistId, setEditingProfileArtistId] = useState<string | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editYoutubeUrl, setEditYoutubeUrl] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [unlockedTrackIds, setUnlockedTrackIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(UNLOCKED_KEY);
      const data = raw ? JSON.parse(raw) as { trackIds?: string[]; signatures?: Record<string, string> } : null;
      return new Set(data?.trackIds ?? []);
    } catch {
      return new Set();
    }
  });
  const [unlockedSignatures, setUnlockedSignatures] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(UNLOCKED_KEY);
      const data = raw ? JSON.parse(raw) as { trackIds?: string[]; signatures?: Record<string, string> } : null;
      return data?.signatures ?? {};
    } catch {
      return {};
    }
  });
  const [payingTrackId, setPayingTrackId] = useState<string | null>(null);
  const [paymentTx, setPaymentTx] = useState<{ trackId: string; signature: string; onChainConfirmed: boolean } | null>(null);

  const [progressStatus, setProgressStatus] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartRef = useRef(0);
  const progressEtaRef = useRef(120);

  /* Mobile State */
  const [showGenres, setShowGenres] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<"history" | "trending" | "artists">("history");
  const [trending, setTrending] = useState<{ artist: Artist; tracks: { id: string; name: string; plays: number }[]; totalPlays: number }[]>([]);

  /* Typing animation state */
  const [placeholderText, setPlaceholderText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  useEffect(() => {
    if (!publicKey?.toBase58()) return;
    fetch(`/api/artists?wallet=${encodeURIComponent(publicKey.toBase58())}`)
      .then((r) => r.json())
      .then((d) => d.success && setArtists(d.artists ?? []))
      .catch(() => {});
  }, [publicKey?.toBase58()]);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch {
      // ignore quota / private mode
    }
  }, [library]);

  useEffect(() => {
    try {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify({
        trackIds: Array.from(unlockedTrackIds),
        signatures: unlockedSignatures,
      }));
    } catch {
      // ignore
    }
  }, [unlockedTrackIds, unlockedSignatures]);

  const validatedLibraryRef = useRef(false);
  useEffect(() => {
    if (validatedLibraryRef.current || library.length === 0) return;
    validatedLibraryRef.current = true;
    const ids = library.map((t) => t.id).join(",");
    fetch(`/api/track/validate?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !Array.isArray(d.validIds)) return;
        const validSet = new Set(d.validIds as string[]);
        if (validSet.size >= library.length) return;
        setLibrary((prev) => prev.filter((t) => validSet.has(t.id)));
        setUnlockedTrackIds((prev) => {
          const next = new Set(prev);
          next.forEach((id) => {
            if (!validSet.has(id)) next.delete(id);
          });
          return next;
        });
        setUnlockedSignatures((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((trackId) => {
            if (!validSet.has(trackId)) delete next[trackId];
          });
          return next;
        });
      })
      .catch(() => {});
  }, [library.length]);

  useEffect(() => {
    if (rightPanelView !== "trending" && rightPanelView !== "artists") return;
    fetch("/api/trending")
      .then((r) => r.json())
      .then((d) => d.success && setTrending(d.trending ?? []))
      .catch(() => setTrending([]));
  }, [rightPanelView]);

  useEffect(() => {
    if (trackName !== "Untitled") return;

    const text = "Enter Song Name Here";
    let timeout: NodeJS.Timeout;

    const animate = () => {
      let i = 0;
      let direction = 1; // 1 for typing, -1 for deleting

      const step = () => {
        if (direction === 1) {
          if (i <= text.length) {
            setPlaceholderText(text.slice(0, i));
            i++;
            timeout = setTimeout(step, 100);
          } else {
            direction = -1;
            timeout = setTimeout(step, 2000);
          }
        } else {
          if (i >= 0) {
            setPlaceholderText(text.slice(0, i));
            i--;
            timeout = setTimeout(step, 50);
          } else {
            direction = 1;
            timeout = setTimeout(step, 500);
          }
        }
      };
      step();
    };

    if (isTyping) animate();
    return () => clearTimeout(timeout);
  }, [isTyping, trackName]);

  const handleGenerateLyrics = async () => {
    setGeneratingLyrics(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: genre || undefined,
          theme: theme || undefined,
          mood: mood || undefined,
          style: lyricsStyle || undefined,
          contentDirection: contentDirection || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to generate lyrics");
      setLyrics(data.lyrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate lyrics");
    } finally {
      setGeneratingLyrics(false);
    }
  };

  const handleGenerateMusic = async () => {
    setGeneratingMusic(true);
    setError(null);
    setDebugLog([]);
    setAudioUrl(null);
    setProgressStatus("Submitting to MusicGPT…");
    setProgressPercent(0);

    const stopProgress = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    try {
      setDebugLog(["Calling MusicGPT…"]);

      const musicGptRes = await fetch("/api/generate-musicgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: lyrics.trim() || undefined,
          genre: genre || "Pop",
          stylePrompt,
          makeInstrumental: !lyrics.trim(),
        }),
      });

      const musicGptData = await musicGptRes.json();
      console.log("CLIENT DEBUG: MusicGPT Response:", musicGptData);

      if (!musicGptRes.ok || !musicGptData.success) {
        console.error("CLIENT DEBUG: MusicGPT Error:", musicGptData);
        throw new Error(musicGptData.error || "MusicGPT did not return a task");
      }

      // Handle both new array format and legacy single ID
      const ids: string[] = musicGptData.conversion_ids || [];
      if (musicGptData.conversion_id && !ids.includes(musicGptData.conversion_id)) {
        ids.push(musicGptData.conversion_id);
      }

      if (ids.length === 0) throw new Error("No conversion IDs returned");

      const { task_id: taskId, eta } = musicGptData;
      progressStartRef.current = Date.now();
      progressEtaRef.current = typeof eta === "number" && eta > 0 ? eta : 120;
      setProgressStatus("Queued — generating your track…");
      setProgressPercent(5);

      const pollIntervalMs = 5000;

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - progressStartRef.current) / 1000;
        const etaSec = progressEtaRef.current;
        const estimated = Math.min(92, Math.round((elapsed / etaSec) * 100));
        setProgressPercent(estimated);
        const secLeft = etaSec - elapsed;
        setProgressStatus(
          secLeft <= 0
            ? "Finishing up… (this can take a few more minutes)"
            : `Generating… ~${Math.ceil(secLeft)}s left`
        );
      }, 1500);

      const pollId = async (id: string, isPrimary: boolean): Promise<string | null> => {
        try {
          while (true) {
            const statusRes = await fetch(
              `/api/musicgpt-status?conversion_id=${encodeURIComponent(id)}`
            );
            const statusData = await statusRes.json();

            if (!statusData.success && statusData.error) {
              if (/Failed to connect to DB|HTTP_ERROR/i.test(statusData.error)) {
                await new Promise((r) => setTimeout(r, 5000));
                continue;
              }
              throw new Error(statusData.error);
            }

            if (statusData.status === "completed" && statusData.audioUrl) {
              return statusData.audioUrl;
            }
            if (statusData.status === "failed" || statusData.status === "cancelled") {
              if (isPrimary) throw new Error(statusData.error || "Generation failed");
              return null;
            }
            await new Promise((r) => setTimeout(r, pollIntervalMs));
          }
        } catch (e) {
          if (isPrimary) throw e;
          return null;
        }
      };

      const primaryUrl = await pollId(ids[0], true);

      stopProgress();
      setProgressPercent(100);
      setProgressStatus("Finalizing variations...");

      const successUrls: string[] = [];
      if (primaryUrl) successUrls.push(primaryUrl);

      if (ids.length > 1) {
        const secondaryPromises = ids.slice(1).map(id => pollId(id, false));
        const secondaryResults = await Promise.all(secondaryPromises);
        secondaryResults.forEach(url => { if (url) successUrls.push(url); });
      }

      setDebugLog((prev) => [...prev, `MusicGPT completed. Got ${successUrls.length} tracks.`]);

      if (successUrls.length === 0) {
        throw new Error("Generation failed for all variations.");
      }

      const names = successUrls.map((_, i) =>
        ids.length > 1 ? `${trackName} (Ver ${i + 1})` : trackName || "Untitled"
      );
      setProgressStatus("Saving tracks…");
      const newTracks: { id: string; name: string }[] = [];
      for (let i = 0; i < successUrls.length; i++) {
        const audioUrl = successUrls[i];
        const name = names[i];
        const r = await fetch("/api/register-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl, name }),
        });
        const data = await r.json();
        if (!data?.success || !data.trackId) throw new Error(data?.error || "Failed to register track");
        newTracks.push({ id: data.trackId, name });
      }

      setLibrary((prev) => [...newTracks, ...prev]);
      setLastGeneratedTracks(newTracks);
      setAudioUrl(null);
      setProgressStatus("Done");

    } catch (err) {
      stopProgress();
      let msg = err instanceof Error ? err.message : "Failed to generate";
      if (/Failed to connect to DB|HTTP_ERROR|getConversion/i.test(msg)) {
        msg = "MusicGPT is temporarily unavailable. Please try again in a few minutes.";
      }
      setError(msg);
      setDebugLog((prev) => [...prev, `Error: ${msg}`]);
    } finally {
      setGeneratingMusic(false);
      setProgressStatus("");
      setProgressPercent(0);
    }
  };

  const treasuryWallet = process.env.NEXT_PUBLIC_TREASURY_WALLET;

  const handlePayForTrack = useCallback(
    async (trackId: string) => {
      if (!publicKey || !sendTransaction || !treasuryWallet) {
        setError(
          !treasuryWallet
            ? "Treasury not configured"
            : "Connect Phantom wallet to unlock full download"
        );
        return;
      }
      const treasury = new PublicKey(treasuryWallet);
      if (publicKey.equals(treasury)) {
        setError(
          "You're connected with the treasury wallet. Switch to a different wallet in Phantom to pay for tracks (treasury receives the USDC)."
        );
        return;
      }
      setPayingTrackId(trackId);
      setError(null);
      let paymentSent = false;
      try {
        const fromAta = getAssociatedTokenAddressSync(USDC_MINT, publicKey);
        const toAta = getAssociatedTokenAddressSync(USDC_MINT, treasury);
        const transferIx = createTransferCheckedInstruction(
          fromAta,
          USDC_MINT,
          toAta,
          publicKey,
          UNLOCK_AMOUNT_RAW,
          USDC_DECIMALS
        );
        const tx = new Transaction().add(transferIx);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;
        const sig = await sendTransaction(tx, connection, {
          preflightCommitment: "confirmed",
          skipPreflight: false,
        });
        paymentSent = true;
        setPaymentTx({ trackId, signature: sig, onChainConfirmed: false });
        connection.confirmTransaction({
          signature: sig,
          blockhash,
          lastValidBlockHeight,
        }).catch(() => {});
        // Poll from client so user sees "confirmed on-chain" (same as Phantom)
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await connection.getSignatureStatus(sig);
          const ok = status?.value?.confirmationStatus === "confirmed" || status?.value?.confirmationStatus === "finalized";
          if (ok) {
            setPaymentTx((prev) => (prev ? { ...prev, onChainConfirmed: true } : null));
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
        let verifyData: { success: boolean; error?: string } = { success: false };
        for (let attempt = 0; attempt < 5; attempt++) {
          const verifyRes = await fetch("/api/verify-usdc-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionSignature: sig, trackId }),
          });
          verifyData = await verifyRes.json();
          if (verifyData.success) break;
          if (attempt < 4) await new Promise((r) => setTimeout(r, 2500));
        }
        if (!verifyData.success) throw new Error(verifyData.error || "Verification failed");
        setPaymentTx(null);
        setUnlockedTrackIds((prev) => new Set(prev).add(trackId));
        setUnlockedSignatures((prev) => ({ ...prev, [trackId]: sig }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Payment failed. Try again.";
        if (paymentSent) {
          setError(
            "Payment was sent but we couldn’t confirm it yet. Refresh the page in about a minute — the track should unlock, or try Unlock again."
          );
        } else {
          const isRejected = /reject|cancel|denied|user/i.test(msg);
          const isRpcBlocked = /403|blockhash|Access forbidden|rate limit/i.test(msg);
          const isTxFailed = /transaction not found|failed|0x1|insufficient|account not found/i.test(msg);
          setError(
            isRejected
              ? "You cancelled the request in Phantom. Try again when you’re ready to pay."
              : isRpcBlocked
                ? "Solana RPC blocked this request. Add NEXT_PUBLIC_SOLANA_RPC_URL (e.g. Helius) in your host."
                : isTxFailed
                  ? "Transaction failed. Have at least 0.50 USDC (Solana) in Phantom and approve the request."
                  : msg
          );
        }
      } finally {
        setPayingTrackId(null);
      }
    },
    [publicKey, sendTransaction, connection]
  );

  const solscanUrl = paymentTx
    ? `https://solscan.io/tx/${paymentTx.signature}`
    : null;

  const handleCreateArtist = async () => {
    if (!publicKey?.toBase58() || !newArtistName.trim()) return;
    setCreatingArtist(true);
    try {
      const res = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          name: newArtistName.trim(),
          imageUrl: newArtistImage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.artist) {
        setArtists((prev) => [...prev, data.artist]);
        setNewArtistName("");
        setNewArtistImage(null);
        setShowCreateArtist(false);
      }
    } finally {
      setCreatingArtist(false);
    }
  };

  const handleOpenEditProfile = (artist: Artist) => {
    setEditingProfileArtistId(artist.id);
    setEditBio(artist.bio ?? "");
    setEditYoutubeUrl(artist.youtubeUrl ?? "");
    setEditWebsiteUrl(artist.websiteUrl ?? "");
    setEditImageUrl(null);
  };

  const handleSaveProfile = async (artistId: string) => {
    if (!publicKey) return;
    setSavingProfile(true);
    try {
      const artist = artists.find((a) => a.id === artistId);
      const res = await fetch(
        `/api/artists/${artistId}?wallet=${encodeURIComponent(publicKey.toBase58())}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bio: editBio.trim() || undefined,
            youtubeUrl: editYoutubeUrl.trim() || undefined,
            websiteUrl: editWebsiteUrl.trim() || undefined,
            imageUrl: editImageUrl ?? artist?.imageUrl,
          }),
        }
      );
      const data = await res.json();
      if (data.success && data.artist) {
        setArtists((prev) =>
          prev.map((a) => (a.id === artistId ? { ...a, ...data.artist } : a))
        );
        setEditingProfileArtistId(null);
        setEditBio("");
        setEditYoutubeUrl("");
        setEditWebsiteUrl("");
        setEditImageUrl(null);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateArtistSlug = async (artistId: string, slug: string) => {
    if (!publicKey) return;
    setSavingSlug(true);
    try {
      const res = await fetch(
        `/api/artists/${artistId}?wallet=${encodeURIComponent(publicKey.toBase58())}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slug.trim() || undefined }),
        }
      );
      const data = await res.json();
      if (data.success && data.artist) {
        setArtists((prev) =>
          prev.map((a) => (a.id === artistId ? { ...a, slug: data.artist.slug } : a))
        );
        setEditingSlugArtistId(null);
        setEditingSlugValue("");
      }
    } finally {
      setSavingSlug(false);
    }
  };

  const handleAssignArtist = (trackId: string, artistId: string | null) => {
    setLibrary((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, artistId: artistId ?? undefined } : t
      )
    );
    if (publicKey) {
      fetch("/api/assign-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          trackId,
          artistId: artistId ?? null,
        }),
      }).catch(() => {});
    }
  };

  const handleRenameTrack = (trackId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLibrary((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, name: trimmed } : t))
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen overflow-hidden text-white font-sans selection:bg-pink-500/30">

      {/* Full-screen Profile (Producer / Artists) - same style as main */}
      {showProfile && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#111827]">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="glass-panel max-w-2xl mx-auto w-full overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Producer profile</h2>
                <div className="flex items-center gap-2">
                  {publicKey && (
                    profileEditMode ? (
                      <button
                        type="button"
                        onClick={() => setProfileEditMode(false)}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white/80"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setProfileEditMode(true)}
                        className="px-3 py-2 rounded-xl bg-pink-500/30 hover:bg-pink-500/50 text-sm font-semibold text-pink-200"
                      >
                        Edit
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowProfile(false); setProfileEditMode(false); setShowCreateArtist(false); setNewArtistName(""); setNewArtistImage(null); setEditingSlugArtistId(null); setEditingSlugValue(""); setEditingProfileArtistId(null); setEditBio(""); setEditYoutubeUrl(""); setEditWebsiteUrl(""); setEditImageUrl(null); }}
                    className="p-2 rounded-xl glass-input hover:bg-white/10 text-white/80"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {publicKey ? (
                  <>
                    <p className="text-sm text-white/50 mb-6">
                      Wallet: <span className="font-mono text-white/70">{publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}</span>
                    </p>
                    {!profileEditMode ? (
                      /* Read-only view: bio, links, image, songs — no edit controls */
                      <div className="space-y-6">
                        {artists.map((a) => {
                          const assignedTracks = library.filter((t) => t.artistId === a.id);
                          return (
                            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                              <div className="flex items-center gap-4 p-4 border-b border-white/10">
                                <div className="w-14 h-14 rounded-full bg-white/20 overflow-hidden shrink-0">
                                  {a.imageUrl ? (
                                    <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white/70">
                                      {a.name.slice(0, 1)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-base font-semibold text-white truncate">{a.name}</p>
                                  {a.slug && (
                                    <p className="text-xs font-mono text-white/50 mt-0.5">/artist/{a.slug}</p>
                                  )}
                                </div>
                                {a.slug && (
                                  <Link
                                    href={`/artist/${a.slug}`}
                                    className="text-xs text-pink-400 hover:text-pink-300 shrink-0"
                                  >
                                    View profile →
                                  </Link>
                                )}
                              </div>
                              <div className="p-4 space-y-3">
                                {a.bio && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Bio</p>
                                    <p className="text-sm text-white/70 whitespace-pre-wrap">{a.bio}</p>
                                  </div>
                                )}
                                {(a.youtubeUrl || a.websiteUrl) && (
                                  <div className="flex flex-wrap gap-2">
                                    {a.youtubeUrl && (
                                      <a href={a.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-300 hover:text-red-200">YouTube</a>
                                    )}
                                    {a.websiteUrl && (
                                      <a href={a.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 hover:text-white/80">Website</a>
                                    )}
                                  </div>
                                )}
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Songs</p>
                                  {assignedTracks.length > 0 ? (
                                    <ul className="space-y-1 text-sm text-white/70">
                                      {assignedTracks.map((t) => (
                                        <li key={t.id} className="truncate">{t.name}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-white/40">No tracks assigned.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {artists.length === 0 && (
                          <p className="text-sm text-white/40 py-6 px-4">No artists yet. Click Edit to create one.</p>
                        )}
                      </div>
                    ) : (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3 px-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/40">My Artists</span>
                        {!showCreateArtist && (
                          <button
                            type="button"
                            onClick={() => setShowCreateArtist(true)}
                            className="text-xs font-bold text-pink-400 hover:text-pink-300 uppercase"
                          >
                            + New artist
                          </button>
                        )}
                      </div>
                      {showCreateArtist ? (
                        <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                          <input
                            type="text"
                            value={newArtistName}
                            onChange={(e) => setNewArtistName(e.target.value)}
                            placeholder="Artist name"
                            className="glass-input w-full px-4 py-3 text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-white/50 shrink-0">Cover / album image:</label>
                            <input
                              type="file"
                              accept="image/*"
                              className="text-xs text-white/60 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:bg-white/10 file:text-white/80"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const r = new FileReader();
                                r.onload = () => setNewArtistImage(r.result as string);
                                r.readAsDataURL(f);
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCreateArtist}
                              disabled={creatingArtist || !newArtistName.trim()}
                              className="flex-1 py-2.5 rounded-xl bg-pink-500/30 hover:bg-pink-500/50 text-sm font-semibold disabled:opacity-50"
                            >
                              {creatingArtist ? "Creating…" : "Create artist"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCreateArtist(false); setNewArtistName(""); setNewArtistImage(null); }}
                              className="py-2.5 px-4 rounded-xl bg-white/10 text-sm font-semibold text-white/70"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-4">
                        {artists.map((a) => {
                          const assignedTracks = library.filter((t) => t.artistId === a.id);
                          const unassignedOrOther = library.filter((t) => t.artistId !== a.id);
                          return (
                            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                              <div className="flex items-center gap-4 p-4 border-b border-white/10">
                                <div className="relative shrink-0">
                                  <div className="w-14 h-14 rounded-full bg-white/20 overflow-hidden">
                                    {(editingProfileArtistId === a.id && editImageUrl) || (!editingProfileArtistId && a.imageUrl) ? (
                                      <img src={(editingProfileArtistId === a.id && editImageUrl) ? editImageUrl : a.imageUrl!} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white/70">
                                        {a.name.slice(0, 1)}
                                      </div>
                                    )}
                                  </div>
                                  {editingProfileArtistId === a.id && (
                                    <label className="absolute bottom-0 right-0 rounded-full bg-pink-500/80 hover:bg-pink-500 p-1.5 cursor-pointer">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (!f) return;
                                          const r = new FileReader();
                                          r.onload = () => setEditImageUrl(r.result as string);
                                          r.readAsDataURL(f);
                                        }}
                                      />
                                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" /></svg>
                                    </label>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-base font-semibold text-white truncate">{a.name}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {editingSlugArtistId === a.id ? (
                                      <>
                                        <input
                                          type="text"
                                          value={editingSlugValue}
                                          onChange={(e) => setEditingSlugValue(e.target.value)}
                                          placeholder="profile-url"
                                          className="glass-input text-xs px-2 py-1.5 w-40"
                                        />
                                        <button
                                          type="button"
                                          disabled={savingSlug}
                                          onClick={() => handleUpdateArtistSlug(a.id, editingSlugValue)}
                                          className="text-xs font-semibold text-pink-400 hover:text-pink-300"
                                        >
                                          {savingSlug ? "Saving…" : "Save"}
                                        </button>
                                        <button type="button" onClick={() => { setEditingSlugArtistId(null); setEditingSlugValue(""); }} className="text-xs text-white/50">Cancel</button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-xs text-white/40">
                                          {a.slug ? (
                                            <span className="font-mono text-white/60">{a.slug}</span>
                                          ) : (
                                            "No profile URL"
                                          )}
                                        </span>
                                        <button type="button" onClick={() => { setEditingSlugArtistId(a.id); setEditingSlugValue(a.slug ?? ""); }} className="text-xs text-pink-400 hover:text-pink-300">Edit URL</button>
                                      </>
                                    )}
                                  </div>
                                  {a.slug && (
                                    <a
                                      href={`/artist/${a.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 mt-1 text-xs text-white/50 hover:text-white/80"
                                    >
                                      View profile →
                                    </a>
                                  )}
                                  {editingProfileArtistId !== a.id && (
                                    <button type="button" onClick={() => handleOpenEditProfile(a)} className="mt-2 text-xs text-pink-400 hover:text-pink-300">Edit profile (photo, bio, links)</button>
                                  )}
                                </div>
                              </div>
                              {editingProfileArtistId === a.id && (
                                <div className="p-4 border-b border-white/10 space-y-3 bg-white/5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Profile details</p>
                                  <div>
                                    <label className="block text-xs text-white/50 mb-1">Bio</label>
                                    <textarea
                                      value={editBio}
                                      onChange={(e) => setEditBio(e.target.value)}
                                      placeholder="Short bio for your artist page..."
                                      rows={3}
                                      className="glass-input w-full px-3 py-2 text-sm resize-y"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-white/50 mb-1">YouTube URL</label>
                                    <input
                                      type="url"
                                      value={editYoutubeUrl}
                                      onChange={(e) => setEditYoutubeUrl(e.target.value)}
                                      placeholder="https://youtube.com/..."
                                      className="glass-input w-full px-3 py-2 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-white/50 mb-1">Website URL</label>
                                    <input
                                      type="url"
                                      value={editWebsiteUrl}
                                      onChange={(e) => setEditWebsiteUrl(e.target.value)}
                                      placeholder="https://..."
                                      className="glass-input w-full px-3 py-2 text-sm"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={savingProfile}
                                      onClick={() => handleSaveProfile(a.id)}
                                      className="py-2 px-4 rounded-xl bg-pink-500/30 hover:bg-pink-500/50 text-sm font-semibold disabled:opacity-50"
                                    >
                                      {savingProfile ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingProfileArtistId(null); setEditBio(""); setEditYoutubeUrl(""); setEditWebsiteUrl(""); setEditImageUrl(null); }}
                                      className="py-2 px-4 rounded-xl bg-white/10 text-sm font-semibold text-white/70"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div className="p-4 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Songs</p>
                                {assignedTracks.length > 0 ? (
                                  <ul className="space-y-1.5">
                                    {assignedTracks.map((t) => (
                                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm text-white/80">
                                        <span className="truncate">{t.name}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleAssignArtist(t.id, null)}
                                          className="text-[10px] text-white/40 hover:text-red-400 shrink-0"
                                        >
                                          Remove
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-white/40">No tracks assigned yet.</p>
                                )}
                                {library.length > 0 && (
                                  <select
                                    className="glass-input text-xs py-2 px-3 rounded-xl w-full max-w-xs"
                                    value=""
                                    onChange={(e) => {
                                      const trackId = e.target.value;
                                      if (trackId) handleAssignArtist(trackId, a.id);
                                      e.target.value = "";
                                    }}
                                  >
                                    <option value="">+ Assign a track</option>
                                    {unassignedOrOther.map((t) => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {artists.length === 0 && !showCreateArtist && (
                          <p className="text-sm text-white/40 py-6 px-4">No artists yet. Create one to set a profile URL and assign tracks here.</p>
                        )}
                      </div>
                    </div>
                    )}
                  </>
                ) : (
                  <p className="text-white/50">Connect your wallet to manage your producer profile and artists.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-black/40 backdrop-blur-xl border-b border-white/10 z-50 sticky top-0">
        <button
          onClick={() => setShowGenres(!showGenres)}
          className="p-2 rounded-lg bg-white/5 border border-white/10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        <div className="flex items-center gap-2">
          <OmegaMusicLogo size={24} className="animate-glow" />
          <span className="font-bold text-lg">Omega Music</span>
        </div>

        <div className="flex items-center gap-2">
          <WalletMultiButton className="!font-mono" />
          {publicKey && (
            <button
              onClick={() => setShowProfile(true)}
              className="p-2 rounded-lg bg-white/5 border border-white/10"
              title="Producer profile"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 relative"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {library.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full" />}
          </button>
        </div>
      </div>

      {/* Sidebar - Genres (Desktop: Static, Mobile: Fixed Overlay) */}
      <aside className={`
        fixed inset-0 z-40 bg-black/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 md:relative md:bg-transparent md:backdrop-blur-none md:z-10 md:flex md:w-72 md:flex-col md:border-r-0 md:my-4 md:ml-4
        ${showGenres ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <div className="md:hidden p-4 flex justify-end">
          <button onClick={() => setShowGenres(false)} className="p-2 text-white/60">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="glass-panel w-full h-full flex flex-col md:rounded-3xl border-none md:border-solid">
          <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-white/10">
            <OmegaMusicLogo size={32} className="animate-glow" />
            <h2 className="text-xl font-bold tracking-tight">Omega Music</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="mb-3 px-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Vibe Selection</span>
            </div>
            <div className="space-y-1">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => { setGenre(g); setShowGenres(false); }}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-300 ${genre === g
                    ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/10"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full transition-all duration-300 ${genre === g ? "bg-pink-500 scale-125 shadow-[0_0_10px_#ec4899]" : "bg-white/20"
                    }`} />
                  {g}
                </button>
              ))}
            </div>

          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col p-2 md:p-4 md:h-screen md:overflow-hidden">
        <div className="glass-panel flex flex-1 flex-col overflow-hidden shadow-2xl md:mx-2 min-h-[calc(100vh-100px)]">

          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 px-6 py-6 backdrop-blur-xl gap-4">
            <div className="min-w-0 flex-1 relative w-full">
              <div className="relative">
                <input
                  type="text"
                  value={trackName === "Untitled" ? "" : trackName}
                  onChange={(e) => {
                    setTrackName(e.target.value);
                    if (isTyping) setIsTyping(false);
                  }}
                  onBlur={() => {
                    if (!trackName) {
                      setTrackName("Untitled");
                      setIsTyping(true);
                    }
                  }}
                  className="w-full max-w-md bg-transparent text-2xl md:text-3xl font-bold text-white placeholder-white/20 focus:outline-none tracking-tight relative z-10"
                />
                {isTyping && trackName === "Untitled" && (
                  <div className="absolute top-0 left-0 pointer-events-none text-2xl md:text-3xl font-bold text-white/30 typing-animation truncate max-w-full">
                    {placeholderText}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs md:text-sm font-medium text-white/50">AI Music Generation • {genre || "Custom Style"}</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {publicKey && (
                <button
                  type="button"
                  onClick={() => setShowProfile(true)}
                  className="!hidden md:!inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-sm font-semibold text-white/90"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Profile
                </button>
              )}
              <WalletMultiButton className="!font-mono flex-1 md:flex-none !hidden md:!inline-flex" />
            </div>
          </div>

          <div className="flex flex-1 flex-row overflow-hidden relative">
            {/* Center Input Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-24 md:pb-8">
              <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">

                {/* Lyrics Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-semibold text-white/90 flex items-center gap-2">
                      <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      Lyrics & Content
                    </h3>
                    <button
                      onClick={handleGenerateLyrics}
                      disabled={generatingLyrics}
                      className="text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors uppercase tracking-wide disabled:opacity-50"
                    >
                      {generatingLyrics ? "Writing..." : "+ Auto-Write"}
                    </button>
                  </div>

                  {/* Lyrics Controls - Stack on mobile, grid on desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">Theme</label>
                      <input
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="e.g. Cyberpunk Love"
                        className="glass-input w-full px-4 py-3 text-sm placeholder-white/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">Mood</label>
                      <input
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        placeholder="e.g. Energetic"
                        className="glass-input w-full px-4 py-3 text-sm placeholder-white/20"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">Lyrics style</label>
                      <input
                        value={lyricsStyle}
                        onChange={(e) => setLyricsStyle(e.target.value)}
                        placeholder="e.g. Rap, trap, party anthem, ballad"
                        className="glass-input w-full px-4 py-3 text-sm placeholder-white/20"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">Content / direction</label>
                      <textarea
                        value={contentDirection}
                        onChange={(e) => setContentDirection(e.target.value)}
                        placeholder="e.g. Uses profanity, about getting money and flexing, no filter. Or: clean, family-friendly, inspirational."
                        rows={2}
                        className="glass-input w-full px-4 py-3 text-sm placeholder-white/20 resize-none"
                      />
                    </div>
                  </div>

                  <div className="glass-input p-0 overflow-hidden relative group">
                    <textarea
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder="Enter your lyrics here..."
                      rows={6}
                      className="w-full min-h-[180px] bg-transparent p-4 md:p-6 text-sm md:text-base leading-relaxed text-white placeholder-white/20 resize-y focus:outline-none custom-scrollbar"
                    />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                </section>

                {/* Style Section */}
                <section className="space-y-4">
                  <h3 className="text-base md:text-lg font-semibold text-white/90 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    Musical Style
                  </h3>
                  <div className="space-y-1.5">
                    <input
                      value={stylePrompt}
                      onChange={(e) => setStylePrompt(e.target.value)}
                      placeholder="e.g. '80s synthwave'"
                      className="glass-input w-full px-4 py-4 text-base md:text-lg font-medium placeholder-white/20"
                    />
                  </div>
                </section>

                {/* Generation Area */}
                <div className="pt-4 pb-8">
                  {paymentTx && (
                    <div className="mb-6 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 text-sm backdrop-blur-md">
                      <div className="flex flex-col gap-2">
                        <span className="font-medium">
                          {paymentTx.onChainConfirmed
                            ? "✓ Payment confirmed on-chain. Unlocking track…"
                            : "Transaction submitted. Confirming on-chain…"}
                        </span>
                        {solscanUrl && (
                          <a
                            href={solscanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-300 hover:text-emerald-200 underline text-xs"
                          >
                            View on Solscan →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm backdrop-blur-md">
                      ⚠️ {error}
                    </div>
                  )}

                  {generatingMusic && progressStatus && (
                    <div className="mb-8 p-6 rounded-3xl bg-black/20 border border-white/5 backdrop-blur-sm">
                      <div className="flex justify-between text-sm font-medium mb-2 text-white/80">
                        <span>{progressStatus}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-violet-600 transition-all duration-300 shadow-[0_0_15px_#ec4899]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateMusic}
                    disabled={generatingMusic || (!lyrics?.trim() && !stylePrompt && !genre)}
                    className="liquid-button liquid-button-primary w-full py-4 md:py-5 text-lg md:text-xl font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {generatingMusic ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span>Creating Magic...</span>
                        </>
                      ) : (
                        <>
                          <span>Generate Track</span>
                          <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sidebar - History (Desktop: Static, Mobile: Fixed Overlay) */}
            <aside className={`
               fixed inset-0 z-40 bg-black/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 md:relative md:bg-gray-50/5 md:backdrop-blur-none md:z-auto md:w-80 md:flex md:flex-col md:border-l md:border-white/10
               ${showHistory ? 'translate-x-0' : 'translate-x-full'}
            `}>
              {/* Mobile Header for History / Trending */}
              <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRightPanelView("history")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${rightPanelView === "history" ? "bg-white/20 text-white" : "text-white/60"}`}
                  >
                    History
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelView("trending")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 ${rightPanelView === "trending" ? "bg-white/20 text-white" : "text-white/60"}`}
                  >
                    Trending
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelView("artists")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${rightPanelView === "artists" ? "bg-white/20 text-white" : "text-white/60"}`}
                  >
                    Artists
                  </button>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 text-white/60">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="hidden md:flex md:items-center md:gap-2 p-6 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setRightPanelView("history")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${rightPanelView === "history" ? "bg-white/20 text-white border border-white/20" : "bg-white/5 text-white/60 hover:text-white/80 border border-white/10"}`}
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelView("trending")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${rightPanelView === "trending" ? "bg-white/20 text-white border border-white/20" : "bg-white/5 text-white/60 hover:text-white/80 border border-white/10"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  Trending
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelView("artists")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${rightPanelView === "artists" ? "bg-white/20 text-white border border-white/20" : "bg-white/5 text-white/60 hover:text-white/80 border border-white/10"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Artists
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {rightPanelView === "history" ? (
                  library.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                      </div>
                      <p className="text-sm font-medium">No tracks generated yet</p>
                    </div>
                  ) : (
                    library.map((track) => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        artist={track.artistId ? artists.find((a) => a.id === track.artistId) ?? null : null}
                        artists={artists}
                        isUnlocked={unlockedTrackIds.has(track.id)}
                        downloadSignature={unlockedSignatures[track.id]}
                        isPaying={payingTrackId === track.id}
                        onPay={() => handlePayForTrack(track.id)}
                        onLoad={() => setLastGeneratedTracks([track])}
                        onRemove={() => {
                          setLibrary((prev) => prev.filter((t) => t.id !== track.id));
                          setUnlockedTrackIds((prev) => {
                            const next = new Set(prev);
                            next.delete(track.id);
                            return next;
                          });
                          setUnlockedSignatures((prev) => {
                            const { [track.id]: _, ...rest } = prev;
                            return rest;
                          });
                        }}
                        onAssignArtist={(artistId) => handleAssignArtist(track.id, artistId)}
                        onRename={(name) => handleRenameTrack(track.id, name)}
                        onPlay={() => {
                          fetch(`/api/track/${track.id}/listen`, { method: "POST" }).catch(() => {});
                        }}
                        previewSeconds={PREVIEW_SECONDS}
                      />
                    ))
                  )
                ) : rightPanelView === "artists" ? (
                  trending.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4 py-8">
                      <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <p className="text-sm font-medium text-center">No artists yet</p>
                      <p className="text-xs text-white/30 text-center max-w-[200px]">Artists with unlocked tracks appear here. Unlock a track and assign an artist to see them.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-1">Artists</p>
                      <p className="text-xs text-white/50 mb-2">Click an artist to see their profile and songs.</p>
                      <div className="space-y-2">
                        {trending.map(({ artist }) =>
                          artist.slug ? (
                            <Link
                              key={artist.id}
                              href={`/artist/${artist.slug}`}
                              className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 border border-white/10 transition-colors hover:bg-white/10 hover:border-white/20"
                            >
                              <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden shrink-0">
                                {artist.imageUrl ? (
                                  <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/70">
                                    {artist.name.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-medium text-white/90 truncate flex-1">{artist.name}</span>
                              <span className="text-[10px] text-pink-400 shrink-0">View profile →</span>
                            </Link>
                          ) : (
                            <button
                              key={artist.id}
                              type="button"
                              onClick={() => {
                                setShowProfile(true);
                                setEditingSlugArtistId(artist.id);
                                setEditingSlugValue(artist.slug ?? slugify(artist.name));
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 border border-white/10 transition-colors hover:bg-white/10 hover:border-white/20 text-left"
                            >
                              <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden shrink-0">
                                {artist.imageUrl ? (
                                  <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/70">
                                    {artist.name.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-medium text-white/90 truncate flex-1">{artist.name}</span>
                              <span className="text-[10px] text-pink-400 shrink-0">Set profile URL →</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )
                ) : trending.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4 py-8">
                    <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    <p className="text-sm font-medium text-center">No trending yet</p>
                    <p className="text-xs text-white/30 text-center max-w-[200px]">Unlocked tracks with an artist appear here. Unlock a track to see it trend.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6">
                      {trending.map(({ artist, tracks: artistTracks, totalPlays }) => (
                        <div key={artist.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                          <div className="flex items-center gap-3 p-3 border-b border-white/10">
                            <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden shrink-0">
                              {artist.imageUrl ? (
                                <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/70">
                                  {artist.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
                              <p className="text-[10px] text-white/50">{totalPlays} plays</p>
                            </div>
                            {artist.slug && (
                              <Link
                                href={`/artist/${artist.slug}`}
                                className="text-[10px] text-pink-400 hover:text-pink-300 shrink-0"
                              >
                                Profile
                              </Link>
                            )}
                          </div>
                          <ul className="p-2 space-y-1">
                            {artistTracks.map((t) => (
                              <li key={t.id} className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10">
                                <span className="text-xs text-white/90 truncate flex-1">{t.name}</span>
                                <span className="text-[10px] text-white/40 shrink-0">{t.plays} plays</span>
                                <audio
                                  controls
                                  className="h-7 w-24 shrink-0 opacity-90"
                                  preload="metadata"
                                  src={`/api/track/${t.id}/preview`}
                                  onPlay={() => {
                                    fetch(`/api/track/${t.id}/listen`, { method: "POST" }).catch(() => {});
                                    setTrending((prev) =>
                                      prev.map((item) =>
                                        item.artist.id === artist.id
                                          ? {
                                              ...item,
                                              tracks: item.tracks.map((tr) =>
                                                tr.id === t.id ? { ...tr, plays: tr.plays + 1 } : tr
                                              ),
                                              totalPlays: item.totalPlays + 1,
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 mt-6 border-t border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 px-1">Artists</p>
                      <p className="text-xs text-white/50 mb-3">Click an artist to see their profile and songs.</p>
                      <div className="space-y-2">
                        {trending.map(({ artist }) =>
                          artist.slug ? (
                            <Link
                              key={artist.id}
                              href={`/artist/${artist.slug}`}
                              className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 border border-white/10 transition-colors hover:bg-white/10 hover:border-white/20"
                            >
                              <div className="w-9 h-9 rounded-full bg-white/20 overflow-hidden shrink-0">
                                {artist.imageUrl ? (
                                  <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/70">
                                    {artist.name.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-medium text-white/90 truncate flex-1">{artist.name}</span>
                              <span className="text-[10px] text-pink-400 shrink-0">View profile →</span>
                            </Link>
                          ) : (
                            <button
                              key={artist.id}
                              type="button"
                              onClick={() => {
                                setShowProfile(true);
                                setEditingSlugArtistId(artist.id);
                                setEditingSlugValue(artist.slug ?? slugify(artist.name));
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 border border-white/10 transition-colors hover:bg-white/10 hover:border-white/20 text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-white/20 overflow-hidden shrink-0">
                                {artist.imageUrl ? (
                                  <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/70">
                                    {artist.name.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-medium text-white/90 truncate flex-1">{artist.name}</span>
                              <span className="text-[10px] text-pink-400 shrink-0">Set profile URL →</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </aside>

          </div>
        </div>
      </main>
    </div>
  );
}
