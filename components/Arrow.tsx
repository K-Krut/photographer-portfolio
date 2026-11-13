export function Arrow({
  direction,
  className = "",
}: {
  direction: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={`shrink-0 transition-transform duration-300 ${direction === "right" ? "-scale-x-100" : ""} ${className}`}
    >
      <path d="M23 8H1.5M8.5 1 1.5 8l7 7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
