import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultWindow } from "./config.ts";
import {
  addDays,
  dayRange,
  dayStarts,
  horizonDay,
  isBookable,
  monthDays,
  monthRange,
  warsawDate,
  warsawDay,
  warsawTime,
  type Availability,
  type Duration,
  type Interval,
} from "./slots.ts";

const monday = "2026-10-12";
const now = new Date("2026-10-12T08:00:00Z");

function at(day: string, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  const date = warsawDate(day, hour * 60 + minute);
  assert.ok(date, `${day} ${time} exists`);
  return date;
}

function block(day: string, from: string, to: string): Interval {
  return { start: at(day, from), end: at(day, to) };
}

function hours(starts: Date[]): number[] {
  return starts.map((start) => warsawTime(start).minutes / 60);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function daysOf(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return range(1, count).map((day) => `${month}-${String(day).padStart(2, "0")}`);
}

function availability(busy: Interval[] = [], overrides: Partial<Availability> = {}): Availability {
  return { window: defaultWindow, busy, now, ...overrides };
}

function starts(day: string, duration: Duration, busy: Interval[] = [], overrides?: Partial<Availability>) {
  return hours(dayStarts(day, duration, availability(busy, overrides)));
}

describe("fixtures", () => {
  test("the reference now is Monday 10:00 Warsaw", () => {
    assert.equal(weekday(monday), 1);
    assert.deepEqual(warsawTime(now), { day: monday, minutes: 600 });
  });
});

describe("days marked from the weekly busy pattern", () => {
  const busy = ["2026-10", "2026-11", "2026-12"].flatMap((month) =>
    daysOf(month).flatMap((day) => {
      if (weekday(day) === 0) return [dayRange(day)];
      if (weekday(day) === 1 || weekday(day) === 3) return [block(day, "08:00", "17:00")];
      return [];
    }),
  );
  const days = (month: string) => monthDays(month, 1, availability(busy));

  test("every day except Sundays is selectable from 24 hours ahead", () => {
    assert.deepEqual(
      days("2026-10"),
      daysOf("2026-10").filter((day) => day > monday && weekday(day) !== 0),
    );
    assert.deepEqual(
      days("2026-11"),
      daysOf("2026-11").filter((day) => weekday(day) !== 0),
    );
  });

  test("Mondays and Wednesdays offer 17:00 through 21:00, other days 08:00 through 21:00", () => {
    assert.deepEqual(starts("2026-10-19", 1, busy), range(17, 21));
    assert.deepEqual(starts("2026-10-21", 1, busy), range(17, 21));
    assert.deepEqual(starts("2026-10-20", 1, busy), range(8, 21));
    assert.deepEqual(starts("2026-10-24", 1, busy), range(8, 21));
    assert.deepEqual(starts("2026-10-18", 1, busy), []);
  });
});

describe("busy time ending on a half hour", () => {
  test("the next whole hour after the busy end is the first start", () => {
    const busy = [block("2026-10-19", "08:00", "18:30")];
    assert.deepEqual(starts("2026-10-19", 1, busy), [19, 20, 21]);
  });

  test("a block ending on the hour lets the next start begin right there", () => {
    const busy = [block("2026-10-19", "08:00", "20:00")];
    assert.deepEqual(starts("2026-10-19", 1, busy), [20, 21]);
  });
});

describe("duration filters the starts", () => {
  const busy = [block("2026-10-20", "08:00", "18:00"), block("2026-10-20", "21:00", "22:00")];

  test("longer sessions have fewer starts", () => {
    assert.deepEqual(starts("2026-10-20", 3, busy), [18]);
    assert.deepEqual(starts("2026-10-20", 2, busy), [18, 19]);
    assert.deepEqual(starts("2026-10-20", 1, busy), [18, 19, 20]);
  });

  test("the whole session must end inside the window", () => {
    assert.deepEqual(starts("2026-10-20", 3), range(8, 19));
    assert.deepEqual(starts("2026-10-20", 2), range(8, 20));
  });

  test("durations outside 1 to 3 give nothing", () => {
    assert.deepEqual(starts("2026-10-20", 0 as Duration), []);
    assert.deepEqual(starts("2026-10-20", 4 as Duration), []);
  });
});

describe("booked time hides starts and days", () => {
  const thursday = "2026-10-22";
  const reservation = block(thursday, "10:00", "12:00");

  test("starts overlapping a reservation are not offered", () => {
    assert.equal(weekday(thursday), 4);
    assert.deepEqual(starts(thursday, 2, [reservation]), [8, ...range(12, 20)]);
    assert.deepEqual(starts(thursday, 1, [reservation]), [8, 9, ...range(12, 21)]);
  });

  test("a day covered by busy events and reservations is not selectable", () => {
    const friday = "2026-10-23";
    const busy = [block(friday, "08:00", "15:00"), block(friday, "15:00", "22:00")];
    assert.deepEqual(starts(friday, 1, busy), []);
    assert.ok(!monthDays("2026-10", 1, availability(busy)).includes(friday));
    assert.ok(monthDays("2026-10", 1, availability(busy)).includes(thursday));
  });
});

describe("custom daily window", () => {
  test("starts stay inside the configured window", () => {
    const window = { start: 10 * 60, end: 20 * 60 };
    assert.deepEqual(starts("2026-10-20", 1, [], { window }), range(10, 19));
    assert.deepEqual(starts("2026-10-20", 3, [], { window }), range(10, 17));
  });

  test("a window starting between hours begins at the next whole hour", () => {
    const window = { start: 9 * 60 + 30, end: 12 * 60 };
    assert.deepEqual(starts("2026-10-20", 1, [], { window }), [10, 11]);
  });
});

describe("lead time and horizon", () => {
  const tuesday = "2026-10-13";
  const busy = [block(tuesday, "12:00", "22:00")];

  test("starts earlier than 24 hours ahead are not offered", () => {
    assert.deepEqual(starts(tuesday, 1, busy), [10, 11]);
    assert.deepEqual(starts(monday, 1), []);
    assert.deepEqual(starts("2026-10-11", 1), []);
  });

  test("the horizon is one year from today inclusive", () => {
    assert.equal(horizonDay(now), "2027-10-12");
    assert.deepEqual(starts("2027-10-12", 1), range(8, 21));
    assert.deepEqual(starts("2027-10-13", 1), []);
    assert.deepEqual(monthDays("2026-12", 1, availability()), daysOf("2026-12"));
    assert.deepEqual(monthDays("2027-10", 1, availability()), daysOf("2027-10").slice(0, 12));
    assert.deepEqual(monthDays("2027-11", 1, availability()), []);
    assert.deepEqual(monthDays("2026-09", 1, availability()), []);
  });

  test("today in Warsaw is used even when UTC is still yesterday", () => {
    const lateEvening = new Date("2026-10-12T22:30:00Z");
    assert.equal(warsawDay(lateEvening), "2026-10-13");
    assert.equal(horizonDay(lateEvening), "2027-10-13");
  });
});

describe("is this exact interval bookable", () => {
  const busy = [block("2026-10-20", "08:00", "18:00")];

  test("a listed start with its duration is bookable", () => {
    assert.ok(isBookable(at("2026-10-20", "18:00"), 2, availability(busy)));
    assert.ok(isBookable(at("2026-10-20", "19:00"), 3, availability(busy)));
  });

  test("overlapping, late, too early, partial-hour and malformed starts are not", () => {
    assert.ok(!isBookable(at("2026-10-20", "17:00"), 2, availability(busy)));
    assert.ok(!isBookable(at("2026-10-20", "20:00"), 3, availability(busy)));
    assert.ok(!isBookable(at("2026-10-20", "18:30"), 1, availability(busy)));
    assert.ok(!isBookable(at("2026-10-13", "09:00"), 1, availability()));
    assert.ok(!isBookable(at("2027-10-13", "09:00"), 1, availability()));
    assert.ok(isBookable(at("2027-10-12", "09:00"), 1, availability()));
    assert.ok(!isBookable(at("2026-10-20", "18:00"), 4 as Duration, availability()));
    assert.ok(!isBookable(new Date(NaN), 1, availability()));
  });
});

describe("DST transition days", () => {
  const fallBack = "2026-10-25";
  const springForward = "2026-03-29";
  const march = new Date("2026-03-02T10:00:00Z");
  const fullDay = { start: 0, end: 24 * 60 };

  test("the clocks go back on the last Sunday of October", () => {
    assert.equal(at("2026-10-24", "08:00").toISOString(), "2026-10-24T06:00:00.000Z");
    assert.equal(at(fallBack, "08:00").toISOString(), "2026-10-25T07:00:00.000Z");
    assert.deepEqual(starts(fallBack, 1), range(8, 21));
    assert.equal(dayRange(fallBack).end.getTime() - dayRange(fallBack).start.getTime(), 25 * 3_600_000);
  });

  test("the repeated hour is offered once, at its first occurrence", () => {
    const result = dayStarts(fallBack, 1, availability([], { window: fullDay }));
    assert.deepEqual(hours(result), range(0, 23));
    assert.equal(result[2].toISOString(), "2026-10-25T00:00:00.000Z");
    for (let index = 1; index < result.length; index++) {
      assert.ok(result[index] > result[index - 1]);
    }
  });

  test("busy intervals given in UTC hide the right local hour after the change", () => {
    const busy = [{ start: new Date("2026-10-25T09:00:00Z"), end: new Date("2026-10-25T09:30:00Z") }];
    assert.deepEqual(starts(fallBack, 1, busy), range(8, 21).filter((hour) => hour !== 10));
  });

  test("the clocks go forward on the last Sunday of March", () => {
    assert.equal(at("2026-03-28", "08:00").toISOString(), "2026-03-28T07:00:00.000Z");
    assert.equal(at(springForward, "08:00").toISOString(), "2026-03-29T06:00:00.000Z");
    assert.deepEqual(starts(springForward, 1, [], { now: march }), range(8, 21));
    assert.equal(
      dayRange(springForward).end.getTime() - dayRange(springForward).start.getTime(),
      23 * 3_600_000,
    );
  });

  test("the skipped hour is not offered", () => {
    assert.equal(warsawDate(springForward, 2 * 60), null);
    const result = dayStarts(springForward, 1, availability([], { window: fullDay, now: march }));
    assert.deepEqual(hours(result), range(0, 23).filter((hour) => hour !== 2));
    assert.equal(result[1].toISOString(), "2026-03-29T00:00:00.000Z");
  });
});

describe("date helpers", () => {
  test("day arithmetic and ranges follow the Warsaw calendar", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(monthRange("2026-10").start.toISOString(), "2026-09-30T22:00:00.000Z");
    assert.equal(monthRange("2026-10").end.toISOString(), "2026-10-31T23:00:00.000Z");
    assert.equal(dayRange("2026-10-20").start.toISOString(), "2026-10-19T22:00:00.000Z");
  });

  test("malformed days and months yield nothing", () => {
    for (const day of ["2026-13-01", "2026-10-32", "garbage", "2026-1-1", ""]) {
      assert.deepEqual(dayStarts(day, 1, availability()), [], day);
      assert.equal(warsawDate(day, 0), null, day);
    }
    for (const month of ["2026-13", "2026-1", "garbage", "", "2026-10-01"]) {
      assert.deepEqual(monthDays(month, 1, availability()), [], month);
    }
  });
});
