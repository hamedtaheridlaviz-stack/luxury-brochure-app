
export function mockListing() {
  return {
    title: "Imported Test Apartment",
    price: "AED 4,950,000",
    propertyType: "Apartment",
    location: "Palm Jumeirah, Dubai",
    beds: "3",
    baths: "4",
    area: "2,221 sqft",
    description: "Mock import working correctly. This proves the form auto-population system is connected.",
    features: ["Balcony", "Pool", "Gym", "Parking"],
    imageUrls: [],
    imported: true
  };
}

export function parseListingText(input = "") {
  const text = String(input || "").replace(/\r/g, "\n").trim();
  const compact = text.replace(/\s+/g, " ");

  const title = firstUsefulLine(text);
  const priceRaw = extract(compact, /AED\s*([0-9,]{4,})/i) || extract(compact, /\b([0-9,]{6,})\b/);
  const beds = extract(compact, /(\d+)\s*(?:Beds?|Bedrooms?)/i) || extract(compact, /(\d+)\s*BR/i);
  const baths = extract(compact, /(\d+)\s*(?:Baths?|Bathrooms?)/i);
  const areaRaw = extract(compact, /([0-9,]+)\s*(?:sqft|sq\.?\s*ft|sq ft)/i);
  const propertyType =
    /penthouse/i.test(compact) ? "Penthouse" :
    /villa/i.test(compact) ? "Villa" :
    /townhouse/i.test(compact) ? "Townhouse" :
    /apartment/i.test(compact) ? "Apartment" :
    /duplex/i.test(compact) ? "Duplex" : "Property";

  const location = extractLocation(compact);
  const features = extractFeatures(compact);
  const description = extractDescription(text, title);

  return {
    title: clean(title),
    price: priceRaw ? formatAED(priceRaw) : "",
    propertyType,
    location,
    beds,
    baths,
    area: areaRaw ? `${areaRaw} sqft` : "",
    description: clean(description),
    features,
    imageUrls: [],
    imported: Boolean(title || priceRaw || beds || areaRaw || description)
  };
}

function extract(str, regex) { return String(str || "").match(regex)?.[1] || ""; }

function firstUsefulLine(text) {
  return String(text || "").split("\n").map(x => x.trim()).filter(Boolean).find(x =>
    x.length > 8 && !/^AED/i.test(x) && !/^\d+\s*(Beds?|Baths?|sqft)/i.test(x)
  ) || "";
}

function extractDescription(text, title) {
  const lines = String(text || "").split("\n").map(x => x.trim()).filter(Boolean);
  const rejected = [/AED\s*[0-9,]+/i,/^\d+\s*(Beds?|Bedrooms?|Baths?|Bathrooms?)/i,/^[0-9,]+\s*(sqft|sq ft|sq\. ft)/i];
  const possible = lines.filter(line => line !== title && line.length > 35 && !rejected.some(rx => rx.test(line)));
  return possible.join(" ").slice(0, 1200);
}

function extractLocation(text) {
  const areas = ["Palm Jumeirah","Dubai Creek Harbour","Creek Beach","Downtown Dubai","Dubai Marina","Business Bay","Jumeirah Beach Residence","JBR","Dubai Hills Estate","Tilal Al Ghaf","Shoreline Apartments","Al Habool","Vida Residences","Creek Harbour","Dubai"];
  return areas.find(area => new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) || "";
}

function extractFeatures(text) {
  const common = ["Balcony","Shared Pool","Shared Gym","Covered Parking","Security","Central A/C","Built in Wardrobes","Kitchen Appliances","Pets Allowed","Maids Room","Private Beach","Concierge","View of Water","Vacant on Transfer","Sea View","Beach Access","Private Pool"];
  return common.filter(f => new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)).slice(0, 12);
}

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function formatAED(value) {
  const num = Number(String(value).replace(/[^\d.]/g, ""));
  return num ? `AED ${num.toLocaleString("en-US")}` : `AED ${value}`;
}
