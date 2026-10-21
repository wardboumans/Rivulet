// Shared between server and client — keep free of Node imports.

/**
 * Google News publishes an RSS feed for any search at /rss/search?q=…, localized by an "edition"
 * (interface language + country). Its items link to news.google.com redirect pages, which only
 * forward to the publisher in a browser, and name the publisher in a <source> element.
 */

export type GoogleNewsEdition = { id: string; label: string; hl: string; gl: string; ceid: string };

export const GOOGLE_NEWS_EDITIONS: GoogleNewsEdition[] = [
  { id: "en-US", label: "English (United States)", hl: "en-US", gl: "US", ceid: "US:en" },
  { id: "en-GB", label: "English (United Kingdom)", hl: "en-GB", gl: "GB", ceid: "GB:en" },
  { id: "en-CA", label: "English (Canada)", hl: "en-CA", gl: "CA", ceid: "CA:en" },
  { id: "en-AU", label: "English (Australia)", hl: "en-AU", gl: "AU", ceid: "AU:en" },
  { id: "en-IN", label: "English (India)", hl: "en-IN", gl: "IN", ceid: "IN:en" },
  { id: "nl-NL", label: "Nederlands (Nederland)", hl: "nl", gl: "NL", ceid: "NL:nl" },
  { id: "nl-BE", label: "Nederlands (België)", hl: "nl", gl: "BE", ceid: "BE:nl" },
  { id: "fr-BE", label: "Français (Belgique)", hl: "fr", gl: "BE", ceid: "BE:fr" },
  { id: "fr-FR", label: "Français (France)", hl: "fr", gl: "FR", ceid: "FR:fr" },
  { id: "de-DE", label: "Deutsch (Deutschland)", hl: "de", gl: "DE", ceid: "DE:de" },
  { id: "es-ES", label: "Español (España)", hl: "es", gl: "ES", ceid: "ES:es" },
  { id: "it-IT", label: "Italiano (Italia)", hl: "it", gl: "IT", ceid: "IT:it" },
  { id: "pt-BR", label: "Português (Brasil)", hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" },
  { id: "sv-SE", label: "Svenska (Sverige)", hl: "sv", gl: "SE", ceid: "SE:sv" },
];

export const GOOGLE_NEWS_ICON = "https://www.google.com/s2/favicons?domain=news.google.com&sz=64";

/** The edition closest to a browser language like "nl-BE" or "de", falling back to US English. */
export function defaultEdition(language: string): string {
  const [lang, country] = language.split("-");
  const exact = GOOGLE_NEWS_EDITIONS.find((e) => e.id.toLowerCase() === language.toLowerCase());
  const sameLang = GOOGLE_NEWS_EDITIONS.find((e) => e.id.startsWith(`${lang}-`) && (!country || e.gl === country.toUpperCase()));
  return (exact ?? sameLang ?? GOOGLE_NEWS_EDITIONS.find((e) => e.id.startsWith(`${lang}-`)) ?? GOOGLE_NEWS_EDITIONS[0]).id;
}

export function googleNewsFeedUrl(query: string, editionId: string): string {
  const e = GOOGLE_NEWS_EDITIONS.find((x) => x.id === editionId) ?? GOOGLE_NEWS_EDITIONS[0];
  const p = new URLSearchParams({ q: query.trim(), hl: e.hl, gl: e.gl, ceid: e.ceid });
  return `https://news.google.com/rss/search?${p}`;
}

export const isGoogleNewsFeed = (feedUrl: string) => /^https:\/\/news\.google\.com\/rss\//.test(feedUrl);

/** Article links in Google News feeds: they only redirect to the publisher in a browser. */
export const isGoogleNewsLink = (url: string | null) => !!url && /^https:\/\/news\.google\.com\//.test(url);

/** Google appends the publisher to every title ("Headline - Publisher"); drop it. */
export function stripSource(title: string | null, source: string | null): string | null {
  if (!title || !source) return title;
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() || title : title;
}
