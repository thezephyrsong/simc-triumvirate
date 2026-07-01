# Triumvirate SimC

SimulationCraft EP weight calculator for [Triumvirate WoW](https://triumvirate.gg) —
a WotLK 3.3.5a private server with a level-60 cap and custom talent trees.

Paste your [TopFit](https://www.curseforge.com/wow/addons/topfit) gear export,
hit Run, and get stat weights back. No install required for guildmates — they
just open the webpage.

```
Frontend  → GitHub Pages  (static, free, auto-deploys on push)
Backend   → Render/Railway (Docker, runs the simc binary, free tier)
```

---

## Repo structure

```
simc-triumvirate/
├── engine/          Patched simc 335-1 C++ source
├── vs/              stdint.h shim (Windows build only)
├── backend/
│   ├── server.js    Express API wrapping the simc binary
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx  Main React UI
│   │   └── main.jsx Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── Dockerfile       Compiles simc on Linux, runs Express
└── .github/workflows/deploy-frontend.yml
```

---

## What's patched in the engine

`engine/sc_rating.cpp` — `get_attribute_base()` previously returned zero for
any level below 60. Now levels 1–59 are approximated via backward linear
extrapolation from the level-60 table row, so mid-leveling exports don't sim
with zero base stats. Level-60 values are exact; sub-60 is a stopgap estimate.

---

## Local development

### Prerequisites
- Node.js 20+
- Docker Desktop (for backend) or a local Linux simc binary

### Backend (local)

```bash
# Build the simc binary natively (Linux/Mac only)
cd engine && make && cd ..

# Or skip the binary and use Docker:
docker build -t simc-triumvirate .
docker run -p 3000:3000 simc-triumvirate
```

If running natively (not Docker):
```bash
cd backend
npm install
SIMC_BIN=../engine/simc node server.js
```

Backend runs on http://localhost:3000
Test it: `curl http://localhost:3000/api/health`

### Frontend (local)

```bash
cd frontend
npm install

# Tell the frontend where your local backend is
echo "VITE_API_URL=http://localhost:3000" > .env.local

npm run dev
```

Frontend runs on http://localhost:5173

---

## Deploying the backend (Render or Railway)

Both platforms support Docker deploys directly from a GitHub repo.
The `Dockerfile` compiles the simc binary at image build time, so no
binary needs to be committed.

### Render (free tier)

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Set:
   - **Runtime**: Docker
   - **Dockerfile path**: `./Dockerfile`  (default, leave as-is)
   - **Instance type**: Free
4. Deploy. Note the URL it gives you (e.g. `https://simc-triumvirate.onrender.com`)

**Free tier caveat:** Render spins down after 15 min of inactivity.
The first request after idle takes ~30s to cold-start. Subsequent requests
are fast. You can work around this with a simple uptime monitor (e.g.
https://uptimerobot.com — free — pinging `/api/health` every 5 min).

### Railway (free tier)

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Railway auto-detects the Dockerfile
3. Add env var `PORT=3000` if not already set (Railway injects `PORT` automatically)
4. Note your public URL

Railway's free tier has a monthly compute-hour cap (~500 hrs) but no cold
starts — the container stays warm.

---

## Deploying the frontend (GitHub Pages)

### One-time setup

1. In your GitHub repo: **Settings → Pages**
   - Source: **GitHub Actions**

2. Add your backend URL as a secret:
   **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VITE_API_URL`
   - Value: `https://your-backend.onrender.com` (or Railway URL)

3. If your repo is named something other than `simc-triumvirate`, update the
   base path:
   **Settings → Secrets and variables → Actions → Variables → New variable**
   - Name: `VITE_BASE_PATH`
   - Value: `/your-repo-name/`

   Or just edit `frontend/vite.config.js` directly.

### Deploying

Push to `main` — the GitHub Action builds the React app and deploys it
automatically. Your site will be live at:

```
https://<your-github-username>.github.io/simc-triumvirate/
```

---

## Adding the CORS origin for your Pages URL

Edit `backend/server.js` and add your exact GitHub Pages URL to
`ALLOWED_ORIGINS`:

```js
const ALLOWED_ORIGINS = [
  /^https:\/\/[\w-]+\.github\.io$/,   // already matches all *.github.io
  /^http:\/\/localhost(:\d+)?$/,
];
```

The existing wildcard `*.github.io` pattern already covers it — no change
needed unless you're hosting the frontend on a custom domain, in which case
add:

```js
/^https:\/\/your-custom-domain\.com$/,
```

---

## Building simc.exe for Windows (Visual Studio)

See `BUILD.md` in the `engine/` folder (or the separate `simc335-triumvirate`
package) for full Visual Studio build instructions. The Windows binary is only
needed if you want to run sims locally on Windows; the web tool uses the Linux
binary built inside Docker.

---

## Known limitations

- **Trinket procs** — TopFit exports trinkets without stats when they have
  on-use/proc effects. Add `stats=` manually to trinket lines if the proc
  matters for your spec's DPS (e.g. a crit rating proc).
- **Custom Triumvirate stats** — any Triumvirate-specific tooltip stats not
  in the standard 3.3.5a stat table (e.g. custom set bonus effects) won't
  be parsed by simc and need manual accounting.
- **Sub-60 base stats** — extrapolated, not exact. Level-60 endgame sims are
  accurate; leveling sims are ballpark only.
- **Race racials** — simc only models Orc/Troll/Tauren/Draenei racials for
  the classes that can be those races in retail. Custom Triumvirate race+class
  combos fall back to Orc silently (no racial contribution to DPS).
