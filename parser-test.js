import { parseListingPayload, mockListing } from "../lib/listingParser.js";
function assert(condition, message) { if (!condition) throw new Error(message); }
const fixture = { title: "3 Bedroom Apartment for Sale in Palm Jumeirah", description: "AED 4,950,000 - 3 Bedrooms - 4 Bathrooms - 2,221 sqft - Balcony - Shared Pool - Covered Parking", text: `3 Bedroom Apartment for Sale in Palm Jumeirah
AED 4,950,000
3 Beds
4 Baths
2,221 sqft
Apartment
Balcony
Shared Pool
Covered Parking`, images: ["https://example.com/photo1.jpg"] };
const parsed = parseListingPayload(fixture, "https://www.propertyfinder.ae/example");
assert(parsed.title.includes("3 Bedroom"), "title parse failed");
assert(parsed.price === "AED 4,950,000", "price parse failed: " + parsed.price);
assert(parsed.beds === "3", "beds parse failed: " + parsed.beds);
assert(parsed.baths === "4", "baths parse failed: " + parsed.baths);
assert(parsed.area === "2,221 sqft", "area parse failed: " + parsed.area);
assert(parsed.propertyType === "Apartment", "property type parse failed: " + parsed.propertyType);
assert(parsed.features.includes("Balcony"), "features parse failed");
assert(parsed.imageUrls.length === 1, "image parse failed");
const mock = mockListing();
assert(mock.title && mock.price && mock.beds, "mock import failed");
console.log("Parser simulation passed.");
console.log(JSON.stringify(parsed, null, 2));
