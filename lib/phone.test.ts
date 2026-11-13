import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { phoneLink, phoneNumber } from "./phone.ts";

describe("phoneNumber", () => {
  test("is undefined when no number is set", () => {
    assert.equal(phoneNumber(""), undefined);
    assert.equal(phoneNumber("   "), undefined);
  });

  test("keeps only the digits after a plus", () => {
    assert.equal(phoneNumber("+48 000 000 000"), "+48000000000");
    assert.equal(phoneNumber("+48 (000) 000-000"), "+48000000000");
  });
});

describe("phoneLink", () => {
  test("is undefined when no number is set", () => {
    assert.equal(phoneLink(""), undefined);
  });

  test("links to the dialable number and shows it as written", () => {
    assert.deepEqual(phoneLink(" +48  000 000 000 "), {
      href: "tel:+48000000000",
      label: "+48 000 000 000",
    });
  });

  test("groups a compact Polish number for display", () => {
    assert.deepEqual(phoneLink("+48000000000"), {
      href: "tel:+48000000000",
      label: "+48 000 000 000",
    });
  });

  test("leaves other compact numbers as they are", () => {
    assert.deepEqual(phoneLink("+4400000000000"), {
      href: "tel:+4400000000000",
      label: "+4400000000000",
    });
  });
});
