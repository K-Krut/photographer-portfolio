const attribute = "data-keyboard";

export function keyboardUsed() {
  return document.documentElement.hasAttribute(attribute);
}

export function trackInputModality() {
  const root = document.documentElement;
  const onKeyDown = () => root.setAttribute(attribute, "");
  const onPointerDown = () => root.removeAttribute(attribute);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    root.removeAttribute(attribute);
  };
}
