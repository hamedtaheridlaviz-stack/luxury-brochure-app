import { parseListingPayload } from "../lib/listingParser.js";
const VERSION = "3.0.0-final-import-system";
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed", version: VERSION });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const url = extractUrl(body.url || "");
    if (!url) return res.status(400).json({ error: "Invalid URL. Paste only the direct listing URL beginning with https://", version: VERSION });
    if (!process.env.APIFY_TOKEN) return res.status(500).json({ error: "Missing APIFY_TOKEN in Vercel environment variables.", version: VERSION });
    const attempts = [];
    try {
      const webScraperResult = await runApifyWebScraper(url);
      const parsed = parseListingPayload(webScraperResult, url);
      attempts.push({ method: "apify/web-scraper", imported: parsed.imported, title: parsed.title });
      if (parsed.imported) return res.status(200).json({ ...parsed, version: VERSION, importMethod: "apify/web-scraper", attempts });
    } catch (error) {
      attempts.push({ method: "apify/web-scraper", error: error.message });
    }
    return res.status(422).json({ error: "The import API ran, but could not extract usable listing details. Manual mode still works.", attempts, version: VERSION });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown server error", version: VERSION });
  }
}
function extractUrl(input) {
  const match = String(input || "").trim().match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\],.]+$/g, "") : "";
}
async function runApifyWebScraper(url) {
  const actorUrl = `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=180`;
  const pageFunction = `
    async function pageFunction(context) {
      const text = document.body ? document.body.innerText : "";
      const title = document.title || "";
      const description = document.querySelector('meta[name="description"]')?.content || document.querySelector('meta[property="og:description"]')?.content || "";
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.content || "";
      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => { try { return JSON.parse(s.textContent); } catch (e) { return null; } }).filter(Boolean);
      const images = Array.from(document.images || []).map(img => img.currentSrc || img.src).filter(Boolean);
      const nextData = document.querySelector('#__NEXT_DATA__')?.textContent || "";
      return { url: context.request.url, title: ogTitle || title, description, text, jsonLd, images, imageUrls: images, ogImage, nextData };
    }
  `;
  const input = { startUrls: [{ url }], pageFunction, proxyConfiguration: { useApifyProxy: true }, maxRequestRetries: 2, maxPagesPerCrawl: 1, maxConcurrency: 1 };
  const response = await fetch(actorUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Apify Web Scraper failed HTTP ${response.status}: ${raw.slice(0, 500)}`);
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`Apify returned non-JSON response: ${raw.slice(0, 500)}`); }
  if (!Array.isArray(data) || data.length === 0) throw new Error("Apify returned an empty dataset.");
  return data[0];
}
