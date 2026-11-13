"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption = { value: string; label: string };

const pageJump = 10;
const typeAheadMs = 500;

export function SessionTypeSelect({
  id,
  name,
  labelId,
  value,
  options,
  onChange,
  invalid,
  describedBy,
  className = "",
}: {
  id: string;
  name: string;
  labelId: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: "nearest" });
  });

  const show = (index: number) => {
    setActive(Math.min(Math.max(index, 0), options.length - 1));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  const typeAhead = (key: string) => {
    const now = performance.now();
    const text = (now - typed.current.at > typeAheadMs ? "" : typed.current.text) + key.toLowerCase();
    typed.current = { text, at: now };
    const from = open ? active : selectedIndex;
    const repeated = [...text].every((character) => character === text[0]);
    const search = repeated ? text[0] : text;
    const start = repeated || text.length === 1 ? from + 1 : from;
    for (let step = 0; step < options.length; step++) {
      const index = (start + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(search)) {
        show(index);
        return;
      }
    }
    if (!open) show(from);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key, altKey, ctrlKey, metaKey } = event;
    const last = options.length - 1;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        show(key === "ArrowUp" && !altKey ? selectedIndex - 1 : selectedIndex);
      } else if (key === "Home") {
        event.preventDefault();
        show(0);
      } else if (key === "End") {
        event.preventDefault();
        show(last);
      } else if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        typeAhead(key);
      }
      return;
    }
    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        show(active + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (altKey) choose(active);
        else show(active - 1);
        return;
      case "PageDown":
        event.preventDefault();
        show(active + pageJump);
        return;
      case "PageUp":
        event.preventDefault();
        show(active - pageJump);
        return;
      case "Home":
        event.preventDefault();
        show(0);
        return;
      case "End":
        event.preventDefault();
        show(last);
        return;
      case "Enter":
        event.preventDefault();
        choose(active);
        return;
      case " ":
        event.preventDefault();
        if (typed.current.text && performance.now() - typed.current.at <= typeAheadMs) typeAhead(key);
        else choose(active);
        return;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        return;
      case "Tab":
        choose(active);
        return;
    }
    if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault();
      typeAhead(key);
    }
  };

  return (
    <div ref={root} className="relative mt-2">
      <input type="hidden" name={name} value={value} />
      <div
        id={id}
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-value={value}
        onClick={() => (open ? setOpen(false) : show(selectedIndex))}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className={`relative flex cursor-pointer select-none items-center pl-3 pr-11 ${className}`}
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          aria-hidden="true"
          data-select-chevron
          viewBox="0 0 16 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          className={`pointer-events-none absolute right-4 top-1/2 h-2 w-3.5 -translate-y-1/2 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1.5 1.5 8 8l6.5-6.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          tabIndex={-1}
          data-lenis-prevent
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-30 -mt-px max-h-72 overflow-y-auto overscroll-contain border border-current bg-background py-1 text-foreground transition-[opacity,translate] starting:-translate-y-1 starting:opacity-0"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={index === selectedIndex}
              data-value={option.value}
              data-active={index === active || undefined}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(index)}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-3 py-2 text-base transition-[background-color,color] data-active:bg-foreground data-active:text-background"
            >
              <span>{option.label}</span>
              {index === selectedIndex && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="square"
                  className="h-2.5 w-3.5 shrink-0"
                >
                  <path d="M1.5 6.5 6 10.5l8.5-9" vectorEffect="non-scaling-stroke" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
