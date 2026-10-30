/* Logo institucional en IndexedDB, configurable por usuario; fallback a imagen del repositorio. */
(function(w,d){"use strict";
const DB="RequisitosActasConfig",STORE="archivos",KEY="logoInstitucional";
const fallback=new URL("../Global/assets/branding/logo-instituto.png",d.baseURI).href;
let current=null;
function openDB(){return new Promise((resolve,reject)=>{if(!w.indexedDB)return reject(Error("IndexedDB no está disponible."));const req=w.indexedDB.open(DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error("No se abrió la base de logos."));});}
async function query(mode,work){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tr=db.transaction(STORE,mode),req=work(tr.objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error("Error al consultar el logo."));tr.onerror=()=>reject(tr.error||Error("Error al guardar el logo."));});}finally{db.close();}}
function fileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(Error("No se pudo leer la imagen."));reader.readAsDataURL(file);});}
function inspect(dataUrl){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(!img.naturalWidth||!img.naturalHeight)return reject(Error("Imagen vacía."));resolve({dataUrl,width:img.naturalWidth,height:img.naturalHeight,format:dataUrl.startsWith("data:image/jpeg")?"JPEG":"PNG"});};img.onerror=()=>reject(Error("La imagen no es válida."));img.src=dataUrl;});}
async function save(file){if(!file||!["image/png","image/jpeg"].includes(file.type))throw Error("Selecciona un archivo PNG o JPG.");if(file.size>4*1024*1024)throw Error("El logo no debe superar 4 MB.");const logo=await inspect(await fileData(file));await query("readwrite",store=>store.put(logo,KEY));current=logo;return logo;}
async function get(){if(current)return current;try{const saved=await query("readonly",store=>store.get(KEY));if(saved&&saved.dataUrl){current=saved;return saved;}}catch(e){/* Fallback por defecto si no hay configuración. */}return null;}
async function clear(){await query("readwrite",store=>store.delete(KEY));current=null;}
function imageUrl(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const canvas=d.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext("2d");if(!ctx)return reject(Error("Canvas no disponible."));ctx.drawImage(img,0,0);resolve({dataUrl:canvas.toDataURL("image/png"),width:img.naturalWidth,height:img.naturalHeight,format:"PNG"});};img.onerror=()=>reject(Error("No se pudo abrir el logo predeterminado."));img.src=src;});}
async function resolve(){const saved=await get();if(saved)return saved;try{return await imageUrl(fallback);}catch(e){return null;}}
w.ActasBrand=Object.freeze({save,get,clear,resolve,inspect,fallback});
})(window,document);
