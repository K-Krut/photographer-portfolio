import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contactError, stripTelegramPrefix } from "./validation.ts";

describe("contactError", () => {
  test("tells an empty required field from a malformed one", () => {
    assert.equal(contactError("name", "  "), "name");
    assert.equal(contactError("name", "7"), "nameInvalid");
    assert.equal(contactError("email", ""), "email");
    assert.equal(contactError("email", "ada@example"), "emailInvalid");
    assert.equal(contactError("phone", ""), "phone");
    assert.equal(contactError("phone", "12-34"), "phoneInvalid");
  });

  test("accepts well-formed values with surrounding spaces", () => {
    assert.equal(contactError("name", " Ada Lovelace "), null);
    assert.equal(contactError("email", " ada@example.com "), null);
    assert.equal(contactError("phone", " +48 123 456 789 "), null);
    assert.equal(contactError("telegram", " @ada_photo "), null);
  });

  test("treats an empty Telegram username as absent", () => {
    assert.equal(contactError("telegram", ""), null);
    assert.equal(contactError("telegram", "   "), null);
    assert.equal(contactError("telegram", "ada_"), "telegram");
  });
});

describe("stripTelegramPrefix", () => {
  test("drops leading @ signs and keeps the rest as typed", () => {
    assert.equal(stripTelegramPrefix("@ada_photo"), "ada_photo");
    assert.equal(stripTelegramPrefix("  @@ada"), "ada");
    assert.equal(stripTelegramPrefix("ada@"), "ada@");
    assert.equal(stripTelegramPrefix("ada "), "ada ");
  });
});
