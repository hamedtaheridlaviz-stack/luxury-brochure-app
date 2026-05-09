export default async function handler(req, res) {
  try {
    const { url } = req.body;

    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startUrls: [{ url }]
        })
      }
    );

    const data = await response.json();

    const item = data[0] || {};

    const cleanData = {
      title:
        item.title ||
        item.name ||
        item.propertyTitle ||
        "",

      price:
        item.price ||
        item.displayPrice ||
        "",

      type:
        item.propertyType ||
        item.type ||
        "",

      location:
        item.location ||
        item.address ||
        "",

      beds:
        item.bedrooms ||
        item.beds ||
        "",

      baths:
        item.bathrooms ||
        item.baths ||
        "",

      area:
        item.area ||
        item.size ||
        "",

      description:
        item.description ||
        "",

      imageUrls:
        item.images ||
        item.imageUrls ||
        []
    };

    res.status(200).json(cleanData);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
