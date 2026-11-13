export type ContactField = "name" | "email" | "phone" | "telegram";

export type ContactErrorKey =
  | "name"
  | "nameInvalid"
  | "email"
  | "emailInvalid"
  | "phone"
  | "phoneInvalid"
  | "telegram";

const letterPattern = new RegExp("\\p{L}", "gu");
const emailPattern = new RegExp(
  "^(?!\\.)(?!.*\\.\\.)[^\\s@]+(?<!\\.)@(?:[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]*[\\p{L}\\p{N}])?\\.)+\\p{L}{2,}$",
  "u",
);
const phonePattern = /^\+?[\d\s()-]+$/;
const telegramPattern = /^[A-Za-z][A-Za-z0-9_]{3,30}[A-Za-z0-9]$/;

const nameMaxLength = 200;
const emailMaxLength = 254;
const phoneMaxLength = 40;

export function stripTelegramPrefix(value: string): string {
  return value.replace(/^\s*@+/, "");
}

export function normaliseTelegram(value: string): string | null {
  const handle = value.trim().replace(/^@/, "");
  return telegramPattern.test(handle) ? `@${handle}` : null;
}

export function isPlausibleName(value: string): boolean {
  return value.length <= nameMaxLength && (value.match(letterPattern)?.length ?? 0) >= 2;
}

export function isPlausibleEmail(value: string): boolean {
  return value.length <= emailMaxLength && emailPattern.test(value);
}

export function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "").length;
  return value.length <= phoneMaxLength && phonePattern.test(value) && digits >= 7 && digits <= 15;
}

export function contactError(field: ContactField, raw: string): ContactErrorKey | null {
  const value = raw.trim();
  switch (field) {
    case "name":
      if (!value) return "name";
      return isPlausibleName(value) ? null : "nameInvalid";
    case "email":
      if (!value) return "email";
      return isPlausibleEmail(value) ? null : "emailInvalid";
    case "phone":
      if (!value) return "phone";
      return isPlausiblePhone(value) ? null : "phoneInvalid";
    case "telegram":
      return !value || normaliseTelegram(value) ? null : "telegram";
  }
}
