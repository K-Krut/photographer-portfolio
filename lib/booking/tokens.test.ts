import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, test } from "node:test";
import { cancelUrl, signCancelToken, verifyCancelToken } from "./tokens.ts";

const secret = "test-secret";

describe("cancel tokens", () => {
  test("round-trips both kinds", () => {
    for (const kind of ["visitor", "photographer"] as const) {
      const token = signCancelToken({ id: "event-1", kind }, secret);
      assert.deepEqual(verifyCancelToken(token, secret), { id: "event-1", kind });
    }
  });

  test("visitor and photographer tokens differ", () => {
    assert.notEqual(
      signCancelToken({ id: "event-1", kind: "visitor" }, secret),
      signCancelToken({ id: "event-1", kind: "photographer" }, secret),
    );
  });

  test("rejects a token signed with another secret", () => {
    const token = signCancelToken({ id: "event-1", kind: "visitor" }, "other");
    assert.equal(verifyCancelToken(token, secret), null);
  });

  test("rejects a payload swapped to another kind or id", () => {
    const token = signCancelToken({ id: "event-1", kind: "visitor" }, secret);
    const [, mac] = token.split(".");
    for (const payload of [
      { id: "event-1", kind: "photographer" },
      { id: "event-2", kind: "visitor" },
    ]) {
      const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
      assert.equal(verifyCancelToken(`${data}.${mac}`, secret), null);
    }
  });

  test("rejects a tampered signature", () => {
    const token = signCancelToken({ id: "event-1", kind: "visitor" }, secret);
    for (let index = token.indexOf(".") + 1; index < token.length; index++) {
      const swapped = token[index] === "A" ? "B" : "A";
      const tampered = token.slice(0, index) + swapped + token.slice(index + 1);
      assert.equal(verifyCancelToken(tampered, secret), null);
    }
    assert.equal(verifyCancelToken(token.slice(0, -2), secret), null);
  });

  test("rejects malformed tokens", () => {
    for (const token of ["", ".", "abc", "abc.def", "a.b.c", `${"x".repeat(10)}.`]) {
      assert.equal(verifyCancelToken(token, secret), null);
    }
  });

  test("rejects a correctly signed payload of the wrong shape", () => {
    for (const payload of [{ id: "event-1", kind: "admin" }, { id: "", kind: "visitor" }, ["x"], "x"]) {
      const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const mac = createHmac("sha256", secret).update(data).digest("base64url");
      assert.equal(verifyCancelToken(`${data}.${mac}`, secret), null);
    }
  });

  test("builds the absolute cancel URL for a locale", () => {
    const url = cancelUrl("https://example.com/", "pl", { id: "event-1", kind: "visitor" }, secret);
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://example.com");
    assert.equal(parsed.pathname, "/pl/booking/cancel");
    assert.deepEqual(verifyCancelToken(parsed.searchParams.get("token") ?? "", secret), {
      id: "event-1",
      kind: "visitor",
    });
  });
});
