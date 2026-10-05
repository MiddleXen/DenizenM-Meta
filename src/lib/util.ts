export const HEADER_LINE = "DenizenM Meta Documentation";

export function escapeForHTML(text: string): string {
  if (!text) return "";
  let res = text
    .replace(/\0/g, " ")
    .replace(/\t/g, "    ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
  res = res
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return res;
}

export function urlSafe(input: string): string {
  if (!input) return "";
  return input
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/"/g, "%22");
}

export function escapeQuickSimple(content: string): string {
  return escapeForHTML(content).replace(/\n/g, "\n<br>");
}

export function cleanTag(text: string): string {
  if (!text) return "";
  let cleaned = "";
  let skipping = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "<" || c === ">") {
      continue;
    }
    if (c === "[") {
      skipping = true;
      continue;
    }
    if (c === "]") {
      skipping = false;
      continue;
    }
    if (skipping) {
      continue;
    }
    cleaned += c;
  }
  return cleaned;
}

export function fixID(id: string | null | undefined): string | null {
  if (!id) return null;
  return decodeURIComponent(id).toLowerCase().replace(/\+/g, " ").replace(/%2f/gi, "/");
}
