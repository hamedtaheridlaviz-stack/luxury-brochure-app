let propertyImages = [];
let importedImages = [];
let agentImage = "";

const $ = (id) => document.getElementById(id);

function val(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function setVal(id, value) {
  const el = $(id);
  if (el && value !== undefined && value !== null && value !== "") el.value = value;
}

function setText(selector, text) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = text || "";
  });
}

function setStatus(message) {
  const el = $("importStatus");
  if (el) el.textContent = message || "";
}

function extractUrl(input) {
  const match = String(input || "").match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\],.]+$/g, "") : "";
}

function setBackground(selector, src) {
  const el = document.querySelector(selector);
  if (!el) return;

  if (src) {
    el.style.backgroundImage = `url("${src}")`;
    el.textContent = "";
  }
}

async function importListing() {
  const url = extractUrl(val("listingUrl"));

  if (!url) {
    setStatus("Please paste a direct Property Finder or Bayut listing URL.");
    return;
  }

  const button = $("importBtn");
  if (button) button.disabled = true;
  setStatus("Importing listing... this can take 30–90 seconds.");

  try {
    const response = await fetch(`${window.location.origin}/api/import-listing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Import failed.");
    }

    setVal("title", data.title);
    setVal("price", data.price);
    setVal("location", data.location);
    setVal("beds", data.beds);
    setVal("baths", data.baths);
    setVal("area", data.area);
    setVal("propertyType", data.propertyType);
    setVal("description", data.description);

    if (Array.isArray(data.features) && data.features.length) {
      setVal("features", data.features.join("\n"));
    }

    importedImages = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    renderPhotoPreview();
    buildBrochure();

    const hasData = data.title || data.price || data.description || importedImages.length;
    setStatus(hasData ? "Imported successfully. Review/edit the details below before exporting." : "Import completed, but no usable data was found. Manual mode still works.");
  } catch (error) {
    console.error(error);
    setStatus("Import failed: " + error.message + " Manual mode still works.");
  } finally {
    if (button) button.disabled = false;
  }
}

function renderPhotoPreview() {
  const preview = $("photoPreview");
  if (!preview) return;

  preview.innerHTML = "";

  [...propertyImages, ...importedImages].forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    preview.appendChild(img);
  });
}

function handlePropertyPhotos(event) {
  propertyImages = [];
  const files = Array.from(event.target.files || []);

  if (!files.length) {
    renderPhotoPreview();
    buildBrochure();
    return;
  }

  let loaded = 0;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      propertyImages.push(e.target.result);
      loaded += 1;
      if (loaded === files.length) {
        renderPhotoPreview();
        buildBrochure();
      }
    };
    reader.readAsDataURL(file);
  });
}

function handleAgentPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    agentImage = e.target.result;

    const preview = $("agentPhotoPreview");
    if (preview) {
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.src = agentImage;
      preview.appendChild(img);
    }

    buildBrochure();
  };
  reader.readAsDataURL(file);
}

function buildBrochure() {
  setText(".outCompany", val("company") || "Betterhomes");
  setText(".outTitle", val("title") || "Property Title");
  setText(".outLocation", val("location"));
  setText(".outPrice", val("price"));
  setText(".outBeds", val("beds"));
  setText(".outBaths", val("baths"));
  setText(".outArea", val("area"));
  setText(".outType", val("propertyType"));
  setText(".outDescription", val("description"));
  setText(".outAgent", val("agent"));
  setText(".outJobTitle", val("jobTitle"));
  setText(".outContact", [val("phone"), val("email")].filter(Boolean).join(" · "));

  const summary = [val("price"), val("propertyType"), val("location")].filter(Boolean).join(" · ");
  setText(".outSummary", summary);

  const features = val("features")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);

  const ul = document.querySelector(".outFeatures");
  if (ul) {
    ul.innerHTML = "";
    features.forEach((feature) => {
      const li = document.createElement("li");
      li.textContent = feature;
      ul.appendChild(li);
    });
  }

  const images = [...propertyImages, ...importedImages];

  setBackground("#coverPhoto", images[0]);
  setBackground(".p1", images[0]);
  setBackground(".p2", images[1]);
  setBackground(".p3", images[2]);
  setBackground(".p4", images[3]);

  const agentPhoto = $("brochureAgentPhoto");
  if (agentPhoto && agentImage) {
    agentPhoto.style.backgroundImage = `url("${agentImage}")`;
    agentPhoto.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("importBtn").addEventListener("click", importListing);
  $("photoInput").addEventListener("change", handlePropertyPhotos);
  $("agentPhotoInput").addEventListener("change", handleAgentPhoto);
  $("previewBtn").addEventListener("click", buildBrochure);
  $("printBtn").addEventListener("click", () => window.print());
  $("printTopBtn").addEventListener("click", () => window.print());

  buildBrochure();
});
