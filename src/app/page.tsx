"use client";

import { useState, useEffect, useRef } from "react";
// Wallet components removed per user request

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

  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackName, setTrackName] = useState("Untitled");
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const [library, setLibrary] = useState<{ id: string; name: string; audioUrl: string }[]>([]);
  const [lastGeneratedTracks, setLastGeneratedTracks] = useState<{ id: string; name: string; audioUrl: string }[]>([]);

  const [progressStatus, setProgressStatus] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartRef = useRef(0);
  const progressEtaRef = useRef(120);

  /* Mobile State */
  const [showGenres, setShowGenres] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  /* Typing animation state */
  const [placeholderText, setPlaceholderText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

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

      if (!musicGptRes.ok || !musicGptData.success) {
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

      const newTracks = successUrls.map((url, i) => ({
        id: crypto.randomUUID(),
        name: ids.length > 1 ? `${trackName} (Ver ${i + 1})` : trackName || "Untitled",
        audioUrl: url
      }));

      setLibrary((prev) => [...newTracks, ...prev]);
      setLastGeneratedTracks(newTracks);
      setAudioUrl(successUrls[0]);
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen overflow-hidden text-white font-sans selection:bg-pink-500/30">

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-black/40 backdrop-blur-xl border-b border-white/10 z-50 sticky top-0">
        <button
          onClick={() => setShowGenres(!showGenres)}
          className="p-2 rounded-lg bg-white/5 border border-white/10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 animate-glow" />
          <span className="font-bold text-lg">Music Studio</span>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 rounded-lg bg-white/5 border border-white/10 relative"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {library.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full" />}
        </button>
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
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 animate-glow" />
            <h2 className="text-xl font-bold tracking-tight">Music Studio</h2>
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

          {/* Wallet Connect Button Placeholder */}
          {/* <div className="p-4 border-t border-white/10">
               <WalletMultiButton className="w-full !bg-purple-600 hover:!bg-purple-700 !rounded-2xl !h-12 !font-bold" />
            </div> */}
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
              <div className="px-4 py-2 rounded-full bg-black/20 border border-white/5 text-xs font-mono text-white/70 shadow-sm flex-1 md:flex-none text-center">
                BPM: AUTO
              </div>
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
                  </div>

                  <div className="glass-input p-0 overflow-hidden relative group">
                    <textarea
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder="Enter your lyrics here..."
                      rows={6}
                      className="w-full bg-transparent p-4 md:p-6 text-sm md:text-base leading-relaxed text-white placeholder-white/20 resize-none focus:outline-none custom-scrollbar"
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
                  <p className="mt-4 text-center text-xs text-white/30">Free Preview • 50¢ USDC for Full Quality</p>
                </div>
              </div>
            </div>

            {/* Right Sidebar - History (Desktop: Static, Mobile: Fixed Overlay) */}
            <aside className={`
               fixed inset-0 z-40 bg-black/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 md:relative md:bg-gray-50/5 md:backdrop-blur-none md:z-auto md:w-80 md:flex md:flex-col md:border-l md:border-white/10
               ${showHistory ? 'translate-x-0' : 'translate-x-full'}
            `}>
              {/* Mobile Header for History */}
              <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Your History</h3>
                <button onClick={() => setShowHistory(false)} className="p-2 text-white/60">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="hidden md:block p-6 border-b border-white/10">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/60">History</h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {library.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <p className="text-sm font-medium">No tracks generated yet</p>
                  </div>
                ) : (
                  library.map((track) => (
                    <div key={track.id} className="group relative bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-all duration-300 border border-white/5 hover:border-white/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                          🎵
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate">{track.name}</h4>
                          <p className="text-[10px] uppercase tracking-wider text-white/40">Generated</p>
                        </div>
                      </div>

                      <audio className="w-full h-8 mb-3 opacity-80 hover:opacity-100 transition-opacity" controls src={track.audioUrl} />

                      <div className="flex gap-2">
                        <a
                          href={track.audioUrl}
                          download={`${track.name.replace(/\s+/g, '_')}.mp3`}
                          className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/20 text-xs font-semibold text-center text-white/70 hover:text-white transition-colors"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => setLastGeneratedTracks([track])}
                          className="flex-1 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-xs font-semibold text-center text-pink-300 hover:text-white transition-colors"
                        >
                          Load
                        </button>
                      </div>
                      <button className="w-full mt-2 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 text-xs font-bold text-indigo-300 transition-colors">
                        Unlock Full Quality (0.50 USDC)
                      </button>
                    </div>
                  ))
                )}
              </div>
            </aside>

          </div>
        </div>
      </main>
    </div>
  );
}
