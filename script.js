async function importListing() {
  const url = document.getElementById('listingUrl').value;

  if (!url) {
    alert('Please enter a Property Finder or Bayut URL');
    return;
  }

  try {
    const response = await fetch('/api/import-listing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    console.log(data);

    const listing = Array.isArray(data) ? data[0] : data;

    document.getElementById('propertyTitle').value =
      listing.title || listing.name || '';

    document.getElementById('price').value =
      listing.price || '';

    document.getElementById('type').value =
      listing.propertyType || listing.type || '';

    document.getElementById('location').value =
      listing.location || listing.address || '';

    document.getElementById('beds').value =
      listing.bedrooms || listing.beds || '';

    document.getElementById('baths').value =
      listing.bathrooms || listing.baths || '';

    document.getElementById('area').value =
      listing.area || listing.size || '';

    document.getElementById('description').value =
      listing.description || '';

    alert('Imported successfully!');
  } catch (error) {
    console.error(error);
    alert('Import failed');
  }
}
