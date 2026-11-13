import { expect, test, type APIRequestContext } from "@playwright/test";
import { notConfiguredBaseURL } from "../playwright.config";

test.describe.configure({ mode: "serial" });

const noStore = "private, no-store";

const warsawClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

function hours(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `${String(from + i).padStart(2, "0")}:00`);
}

function daysOf(month: string, keep: (day: string, weekday: number) => boolean): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(
    (day) => keep(day, new Date(`${day}T00:00:00Z`).getUTCDay()),
  );
}

function notSunday(day: string, weekday: number): boolean {
  return weekday !== 0;
}

async function fake(request: APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post("/api/booking/fake", { data: body });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function days(request: APIRequestContext, month: string, duration: number | string = 1) {
  const response = await request.get(`/api/booking/days?month=${month}&duration=${duration}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe(noStore);
  return (await response.json()).days as string[];
}

async function starts(request: APIRequestContext, day: string, duration: number | string = 1) {
  const response = await request.get(`/api/booking/starts?day=${day}&duration=${duration}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe(noStore);
  const { starts } = (await response.json()) as { starts: { start: string; time: string }[] };
  for (const entry of starts) {
    expect(Object.keys(entry)).toEqual(["start", "time"]);
    expect(warsawClock.format(new Date(entry.start))).toBe(entry.time);
  }
  return starts;
}

async function times(request: APIRequestContext, day: string, duration: number | string = 1) {
  return (await starts(request, day, duration)).map(({ time }) => time);
}

test.describe("with the fake provider", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "the fake store is shared by all projects");

  test.beforeEach(async ({ request }) => {
    await fake(request, { action: "reset" });
  });

  test.afterEach(async ({ request }) => {
    await fake(request, { action: "reset" });
  });

  test("the fake endpoint exposes the fixed clock and the seeded, empty state", async ({ request }) => {
    const response = await request.get("/api/booking/fake");
    expect(response.status()).toBe(200);
    const state = await response.json();
    expect(state.now).toBe("2026-10-12T08:00:00.000Z");
    expect(state.blocks.length).toBeGreaterThan(0);
    expect(state.reservations).toEqual([]);
    expect(state.emails).toEqual([]);
    expect(state.telegrams).toEqual([]);
  });

  test("days of a month follow the weekly pattern from 24 hours ahead to the horizon", async ({
    request,
  }) => {
    expect(await days(request, "2026-10")).toEqual(
      daysOf("2026-10", (day, weekday) => day >= "2026-10-13" && weekday !== 0),
    );
    expect(await days(request, "2026-11")).toEqual(daysOf("2026-11", notSunday));
    expect(await days(request, "2026-12")).toEqual(daysOf("2026-12", notSunday));
    expect(await days(request, "2027-10")).toEqual(
      daysOf("2027-10", (day, weekday) => day <= "2027-10-12" && weekday !== 0),
    );
    expect(await days(request, "2027-11")).toEqual([]);
    expect(await days(request, "2026-09")).toEqual([]);
  });

  test("Mondays and Wednesdays start at 17:00, other days at 08:00, Sundays never", async ({
    request,
  }) => {
    expect(await times(request, "2026-10-19")).toEqual(hours(17, 21));
    expect(await times(request, "2026-10-21")).toEqual(hours(17, 21));
    expect(await times(request, "2026-10-20")).toEqual(hours(8, 21));
    expect(await times(request, "2026-10-24")).toEqual(hours(8, 21));
    expect(await times(request, "2026-10-18")).toEqual([]);
  });

  test("the ISO start is the Warsaw wall-clock time, before and after the clocks go back", async ({
    request,
  }) => {
    expect((await starts(request, "2026-10-20"))[0]).toEqual({
      start: "2026-10-20T06:00:00.000Z",
      time: "08:00",
    });
    expect((await starts(request, "2026-10-26"))[0]).toEqual({
      start: "2026-10-26T16:00:00.000Z",
      time: "17:00",
    });
    expect(await times(request, "2026-10-26")).toEqual(hours(17, 21));
  });

  test("nothing is offered before the 24-hour lead time or past the one-year horizon", async ({
    request,
  }) => {
    expect(await times(request, "2026-10-12")).toEqual([]);
    expect(await times(request, "2026-10-13")).toEqual(hours(10, 21));
    expect(await times(request, "2026-12-08")).toEqual(hours(8, 21));
    expect(await times(request, "2027-10-11")).toEqual(hours(17, 21));
    expect(await times(request, "2027-10-12")).toEqual(hours(8, 21));
    expect(await times(request, "2027-10-13")).toEqual([]);
    expect(await times(request, "2026-10-11")).toEqual([]);
  });

  test("the duration filters the starts", async ({ request }) => {
    await fake(request, { action: "block", day: "2026-10-20", from: "08:00", to: "18:00" });
    await fake(request, { action: "block", day: "2026-10-20", from: "21:00", to: "22:00" });
    expect(await times(request, "2026-10-20", 3)).toEqual(["18:00"]);
    expect(await times(request, "2026-10-20", 2)).toEqual(["18:00", "19:00"]);
    expect(await times(request, "2026-10-20", 1)).toEqual(["18:00", "19:00", "20:00"]);
    expect(await times(request, "2026-10-19", 3)).toEqual(hours(17, 19));
    expect(await times(request, "2026-10-22", 3)).toEqual(hours(8, 19));
  });

  test("a reservation hides the overlapping starts without revealing who booked", async ({
    request,
  }) => {
    const reservation = await fake(request, {
      action: "reserve",
      day: "2026-10-22",
      start: "10:00",
      duration: 2,
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(reservation.id).toEqual(expect.any(String));

    const response = await request.get("/api/booking/starts?day=2026-10-22&duration=2");
    const body = await response.text();
    expect(body).not.toContain("Ada");
    expect(body).not.toContain("ada@example.com");
    expect(body).not.toContain(reservation.id);
    expect(await times(request, "2026-10-22", 2)).toEqual(["08:00", ...hours(12, 20)]);
    expect(await times(request, "2026-10-22", 1)).toEqual(["08:00", "09:00", ...hours(12, 21)]);
    expect(await days(request, "2026-10")).toContain("2026-10-22");

    await fake(request, { action: "unreserve", id: reservation.id });
    expect(await times(request, "2026-10-22", 2)).toEqual(hours(8, 20));
  });

  test("a day whose window is covered by busy events and reservations is not selectable", async ({
    request,
  }) => {
    await fake(request, { action: "block", day: "2026-10-23", from: "08:00", to: "15:00" });
    await fake(request, { action: "reserve", day: "2026-10-23", start: "15:00", duration: 3 });
    await fake(request, { action: "reserve", day: "2026-10-23", start: "18:00", duration: 3 });
    expect(await times(request, "2026-10-23", 1)).toEqual(["21:00"]);
    expect(await days(request, "2026-10")).toContain("2026-10-23");

    await fake(request, { action: "reserve", day: "2026-10-23", start: "21:00", duration: 1 });
    expect(await times(request, "2026-10-23", 1)).toEqual([]);
    expect(await days(request, "2026-10")).not.toContain("2026-10-23");

    await fake(request, { action: "block", day: "2026-10-30" });
    expect(await times(request, "2026-10-30")).toEqual([]);
    expect(await days(request, "2026-10")).toEqual(
      daysOf(
        "2026-10",
        (day, weekday) =>
          day >= "2026-10-13" && weekday !== 0 && day !== "2026-10-23" && day !== "2026-10-30",
      ),
    );
  });

  test("a block added by hand is excluded like a reservation", async ({ request }) => {
    await fake(request, { action: "block", day: "2026-10-20", from: "12:00", to: "14:00" });
    expect(await times(request, "2026-10-20")).toEqual([...hours(8, 11), ...hours(14, 21)]);
    expect(await times(request, "2026-10-20", 2)).toEqual([...hours(8, 10), ...hours(14, 20)]);
  });

  test("busy time ending on a half hour leaves the next whole hour as the first start", async ({
    request,
  }) => {
    await fake(request, { action: "block", day: "2026-10-19", from: "08:00", to: "18:30" });
    expect(await times(request, "2026-10-19")).toEqual(["19:00", "20:00", "21:00"]);
    expect(await times(request, "2026-10-19", 2)).toEqual(["19:00", "20:00"]);
  });

  test("malformed queries are rejected with 400", async ({ request }) => {
    const queries = [
      "/api/booking/days",
      "/api/booking/days?month=2026-10",
      "/api/booking/days?duration=1",
      "/api/booking/days?month=2026-1&duration=1",
      "/api/booking/days?month=2026-13&duration=1",
      "/api/booking/days?month=garbage&duration=1",
      "/api/booking/days?month=2026-10-01&duration=1",
      "/api/booking/days?month=2026-10&duration=4",
      "/api/booking/days?month=2026-10&duration=0",
      "/api/booking/days?month=2026-10&duration=abc",
      "/api/booking/days?month=2026-10&duration=1.5",
      "/api/booking/starts",
      "/api/booking/starts?day=2026-10-20",
      "/api/booking/starts?day=2026-10-32&duration=1",
      "/api/booking/starts?day=2026-13-01&duration=1",
      "/api/booking/starts?day=2026-10&duration=1",
      "/api/booking/starts?day=garbage&duration=1",
      "/api/booking/starts?day=2026-10-20&duration=4",
      "/api/booking/starts?day=2026-10-20&duration=-1",
    ];
    for (const query of queries) {
      const response = await request.get(query);
      expect(response.status(), query).toBe(400);
      expect(await response.json(), query).toEqual({ error: "invalid_query" });
      expect(response.headers()["cache-control"], query).toBe(noStore);
    }
  });

  test("a failing calendar answers 503 and recovers on the next request", async ({ request }) => {
    await fake(request, { action: "fail", operation: "busyIntervals" });
    const failed = await request.get("/api/booking/days?month=2026-10&duration=1");
    expect(failed.status()).toBe(503);
    expect(await failed.json()).toEqual({ error: "provider_unavailable" });
    expect(failed.headers()["cache-control"]).toBe(noStore);
    expect(await days(request, "2026-10")).not.toEqual([]);

    await fake(request, { action: "fail", operation: "reservations", times: 2 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request.get("/api/booking/starts?day=2026-10-20&duration=1");
      expect(response.status()).toBe(503);
      expect(await response.json()).toEqual({ error: "provider_unavailable" });
    }
    expect(await times(request, "2026-10-20")).toEqual(hours(8, 21));
  });

  test("the fake endpoint rejects unknown actions, operations and malformed input", async ({
    request,
  }) => {
    const cases: Record<string, unknown>[] = [
      { action: "nope" },
      { action: "fail", operation: "explode" },
      { action: "block", day: "2026-10-20", from: "14:00", to: "12:00" },
      { action: "block", day: "garbage" },
      { action: "reserve", day: "2026-10-20", start: "10:00", duration: 4 },
      { action: "reserve", day: "2026-10-20" },
      { action: "unreserve" },
    ];
    for (const body of cases) {
      const response = await request.post("/api/booking/fake", { data: body });
      expect(response.status(), JSON.stringify(body)).toBe(400);
    }
    const invalid = await request.post("/api/booking/fake", {
      data: "not json",
      headers: { "content-type": "application/json" },
    });
    expect(invalid.status()).toBe(400);
    expect(await times(request, "2026-10-20")).toEqual(hours(8, 21));
  });
});

test.describe("without configuration", () => {
  test.use({ baseURL: notConfiguredBaseURL });

  test("the availability handlers answer 404", async ({ request }) => {
    for (const query of [
      "/api/booking/days?month=2026-10&duration=1",
      "/api/booking/starts?day=2026-10-20&duration=1",
      "/api/booking/days",
    ]) {
      const response = await request.get(query);
      expect(response.status(), query).toBe(404);
      expect(await response.json(), query).toEqual({ error: "not_configured" });
      expect(response.headers()["cache-control"], query).toBe(noStore);
    }
  });

  test("the test-only endpoint does not exist", async ({ request }) => {
    expect((await request.get("/api/booking/fake")).status()).toBe(404);
    const post = await request.post("/api/booking/fake", { data: { action: "reset" } });
    expect(post.status()).toBe(404);
  });
});
