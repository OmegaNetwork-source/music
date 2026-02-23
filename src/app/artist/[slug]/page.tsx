import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getArtistBySlug,
  getTracksByArtist,
  getTrack,
  getArtistLikes,
} from "@/lib/trackStore";
import { OmegaMusicLogo } from "@/components/OmegaMusicLogo";
import { ArtistProfileActions } from "./ArtistProfileActions";

type Props = { params: Promise<{ slug: string }> };

export default async function ArtistProfilePage({ params }: Props) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);
  if (!artist) notFound();

  const trackIds = getTracksByArtist(artist.wallet, artist.id);
  const tracks = trackIds
    .map((tid) => {
      const t = getTrack(tid);
      return t ? { id: tid, name: t.name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];
  const likes = getArtistLikes(artist.id);

  return (
    <div className="min-h-screen bg-[var(--background)] text-gray-900 font-sans">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <OmegaMusicLogo size={28} className="animate-glow" />
            <span className="font-bold text-lg">Omega Music</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="glass-panel p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-black/10 overflow-hidden shrink-0 mx-auto md:mx-0">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-500">
                  {artist.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="flex-1 text-center md:text-left min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-1">
                {artist.name}
              </h1>
              <p className="text-sm text-gray-500 font-mono mb-2">
                /artist/{artist.slug}
              </p>
              {artist.bio && (
                <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap max-w-lg">
                  {artist.bio}
                </p>
              )}
              <ArtistProfileActions
                artistId={artist.id}
                initialLikes={likes}
                slug={slug}
              />
              {(artist.youtubeUrl || artist.websiteUrl) && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {artist.youtubeUrl && (
                    <a
                      href={artist.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-sm font-medium text-red-700"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      YouTube
                    </a>
                  )}
                  {artist.websiteUrl && (
                    <a
                      href={artist.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-black/5 hover:bg-black/10 border border-black/10 text-sm font-medium text-gray-800"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9a9 9 0 009 9m0 0c9.21 0 16.667-4.478 16.667-10a10 10 0 00-20 0c0 5.522 7.458 10 16.667 10z" />
                      </svg>
                      Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
              Songs
            </h2>
            {tracks.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">
                No tracks yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {tracks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 bg-black/5 border border-black/5"
                  >
                    <span className="text-gray-900 font-medium truncate flex-1">
                      {t.name}
                    </span>
                    <audio
                      controls
                      className="h-8 w-full max-w-[200px] opacity-90"
                      preload="metadata"
                      src={`/api/track/${t.id}/preview`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
