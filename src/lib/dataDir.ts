import path from "path";

/**
 * Root directory for store and audio files.
 * Set MUSIC_STUDIO_DATA_DIR to an absolute path if you run multiple workers
 * or see 404s after generating (e.g. "C:\\Users\\you\\Desktop\\Music\\music-studio\\data").
 */
export const DATA_DIR = process.env.MUSIC_STUDIO_DATA_DIR
  ? path.resolve(process.env.MUSIC_STUDIO_DATA_DIR)
  : process.cwd();

export const STORE_FILE_PATH = path.join(DATA_DIR, ".music-studio-store.json");
export const AUDIO_DIR_PATH = path.join(DATA_DIR, ".music-studio-audio");
