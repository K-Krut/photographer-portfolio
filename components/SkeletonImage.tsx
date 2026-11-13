"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type CSSProperties } from "react";

type Status = "loading" | "loaded" | "failed";

export function SkeletonImage({
  frameClassName = "",
  frameStyle,
  className = "",
  alt,
  onLoad,
  onError,
  ...props
}: ImageProps & { frameClassName?: string; frameStyle?: CSSProperties }) {
  const [status, setStatus] = useState<Status>("loading");
  const immediate = Boolean(
    props.preload || props.priority || props.loading === "eager" || props.fetchPriority === "high",
  );
  const frameState = {
    loading: immediate ? "bg-skeleton" : "bg-skeleton motion-safe:animate-pulse",
    loaded: "bg-transparent",
    failed: "bg-skeleton",
  }[status];
  const imageState =
    status === "loaded" || (immediate && status === "loading") ? "opacity-100" : "opacity-0";

  return (
    <div
      data-skeleton={status}
      className={`overflow-hidden motion-safe:transition-colors ${frameState} ${frameClassName}`}
      style={frameStyle}
    >
      <Image
        {...props}
        alt={alt}
        className={`motion-safe:transition-opacity ${imageState} ${className}`}
        onLoad={(event) => {
          setStatus(event.currentTarget.naturalWidth > 0 ? "loaded" : "failed");
          onLoad?.(event);
        }}
        onError={(event) => {
          setStatus("failed");
          onError?.(event);
        }}
      />
    </div>
  );
}
