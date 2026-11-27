/**
 * Fixes text typed with the Russian (ЙЦУКЕН) keyboard layout active by mistake: "ыше" -> "sit",
 * "здфнукюдщсфешщт" -> "player.location", "Бздфнук" -> "<player".
 *
 * The meta has no Cyrillic content, so any Cyrillic letter in a query can only be a layout slip.
 * Only the Cyrillic characters are mapped (to the Latin key in the same position); everything else is
 * kept, so half-and-half input such as "player.ыше" also comes out right.
 */
const LOWER: Record<string, string> = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
  'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'э': "'",
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', 'ё': '`',
};

const UPPER: Record<string, string> = {
  'Х': '{', 'Ъ': '}', 'Ж': ':', 'Э': '"', 'Б': '<', 'Ю': '>', 'Ё': '~',
};

const CYRILLIC = /[Ѐ-ӿ]/;

export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}

export function fixKeyboardLayout(text: string): string {
  if (!text || !CYRILLIC.test(text)) return text;
  let out = '';
  for (const ch of text) {
    const lower = LOWER[ch];
    if (lower !== undefined) {
      out += lower;
      continue;
    }
    const upper = UPPER[ch];
    if (upper !== undefined) {
      out += upper;
      continue;
    }
    const fromLower = LOWER[ch.toLowerCase()];
    out += fromLower !== undefined ? fromLower.toUpperCase() : ch;
  }
  return out;
}

/**
 * For a search input's onChange: rewrites a layout slip in place and returns the fixed value. The DOM value is set
 * here (not only through React state) so the caret stays where the user is typing; the mapping is one character to
 * one character, so the selection offsets stay valid.
 */
export function fixInputLayout(input: HTMLInputElement): string {
  const value = input.value;
  const fixed = fixKeyboardLayout(value);
  if (fixed !== value) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = fixed;
    if (start !== null && end !== null) input.setSelectionRange(start, end);
  }
  return fixed;
}
