"use client";

import { useState, useEffect, useRef } from "react";

const GENRES = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Electronic",
  "R&B",
  "Jazz",
  "Country",
  "Indie",
  "Classical",
  "Lo-fi",
  "K-Pop",
  "Metal",
  "Reggae",
];

export default function Home() {
  const [genre, setGenre] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [theme, setTheme] = useState("");
  const [mood, setMood] = useState("");
  const DURATION = 60;
  const [opacity, setOpacity] = useState(100);
  const [blur, setBlur] = useState(22);
  const [translucency, setTranslucency] = useState(50);
  const [specular, setSpecular] = useState(true);
  const [blurOn, setBlurOn] = useState(true);
  const [translucencyOn, setTranslucencyOn] = useState(true);
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

  /* New state for typing animation */
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
            timeout = setTimeout(step, 2000); // Checkpoint: Wait before deleting
          }
        } else {
          if (i >= 0) {
            setPlaceholderText(text.slice(0, i));
            i--;
            timeout = setTimeout(step, 50);
          } else {
            direction = 1;
            timeout = setTimeout(step, 500); // Checkpoint: Wait before retyping
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

      // Start progress simulation
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

      // Helper to poll a specific ID
      const pollId = async (id: string, isPrimary: boolean): Promise<string | null> => {
        try {
          while (true) {
            const statusRes = await fetch(
              `/api/musicgpt-status?conversion_id=${encodeURIComponent(id)}`
            );
            const statusData = await statusRes.json();

            if (!statusData.success && statusData.error) {
              // Be tolerant of temporary DB/connection errors
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
              // If it's the primary track, we throw to alert the user. 
              // If secondary, we just return null to skip it.
              if (isPrimary) throw new Error(statusData.error || "Generation failed");
              return null;
            }

            // Wait and retry
            await new Promise((r) => setTimeout(r, pollIntervalMs));
          }
        } catch (e) {
          if (isPrimary) throw e;
          return null;
        }
      };

      // Poll the first ID to drive UI feedback
      const primaryUrl = await pollId(ids[0], true);

      // Stop progress once primary is done
      stopProgress();
      setProgressPercent(100);
      setProgressStatus("Finalizing variations...");

      // Collect results
      const successUrls: string[] = [];
      if (primaryUrl) successUrls.push(primaryUrl);

      // Poll others if any (conceptually they are running in parallel, so this should be fast)
      if (ids.length > 1) {
        const secondaryPromises = ids.slice(1).map(id => pollId(id, false));
        const secondaryResults = await Promise.all(secondaryPromises);
        secondaryResults.forEach(url => { if (url) successUrls.push(url); });
      }

      setDebugLog((prev) => [...prev, `MusicGPT completed. Got ${successUrls.length} tracks.`]);

      if (successUrls.length === 0) {
        throw new Error("Generation failed for all variations.");
      }

      // Add to library
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
    <div className="flex min-h-screen overflow-hidden text-white font-sans selection:bg-pink-500/30">

      {/* Sidebar - Genres */}
      <aside className="glass-panel relative z-10 flex w-72 flex-col border-r-0 my-4 ml-4">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
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
                onClick={() => setGenre(g)}
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
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col p-4 h-screen overflow-hidden">
        <div className="glass-panel flex flex-1 flex-col overflow-hidden shadow-2xl mx-2">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-8 py-6 backdrop-blur-xl">
            <div className="min-w-0 flex-1 relative">
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
                  className="w-full max-w-md bg-transparent text-3xl font-bold text-white placeholder-white/20 focus:outline-none tracking-tight relative z-10"
                />
                {isTyping && trackName === "Untitled" && (
                  <div className="absolute top-0 left-0 pointer-events-none text-3xl font-bold text-white/30 typing-animation">
                    {placeholderText}
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-white/50">AI Music Generation • {genre || "Custom Style"}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-full bg-black/20 border border-white/5 text-xs font-mono text-white/70">
                BPM: AUTO
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-row overflow-hidden">
            {/* Center Input Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-3xl mx-auto space-y-8">

                {/* Lyrics Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                      <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      Lyrics & Content
                    </h3>
                    <button
                      onClick={handleGenerateLyrics}
                      disabled={generatingLyrics}
                      className="text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors uppercase tracking-wide disabled:opacity-50"
                    >
                      {generatingLyrics ? "Writing..." : "+ Auto-Write Lyrics"}
                    </button>
                  </div>

                  {/* Lyrics Controls */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
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
                      rows={8}
                      className="w-full bg-transparent p-6 text-base leading-relaxed text-white placeholder-white/20 resize-none focus:outline-none custom-scrollbar"
                    />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                </section>

                {/* Style Section */}
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    Musical Style
                  </h3>
                  <div className="space-y-1.5">
                    <input
                      value={stylePrompt}
                      onChange={(e) => setStylePrompt(e.target.value)}
                      placeholder="Describe the sound (e.g. '80s synthwave with heavy bass')"
                      className="glass-input w-full px-4 py-4 text-lg font-medium placeholder-white/20"
                    />
                  </div>
                </section>

                {/* Generation Area */}
                <div className="pt-4">
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
                    className="liquid-button liquid-button-primary w-full py-5 text-xl font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
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
                          <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sidebar - History included in main panel for better glassy feel */}
            <div className="w-80 border-l border-white/10 bg-black/10 flex flex-col">
              <div className="p-6 border-b border-white/10">
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
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{track.name}</h4>
                          <p className="text-[10px] uppercase tracking-wider text-white/40">Generated</p>
                        </div>
                      </div>

                      <audio className="w-full h-6 mb-3 opacity-60 hover:opacity-100 transition-opacity" controls src={track.audioUrl} />

                      <div className="flex gap-2">
                        <a
                          href={track.audioUrl}
                          download={`${track.name.replace(/\s+/g, '_')}.mp3`}
                          className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/20 text-xs font-semibold text-center text-white/70 hover:text-white transition-colors"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => setLastGeneratedTracks([track])}
                          className="flex-1 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-xs font-semibold text-center text-pink-300 hover:text-white transition-colors"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
