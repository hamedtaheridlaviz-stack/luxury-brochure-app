export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const url = extractUrl(body.url || "");

    if (!url) {
      return res.status(400).json({
        error: "Invalid URL. Paste only the direct listing link beginning with https://"
      });
    }

    const attempts = [];

    // Attempt 1: direct server fetch and parse
    try {
      const direct = await directFetchAndParse(url);
      attempts.push({ method: "direct", imported: direct.imported, title: direct.title });
      if (direct.imported) {
        return res.status(200).json({ ...direct, importMethod: "direct", attempts });
      }
    } catch (error) {
      attempts.push({ method: "direct", error: error.message });
    }

    // Attempt 2: Apify fallback
    if (process.env.APIFY_TOKEN) {
      try {
        const apify = await importViaApify(url);
        attempts.push({ method: "apify-web-scraper", imported: apify.imported, title: apify.title });
        if (apify.imported) {
          return res.status(200).json({ ...apify, importMethod: "apify-web-scraper", attempts });
        }
      } catch (error) {
        attempts.push({ method: "apify-web-scraper", error: error.message });
      }
    } else {
      attempts.push({ method: "apify-web-scraper", error: "APIFY_TOKEN is missing in Vercel." });
    }

    return res.status(422).json({
      error: "Import could not extract listing details. Manual mode still works.",
      attempts
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unknown server error"
    });
  }
}

function extractUrl(input) {
  const match = String(input || "").trim().match(/https?:\/\/[^\s]+/i);
  if (!match) return "";
  return match[0].replace(/[)\],.]+$/g, "");
}

async function directFetchAndParse(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`Direct fetch failed: HTTP ${response.status}`);
  }

  if (!html || html.length < 500) {
    throw new Error("Direct fetch returned empty/short HTML.");
  }

  return parseFromHtml(html, url);
}

function parseFromHtml(html, sourceUrl) {
  const jsonLdObjects = extractJsonLd(html);
  const og = extractOpenGraph(html);

  const raw = html;
  const structured = findStructured(jsonLdObjects) || {};

  const pageText = stripHtml(html);

  const title = clean(
    structured.name ||
    og["og:title"] ||
    extractTitle(html) ||
    extract(raw, /"title"\s*:\s*"([^"]+)"/i)
  );

  const description = clean(
    structured.description ||
    og["og:description"] ||
    extractMetaDescription(html) ||
    extract(raw, /"description"\s*:\s*"([^"]+)"/i)
  );

  return normaliseListing({
    sourceUrl,
    title,
    description,
    raw,
    text: pageText,
    structured,
    og
  });
}

async function importViaApify(url) {
  const pageFunction = `
    async function pageFunction(context) {
      const $ = context.jQuery;
      const text = document.body ? document.body.innerText : "";
      const title = document.title || "";
      const description =
        document.querySelector('meta[name="description"]')?.content ||
        document.querySelector('meta[property="og:description"]')?.content ||
        "";
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.content || "";

      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(s => {
          try { return JSON.parse(s.textContent); } catch (e) { return null; }
        })
        .filter(Boolean);

      const images = Array.from(document.images || [])
        .map(img => img.src)
        .filter(Boolean);

      return {
        url: context.request.url,
        title: ogTitle || title,
        description,
        text,
        jsonLd,
        images,
        ogImage
      };
    }
  `;

  const actorUrl =
    `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=180`;

  const input = {
    startUrls: [{ url }],
    pageFunction,
    proxyConfiguration: { useApifyProxy: true },
    maxRequestRetries: 2,
    maxPagesPerCrawl: 1,
    maxConcurrency: 1
  };

  const response = await fetch(actorUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Apify failed: HTTP ${response.status} ${responseText.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Apify returned non-JSON response: ${responseText.slice(0, 300)}`);
  }

  const item = Array.isArray(data) ? (data[0] || {}) : (data || {});
  const structured = findStructured(flattenJsonLd(item.jsonLd || [])) || {};

  return normaliseListing({
    sourceUrl: url,
    title: item.title || "",
    description: item.description || "",
    raw: JSON.stringify(item || {}),
    text: item.text || "",
    structured,
    og: { "og:image": item.ogImage || "" },
    imagesFromApify: item.images || []
  });
}

function normaliseListing({ sourceUrl, title, description, raw, text, structured, og, imagesFromApify = [] }) {
  const allText = clean(`${title} ${description} ${text} ${raw}`);

  const priceRaw =
    getNested(structured, ["offers", "priceSpecification", "price"]) ||
    getNested(structured, ["offers", "price"]) ||
    getNested(structured, ["priceSpecification", "price"]) ||
    extract(raw, /"price"\s*:\s*"?([0-9,]+)"?/i) ||
    extract(allText, /AED\s*([0-9,]{5,})/i) ||
    extract(allText, /\b([0-9,]{6,})\b/i) ||
    "";

  const beds =
    extract(allText, /(\d+)\s*(?:Beds?|Bedrooms?)/i) ||
    extract(raw, /"bedrooms"\s*:\s*"?(\d+)"?/i) ||
    extract(raw, /"beds"\s*:\s*"?(\d+)"?/i) ||
    "";

  const baths =
    extract(allText, /(\d+)\s*(?:Baths?|Bathrooms?)/i) ||
    extract(raw, /"bathrooms"\s*:\s*"?(\d+)"?/i) ||
    extract(raw, /"baths"\s*:\s*"?(\d+)"?/i) ||
    "";

  const areaRaw =
    getNested(structured, ["floorSize", "value"]) ||
    extract(allText, /([0-9,]+)\s*(?:sqft|sq\.?\s*ft|sq ft)/i) ||
    extract(raw, /"size"\s*:\s*"?([0-9,]+)"?/i) ||
    extract(raw, /"area"\s*:\s*"?([0-9,]+)"?/i) ||
    "";

  const propertyType =
    /penthouse/i.test(allText) ? "Penthouse" :
    /villa/i.test(allText) ? "Villa" :
    /townhouse/i.test(allText) ? "Townhouse" :
    /apartment/i.test(allText) ? "Apartment" :
    /duplex/i.test(allText) ? "Duplex" :
    "Property";

  const address = structured.address || {};
  const location = clean(
    (typeof address === "string" ? address : "") ||
    address.name ||
    [address.addressRegion, address.addressLocality].filter(Boolean).join(", ") ||
    extractLocation(allText)
  );

  const features = extractFeatures(structured, allText);

  const imageUrls = extractImages(raw, structured, og, imagesFromApify);

  const cleanTitle = clean(title);
  const cleanDescription = clean(description);

  return {
    sourceUrl,
    title: cleanTitle,
    price: priceRaw ? formatAED(priceRaw) : "",
    propertyType,
    location,
    beds,
    baths,
    area: areaRaw ? `${String(areaRaw).replace(/[^\d,]/g, "")} sqft` : "",
    description: cleanDescription,
    features,
    imageUrls,
    imported: Boolean(cleanTitle || priceRaw || cleanDescription || imageUrls.length)
  };
}

function extractJsonLd(html) {
  const scripts = [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return scripts.flatMap(match => {
    try {
      const parsed = JSON.parse(match[1].trim());
      return flattenJsonLd(parsed);
    } catch {
      return [];
    }
  });
}

function flattenJsonLd(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value["@graph"] && Array.isArray(value["@graph"])) return [value, ...value["@graph"].flatMap(flattenJsonLd)];
  return [value];
}

function findStructured(nodes) {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const candidates = [node, node.mainEntity].filter(Boolean);

    for (const candidate of candidates) {
      const type = Array.isArray(candidate["@type"])
        ? candidate["@type"].join(" ")
        : String(candidate["@type"] || "");

      if (/RealEstateListing|Apartment|House|Product|WebPage|Residence|ApartmentComplex/i.test(type)) {
        return candidate.mainEntity && typeof candidate.mainEntity === "object"
          ? candidate.mainEntity
          : candidate;
      }
    }
  }
  return null;
}

function extractOpenGraph(html) {
  const og = {};
  const tags = [...String(html || "").matchAll(/<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)];
  tags.forEach(match => { og[match[1]] = decodeHtml(match[2]); });
  return og;
}

function extractTitle(html) {
  return decodeHtml(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function extractMetaDescription(html) {
  const match = String(html || "").match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  return decodeHtml(match?.[1] || "");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNested(obj, path) {
  return path.reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj);
}

function extract(str, regex) {
  return String(str || "").match(regex)?.[1] || "";
}

function clean(value) {
  return decodeHtml(String(value || ""))
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatAED(value) {
  const str = String(value || "").replace(/AED/i, "").trim();
  const num = Number(str.replace(/[^\d.]/g, ""));
  if (!num) return str ? `AED ${str}` : "";
  return `AED ${num.toLocaleString("en-US")}`;
}

function escapeReg(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLocation(text) {
  const areas = [
    "Palm Jumeirah",
    "Dubai Creek Harbour",
    "Creek Beach",
    "Downtown Dubai",
    "Dubai Marina",
    "Business Bay",
    "Jumeirah Beach Residence",
    "JBR",
    "Dubai Hills Estate",
    "Tilal Al Ghaf",
    "Emirates Living",
    "Arabian Ranches",
    "Bluewaters",
    "Jumeirah Village Circle",
    "JVC",
    "Shoreline Apartments",
    "Al Habool",
    "Vida Residences",
    "Creek Harbour"
  ];

  return areas.find(area => new RegExp(escapeReg(area), "i").test(text)) || "";
}

function extractFeatures(structured, source) {
  const features = [];

  if (Array.isArray(structured.amenityFeature)) {
    structured.amenityFeature.forEach(item => {
      if (item && item.name) features.push(item.name);
    });
  }

  const common = [
    "Balcony",
    "Shared Pool",
    "Shared Gym",
    "Covered Parking",
    "Security",
    "Central A/C",
    "Built in Wardrobes",
    "Kitchen Appliances",
    "Pets Allowed",
    "Maids Room",
    "Private Beach",
    "Concierge",
    "View of Water",
    "View of Landmark",
    "Walk-in Closet",
    "Lobby in Building",
    "Maid Service"
  ];

  common.forEach(feature => {
    if (new RegExp(escapeReg(feature), "i").test(source)) features.push(feature);
  });

  return [...new Set(features)].slice(0, 12);
}

function extractImages(raw, structured, og, apifyImages = []) {
  const images = [];

  function add(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (typeof value === "string" && /^https?:\/\//i.test(value)) images.push(value);
  }

  add(structured.image);
  add(og["og:image"]);
  add(apifyImages);

  const matches = String(raw || "").match(/https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi) || [];
  matches.forEach(add);

  return [...new Set(images)].slice(0, 10);
}
