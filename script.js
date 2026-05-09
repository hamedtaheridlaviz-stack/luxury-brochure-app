let uploadedImages=[], importedImageUrls=[];
function $(id){return document.getElementById(id)} function val(id){return $(id).value.trim()} function set(id,v){$(id).value=v||""}
async function importListing(){
 const url=val("sourceUrl"), status=$("status"); if(!url){status.textContent="Paste a listing URL first.";return}
 status.textContent="Importing listing..."; $("importBtn").disabled=true;
 try{
  const res=await fetch("/api/import-listing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
  const data=await res.json(); if(!res.ok) throw new Error(data.error||"Import failed");
  set("title",data.title); set("price",data.price); set("propertyType",data.propertyType); set("location",data.location);
  set("beds",data.beds); set("baths",data.baths); set("area",data.area); set("description",data.description); set("features",(data.features||[]).join("\n"));
  importedImageUrls=data.imageUrls||[]; renderPhotoPreview(); buildBrochure(); status.textContent="Imported successfully.";
 }catch(e){status.textContent="Import failed: "+e.message} finally{$("importBtn").disabled=false}
}
$("photosInput").addEventListener("change",e=>{uploadedImages=[];[...e.target.files].forEach(file=>{const r=new FileReader();r.onload=ev=>{uploadedImages.push(ev.target.result);renderPhotoPreview();buildBrochure()};r.readAsDataURL(file)})});
function renderPhotoPreview(){const w=$("photoPreview");w.innerHTML="";[...importedImageUrls,...uploadedImages].forEach(src=>{const img=document.createElement("img");img.src=src;w.appendChild(img)})}
function buildBrochure(){
 const title=val("title")||"Property Title", summary=[val("price"),val("propertyType"),val("location")].filter(Boolean).join(" - ");
 document.querySelectorAll(".outTitle").forEach(x=>x.textContent=title); document.querySelectorAll(".outSummary").forEach(x=>x.textContent=summary);
 document.querySelector(".outDescription").textContent=val("description"); document.querySelectorAll(".outCompany").forEach(x=>x.textContent=val("company")||"Betterhomes");
 document.querySelector(".outAgent").textContent=val("agent"); document.querySelector(".outContact").textContent=[val("phone"),val("email")].filter(Boolean).join(" | ");
 const ul=document.querySelector(".outFeatures");ul.innerHTML=""; val("features").split("\n").filter(Boolean).slice(0,8).forEach(f=>{const li=document.createElement("li");li.textContent=f;ul.appendChild(li)});
 applyImages();
}
function applyImages(){const imgs=[...uploadedImages,...importedImageUrls];[".hero",".p1",".p2",".p3",".p4"].forEach((sel,i)=>{const el=document.querySelector(sel);if(imgs[i]){el.style.backgroundImage=`url('${imgs[i]}')`;el.textContent=""}})}