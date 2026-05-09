function $(id) {
  return document.getElementById(id);
}

function set(id, value) {
  const el = $(id);
  if (el) el.value = value || "";
}

let importedImageUrls = [];

async function importListing() {
  const url = $("sourceUrl").value;

  if (!url) {
    alert("Please paste a Property Finder URL");
    return;
  }

  try {
    const response = await fetch("/api/import-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    console.log(data);

    set("title", data.title);
    set("price", data.price);
    set("propertyType", data.propertyType);
    set("location", data.location);
    set("beds", data.beds);
    set("baths", data.baths);
    set("area", data.area);
    set("description", data.description);

    if ($("features")) {
      $("features").value =
        (data.features || []).join("\n");
    }

    importedImageUrls =
      data.imageUrls || [];

    alert("Imported successfully");

  } catch (error) {
    console.error(error);
    alert("Import failed");
  }
}
