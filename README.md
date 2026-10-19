# Chess Coach — personal game review PWA

A client-only chess review and coaching app for one chess.com account. No login, no backend,
no paid APIs: games come from the public chess.com API, analysis runs locally with
Stockfish (WASM, in a Web Worker), and everything is cached in IndexedDB.

- **Games**: your chess.com games (cached instantly, refreshed in the background), with filters.
- **Review**: board, eval bar, eval graph, move list, best-move arrow and engine line,
  chess.com-style move classification and accuracy for both players.
- **Auto-analysis**: new games are analyzed in the background (depth 12). This pauses while the app is hidden.
- **Coach**: your top weaknesses with links to the real positions, accuracy by phase, worst
  openings, time management, and trends.
- **Puzzles**: built from your own blunders and missed tactics, with spaced repetition (1 → 3 → 7 days).
- **Stats**: win rates, rating history, openings, and accuracy over time.
- **Openings**: your repertoire (Queen's Gambit as White, Caro-Kann as Black by default, see `REPERTOIRE`
  in `src/config.ts`): results per variation, an explorer of your own games, and your opening mistakes.
- **Opening trainer**: learn Stockfish's best moves in every variation up to move 8/10/12. You can train a
  random variation, a chosen one, or mixed lines, with spaced repetition. It also counts how many variations
  you know 100%.

## Setup

1. Set your username in `src/config.ts`:
   ```ts
   export const USERNAME = "katileasy";
   ```
2. Install and run (Node 20+):
   ```bash
   npm install
   npm run dev        # http://localhost:5173
   ```
   `npm install` copies the single-threaded *lite* Stockfish build (`stockfish-19-lite-single.js/.wasm`)
   from the `stockfish` package into `public/stockfish/`. This build needs no SharedArrayBuffer and no
   COOP/COEP headers, so it works on iOS Safari and on any static host.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check and build to `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (win%, accuracy, classification, phases, spaced repetition) |

Settings (gear icon on the Games tab) let you change the manual analysis depth (default 16) and
turn background analysis on or off.

## Deploy

### Vercel
1. Push the repo to GitHub and import it in Vercel.
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist`.
3. You don't need any extra configuration. The app uses hash routing (`#/coach`), so it needs no rewrites.

### GitHub Pages
The site is served from `https://<user>.github.io/<repo>/`, so Vite needs that base path:

```bash
BASE_PATH=/<repo>/ npm run build      # or: npm run build:gh  (uses /chesskatileasy/)
```

Then publish `dist/`. One option is a GitHub Actions workflow (`.github/workflows/pages.yml`):

```yaml
name: Deploy to Pages
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: BASE_PATH=/${{ github.event.repository.name }}/ npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

Under *Settings → Pages*, set the source to **GitHub Actions**.

## Add to the iPhone home screen

1. Open the deployed URL in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch it from the home screen. It runs full-screen (standalone) with a dark status bar
   and respects the notch and home indicator.

After the first visit, the service worker caches the app shell and the Stockfish files, so the app
opens offline and shows your cached games. Analysis also works offline.

## How it works

- **Classification**: each position is evaluated from the side-to-move perspective. Mate scores
  become ±10000 cp. Win% is `50 + 50·(2/(1+e^(−0.00368208·cp)) − 1)`. The loss for a move is
  the mover's win% before it minus their win% after it. Moves are classified with these thresholds:
  Best = the engine's top move, Excellent ≤ 0.02, Good ≤ 0.05, Inaccuracy ≤ 0.10, Mistake ≤ 0.20,
  Blunder > 0.20. Book, Brilliant (a sound sacrifice of ≥ 2 pawns) and Miss (failing to punish an
  opponent's blunder) are approximations.
- **Accuracy**: per move it is `103.1668·e^(−0.04354·loss%) − 3.1669`. Game accuracy is the
  average of the arithmetic and harmonic means.
- **Patterns** are rule-based: hanging piece, missed tactic, missed punish, time trouble,
  endgame technique and opening prep. See `src/analysis/build.ts`.
- **Storage**: IndexedDB stores games, analyses (raw engine evals plus classified moves), puzzles and
  settings. If the classification logic changes, stored analyses are re-classified from the saved
  evals without running the engine again.

## Development notes

The sandbox used to build this app could not reach chess.com, so `e2e/` contains a fixture
generator (`node e2e/generate-fixtures.cjs 60`, which has Stockfish play low-skill games) and
Playwright scripts that mock the chess.com API, e.g. `node e2e/phase2.mjs` with the dev server running.
