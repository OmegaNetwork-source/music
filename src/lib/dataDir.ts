import path from "path";
import os from "os";

/**
 * Root directory for store and audio files.
 * - On Vercel: use /tmp (only writable dir; data is ephemeral per instance).
 * - Else: MUSIC_STUDIO_DATA_DIR if set, otherwise process.cwd().
 */
export const DATA_DIR =
  process.env.VERCEL === "1"
    ? os.tmpdir()
    : process.env.MUSIC_STUDIO_DATA_DIR
      ? path.resolve(process.env.MUSIC_STUDIO_DATA_DIR)
      : process.cwd();

export const STORE_FILE_PATH = path.join(DATA_DIR, ".music-studio-store.json");
export const AUDIO_DIR_PATH = path.join(DATA_DIR, ".music-studio-audio");
