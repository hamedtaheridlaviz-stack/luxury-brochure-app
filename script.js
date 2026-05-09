let importedImageUrls = [];
let uploadedImages = [];
const $ = id => document.getElementById(id);

function value(id){ const el=$(id); return el ? el.value.trim() : ""; }
function setValue(id,val){ const el=$(id); if(el) el.value = val || ""; }
function setStatus(msg){ const el=$("status"); if(el) el.textContent = msg || ""; }
function extractUrl(input){ const m=String(input||"").match(/https?:\/\/[^\s]+/i); return m ? m[0].replace(/[)\],.]+$/g,"") : ""; }

async function importListing(){
  const url = extractUrl(value("sourceUrl"));
  if(!url){ setStatus("Please paste a valid Property Finder or Bayut URL."); return; }
  const btn=$("importBtn"); if(btn) btn.disabled=true;
  setStatus("Importing listing... please wait.");
  try{
    const response = await fetch("/api/import-listing", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url})
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.error || "Import failed");
    setValue("sourceUrl", url);
    setValue("title", data.title);
    setValue("price", data.price);
    setValue("propertyType", data.propertyType);
    setValue("location", data.location);
    setValue("beds", data.beds);
    setValue("baths", data.baths);
    setValue("area", data.area);
    setValue("description", data.description);
    setValue("features", Array.isArray(data.features) ? data.features.join("\n") : "");
    importedImageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    renderPhotoPreview();
    buildBrochure();
    const any = data.title || data.price || data.description || data.area;
    setStatus(any ? "Imported successfully." : "Imported, but no structured details were found. Try another URL or enter details manually.");
  }catch(error){
    console.error(error);
    setStatus("Import failed: " + error.message);
  }finally{
    if(btn) btn.disabled=false;
  }
}

function renderPhotoPreview(){
  const wrap=$("photoPreview"); if(!wrap) return;
  wrap.innerHTML="";
  [...importedImageUrls, ...uploadedImages].forEach(src => {
    const img=document.createElement("img"); img.src=src; wrap.appendChild(img);
  });
}

function handlePhotoUpload(event){
  uploadedImages=[];
  const files=Array.from(event.target.files||[]);
  if(!files.length){ renderPhotoPreview(); buildBrochure(); return; }
  let loaded=0;
  files.forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      uploadedImages.push(e.target.result);
      loaded++;
      if(loaded===files.length){ renderPhotoPreview(); buildBrochure(); }
    };
    reader.readAsDataURL(file);
  });
}

function buildBrochure(){
  const title=value("title") || "Property Title";
  const summary=[value("price"), value("propertyType"), value("location")].filter(Boolean).join(" - ");
  const stats=[value("beds")?`${value("beds")} Beds`:"", value("baths")?`${value("baths")} Baths`:"", value("area")].filter(Boolean).join(" | ");
  document.querySelectorAll(".outTitle").forEach(el=>el.textContent=title);
  document.querySelectorAll(".outSummary").forEach(el=>el.textContent=summary);
  const outStats=document.querySelector(".outStats"); if(outStats) outStats.textContent=stats;
  const outDescription=document.querySelector(".outDescription"); if(outDescription) outDescription.textContent=value("description");
  document.querySelectorAll(".outCompany").forEach(el=>{ el.textContent=value("company") || "Betterhomes"; });
  const outAgent=document.querySelector(".outAgent"); if(outAgent) outAgent.textContent=value("agent") || "";
  const outContact=document.querySelector(".outContact"); if(outContact) outContact.textContent=[value("phone"), value("email")].filter(Boolean).join(" | ");
  const ul=document.querySelector(".outFeatures");
  if(ul){
    ul.innerHTML="";
    value("features").split("\n").map(x=>x.trim()).filter(Boolean).slice(0,10).forEach(feature=>{
      const li=document.createElement("li"); li.textContent=feature; ul.appendChild(li);
    });
  }
  applyImages();
}

function applyImages(){
  const imgs=[...uploadedImages, ...importedImageUrls];
  [".hero",".p1",".p2",".p3",".p4"].forEach((selector,index)=>{
    const el=document.querySelector(selector); if(!el) return;
    if(imgs[index]){ el.style.backgroundImage=`url("${imgs[index]}")`; el.textContent=""; }
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  const importBtn=$("importBtn"); if(importBtn) importBtn.addEventListener("click", importListing);
  const previewBtn=$("previewBtn"); if(previewBtn) previewBtn.addEventListener("click", buildBrochure);
  const printBtn=$("printBtn"); if(printBtn) printBtn.addEventListener("click", ()=>window.print());
  const photosInput=$("photosInput"); if(photosInput) photosInput.addEventListener("change", handlePhotoUpload);
});