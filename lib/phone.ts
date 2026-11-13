export type PhoneLink = { href: string; label: string };

export function phoneNumber(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  return digits ? `+${digits}` : undefined;
}

export function phoneLink(phone: string): PhoneLink | undefined {
  const number = phoneNumber(phone);
  if (!number) return undefined;
  const written = phone.trim().replace(/\s+/g, " ");
  const label = written.includes(" ")
    ? written
    : number.replace(/^\+48(\d{3})(\d{3})(\d{3})$/, "+48 $1 $2 $3");
  return { href: `tel:${number}`, label };
}
