export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing listing URL" });

    const token = process.env.APIFY_TOKEN;
    if (!token) return res.status(500).json({ error: "APIFY_TOKEN is not set in Vercel environment variables" });

    const actorUrl = `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${token}&timeout=180`;
    const input = {
      startUrls: [{ url }],
      crawlerType: "browser",
      maxCrawlPages: 1,
      saveMarkdown: true,
      saveHtml: false,
      proxyConfiguration: { useApifyProxy: true }
    };

    const apifyRes = await fetch(actorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    const raw = await apifyRes.text();
    if (!apifyRes.ok) return res.status(502).json({ error: "Apify request failed", details: raw.slice(0, 1000) });

    let items = JSON.parse(raw);
    const item = Array.isArray(items) ? items[0] : items;
    return res.status(200).json(parseListing(item, url));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

function parseListing(item, sourceUrl) {
  const metadata = item?.metadata || {};
  const text = item?.text || item?.markdown || "";
  const ogArray = metadata.openGraph || [];
  const og = {};
  if (Array.isArray(ogArray)) for (const e of ogArray) if (e.property && e.content) og[e.property] = e.content;

  const jsonLd = Array.isArray(metadata.jsonLd) ? metadata.jsonLd : [];
  const main = findRealEstateObject(jsonLd) || {};

  const title = main.name || metadata.title || og["og:title"] || firstLine(text);
  const description = main.description || metadata.description || og["og:description"] || cleanDescription(text);
  const image = main.image || og["og:image"] || extractFirstImage(item);
  const price = extractPrice(main, text);
  const bedrooms = extractBedroom(text, description, title);
  const bathrooms = extractBathroom(text, description, title);
  const sqft = extractSqft(main, text);
  const location = extractLocation(main);
  const amenities = extractAmenities(main, text);

  return {
    sourceUrl,
    title: clean(title),
    price: price ? formatAED(price) : "",
    propertyType: inferType(title + " " + description),
    location: clean(location),
    beds: bedrooms,
    baths: bathrooms,
    area: sqft ? `${sqft} sqft` : "",
    description: clean(description),
    features: amenities,
    imageUrls: Array.from(new Set([image].filter(Boolean))),
    rawTextPreview: text.slice(0, 1000)
  };
}

function findRealEstateObject(nodes) {
  for (const n of nodes) {
    if (!n) continue;
    const type = Array.isArray(n["@type"]) ? n["@type"].join(" ") : (n["@type"] || "");
    if (/RealEstateListing|Apartment|House|Product|WebPage/i.test(type)) {
      if (n.mainEntity && typeof n.mainEntity === "object") return n.mainEntity;
      return n;
    }
    if (n.mainEntity && typeof n.mainEntity === "object") {
      const found = findRealEstateObject([n.mainEntity]);
      if (found) return found;
    }
  }
  return null;
}
function extractPrice(main, text) {
  const p = main?.offers?.priceSpecification?.price || main?.offers?.price || main?.priceSpecification?.price;
  if (p) return String(p);
  const m = text.match(/(?:AED\s*)?([0-9][0-9,]{4,})(?:\s*AED)?/i);
  return m ? m[1].replace(/,/g, "") : "";
}
function formatAED(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return n ? `AED ${n.toLocaleString("en-US")}` : String(v);
}
function extractBedroom(...parts) {
  const m = parts.join(" ").match(/(\d+)\s*(?:Beds?|Bedrooms?)/i);
  return m ? m[1] : "";
}
function extractBathroom(...parts) {
  const m = parts.join(" ").match(/(\d+)\s*(?:Baths?|Bathrooms?)/i);
  return m ? m[1] : "";
}
function extractSqft(main, text) {
  const fs = main?.floorSize?.value || main?.floorSize;
  if (fs) return String(fs).replace(/[^\d,]/g, "").replace(/,/g, "");
  const m = text.match(/([0-9,]+)\s*(?:sqft|sq\.?\s*ft|sq\.?\s?feet)/i);
  return m ? m[1].replace(/,/g, "") : "";
}
function extractLocation(main) {
  const a = main?.address || {};
  if (typeof a === "string") return a;
  return a.name || [a.addressRegion, a.addressLocality].filter(Boolean).join(", ") || "";
}
function extractAmenities(main, text) {
  let amenities = [];
  if (Array.isArray(main?.amenityFeature)) amenities = main.amenityFeature.map(x => x.name).filter(Boolean);
  if (!amenities.length) {
    const common = ["Balcony", "Security", "Covered Parking", "Shared Gym", "Shared Pool", "Central A/C", "Built in Wardrobes", "Kitchen Appliances", "Pets Allowed", "Maids Room"];
    amenities = common.filter(x => text.toLowerCase().includes(x.toLowerCase()));
  }
  return Array.from(new Set(amenities)).slice(0, 10);
}
function extractFirstImage(item) {
  const m = JSON.stringify(item || {}).match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/i);
  return m ? m[0] : "";
}
function cleanDescription(text) { return String(text || "").replace(/\n+/g, "\n").split("Amenities")[0].slice(0, 900); }
function firstLine(text) { return String(text || "").split("\n").find(x => x.trim().length > 5) || ""; }
function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
function inferType(s) {
  if (/penthouse/i.test(s)) return "Penthouse";
  if (/villa/i.test(s)) return "Villa";
  if (/townhouse/i.test(s)) return "Townhouse";
  if (/apartment/i.test(s)) return "Apartment";
  return "Property";
}