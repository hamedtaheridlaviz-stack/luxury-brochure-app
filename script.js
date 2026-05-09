let propertyImages = [];
let agentImage = "";

const $ = (id) => document.getElementById(id);

function val(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function setText(selector, text) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = text || "";
  });
}

function setBackground(selector, src) {
  const el = document.querySelector(selector);
  if (!el) return;

  if (src) {
    el.style.backgroundImage = `url("${src}")`;
    el.textContent = "";
  }
}

function handlePropertyPhotos(event) {
  propertyImages = [];
  const files = Array.from(event.target.files || []);
  const preview = $("photoPreview");
  if (preview) preview.innerHTML = "";

  if (!files.length) {
    buildBrochure();
    return;
  }

  let loaded = 0;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      propertyImages.push(e.target.result);

      if (preview) {
        const img = document.createElement("img");
        img.src = e.target.result;
        preview.appendChild(img);
      }

      loaded += 1;
      if (loaded === files.length) buildBrochure();
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

  setBackground("#coverPhoto", propertyImages[0]);
  setBackground(".p1", propertyImages[0]);
  setBackground(".p2", propertyImages[1]);
  setBackground(".p3", propertyImages[2]);
  setBackground(".p4", propertyImages[3]);

  const agentPhoto = $("brochureAgentPhoto");
  if (agentPhoto && agentImage) {
    agentPhoto.style.backgroundImage = `url("${agentImage}")`;
    agentPhoto.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("photoInput").addEventListener("change", handlePropertyPhotos);
  $("agentPhotoInput").addEventListener("change", handleAgentPhoto);
  $("previewBtn").addEventListener("click", buildBrochure);
  $("printBtn").addEventListener("click", () => window.print());
  $("printTopBtn").addEventListener("click", () => window.print());

  buildBrochure();
});