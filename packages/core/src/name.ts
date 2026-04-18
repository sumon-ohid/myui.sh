const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "with",
  "to",
  "in",
  "on",
  "at",
  "by",
  "my",
  "our",
  "your",
]);

export function inferComponentName(prompt: string, fallback = "Component"): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));

  if (words.length === 0) return fallback;

  const pascal = words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  if (!/^[A-Z][A-Za-z0-9]*$/.test(pascal)) return fallback;
  return pascal;
}
