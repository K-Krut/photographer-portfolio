import type { NextRequest } from "next/server";
import { readBookingConfig } from "@/lib/booking/config";
import { dayRange, dayStarts, warsawTime } from "@/lib/booking/slots";
import { dayPattern, json, loadAvailability, parseDuration, providerError } from "../availability";

function label(start: Date): string {
  const { minutes } = warsawTime(start);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const config = readBookingConfig();
  if (!config) return json(404, { error: "not_configured" });

  const day = query.get("day") ?? "";
  const duration = parseDuration(query.get("duration"));
  if (!dayPattern.test(day) || !duration) return json(400, { error: "invalid_query" });

  try {
    const availability = await loadAvailability(config, dayRange(day));
    const starts = dayStarts(day, duration, availability).map((start) => ({
      start: start.toISOString(),
      time: label(start),
    }));
    return json(200, { starts });
  } catch (error) {
    return providerError(error);
  }
}
