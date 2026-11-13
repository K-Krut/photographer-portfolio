"use client";

import { useEffect } from "react";
import { trackInputModality } from "@/lib/input-modality";

export function InputModality() {
  useEffect(() => trackInputModality(), []);

  return null;
}
