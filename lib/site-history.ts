import { scrollTop } from "./scroller";

type NavigationHistory = { currentEntry: { index: number; key: string } | null };

let visits = 0;
const scrollPositions = new Map<string, number>();

function navigationHistory() {
  return (window as Window & { navigation?: NavigationHistory }).navigation;
}

function entryKey() {
  return navigationHistory()?.currentEntry?.key ?? window.location.href;
}

export function recordVisit() {
  visits += 1;
}

export function cameFromSite() {
  const navigation = navigationHistory();
  if (navigation?.currentEntry) return navigation.currentEntry.index > 0;
  return visits > 1;
}

export function rememberScroll() {
  scrollPositions.set(entryKey(), scrollTop());
}

export function rememberedScroll() {
  return scrollPositions.get(entryKey());
}
