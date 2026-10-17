import { gamesStore } from '../lib/games';
import { analysisIndex } from '../lib/analysisIndex';
import { settingsStore } from '../lib/settings';
import { enqueueAuto } from './queue';

let queuedThisSession = 0;
const seen = new Set<string>();

/** Queues not-yet-analyzed games (newest first) for background analysis. */
function scan() {
  const settings = settingsStore.get();
  if (!settings.autoAnalyze) return;
  const { games, loaded } = gamesStore.get();
  if (!loaded) return;
  const analyzed = analysisIndex.get().byGame;
  const budget = settings.autoMaxPerSession - queuedThisSession;
  if (budget <= 0) return;
  const todo = games.filter((g) => !analyzed[g.id] && !seen.has(g.id)).slice(0, budget);
  if (todo.length === 0) return;
  todo.forEach((g) => seen.add(g.id));
  queuedThisSession += todo.length;
  enqueueAuto(todo.map((g) => g.id));
}

export function startAutoAnalysis() {
  let lastGames = gamesStore.get().games;
  let lastRefreshing = gamesStore.get().refreshing;
  gamesStore.subscribe(() => {
    const s = gamesStore.get();
    // Re-scan when the first refresh finishes or new games arrive.
    if (s.games !== lastGames || (lastRefreshing && !s.refreshing)) {
      lastGames = s.games;
      lastRefreshing = s.refreshing;
      if (!s.refreshing) scan();
    }
    lastRefreshing = s.refreshing;
  });
  let lastAuto = settingsStore.get().autoAnalyze;
  settingsStore.subscribe(() => {
    const on = settingsStore.get().autoAnalyze;
    if (on && !lastAuto) scan();
    lastAuto = on;
  });
  // Cached games are available immediately (e.g. offline): start right away.
  if (!gamesStore.get().refreshing) scan();
}
