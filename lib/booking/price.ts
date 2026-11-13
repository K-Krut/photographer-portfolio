import { priceItems } from "../content";
import type { Duration } from "./slots";

export function sessionPrice(duration: Duration): number {
  const [first, additional] = priceItems;
  return first.amount + (duration - 1) * additional.amount;
}
