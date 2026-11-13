import type { NextRequest } from "next/server";
import { readBookingConfig } from "@/lib/booking/config";
import { monthDays, monthRange } from "@/lib/booking/slots";
import { json, loadAvailability, monthPattern, parseDuration, providerError } from "../availability";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const config = readBookingConfig();
  if (!config) return json(404, { error: "not_configured" });

  const month = query.get("month") ?? "";
  const duration = parseDuration(query.get("duration"));
  if (!monthPattern.test(month) || !duration) return json(400, { error: "invalid_query" });

  try {
    const availability = await loadAvailability(config, monthRange(month));
    return json(200, { days: monthDays(month, duration, availability) });
  } catch (error) {
    return providerError(error);
  }
}
