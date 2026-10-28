/* Exportación DOCX nativa (OOXML ZIP sin librerías externas). */
(function(w,d){"use strict";
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const q=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
function first(row,names){for(const name of names)if(row&&row[name]!=null&&String(row[name]).trim())return String(row[name]).trim();return "No registrado";}
function dmy(v){const x=String(v||"").slice(0,10).split("-");return x.length===3?x[2]+"/"+x[1]+"/"+x[0]:"No registrada";}
function title(mode){return mode==="TRABAJO_TITULACION"?"ACTA DE TITULACIÓN POR TRABAJO DE TITULACIÓN":"ACTA DE TITULACIÓN POR EXAMEN COMPLEXIVO";}
function label(mode){return mode==="TRABAJO_TITULACION"?"Trabajo de Titulación":"Examen Complexivo";}
function para(s,opts){opts=opts||{};const size=Number(opts.size||20),jc=opts.align||"left";
const props='<w:pPr><w:jc w:val="'+jc+'"/><w:spacing w:before="'+(opts.before||0)+'" w:after="'+(opts.after===undefined?90:opts.after)+'"/>'+(opts.keep?'<w:keepNext/>':'')+'</w:pPr>';
const rp='<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="'+size+'"/>'+(opts.bold?'<w:b/>':'')+'</w:rPr>';
const content=String(s==null?"":s).split(/\r?\n/).map((line,i)=>(i?'<w:r><w:br/></w:r>':'')+'<w:r>'+rp+'<w:t xml:space="preserve">'+q(line||" ")+'</w:t></w:r>').join('');return '<w:p>'+props+content+'</w:p>';}
function rawPara(inner){return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'+inner+'</w:p>';}
function imageTag(){return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1350000" cy="640000"/><wp:docPr id="1" name="Logotipo ITSQMET"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="Logo institucional"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1350000" cy="640000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';}
function cell(value,width,opts){opts=opts||{};const content=opts.xml?value:para(value,{size:opts.size||18,align:opts.align||"left",bold:!!opts.bold,after:0});return '<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/>'+(opts.span?'<w:gridSpan w:val="'+opts.span+'"/>':'')+'</w:tcPr>'+content+'</w:tc>';}
function table(rows,widths){const total=widths.reduce((a,b)=>a+b,0);return '<w:tbl><w:tblPr><w:tblW w:w="'+total+'" w:type="dxa"/><w:tblBorders>'+["top","left","bottom","right","insideH","insideV"].map(k=>'<w:'+k+' w:val="single" w:sz="4" w:color="454545"/>').join('')+'</w:tblBorders><w:tblCellMar><w:top w:w="75" w:type="dxa"/><w:bottom w:w="75" w:type="dxa"/><w:left w:w="75" w:type="dxa"/><w:right w:w="75" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(x=>'<w:gridCol w:w="'+x+'"/>').join('')+'</w:tblGrid>'+rows.map(row=>'<w:tr>'+row.map((value,i)=>{if(value&&typeof value==="object")return cell(value.text||value.xml,widths[i],value);return cell(value,widths[i]);}).join('')+'</w:tr>').join('')+'</w:tbl>';}
function encabezado(x,n){return table([
[{xml:rawPara(imageTag()),span:1},{text:"Unidad de Titulación y Eficiencia Terminal",align:"center"},{text:"Código:\n"+x.record.codigo+"\nVersión: 1.0",align:"center",size:16}],
[{text:"Fecha de emisión: "+dmy(x.issue),align:"center",size:16},{text:label(x.mode)+"\n"+x.periodLabel,align:"center",bold:true,size:17},{text:"Página "+n+" de 2",align:"center",size:17}]
],[2200,4200,2600]);}
function cover(x){return encabezado(x,1)+
para(" ",{after:1000})+para(title(x.mode),{size:46,align:"center",bold:true,after:260})+
para("Período académico: "+x.periodLabel,{size:22,align:"center",after:220})+
para("BORRADOR · PENDIENTE DE LEGALIZACIÓN",{size:18,align:"center",bold:true,after:2000})+
table([
[{text:"ELABORADO POR:",align:"center"},{text:"REVISADO POR:",align:"center"},{text:"APROBADO POR:",align:"center"}],
[{text:"\n\n\nNOMBRE: __________________\nCARGO: __________________",size:17},{text:"\n\n\nNOMBRE: __________________\nCARGO: __________________",size:17},{text:"\n\n\nNOMBRE: __________________\nCARGO: __________________",size:17}]
],[3000,3000,3000]);}
function body(x){
const s=x.student,nm=first(s,["Nombres","nombres","nombreCompleto","nombre","Nombre"]),ced=first(s,["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula"]),car=first(s,["NombreCarrera","nombreCarrera","carrera","Carrera"]),cod=first(s,["CodigoCarrera","codigoCarrera"]);
const allowed=x.mode==="TRABAJO_TITULACION"?["induccion","tema","entrega","defensa","cierre"]:["nucleo1","nucleo4","examen","supletorio"];
const activities=(x.schedule||[]).flatMap(g=>g.actividades||[]).filter(a=>allowed.includes(a.id)&&(a.inicio||a.fin));
let out=encabezado(x,2)+para("CONSTANCIA DEL PROCESO DE TITULACIÓN",{bold:true,size:26,align:"center",before:280,after:150});
out+=table([[{text:"Nombres completos",bold:true},nm],[{text:"Cédula",bold:true},ced],[{text:"Código de carrera",bold:true},cod],[{text:"Carrera",bold:true},car],[{text:"Modalidad",bold:true},label(x.mode)],[{text:"Período académico",bold:true},x.periodLabel]],[2500,6500]);
out+=para("1. Antecedentes",{bold:true,size:20,before:140});
out+=para("En el marco de las actividades académicas del Instituto Superior Tecnológico Quito Metropolitano, la Unidad de Titulación y Eficiencia Terminal documenta el resultado final del estudiante "+nm+", portador de la cédula de identidad "+ced+", perteneciente a la carrera "+car+". La modalidad registrada es "+label(x.mode)+", correspondiente al período "+x.periodLabel+".",{size:18});
out+=para("2. Desarrollo académico y cronograma",{bold:true,size:20,before:120});
out+=para(x.mode==="TRABAJO_TITULACION"?"El proceso comprende planificación, formulación y aprobación del tema, elaboración y revisión del trabajo académico y defensa final ante el tribunal correspondiente. Los hitos que siguen proceden del cronograma ingresado por la unidad responsable.":"El proceso comprende núcleos formativos, evaluación ordinaria y, de corresponder, la instancia supletoria. Los hitos que siguen proceden del cronograma ingresado por la unidad responsable. Las fechas no acreditan por sí solas ejecución.",{size:18});
if(activities.length)out+=table([[{text:"Actividad",bold:true,size:16},{text:"Inicio",bold:true,size:16},{text:"Fin",bold:true,size:16}],...activities.map(a=>[{text:a.nombre,size:16},{text:dmy(a.inicio),size:16},{text:dmy(a.fin),size:16}])],[5000,2000,2000]);
else out+=para("El cronograma correspondiente aún no tiene fechas ingresadas.",{size:18});
out+=para("3. Verificación de requisitos finales",{bold:true,size:20,before:120});
out+=para("Conforme a los registros consultados, el estudiante consta con estado CUMPLE en «Aprobación titulación» y estado CUMPLE en «Aprobación complexivo/proyecto». El documento refleja estos estados finales sin incorporar calificaciones numéricas.",{size:18});
out+=para("4. Constancia de resultado",{bold:true,size:20,before:120});
out+=para("De acuerdo con la aprobación final registrada para el período y modalidad identificados, se deja constancia de que el estudiante registra APROBADO su proceso de titulación. La emisión del borrador no sustituye la revisión de evidencias académicas ni la suscripción por los responsables institucionales.",{size:18});
out+=para("RESULTADO FINAL: APROBADO",{bold:true,size:24,align:"center",before:160,after:180});
out+=para("Una vez revisada y legalizada, el acta deberá incorporarse al expediente de titulación y archivarse en el repositorio documental correspondiente de la UTET.",{size:17});
return out;}
function documentXML(items){const pages=items.map(x=>cover(x)+'<w:p><w:r><w:br w:type="page"/></w:r></w:p>'+body(x));return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
'<w:document xmlns:w="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+pages.join('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')+
'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1450" w:bottom="1250" w:left="1450" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>';}
const tableCRC=(()=>{const a=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;a[n]=c>>>0;}return a;})();
function crc32(bytes){let c=0xFFFFFFFF;for(const v of bytes)c=tableCRC[(c^v)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function write16(view,at,v){view.setUint16(at,v,true);}
function write32(view,at,v){view.setUint32(at,v,true);}
function zip(files){const enc=new TextEncoder(),parts=[],central=[],created=[];let offset=0;
function push(part){parts.push(part);offset+=part.byteLength;}
for(const [filename,content] of Object.entries(files)){const name=enc.encode(filename),bytes=typeof content==="string"?enc.encode(content):content,crc=crc32(bytes),size=bytes.byteLength,at=offset;
const head=new Uint8Array(30+name.length),dv=new DataView(head.buffer);write32(dv,0,0x04034b50);write16(dv,4,20);write16(dv,6,0x0800);write16(dv,8,0);write16(dv,10,0);write16(dv,12,33);write32(dv,14,crc);write32(dv,18,size);write32(dv,22,size);write16(dv,26,name.length);head.set(name,30);push(head);push(bytes);
const cd=new Uint8Array(46+name.length),v=new DataView(cd.buffer);write32(v,0,0x02014b50);write16(v,4,20);write16(v,6,20);write16(v,8,0x0800);write16(v,10,0);write16(v,12,0);write16(v,14,33);write32(v,16,crc);write32(v,20,size);write32(v,24,size);write16(v,28,name.length);write32(v,42,at);cd.set(name,46);central.push(cd);created.push(filename);}
const cdStart=offset;for(const piece of central)push(piece);const cdSize=offset-cdStart;
const end=new Uint8Array(22),ev=new DataView(end.buffer);write32(ev,0,0x06054b50);write16(ev,8,central.length);write16(ev,10,central.length);write32(ev,12,cdSize);write32(ev,16,cdStart);push(end);
return new Blob(parts,{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});}
function components(items,logo){return {
"[Content_Types].xml":'<?xml version="1.0" encoding="UTF-8"?>'+
'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
"_rels/.rels":'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
"word/_rels/document.xml.rels":'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>',
"word/document.xml":documentXML(items),
"word/media/logo.png":logo
};}
async function build(items){const list=Array.isArray(items)?items:[items];if(!list.length)throw Error("No hay actas para exportar.");const logo=new URL("../Global/assets/branding/logo-instituto.png",w.location.href);const resp=await fetch(logo.href);if(!resp.ok)throw Error("No se pudo obtener el logotipo institucional para Word.");const bytes=new Uint8Array(await resp.arrayBuffer());if(!bytes.length)throw Error("El archivo del logotipo está vacío.");return zip(components(list,bytes));}
async function download(items){const blob=await build(items);const uri=URL.createObjectURL(blob),a=d.createElement("a");a.href=uri;a.download="Actas_UTET_"+new Date().toISOString().slice(0,10)+".docx";d.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),2000);return {ok:true,bytes:blob.size};}
w.ActasDocx=Object.freeze({build,download,documentXML});
})(window,document);