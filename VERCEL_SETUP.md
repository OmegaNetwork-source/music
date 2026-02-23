# Vercel setup: persistent tracks (Blob + Redis)

So generated songs **stay** on the live site instead of disappearing.

## 1. Vercel Blob (audio files)

1. In the [Vercel Dashboard](https://vercel.com), open your **music** project.
2. Go to **Storage**.
3. Click **Create Database** (or **Add Storage**) → choose **Blob**.
4. Create a store (e.g. name: `music-audio`). Region: pick one close to you.
5. Connect it to your project. Vercel will add **`BLOB_READ_WRITE_TOKEN`** to your project env (you don’t need to copy it yourself).

## 2. Upstash Redis (track metadata)

1. In the same project, go to **Storage** (or **Integrations**).
2. **Create Database** → choose **Upstash Redis** (or install “Upstash” from the Marketplace).
3. Sign in / sign up with Upstash if asked.
4. Create a Redis database (free tier is enough). Connect it to your project.
5. Vercel will add:
   - **`UPSTASH_REDIS_REST_URL`**
   - **`UPSTASH_REDIS_REST_TOKEN`**

## 3. Env vars you already have

Keep these in **Settings → Environment Variables** (for Production and Preview if you use them):

- `MUSICGPT_API_KEY`
- `GROQ_API_KEY`
- `TREASURY_WALLET`
- `NEXT_PUBLIC_TREASURY_WALLET`
- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `SOLANA_RPC_URL`

You do **not** need `MUSIC_STUDIO_DATA_DIR` on Vercel when Blob + Redis are set.

## 4. Redeploy

After adding Blob and Redis and linking them to the project:

- **Deployments** → open the **⋯** on the latest deployment → **Redeploy**.

Once the new deployment is live, the app will use Blob for audio and Redis for metadata so tracks persist across requests.

## 5. Storage limits (free tier)

- **Tracks:** Max 50 by default. Set `MUSIC_STUDIO_MAX_TRACKS` in env to change. When the limit is reached, users see an error and must remove old tracks to add new ones.
- **Notebook:** Lyric/notes are stored in Redis (max 20 entries per wallet). Requires Redis; if Redis is not set, the Notebook tab shows empty.
