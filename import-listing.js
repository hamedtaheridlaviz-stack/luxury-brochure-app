export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const url = extractUrl(body.url || "");

    if (!url) {
      return res.status(400).json({ error: "Please provide a valid direct Property Finder or Bayut URL." });
    }

    if (!process.env.APIFY_TOKEN) {
      return res.status(500).json({ error: "Missing APIFY_TOKEN in Vercel environment variables." });
    }

    /*
      IMPORTANT:
      Keep the Apify input minimal. Some actor versions reject optional
      fields such as crawlerType with "string did not match expected pattern".
    */
    const actorUrl =
      `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=180`;

    const apifyInput = {
      startUrls: [{ url }],
      maxCrawlPages: 1
    };

    const apifyResponse = await fetch(actorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apifyInput)
    });

    const rawResponse = await apifyResponse.text();

    if (!apifyResponse.ok) {
      return res.status(502).json({
        error: "Apify import failed",
        details: rawResponse.slice(0, 1200)
      });
    }

    let data;
    try {
      data = JSON.parse(rawResponse);
    } catch (err) {
      return res.status(502).json({
        error: "Could not read Apify response",
        details: rawResponse.slice(0, 1200)
      });
    }

    const item = Array.isArray(data) ? data[0] || {} : data || {};
    const listing = parseListing(item, url);

    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unknown import error"
    });
  }
}

function extractUrl(input) {
  const match = String(input || "").trim().match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\],.]+$/g, "") : "";
}

function parseListing(item, sourceUrl) {
  const raw = JSON.stringify(item || {});
  const text = String(item.text || item.markdown || item.description || "");
  const metadata = item.metadata || {};

  const og = {};
  const openGraph = Array.isArray(metadata.openGraph) ? metadata.openGraph : [];
  openGraph.forEach(entry => {
    if (entry.property && entry.content) og[entry.property] = entry.content;
  });

  const jsonLd = Array.isArray(metadata.jsonLd) ? metadata.jsonLd : [];
  const structured = findStructured(jsonLd) || {};

  const combined = `${raw}\n${text}`;

  const title = clean(
    structured.name ||
    metadata.title ||
    og["og:title"] ||
    matchString(raw, "title") ||
    matchString(raw, "name") ||
    firstUsefulLine(text)
  );

  const description = clean(
    structured.description ||
    metadata.description ||
    og["og:description"] ||
    matchString(raw, "description") ||
    text.split(/Amenities|Prices\s*&\s*trends|Reviews|Provided by|Regulatory information/i)[0].slice(0, 1200)
  );

  const priceRaw =
    getNested(structured, ["offers", "priceSpecification", "price"]) ||
    getNested(structured, ["offers", "price"]) ||
    getNested(structured, ["priceSpecification", "price"]) ||
    extract(combined, /"price"\s*:\s*"?([0-9,]+)"?/i) ||
    extract(combined, /AED\s*([0-9,]{5,})/i) ||
    extract(combined, /\b([0-9,]{6,})\b/i) ||
    "";

  const allText = `${title} ${description} ${text}`;

  const beds =
    extract(allText, /(\d+)\s*(?:Beds?|Bedrooms?)/i) ||
    extract(combined, /"bedrooms"\s*:\s*"?(\d+)"?/i) ||
    extract(combined, /"beds"\s*:\s*"?(\d+)"?/i) ||
    "";

  const baths =
    extract(allText, /(\d+)\s*(?:Baths?|Bathrooms?)/i) ||
    extract(combined, /"bathrooms"\s*:\s*"?(\d+)"?/i) ||
    extract(combined, /"baths"\s*:\s*"?(\d+)"?/i) ||
    "";

  const areaRaw =
    getNested(structured, ["floorSize", "value"]) ||
    extract(allText, /([0-9,]+)\s*(?:sqft|sq\.?\s*ft|sq ft)/i) ||
    extract(combined, /"size"\s*:\s*"?([0-9,]+)"?/i) ||
    extract(combined, /"area"\s*:\s*"?([0-9,]+)"?/i) ||
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
  const imageUrls = extractImages(item, structured, og);

  return {
    sourceUrl,
    title,
    price: priceRaw ? formatAED(priceRaw) : "",
    propertyType,
    location,
    beds,
    baths,
    area: areaRaw ? `${String(areaRaw).replace(/[^\d,]/g, "")} sqft` : "",
    description,
    features,
    imageUrls,
    imported: Boolean(title || priceRaw || description || imageUrls.length)
  };
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

function getNested(obj, path) {
  return path.reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj);
}

function extract(str, regex) {
  return String(str || "").match(regex)?.[1] || "";
}

function matchString(raw, key) {
  const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "i");
  return raw.match(regex)?.[1] || "";
}

function firstUsefulLine(text) {
  return String(text || "")
    .split("\n")
    .map(x => x.trim())
    .find(x => x.length > 8 && !/^(AED|Reviews|Amenities|Price)$/i.test(x)) || "";
}

function clean(value) {
  return String(value || "")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    "Lobby in Building"
  ];

  common.forEach(feature => {
    if (new RegExp(escapeReg(feature), "i").test(source)) features.push(feature);
  });

  return [...new Set(features)].slice(0, 12);
}

function extractImages(item, structured, og) {
  const images = [];

  function add(value) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      images.push(value);
    }
  }

  add(structured.image);
  add(og["og:image"]);

  const raw = JSON.stringify(item || {});
  const matches = raw.match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?/gi) || [];
  matches.forEach(add);

  return [...new Set(images)].slice(0, 10);
}
