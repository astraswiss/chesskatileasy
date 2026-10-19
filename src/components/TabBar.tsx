import { navigate, useRoute } from '../lib/router';
import { IconBook, IconCoach, IconGames, IconPuzzle, IconStats } from './Icons';

const tabs = [
  { path: '/', label: 'Games', Icon: IconGames },
  { path: '/coach', label: 'Coach', Icon: IconCoach },
  { path: '/openings', label: 'Openings', Icon: IconBook },
  { path: '/puzzles', label: 'Puzzles', Icon: IconPuzzle },
  { path: '/stats', label: 'Stats', Icon: IconStats },
];

export function TabBar() {
  const { segments } = useRoute();
  const active = '/' + (segments[0] ?? '');
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 bg-surface/85 backdrop-blur pb-safe px-safe"
      aria-label="Main"
    >
      <div className="mx-auto flex h-[var(--tabbar-h)] max-w-3xl">
        {tabs.map(({ path, label, Icon }) => {
          const on = active === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? 'text-accent' : 'text-muted'}`}
              aria-current={on ? 'page' : undefined}
            >
              <Icon width={24} height={24} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
