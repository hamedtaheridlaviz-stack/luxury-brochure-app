export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "No URL provided"
      });
    }

    // TEMP TEST IMPORT
    // This confirms the live import route works correctly

    return res.status(200).json({
      title: "Live Import Working",
      price: "AED 7,250,000",
      propertyType: "Penthouse",
      location: "Palm Jumeirah, Dubai",
      beds: "4",
      baths: "5",
      area: "4,850 sqft",
      description:
        "Live import endpoint is now functioning correctly. Next step is connecting real Property Finder extraction.",
      features: [
        "Sea View",
        "Private Pool",
        "Beach Access",
        "Smart Home"
      ],
      imageUrls: [],
      imported: true
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
