export const containedScroll = "(hover: none) and (pointer: coarse)";

export function scroller(): HTMLElement {
  return window.matchMedia(containedScroll).matches ? document.body : document.documentElement;
}

export function scrollTop() {
  return scroller().scrollTop;
}

export function scrollToTop(top: number) {
  scroller().scrollTo({ top, behavior: "instant" });
}

export function maxScrollTop() {
  const element = scroller();
  return element.scrollHeight - element.clientHeight;
}
