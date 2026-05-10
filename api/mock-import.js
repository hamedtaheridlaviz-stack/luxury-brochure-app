export default function handler(req, res) {
  res.status(200).json({
    title: "Imported Test Apartment",
    price: "AED 4,950,000",
    propertyType: "Apartment",
    location: "Palm Jumeirah, Dubai",
    beds: "3",
    baths: "4",
    area: "2,221 sqft",
    description: "Mock import working correctly.",
    features: [
      "Balcony",
      "Pool",
      "Gym",
      "Parking"
    ]
  });
}
