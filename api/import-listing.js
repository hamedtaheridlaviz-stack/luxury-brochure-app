export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const url = body?.url;

    if (!url) {
      return res.status(400).json({ error: "No listing URL provided" });
    }

    if (!process.env.APIFY_TOKEN) {
      return res.status(500).json({ error: "Missing APIFY_TOKEN in Vercel" });
    }

    const apifyUrl =
      `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;

    const response = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url }],
        maxCrawlPages: 1,
        maxCrawlDepth: 0,
        crawlerType: "playwright:chrome",
        saveMarkdown: true,
        proxyConfiguration: {
          useApifyProxy: true
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
  return res.status(500).json({
    error: "Apify request failed: " + JSON.stringify(data).slice(0, 1000),
    details: data
  });
}
    }

    const item = Array.isArray(data) ? data[0] : data;
    const text = `${item?.markdown || ""} ${item?.text || ""} ${JSON.stringify(item || {})}`;

    const price = text.match(/AED\s?[\d,]+/i)?.[0] || "";
    const beds = text.match(/(\d+)\s*(Beds|Bedrooms)/i)?.[1] || "";
    const baths = text.match(/(\d+)\s*(Baths|Bathrooms)/i)?.[1] || "";
    const area = text.match(/([\d,]+)\s*(sqft|sq ft|sq\. ft)/i)?.[0] || "";
    const title =
      item?.metadata?.title ||
      item?.title ||
      text.split("\n").find(line => line.length > 15) ||
      "Imported Property";

    const description = text.slice(0, 900);

    return res.status(200).json({
      title,
      price,
      propertyType: text.match(/Apartment|Villa|Penthouse|Townhouse/i)?.[0] || "Property",
      location: text.match(/Palm Jumeirah|Dubai Marina|Downtown Dubai|Dubai Creek Harbour|Business Bay|Dubai/i)?.[0] || "",
      beds,
      baths,
      area,
      description,
      features: ["Balcony", "Parking", "Security"],
      imageUrls: [],
      imported: true,
      importMethod: "apify"
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
