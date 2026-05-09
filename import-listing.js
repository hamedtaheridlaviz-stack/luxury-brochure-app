export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const url = extractUrl(body.url || "");
    if (!url) return res.status(400).json({ error: "Missing or invalid listing URL" });
    if (!process.env.APIFY_TOKEN) return res.status(500).json({ error: "Missing APIFY_TOKEN environment variable" });

    const apifyUrl = `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=180`;
    const apifyResponse = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url }],
        crawlerType: "browser",
        maxCrawlPages: 1,
        saveMarkdown: true,
        saveHtml: false,
        proxyConfiguration: { useApifyProxy: true }
      })
    });

    const rawResponse = await apifyResponse.text();
    if (!apifyResponse.ok) {
      return res.status(502).json({ error: "Apify request failed", details: rawResponse.slice(0, 1000) });
    }

    let data = JSON.parse(rawResponse);
    const item = Array.isArray(data) ? (data[0] || {}) : (data || {});
    return res.status(200).json(parseListing(item, url));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown server error" });
  }
}

function extractUrl(input) {
  const match = String(input || "").trim().match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\],.]+$/g, "") : "";
}

function parseListing(item, sourceUrl) {
  const metadata = item.metadata || {};
  const raw = JSON.stringify(item || {});
  const text = String(item.text || item.markdown || "");
  const og = {};
  (Array.isArray(metadata.openGraph) ? metadata.openGraph : []).forEach(e => {
    if (e.property && e.content) og[e.property] = e.content;
  });
  const jsonLd = Array.isArray(metadata.jsonLd) ? metadata.jsonLd : [];
  const structured = findStructured(jsonLd) || {};

  const title = clean(
    structured.name ||
    metadata.title ||
    og["og:title"] ||
    raw.match(/"name"\s*:\s*"([^"]+)"/)?.[1] ||
    firstLine(text)
  );

  const description = clean(
    structured.description ||
    metadata.description ||
    og["og:description"] ||
    raw.match(/"description"\s*:\s*"([^"]+)"/)?.[1] ||
    text.split(/Amenities|Prices\s*&\s*trends|Reviews|Provided by/i)[0].slice(0, 1000)
  );

  const priceRaw =
    structured?.offers?.priceSpecification?.price ||
    structured?.offers?.price ||
    structured?.priceSpecification?.price ||
    raw.match(/"price"\s*:\s*"?([0-9,]+)"?/)?.[1] ||
    text.match(/AED\s*([0-9,]{5,})/i)?.[1] ||
    text.match(/\b([0-9,]{6,})\b/)?.[1] || "";

  const beds = text.match(/(\d+)\s*(?:Beds?|Bedrooms?)/i)?.[1] || "";
  const baths = text.match(/(\d+)\s*(?:Baths?|Bathrooms?)/i)?.[1] || "";
  const areaRaw = structured?.floorSize?.value || text.match(/([0-9,]+)\s*(?:sqft|sq\.?\s*ft|sq ft)/i)?.[1] || "";
  const allText = `${title} ${description} ${text}`;

  const propertyType =
    /penthouse/i.test(allText) ? "Penthouse" :
    /villa/i.test(allText) ? "Villa" :
    /townhouse/i.test(allText) ? "Townhouse" :
    /apartment/i.test(allText) ? "Apartment" : "Property";

  const address = structured.address || {};
  const location = clean(
    (typeof address === "string" ? address : "") ||
    address.name ||
    [address.addressRegion, address.addressLocality].filter(Boolean).join(", ") ||
    extractLocation(allText)
  );

  const featureNames = structured.amenityFeature && Array.isArray(structured.amenityFeature)
    ? structured.amenityFeature.map(x => x && x.name).filter(Boolean)
    : [];

  const common = ["Balcony","Shared Pool","Shared Gym","Covered Parking","Security","Central A/C","Built in Wardrobes","Kitchen Appliances","Pets Allowed","Maids Room","Private Beach","Concierge","View of Water"];
  const features = [...new Set([...featureNames, ...common.filter(f => new RegExp(escapeReg(f), "i").test(allText))])].slice(0, 10);

  const images = [];
  const add = v => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(add);
    else if (typeof v === "string" && /^https?:\/\//.test(v)) images.push(v);
  };
  add(structured.image);
  add(og["og:image"]);
  (raw.match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/gi) || []).forEach(add);

  return {
    sourceUrl,
    title,
    price: priceRaw ? `AED ${String(priceRaw).replace(/AED/i, "").trim()}` : "",
    propertyType,
    location,
    beds,
    baths,
    area: areaRaw ? `${String(areaRaw).replace(/[^\d,]/g, "")} sqft` : "",
    description,
    features,
    imageUrls: [...new Set(images)].slice(0, 8),
    debug: { hasText: Boolean(text), textPreview: text.slice(0, 300) }
  };
}

function findStructured(nodes) {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const list = [node, node.mainEntity].filter(Boolean);
    for (const c of list) {
      const type = Array.isArray(c["@type"]) ? c["@type"].join(" ") : String(c["@type"] || "");
      if (/RealEstateListing|Apartment|House|Product|WebPage|ApartmentComplex/i.test(type)) return c.mainEntity && typeof c.mainEntity === "object" ? c.mainEntity : c;
    }
  }
  return null;
}
function firstLine(text) { return String(text || "").split("\n").map(x => x.trim()).find(x => x.length > 8) || ""; }
function extractLocation(s) {
  return ["Palm Jumeirah","Dubai Creek Harbour","Downtown Dubai","Dubai Marina","Business Bay","Jumeirah Beach Residence","JBR","Creek Beach","Dubai Hills Estate","Tilal Al Ghaf","Al Habool","Shoreline Apartments"].find(a => new RegExp(escapeReg(a), "i").test(s)) || "";
}
function escapeReg(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function clean(s) { return String(s || "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim(); }