"use client";

import { useState } from "react";
import type { BookingTexts } from "@/lib/content";

type Outcome = "cancelled" | "alreadyCancelled" | "invalid" | "failed";

const responses: Record<number, Partial<Record<string, Outcome>>> = {
  200: { cancelled: "cancelled", alreadyCancelled: "alreadyCancelled" },
  400: { invalid: "invalid" },
};

export function BookingCancel({
  token,
  labels,
}: {
  token: string;
  labels: BookingTexts["cancel"];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const confirm = async () => {
    setSubmitting(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => null);
      setOutcome(responses[response.status]?.[body?.status ?? body?.error] ?? "failed");
    } catch {
      setOutcome("failed");
    }
    setSubmitting(false);
  };

  if (outcome && outcome !== "failed") {
    return (
      <p role="status" data-cancel-state={outcome} className="mt-8 text-lg">
        {labels[outcome]}
      </p>
    );
  }

  return (
    <div data-cancel-state="confirm" className="mt-8 flex flex-col items-start gap-4">
      {outcome === "failed" && (
        <p role="alert" data-cancel-error>
          {labels.failed}
        </p>
      )}
      <button
        type="button"
        data-cancel-confirm
        onClick={confirm}
        disabled={submitting}
        aria-busy={submitting || undefined}
        className="min-h-11 border border-current px-6 text-sm uppercase tracking-[0.2em] transition-[opacity,background-color,color] can-hover:hover:enabled:opacity-60 disabled:opacity-30"
      >
        {submitting ? labels.confirming : labels.confirm}
      </button>
    </div>
  );
}
