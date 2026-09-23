const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Maskiert Text für die Ausgabe in HTML- oder SVG-Strings. */
export function esc(text: string | number): string {
  return String(text).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}
