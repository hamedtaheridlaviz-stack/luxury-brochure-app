let uploadedImages = [];
let importedImageUrls = [];

function $(id) {
  return document.getElementById(id);
}

function val(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function set(id, value) {
  const el = $(id);
  if (el) el.value = value || "";
}

async function importListing() {
  const url = val("sourceUrl");
  const status = $("status");

  if (!url) {
    status.textContent = "Please paste a listing URL first.";
    return;
  }

  status.textContent = "Importing listing...";
  $("importBtn").disabled = true;

  try {
    const response = await fetch("/api/import-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    console.log("Apify response:", data);

    const item = Array.isArray(data) ? data[0] : data;

    const text = item.text || item.markdown || "";
    const metadata = item.metadata || {};
    const title = metadata.title || item.title || "";
    const description = metadata.description || item.description || text.slice(0, 600);

    set("title", title);
    set("description", description);

    const priceMatch = text.match(/AED\s?[0-9,]+|[0-9,]+\s?AED/i);
    if (priceMatch) set("price", priceMatch[0]);

    const bedsMatch = text.match(/(\d+)\s*(Beds?|Bedrooms?)/i);
    if (bedsMatch) set("beds", bedsMatch[1]);

    const bathsMatch = text.match(/(\d+)\s*(Baths?|Bathrooms?)/i);
    if (bathsMatch) set("baths", bathsMatch[1]);

    const areaMatch = text.match(/([0-9,]+)\s*(sqft|sq\. ft|sq ft)/i);
    if (areaMatch) set("area", areaMatch[1] + " sqft");

    if (/apartment/i.test(text)) set("propertyType", "Apartment");
    if (/villa/i.test(text)) set("propertyType", "Villa");
    if (/penthouse/i.test(text)) set("propertyType", "Penthouse");

    const locationMatch = text.match(/Palm Jumeirah|Dubai Creek Harbour|Downtown Dubai|Dubai Marina|Business Bay|Jumeirah Beach Residence/i);
    if (locationMatch) set("location", locationMatch[0]);

    const commonFeatures = [
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

    const features = commonFeatures.filter(f =>
      text.toLowerCase().includes(f.toLowerCase())
    );

    set("features", features.join("\n"));

    const imageMatches = JSON.stringify(item).match(/https?:\/\/[^"']+\.(jpg|jpeg|png|webp)/gi);
    importedImageUrls = imageMatches ? [...new Set(imageMatches)].slice(0, 6) : [];

    renderPhotoPreview();
    buildBrochure();

    status.textContent = "Imported successfully.";
  } catch (error) {
    console.error(error);
    status.textContent = "Import failed: " + error.message;
  } finally {
    $("importBtn").disabled = false;
  }
}

function renderPhotoPreview() {
  const wrap = $("photoPreview");
  if (!wrap) return;

  wrap.innerHTML = "";

  [...importedImageUrls, ...uploadedImages].forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    wrap.appendChild(img);
  });
}

function buildBrochure() {
  const title = val("title") || "Property Title";
  const summary = [val("price"), val("propertyType"), val("location")]
    .filter(Boolean)
    .join(" - ");

  document.querySelectorAll(".outTitle").forEach(el => el.textContent = title);
  document.querySelectorAll(".outSummary").forEach(el => el.textContent = summary);

  const desc = document.querySelector(".outDescription");
  if (desc) desc.textContent = val("description");

  document.querySelectorAll(".outCompany").forEach(el => {
    el.textContent = val("company") || "Betterhomes";
  });

  const agent = document.querySelector(".outAgent");
  if (agent) agent.textContent = val("agent");

  const contact = document.querySelector(".outContact");
  if (contact) contact.textContent = [val("phone"), val("email")].filter(Boolean).join(" | ");

  const ul = document.querySelector(".outFeatures");
  if (ul) {
    ul.innerHTML = "";
    val("features")
      .split("\n")
      .filter(Boolean)
      .slice(0, 8)
      .forEach(feature => {
        const li = document.createElement("li");
        li.textContent = feature;
        ul.appendChild(li);
      });
  }

  applyImages();
}

function applyImages() {
  const imgs = [...uploadedImages, ...importedImageUrls];

  [".hero", ".p1", ".p2", ".p3", ".p4"].forEach((selector, index) => {
    const el = document.querySelector(selector);
    if (el && imgs[index]) {
      el.style.backgroundImage = `url('${imgs[index]}')`;
      el.textContent = "";
    }
  });
}
