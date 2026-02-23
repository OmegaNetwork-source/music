"use client";

import { useState, useEffect } from "react";

export function ArtistProfileActions({
  artistId,
  initialLikes,
  slug,
}: {
  artistId: string;
  initialLikes: number;
  slug: string;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("music-studio-liked-artists");
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.includes(artistId)) setLiked(true);
    } catch {
      // ignore
    }
  }, [artistId]);

  const handleLike = async () => {
    if (liked) return;
    try {
      const res = await fetch(`/api/artist/${artistId}/like`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setLikes(data.likes);
        setLiked(true);
        if (typeof window !== "undefined") {
          try {
            const key = "music-studio-liked-artists";
            const raw = localStorage.getItem(key);
            const set = new Set(raw ? JSON.parse(raw) : []);
            set.add(artistId);
            localStorage.setItem(key, JSON.stringify([...set]));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    setSharing(true);
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/artist/${slug}`
        : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Artist on Omega Music",
          url,
          text: `Check out this artist on Omega Music`,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setSharing(false);
        alert("Link copied to clipboard!");
        return;
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
      }
    }
    setSharing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleLike}
        disabled={liked}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-black/5 hover:bg-black/10 border border-black/10 text-sm font-semibold text-gray-900 disabled:opacity-70 disabled:cursor-default transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill={liked ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        {likes} {likes === 1 ? "like" : "likes"}
      </button>
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-black/5 hover:bg-black/10 border border-black/10 text-sm font-semibold text-gray-900 disabled:opacity-70 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {sharing ? "Sharing…" : "Share"}
      </button>
    </div>
  );
}
