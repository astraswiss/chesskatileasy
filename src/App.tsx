import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { initGames } from './lib/games';
import { initAnalysisIndex } from './lib/analysisIndex';
import { TabBar } from './components/TabBar';
import { HomeScreen } from './screens/HomeScreen';
import { EmptyState } from './components/ui';
import { Header } from './components/Header';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="pb-tabbar">
      <Header title={title} />
      <EmptyState title="Coming soon" />
    </div>
  );
}

export default function App() {
  const route = useRoute();
  useEffect(() => {
    void initAnalysisIndex().then(initGames);
  }, []);

  const [top] = route.segments;
  let screen;
  switch (top) {
    case 'coach':
      screen = <Placeholder title="Coach" />;
      break;
    case 'puzzles':
      screen = <Placeholder title="Puzzles" />;
      break;
    case 'stats':
      screen = <Placeholder title="Stats" />;
      break;
    default:
      screen = <HomeScreen />;
  }
  const showTabs = top !== 'game';
  return (
    <>
      {screen}
      {showTabs && <TabBar />}
    </>
  );
}
