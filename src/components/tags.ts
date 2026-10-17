import type { PatternTag } from '../types/app';

export const TAG_META: Record<PatternTag, { label: string; short: string; description: string }> = {
  'hanging-piece': { label: 'Hanging piece', short: 'hung piece', description: 'Left a piece undefended and the opponent could win it.' },
  'missed-tactic': { label: 'Missed tactic', short: 'missed tactic', description: 'A move that won material or mated was available.' },
  'missed-punish': { label: 'Missed punish', short: 'missed punish', description: 'The opponent blundered and you did not take advantage.' },
  'time-trouble': { label: 'Time trouble', short: 'time', description: 'Mistake with little clock left, or a rushed move in a critical spot.' },
  'endgame-technique': { label: 'Endgame technique', short: 'endgame', description: 'Let a winning endgame slip.' },
  'opening-prep': { label: 'Opening prep', short: 'opening', description: 'Mistake in the opening phase.' },
};

export const TAG_ORDER: PatternTag[] = ['hanging-piece', 'missed-tactic', 'missed-punish', 'time-trouble', 'endgame-technique', 'opening-prep'];
