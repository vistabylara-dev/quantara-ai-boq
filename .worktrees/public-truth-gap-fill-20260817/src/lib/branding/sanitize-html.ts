/**
 * Conservative allowlist sanitizer for the one piece of free-form HTML a
 * company can save (the email signature) — no third-party sanitizer is in
 * this project's dependency tree, so this is a small, deliberately narrow
 * implementation rather than a general-purpose HTML parser. It removes
 * entire dangerous elements first, then strips any remaining disallowed
 * tags/attributes, and neutralizes javascript:/data: URLs. Good enough for
 * a short signature block; never used to render arbitrary user HTML at
 * large.
 */

const DANGEROUS_ELEMENTS = /<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*\/?>/gi;

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "span", "div", "a", "ul", "ol", "li", "img", "table", "tr", "td", "tbody"]);
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  span: new Set(["style"]),
  div: new Set(["style"]),
  td: new Set(["style"]),
};

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("mailto:") || trimmed.startsWith("#");
}

function isSafeStyle(value: string): boolean {
  const lower = value.toLowerCase();
  return !lower.includes("expression(") && !lower.includes("javascript:") && !lower.includes("url(");
}

export function sanitizeEmailSignatureHtml(rawHtml: string): string {
  const withoutDangerous = rawHtml.replace(DANGEROUS_ELEMENTS, "");

  return withoutDangerous.replace(/<\/?([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-:]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g, (fullMatch, rawTag: string, attrString: string) => {
    const tag = rawTag.toLowerCase();
    const isClosing = fullMatch.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (isClosing) return `</${tag}>`;

    const allowedAttrs = ALLOWED_ATTRIBUTES[tag];
    if (!allowedAttrs || !attrString.trim()) return `<${tag}>`;

    const keptAttrs: string[] = [];
    const attrPattern = /([a-zA-Z0-9-:]+)(?:=("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrPattern.exec(attrString)) !== null) {
      const name = attrMatch[1].toLowerCase();
      const value = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? "";
      if (name.startsWith("on")) continue;
      if (!allowedAttrs.has(name)) continue;
      if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
      if (name === "style" && !isSafeStyle(value)) continue;
      keptAttrs.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    }
    return keptAttrs.length ? `<${tag} ${keptAttrs.join(" ")}>` : `<${tag}>`;
  });
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value.trim());
}

const ALLOWED_COVER_STYLES = new Set(["light", "dark"]);
const ALLOWED_LOGO_POSITIONS = new Set(["top-left", "top-center", "top-right"]);

export function isValidCoverStyle(value: string): boolean {
  return ALLOWED_COVER_STYLES.has(value);
}

export function isValidLogoPosition(value: string): boolean {
  return ALLOWED_LOGO_POSITIONS.has(value);
}
