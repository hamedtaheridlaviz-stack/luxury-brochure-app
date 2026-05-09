export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Missing URL" });
    }

    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=180`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startUrls: [{ url }],
          crawlerType: "browser",
          maxCrawlPages: 1,
          saveMarkdown: true
        })
      }
    );

    const data = await response.json();

    const item = Array.isArray(data) ? data[0] : data;

    const text =
      item?.text ||
      item?.markdown ||
      "";

    const meta =
      item?.metadata || {};

    const title =
      meta.title || "";

    const description =
      meta.description ||
      text.slice(0, 800);

    const price =
      text.match(/AED\s?[0-9,]+|[0-9,]+\s?AED/i)?.[0] || "";

    const beds =
      text.match(/(\d+)\s*(Beds?|Bedrooms?)/i)?.[1] || "";

    const baths =
      text.match(/(\d+)\s*(Baths?|Bathrooms?)/i)?.[1] || "";

    const areaMatch =
      text.match(/([0-9,]+)\s*(sqft|sq\. ft|sq ft)/i);

    const area =
      areaMatch
        ? `${areaMatch[1]} sqft`
        : "";

    const type =
      /penthouse/i.test(text)
        ? "Penthouse"
        : /villa/i.test(text)
        ? "Villa"
        : /apartment/i.test(text)
        ? "Apartment"
        : "Property";

    const location =
      text.match(
        /Palm Jumeirah|Dubai Creek Harbour|Downtown Dubai|Dubai Marina|Business Bay|JBR|Creek Beach/i
      )?.[0] || "";

    const featuresList = [
      "Balcony",
      "Shared Pool",
      "Shared Gym",
      "Covered Parking",
      "Security",
      "Central A/C",
      "Built in Wardrobes",
      "Kitchen Appliances",
      "Pets Allowed",
      "Maids Room"
    ];

    const features =
      featuresList.filter(f =>
        text.toLowerCase().includes(f.toLowerCase())
      );

    const imageUrls =
      JSON.stringify(item).match(
        /https?:\/\/[^"']+\.(jpg|jpeg|png|webp)/gi
      ) || [];

    res.status(200).json({
      title,
      price,
      propertyType: type,
      location,
      beds,
      baths,
      area,
      description,
      features,
      imageUrls: [...new Set(imageUrls)].slice(0, 6)
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
