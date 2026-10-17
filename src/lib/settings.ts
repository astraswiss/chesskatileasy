import { useSyncExternalStore } from 'react';
import type { Settings } from '../types/app';
import { defaultSettings, getSettings, saveSettings } from './db';
import { createStore } from './store';

export const settingsStore = createStore<Settings>(defaultSettings);

export async function initSettings() {
  settingsStore.set(await getSettings());
}

export function useSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}

export async function updateSettings(patch: Partial<Settings>) {
  settingsStore.set(patch);
  await saveSettings(settingsStore.get());
}
