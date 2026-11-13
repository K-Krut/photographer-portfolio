import type { Locale } from "../i18n";
import { phoneLink } from "../phone.ts";

export type EmailSite = { name: string; email: string; url: string; phone?: string };

export type EmailLink = { text: string; href: string };

export type EmailRow = { label: string; value: string; href?: string };

export type EmailBlock =
  | { type: "text"; text: string; link?: EmailLink; tone?: "lead" | "muted" }
  | { type: "details"; rows: EmailRow[] }
  | { type: "button"; intro: string; label: string; url: string };

export type EmailDocument = {
  locale: Locale;
  title: string;
  preheader: string;
  site: EmailSite;
  blocks: EmailBlock[];
};

const colors = { background: "#000000", text: "#ffffff", muted: "#999999", rule: "#4d4d4d" };
const fontStack = "'Jost', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const font = `font-family:${fontStack};`;
const labelStyle = `${font}font-size:11px;line-height:16px;letter-spacing:0.25em;text-transform:uppercase;color:${colors.muted};`;
const linkStyle = `color:${colors.text};text-decoration:underline;`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeLines(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
}

export function telHref(phone: string): string | undefined {
  return phoneLink(phone)?.href;
}

export function telegramHref(handle: string): string {
  return `https://t.me/${encodeURIComponent(handle.trim().replace(/^@/, ""))}`;
}

function anchor(href: string, text: string, style = linkStyle): string {
  return `<a href="${escapeHtml(href)}" target="_blank" style="${style}">${text}</a>`;
}

function rule(): string {
  return `<tr><td height="1" bgcolor="${colors.rule}" style="height:1px;line-height:1px;font-size:1px;background-color:${colors.rule};">&nbsp;</td></tr>`;
}

function section(content: string, padding = "28px 0 0 0"): string {
  return `<tr><td style="padding:${padding};">${content}</td></tr>`;
}

function renderText({ text, link, tone }: Extract<EmailBlock, { type: "text" }>): string {
  const size = tone === "lead" ? "font-size:18px;line-height:28px;" : "font-size:15px;line-height:24px;";
  const color = tone === "muted" ? colors.muted : colors.text;
  let body = escapeLines(text);
  if (link) {
    const escaped = escapeHtml(link.text);
    body = body.includes(escaped) ? body.replace(escaped, anchor(link.href, escaped)) : body;
  }
  return section(`<p style="margin:0;${font}${size}font-weight:300;color:${color};">${body}</p>`);
}

function renderRow({ label, value, href }: EmailRow, first: boolean): string {
  const border = first ? "" : `border-top:1px solid ${colors.rule};`;
  const content = href ? anchor(href, escapeLines(value)) : escapeLines(value);
  return `<tr>
<td valign="top" width="38%" class="label" style="${border}padding:12px 16px 12px 0;${labelStyle}">${escapeHtml(label)}</td>
<td valign="top" style="${border}padding:12px 0;${font}font-size:15px;line-height:22px;color:${colors.text};word-break:break-word;">${content}</td>
</tr>`;
}

function renderDetails({ rows }: Extract<EmailBlock, { type: "details" }>): string {
  const body = rows.map((row, index) => renderRow(row, index === 0)).join("\n");
  return section(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${colors.rule};border-bottom:1px solid ${colors.rule};">
${body}
</table>`,
  );
}

function renderButton({ intro, label, url }: Extract<EmailBlock, { type: "button" }>): string {
  const href = escapeHtml(url);
  return section(`<p style="margin:0 0 16px 0;${font}font-size:15px;line-height:24px;font-weight:300;color:${colors.text};">${escapeLines(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
<tr><td align="center" bgcolor="${colors.background}" style="border:1px solid ${colors.text};background-color:${colors.background};padding:14px 28px;">
<a href="${href}" target="_blank" style="${font}font-size:13px;line-height:16px;letter-spacing:0.2em;text-transform:uppercase;color:${colors.text};text-decoration:none;display:inline-block;">${escapeHtml(label)}</a>
</td></tr>
</table>`);
}

function renderBlock(block: EmailBlock): string {
  if (block.type === "details") return renderDetails(block);
  if (block.type === "button") return renderButton(block);
  return renderText(block);
}

function renderFooter(site: EmailSite): string {
  const sitePhone = site.phone ? phoneLink(site.phone) : undefined;
  const host = (() => {
    try {
      return new URL(site.url).host;
    } catch {
      return site.url;
    }
  })();
  const contacts = [
    site.email ? anchor(mailtoHref(site.email), escapeHtml(site.email), `color:${colors.muted};text-decoration:none;`) : "",
    sitePhone ? anchor(sitePhone.href, escapeHtml(sitePhone.label), `color:${colors.muted};text-decoration:none;`) : "",
    anchor(site.url, escapeHtml(host), `color:${colors.muted};text-decoration:none;`),
  ].filter(Boolean);
  return section(
    `<p style="margin:0 0 10px 0;${font}font-size:12px;line-height:18px;letter-spacing:0.3em;text-transform:uppercase;color:${colors.text};">${escapeHtml(site.name)}</p>
<p style="margin:0;${font}font-size:13px;line-height:22px;color:${colors.muted};">${contacts.join("<br>")}</p>`,
    "24px 0 0 0",
  );
}

function preheader(text: string): string {
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${colors.background};opacity:0;">${escapeHtml(text)}${filler}</div>`;
}

export function renderEmailHtml(document: EmailDocument): string {
  const { locale, title, site, blocks } = document;
  const siteHref = escapeHtml(site.url);
  return `<!DOCTYPE html>
<html lang="${locale}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&amp;display=swap" rel="stylesheet">
<style>
:root { color-scheme: dark; supported-color-schemes: dark; }
body { margin: 0; padding: 0; background-color: ${colors.background}; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
@media only screen and (max-width: 480px) {
  .label { width: 40% !important; }
}
</style>
<!--[if mso]>
<style>
table, td, p, a, span { font-family: Helvetica, Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body bgcolor="${colors.background}" style="margin:0;padding:0;width:100%;background-color:${colors.background};color:${colors.text};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheader(document.preheader)}
<table role="presentation" width="100%" bgcolor="${colors.background}" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${colors.background};">
<tr><td align="center" bgcolor="${colors.background}" style="padding:40px 16px 48px 16px;background-color:${colors.background};">
<!--[if mso]><table role="presentation" width="580" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" bgcolor="${colors.background}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:${colors.background};">
<tr><td align="left" style="padding:0 0 24px 0;"><a href="${siteHref}" target="_blank" style="${font}font-size:20px;line-height:28px;letter-spacing:0.3em;text-transform:uppercase;color:${colors.text};text-decoration:none;">${escapeHtml(site.name)}</a></td></tr>
${rule()}
${blocks.map(renderBlock).join("\n")}
${section("", "36px 0 0 0")}
${rule()}
${renderFooter(site)}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}
