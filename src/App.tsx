import { lazy, Suspense, useEffect } from 'react';
import { useRoute } from './lib/router';
import { initGames } from './lib/games';
import { initAnalysisIndex } from './lib/analysisIndex';
import { initSettings } from './lib/settings';
import { backfillPuzzles, savePuzzlesFor } from './lib/puzzles';
import { startAutoAnalysis } from './analysis/auto';
import { migrateAnalyses, onAnalysisSaved } from './analysis/runner';
import { TabBar } from './components/TabBar';
import { Spinner } from './components/ui';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';

// Heavier screens (charts, board) are split into their own chunks.
const ReviewScreen = lazy(() => import('./screens/ReviewScreen').then((m) => ({ default: m.ReviewScreen })));
const CoachScreen = lazy(() => import('./screens/CoachScreen').then((m) => ({ default: m.CoachScreen })));
const PuzzlesScreen = lazy(() => import('./screens/PuzzlesScreen').then((m) => ({ default: m.PuzzlesScreen })));
const StatsScreen = lazy(() => import('./screens/StatsScreen').then((m) => ({ default: m.StatsScreen })));

let booted = false;

export default function App() {
  const route = useRoute();
  useEffect(() => {
    if (booted) return;
    booted = true;
    onAnalysisSaved.add(savePuzzlesFor);
    void Promise.all([initSettings(), initAnalysisIndex()])
      .then(initGames)
      .then(migrateAnalyses)
      .then(startAutoAnalysis)
      .then(backfillPuzzles);
  }, []);

  const [top] = route.segments;
  let screen;
  switch (top) {
    case 'coach':
      screen = <CoachScreen />;
      break;
    case 'puzzles':
      screen = <PuzzlesScreen />;
      break;
    case 'stats':
      screen = <StatsScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'game':
      screen = <ReviewScreen key={route.segments[1]} gameId={route.segments[1] ?? ''} />;
      break;
    default:
      screen = <HomeScreen />;
  }
  const showTabs = top !== 'game';
  return (
    <>
      <Suspense fallback={<div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>}>{screen}</Suspense>
      {showTabs && <TabBar />}
    </>
  );
}
