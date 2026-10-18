import { useEffect, useState } from 'react';
import { USERNAME } from '../config';
import { cancelAuto } from '../analysis/queue';
import { updateSettings, useSettings } from '../lib/settings';
import { useAnalysisIndex } from '../lib/analysisIndex';
import { useGames } from '../lib/games';
import { Header } from '../components/Header';
import { Card, SectionTitle } from '../components/ui';

export function SettingsScreen() {
  const s = useSettings();
  const { byGame } = useAnalysisIndex();
  const { games } = useGames();
  const [storage, setStorage] = useState<string | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setStorage(e.usage ? `${(e.usage / 1024 / 1024).toFixed(1)} MB used` : null));
  }, []);

  return (
    <div className="pb-tabbar">
      <Header title="Settings" back />
      <main className="mx-auto max-w-3xl px-3">
        <SectionTitle>Engine</SectionTitle>
        <Card>
          <label className="flex items-center justify-between text-sm font-medium" htmlFor="depth">
            Analysis depth <span className="tabular-nums text-accent">{s.depth}</span>
          </label>
          <input
            id="depth"
            type="range"
            min={8}
            max={22}
            value={s.depth}
            onChange={(e) => void updateSettings({ depth: Number(e.target.value) })}
            className="mt-3 w-full accent-[#8fbf6a]"
          />
          <p className="mt-2 text-xs text-muted">Used when you tap Analyze. Higher is more accurate but slower. Background analysis uses depth 12.</p>
        </Card>

        <SectionTitle>Auto-analysis</SectionTitle>
        <Card className="flex flex-col gap-4">
          <label className="flex items-center justify-between text-sm font-medium">
            Analyze new games in the background
            <input
              type="checkbox"
              checked={s.autoAnalyze}
              onChange={(e) => {
                void updateSettings({ autoAnalyze: e.target.checked });
                if (!e.target.checked) cancelAuto();
              }}
              className="h-6 w-6 accent-[#8fbf6a]"
            />
          </label>
          <label className="flex items-center justify-between text-sm font-medium">
            Max games per session
            <select
              value={s.autoMaxPerSession}
              onChange={(e) => void updateSettings({ autoMaxPerSession: Number(e.target.value) })}
              className="h-10 rounded-xl bg-surface-2 px-2"
            >
              {[10, 30, 100, 1000].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted">Pauses automatically while the app is in the background.</p>
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card className="text-sm">
          <div>chess.com user: <b>{USERNAME}</b></div>
          <div className="mt-1 text-muted">
            {games.length} games cached · {Object.keys(byGame).length} analyzed{storage ? ` · ${storage}` : ''}
          </div>
          <p className="mt-2 text-xs text-muted">Everything is stored on this device only. Change the username in src/config.ts.</p>
        </Card>
      </main>
    </div>
  );
}
