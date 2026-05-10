export function parseListingPayload(payload = {}, sourceUrl = "") {
  const item = Array.isArray(payload) ? (payload[0] || {}) : (payload || {});
  const raw = JSON.stringify(item || {});
  const text = String(item.text || item.markdown || item.description || item.bodyText || "");
  const metadata = item.metadata || {};
  const og = {};
  (Array.isArray(metadata.openGraph) ? metadata.openGraph : []).forEach((entry) => {
    if (entry.property && entry.content) og[entry.property] = entry.content;
  });
  if (item.ogTitle) og["og:title"] = item.ogTitle;
  if (item.ogDescription) og["og:description"] = item.ogDescription;
  if (item.ogImage) og["og:image"] = item.ogImage;

  const jsonLd = [...flattenJsonLd(metadata.jsonLd || []), ...flattenJsonLd(item.jsonLd || [])];
  const structured = findStructured(jsonLd) || {};
  const allText = clean(`${text} ${raw}`);

  const title = clean(structured.name || item.title || metadata.title || og["og:title"] || extract(raw, /"title"\s*:\s*"([^"]+)"/i) || extract(raw, /"name"\s*:\s*"([^"]+)"/i) || firstUsefulLine(text));
  const description = clean(structured.description || item.description || metadata.description || og["og:description"] || extract(raw, /"description"\s*:\s*"([^"]+)"/i) || text.split(/Amenities|Prices\s*&\s*trends|Reviews|Provided by|Regulatory information|Reference/i)[0].slice(0, 1200));
  const priceRaw = getNested(structured, ["offers","priceSpecification","price"]) || getNested(structured, ["offers","price"]) || getNested(structured, ["priceSpecification","price"]) || item.price || item.displayPrice || extract(raw, /"price"\s*:\s*"?([0-9,]+)"?/i) || extract(allText, /AED\s*([0-9,]{5,})/i) || extract(allText, /\b([0-9,]{6,})\b/i) || "";

  const beds = item.bedrooms || item.beds || extract(allText, /(\d+)\s*(?:Beds?|Bedrooms?)/i) || extract(raw, /"bedrooms"\s*:\s*"?(\d+)"?/i) || extract(raw, /"beds"\s*:\s*"?(\d+)"?/i) || "";
  const baths = item.bathrooms || item.baths || extract(allText, /(\d+)\s*(?:Baths?|Bathrooms?)/i) || extract(raw, /"bathrooms"\s*:\s*"?(\d+)"?/i) || extract(raw, /"baths"\s*:\s*"?(\d+)"?/i) || "";
  const areaRaw = item.area || item.size || getNested(structured, ["floorSize","value"]) || extract(allText, /([0-9,]+)\s*(?:sqft|sq\.?\s*ft|sq ft)/i) || extract(raw, /"size"\s*:\s*"?([0-9,]+)"?/i) || extract(raw, /"area"\s*:\s*"?([0-9,]+)"?/i) || "";
  const propertyType = item.propertyType || item.type || (/penthouse/i.test(allText) ? "Penthouse" : /villa/i.test(allText) ? "Villa" : /townhouse/i.test(allText) ? "Townhouse" : /apartment/i.test(allText) ? "Apartment" : /duplex/i.test(allText) ? "Duplex" : "Property");
  const address = structured.address || {};
  const location = clean(item.location || item.address || (typeof address === "string" ? address : "") || address.name || [address.addressRegion, address.addressLocality].filter(Boolean).join(", ") || extractLocation(allText));
  const features = extractFeatures(structured, allText, item);
  const imageUrls = extractImages(item, structured, og);
  return { sourceUrl, title, price: priceRaw ? formatAED(priceRaw) : "", propertyType: clean(propertyType), location, beds: String(beds || ""), baths: String(baths || ""), area: areaRaw ? formatArea(areaRaw) : "", description, features, imageUrls, imported: Boolean(title || priceRaw || description || imageUrls.length) };
}

export function mockListing() {
  return { sourceUrl: "mock://test-listing", title: "Imported Test Apartment | Palm Jumeirah", price: "AED 4,950,000", propertyType: "Apartment", location: "Palm Jumeirah, Dubai", beds: "3", baths: "4", area: "2,221 sqft", description: "This is a mock import used to prove the brochure form auto-populates correctly. If this works, the form mapping is correct and any live import issue is coming from the scraper/API source.", features: ["Balcony","Covered Parking","Shared Gym","Shared Pool","Security","Built in Wardrobes"], imageUrls: [], imported: true };
}
function flattenJsonLd(value) { if (!value) return []; if (typeof value === "string") { try { return flattenJsonLd(JSON.parse(value)); } catch { return []; } } if (Array.isArray(value)) return value.flatMap(flattenJsonLd); if (value["@graph"] && Array.isArray(value["@graph"])) return [value, ...value["@graph"].flatMap(flattenJsonLd)]; return [value];}
function findStructured(nodes) { for (const node of nodes) { if (!node || typeof node !== "object") continue; const candidates = [node, node.mainEntity, node.about].filter(Boolean); for (const candidate of candidates) { const type = Array.isArray(candidate["@type"]) ? candidate["@type"].join(" ") : String(candidate["@type"] || ""); if (/RealEstateListing|Apartment|House|Product|WebPage|Residence|ApartmentComplex|Offer/i.test(type)) return candidate.mainEntity && typeof candidate.mainEntity === "object" ? candidate.mainEntity : candidate; } } return null;}
function getNested(obj, path) { return path.reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj);}
function extract(str, regex) { return String(str || "").match(regex)?.[1] || "";}
function firstUsefulLine(text) { return String(text || "").split(/\n| - | \| /).map((x) => x.trim()).find((x) => x.length > 10 && !/^(AED|Reviews|Amenities|Price|Property Finder)$/i.test(x)) || "";}
function clean(value) { return decodeHtml(String(value || "")).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();}
function decodeHtml(value) { return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");}
function formatAED(value) { const str = String(value || "").replace(/AED/i, "").trim(); const num = Number(str.replace(/[^\d.]/g, "")); if (!num) return str ? `AED ${str}` : ""; return `AED ${num.toLocaleString("en-US")}`;}
function formatArea(value) { const str = String(value || ""); if (/sq/i.test(str)) return str; const cleanNum = str.replace(/[^\d,]/g, ""); return cleanNum ? `${cleanNum} sqft` : "";}
function escapeReg(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");}
function extractLocation(text) { const areas = ["Palm Jumeirah","Dubai Creek Harbour","Creek Beach","Downtown Dubai","Dubai Marina","Business Bay","Jumeirah Beach Residence","JBR","Dubai Hills Estate","Tilal Al Ghaf","Emirates Living","Arabian Ranches","Bluewaters","Jumeirah Village Circle","JVC","Shoreline Apartments","Al Habool","Vida Residences","Creek Harbour","Dubai"]; return areas.find((area) => new RegExp(escapeReg(area), "i").test(text)) || "";}
function extractFeatures(structured, source, item) { const features = []; if (Array.isArray(item.amenities)) features.push(...item.amenities); if (Array.isArray(item.features)) features.push(...item.features); if (Array.isArray(structured.amenityFeature)) structured.amenityFeature.forEach((feature) => { if (feature && feature.name) features.push(feature.name); }); const common = ["Balcony","Shared Pool","Shared Gym","Covered Parking","Security","Central A/C","Built in Wardrobes","Kitchen Appliances","Pets Allowed","Maids Room","Private Beach","Concierge","View of Water","View of Landmark","Walk-in Closet","Lobby in Building","Maid Service","Vacant on Transfer"]; common.forEach((feature) => { if (new RegExp(escapeReg(feature), "i").test(source)) features.push(feature); }); return [...new Set(features.map(clean).filter(Boolean))].slice(0, 12);}
function extractImages(item, structured, og) { const images = []; function add(value) { if (!value) return; if (Array.isArray(value)) { value.forEach(add); return; } if (typeof value === "string" && /^https?:\/\//i.test(value)) images.push(value); } add(structured.image); add(og["og:image"]); add(item.image); add(item.images); add(item.imageUrls); add(item.photos); const raw = JSON.stringify(item || {}); const matches = raw.match(/https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi) || []; matches.forEach(add); return [...new Set(images)].slice(0, 10);}
