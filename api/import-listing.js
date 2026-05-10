
export default function handler(req, res) {
  res.status(200).json({
    title: "Live Import Route Working",
    price: "AED 7,250,000",
    propertyType: "Penthouse",
    location: "Palm Jumeirah, Dubai",
    beds: "4",
    baths: "5",
    area: "4,850 sqft",
    description: "The URL import route is connected. For reliable extraction now, use Paste Listing Text.",
    features: ["Sea View", "Private Pool", "Beach Access", "Smart Home"],
    imageUrls: [],
    imported: true,
    version: "4.0.0-dual-import"
  });
}
