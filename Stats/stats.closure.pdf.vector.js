/* =========================================================
Nombre completo: stats.closure.pdf.vector.js
Ruta: /Stats/stats.closure.pdf.vector.js
Función:
- Generar un informe PDF institucional de cierre sin librerías PDF externas.
- Incluir portada con el logo institucional de Global/assets/branding/logo-instituto.png.
- Separar cada bloque principal para evitar contenido amontonado.
- Incorporar análisis automático y determinista en cada sección.
- Mostrar la categoría "No aprobaron artículo o defensa".
- Excluir del PDF el detalle nominal de quienes no llegaron.
========================================================= */
(function(window,document){
  "use strict";

  var exporting=false;
  var lastValidation=null;
  var LOGO_PATH="../Global/assets/branding/logo-instituto.png";

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function pct(value,total){var d=num(total);return d>0?Math.round((num(value)*10000)/d)/100:0;}
  function slug(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^0-9A-Za-z_-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"");}
  function state(){return window.StatsApp&&typeof window.StatsApp.getState==="function"?window.StatsApp.getState()||{}:{};}
  function currentReport(){if(!window.StatsClosure||typeof window.StatsClosure.build!=="function"){return null;}try{return window.StatsClosure.build()||null;}catch(error){return null;}}
  function selectedText(id,fallback){var node=el(id);if(node&&node.options&&node.selectedIndex>=0){var value=text(node.options[node.selectedIndex].textContent);if(value){return value;}}return text(fallback);}
  function isRetired(row){var value=text(row&&(row._estadoMatricula||row.estadoMatricula||row.EstadoMatricula||"ACTIVO")).toUpperCase();return value==="RETIRADO"||!!(row&&row.retirado===true);}
  function careerOf(row){return text(row&&(row._carrera||row.nombreCarrera||row.NombreCarrera||row.carrera||row.Carrera))||"SIN CARRERA";}

  function rules(){return window.StatsRules||{};}
  function statusOf(row,key){
    try{if(typeof rules().requirementStatus==="function"){return rules().requirementStatus(row||{},key)||null;}}catch(error){}
    return null;
  }
  function isCumpleKey(row,key){
    try{if(typeof rules().valueOf==="function"&&typeof rules().isCumple==="function"){return rules().isCumple(rules().valueOf(row||{},key))===true;}}catch(error){}
    var status=statusOf(row,key);return !!(status&&status.cumple===true);
  }
  function baseAssessment(row){
    if(window.StatsClosure&&typeof window.StatsClosure.baseAssessment==="function"){try{return window.StatsClosure.baseAssessment(row)||{complete:false,missing:[]};}catch(error){}}
    var items=Array.isArray(rules().BASE_REQUIREMENTS)?rules().BASE_REQUIREMENTS:[],missing=[];
    items.forEach(function(item){var status=statusOf(row,item.key);if(status&&status.applies===false){return;}if(!status||status.cumple!==true){missing.push(item);}});
    return {complete:missing.length===0,missing:missing};
  }
  function failedArticleDefense(row){
    if(window.StatsClosure&&typeof window.StatsClosure.failedArticleDefense==="function"){try{return window.StatsClosure.failedArticleDefense(row)===true;}catch(error){}}
    return baseAssessment(row).complete&&!isCumpleKey(row,"titulacion")&&!isCumpleKey(row,"aprobaciontitulacion")&&!isCumpleKey(row,"aprobacioncomplexivoproyecto");
  }

  function rowsForReport(report){
    if(report&&Array.isArray(report.rows)){return report.rows.slice();}
    if(!report||!report.periodId||!window.StatsCore||typeof window.StatsCore.resumen!=="function"){return [];}
    var s=state();
    try{var data=window.StatsCore.resumen({periodId:report.periodId,sede:text(s.sede),division:text(s.division),matricula:"",career:text(s.career),status:"",requirementKey:"",force:false})||{};return Array.isArray(data.rows)?data.rows:[];}catch(error){console.warn("[StatsClosurePDF] No se pudo reconstruir la cohorte.",error);return [];}
  }

  function requirementSummary(rows){
    var base=Array.isArray(rules().BASE_REQUIREMENTS)?rules().BASE_REQUIREMENTS:[];
    var catalog=base.map(function(item){return {key:item.key,label:item.label||item.key,type:"base"};});
    catalog.push({key:"titulacion",label:"Titulación",type:"outcome"});
    var active=(rows||[]).filter(function(row){return !isRetired(row);});
    return catalog.map(function(item){
      var out={key:item.key,label:item.label,total:active.length,cumple:0,noCumple:0,avance:0};
      active.forEach(function(row){
        var cumple=item.type==="outcome"?isCumpleKey(row,item.key):!!(statusOf(row,item.key)&&statusOf(row,item.key).cumple===true);
        if(cumple){out.cumple+=1;}else{out.noCumple+=1;}
      });
      out.avance=pct(out.cumple,out.total);return out;
    });
  }

  function careerSummary(rows){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      var career=careerOf(row);
      if(!map[career]){map[career]={career:career,total:0,retired:0,reached:0,notReached:0,failedFinal:0,rate:0};}
      var item=map[career];item.total+=1;
      if(isRetired(row)){item.retired+=1;item.notReached+=1;return;}
      if(baseAssessment(row).complete){item.reached+=1;if(failedArticleDefense(row)){item.failedFinal+=1;}}else{item.notReached+=1;}
    });
    return Object.keys(map).map(function(key){var item=map[key];item.rate=pct(item.reached,item.total);return item;}).sort(function(a,b){return b.notReached-a.notReached||b.failedFinal-a.failedFinal||b.total-a.total||a.career.localeCompare(b.career,"es");});
  }

  function metadata(report){var s=state();return {period:selectedText("stats-periodo",report.periodId)||report.periodId,sede:selectedText("stats-sede",s.sede||"Todas")||"Todas",division:selectedText("stats-division",s.division||"Todas")||"Todas",career:selectedText("stats-carrera",s.career||"Todas")||"Todas",generated:new Date().toLocaleString("es-EC",{dateStyle:"long",timeStyle:"short"})};}

  function topBy(list,key,asc){var copy=(list||[]).slice();copy.sort(function(a,b){var delta=num(a[key])-num(b[key]);return asc?delta:-delta;});return copy[0]||null;}
  function analysisSummary(report){
    var parts=["La cohorte registra "+report.total+" estudiantes: "+report.active+" activos al cierre y "+report.retired+" retirados.",report.reached+" estudiantes llegaron a la fase final al completar todos los requisitos previos, lo que representa el "+report.arrivalRate+"% de la cohorte."];
    if(report.notReached){parts.push(report.notReached+" estudiantes no llegaron a la fase final por retiro o por mantener requisitos previos pendientes.");}
    if(report.failedFinal){parts.push(report.failedFinal+" estudiantes sí llegaron a la fase final, pero se clasifican como 'No aprobaron artículo o defensa' porque no registran Titulación, Aprobación de titulación ni Aprobación complexivo/proyecto.");}
    return parts.join(" ");
  }
  function analysisCauses(report){
    if(!report.notReached){return "No se identificaron estudiantes que hayan quedado fuera de la fase final con el alcance seleccionado.";}
    var first=report.causes&&report.causes[0],second=report.causes&&report.causes[1];
    var sentence="Se identificaron "+report.notReached+" estudiantes que no llegaron a la fase final y "+report.incidents+" incidencias de incumplimiento o retiro.";
    if(first){sentence+=" La causa más frecuente fue "+first.label+" con "+first.total+" estudiante"+(first.total===1?"":"s")+" ("+first.percent+"% de quienes no llegaron).";}
    if(second){sentence+=" La segunda causa con mayor presencia fue "+second.label+" con "+second.total+".";}
    return sentence+" Un estudiante puede acumular más de una causa, por lo que las incidencias no equivalen necesariamente a estudiantes únicos.";
  }
  function analysisRequirements(requirements){
    if(!requirements.length){return "No existen requisitos con información suficiente para realizar el análisis.";}
    var best=topBy(requirements,"avance",false),worst=topBy(requirements,"avance",true),pending=requirements.reduce(function(sum,item){return sum+item.noCumple;},0);
    var sentence="El análisis requisito por requisito registra "+pending+" incidencias pendientes entre los estudiantes activos.";
    if(best){sentence+=" El mayor cumplimiento corresponde a "+best.label+" con "+best.avance+"% ("+best.cumple+" de "+best.total+").";}
    if(worst){sentence+=" El menor cumplimiento corresponde a "+worst.label+" con "+worst.avance+"% y "+worst.noCumple+" pendientes.";}
    return sentence;
  }
  function analysisCareers(careers){
    if(!careers.length){return "No existen carreras con datos para comparar en el alcance seleccionado.";}
    var highest=topBy(careers,"rate",false),lowest=topBy(careers,"rate",true),problem=topBy(careers,"notReached",false);
    var sentence="La comparación por carrera permite identificar diferencias en la llegada a fase final.";
    if(highest){sentence+=" La mayor tasa de llegada corresponde a "+highest.career+" con "+highest.rate+"%.";}
    if(lowest&&highest&&lowest.career!==highest.career){sentence+=" La menor tasa corresponde a "+lowest.career+" con "+lowest.rate+"%.";}
    if(problem&&problem.notReached>0){sentence+=" La mayor cantidad absoluta de estudiantes que no llegaron se concentra en "+problem.career+" con "+problem.notReached+".";}
    return sentence;
  }
  function analysisFinal(report){
    var finals=report.final||[],sentence="La fase final se analiza de manera separada de los requisitos previos para no confundir acceso al cierre con aprobación del proceso.";
    if(report.failedFinal){sentence+=" Se identifican "+report.failedFinal+" estudiantes que cumplieron todos los requisitos previos, pero no registran ninguna de las tres evidencias finales y, por regla de cierre, se consideran como no aprobados en artículo o defensa.";}
    finals.forEach(function(item){sentence+=" "+item.label+": "+item.cumple+" de "+item.total+" con estado aprobado ("+item.avance+"%).";});
    return sentence;
  }
  function conclusions(report,requirements,careers){
    var out=["La tasa de llegada a fase final del período es "+report.arrivalRate+"% ("+report.reached+" de "+report.total+" estudiantes registrados)."];
    if(report.causes&&report.causes[0]){out.push("La principal causa asociada a no llegar a fase final es "+report.causes[0].label+" con "+report.causes[0].total+" incidencias.");}
    var worst=topBy(requirements,"avance",true);if(worst){out.push("El requisito con menor cumplimiento es "+worst.label+" con "+worst.avance+"%.");}
    var problem=topBy(careers,"notReached",false);if(problem&&problem.notReached>0){out.push("La carrera con más estudiantes que no llegaron a fase final es "+problem.career+" con "+problem.notReached+".");}
    out.push(report.failedFinal+" estudiantes llegaron a fase final pero no aprobaron artículo o defensa según la regla institucional definida para este cierre.");
    return out;
  }

  function cleanPdfText(value){return text(value).replace(/[\u2013\u2014]/g,"-").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,"-").replace(/\s+/g," ");}
  function pdfString(value){var s=cleanPdfText(value),out="";for(var i=0;i<s.length;i+=1){var code=s.charCodeAt(i);if(code===40||code===41||code===92){out+="\\"+String.fromCharCode(code);}else if(code>=32&&code<=126){out+=String.fromCharCode(code);}else if(code<=255){out+="\\"+code.toString(8).padStart(3,"0");}else{out+="?";}}return out;}
  function fmt(value){return Number(value||0).toFixed(2).replace(/\.00$/,"");}
  function rgb(color){return (color||[0,0,0]).map(function(v){return (Math.max(0,Math.min(255,Number(v)||0))/255).toFixed(3);}).join(" ");}
  function bytesToBinary(bytes){var out="",chunk=8192;for(var i=0;i<bytes.length;i+=chunk){out+=String.fromCharCode.apply(null,Array.prototype.slice.call(bytes,i,Math.min(bytes.length,i+chunk)));}return out;}
  function base64Bytes(value){var raw=window.atob(value),bytes=new Uint8Array(raw.length);for(var i=0;i<raw.length;i+=1){bytes[i]=raw.charCodeAt(i)&255;}return bytes;}

  function loadInstitutionalLogo(){
    return new Promise(function(resolve,reject){
      var image=new Image();
      image.onload=function(){
        try{
          var scale=2,canvas=document.createElement("canvas"),w=Math.max(1,image.naturalWidth||image.width),h=Math.max(1,image.naturalHeight||image.height);
          canvas.width=w*scale;canvas.height=h*scale;
          var ctx=canvas.getContext("2d");if(!ctx){throw new Error("Canvas no está disponible para preparar el logo.");}
          ctx.fillStyle="#071A33";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
          var dataUrl=canvas.toDataURL("image/jpeg",0.94),base64=dataUrl.split(",")[1];
          if(!base64){throw new Error("No se pudo convertir el logo institucional.");}
          resolve({bytes:base64Bytes(base64),width:canvas.width,height:canvas.height,name:"ImLogo"});
        }catch(error){reject(error);}
      };
      image.onerror=function(){reject(new Error("No se pudo cargar el logo institucional: "+LOGO_PATH));};
      try{image.src=new URL(LOGO_PATH,document.baseURI).href;}catch(error){reject(error);}
    });
  }

  function PdfBuilder(logo){this.W=595.28;this.H=841.89;this.M=42;this.BOTTOM=48;this.pages=[];this.page=null;this.y=790;this.logo=logo||null;this.newPage();}
  PdfBuilder.prototype.newPage=function(){this.page=[];this.pages.push(this.page);this.y=790;};
  PdfBuilder.prototype.ensure=function(height){if(this.y-height<this.BOTTOM){this.newPage();this.internalHeader();}};
  PdfBuilder.prototype.line=function(x1,y1,x2,y2,color,width){this.page.push(rgb(color||[203,213,225])+" RG "+fmt(width||0.5)+" w "+fmt(x1)+" "+fmt(y1)+" m "+fmt(x2)+" "+fmt(y2)+" l S");};
  PdfBuilder.prototype.rect=function(x,y,w,h,fill,stroke){var commands=[];if(fill){commands.push(rgb(fill)+" rg");}if(stroke){commands.push(rgb(stroke)+" RG");}commands.push(fmt(x)+" "+fmt(y)+" "+fmt(w)+" "+fmt(h)+" re "+(fill&&stroke?"B":fill?"f":"S"));this.page.push(commands.join(" "));};
  PdfBuilder.prototype.text=function(x,y,value,size,bold,color){this.page.push("BT /"+(bold?"F2":"F1")+" "+fmt(size||9)+" Tf "+rgb(color||[23,32,51])+" rg 1 0 0 1 "+fmt(x)+" "+fmt(y)+" Tm ("+pdfString(value)+") Tj ET");};
  PdfBuilder.prototype.image=function(x,y,w,h){if(!this.logo){return;}this.page.push("q "+fmt(w)+" 0 0 "+fmt(h)+" "+fmt(x)+" "+fmt(y)+" cm /ImLogo Do Q");};
  PdfBuilder.prototype.textWidth=function(value,size,bold){var s=cleanPdfText(value),units=0;for(var i=0;i<s.length;i+=1){var ch=s[i];if(ch===" "){units+=0.28;}else if(/[A-ZÁÉÍÓÚÜÑ0-9]/.test(ch)){units+=0.58;}else if(/[.,:;!|ilI'`]/.test(ch)){units+=0.26;}else{units+=0.5;}}return units*(Number(size)||9)*(bold?1.04:1);};
  PdfBuilder.prototype.wrap=function(value,width,size,bold){var words=cleanPdfText(value).split(/\s+/).filter(Boolean);if(!words.length){return [""];}var lines=[],line="";for(var i=0;i<words.length;i+=1){var candidate=line?line+" "+words[i]:words[i];if(this.textWidth(candidate,size,bold)<=width){line=candidate;continue;}if(line){lines.push(line);line="";}if(this.textWidth(words[i],size,bold)<=width){line=words[i];continue;}var part="";for(var j=0;j<words[i].length;j+=1){var next=part+words[i][j];if(part&&this.textWidth(next,size,bold)>width){lines.push(part);part=words[i][j];}else{part=next;}}line=part;}if(line){lines.push(line);}return lines;};
  PdfBuilder.prototype.paragraph=function(value,size,leading,indent,color){size=size||9;leading=leading||13;indent=indent||0;var lines=this.wrap(value,this.W-(this.M*2)-indent,size,false);this.ensure(lines.length*leading+8);for(var i=0;i<lines.length;i+=1){this.text(this.M+indent,this.y,lines[i],size,false,color||[23,32,51]);this.y-=leading;}this.y-=8;};
  PdfBuilder.prototype.internalHeader=function(){if(this.pages.length<=1){return;}this.text(this.M,808,"ITSQMET · UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL",7.5,true,[71,85,105]);this.line(this.M,798,this.W-this.M,798,[201,162,39],1.1);this.y=774;};
  PdfBuilder.prototype.section=function(title,subtitle){this.ensure(54);this.rect(this.M,this.y-14,4,20,[201,162,39],null);this.text(this.M+11,this.y,title,15,true,[7,26,51]);this.y-=21;if(subtitle){var lines=this.wrap(subtitle,this.W-this.M*2-11,8,false);for(var i=0;i<lines.length;i+=1){this.text(this.M+11,this.y,lines[i],8,false,[100,116,139]);this.y-=11;}}this.y-=12;};
  PdfBuilder.prototype.sectionPage=function(title,subtitle){this.newPage();this.internalHeader();this.section(title,subtitle);};
  PdfBuilder.prototype.kpis=function(items){var gap=12,col=(this.W-this.M*2-gap*2)/3,rowH=58;this.ensure(rowH*2+gap+18);for(var i=0;i<items.length;i+=1){var r=Math.floor(i/3),c=i%3,x=this.M+c*(col+gap),top=this.y-r*(rowH+gap),bottom=top-rowH;this.rect(x,bottom,col,rowH,[248,250,252],[219,227,239]);this.text(x+9,top-14,String(items[i][0]).toUpperCase(),6.3,true,[100,116,139]);this.text(x+9,top-35,items[i][1],17,true,[15,23,42]);this.text(x+9,top-49,items[i][2],6.5,false,[100,116,139]);}this.y-=rowH*2+gap+20;};
  PdfBuilder.prototype.callout=function(title,value,tone){var fill=tone==="warning"?[255,247,237]:[239,246,255],stroke=tone==="warning"?[253,186,116]:[191,219,254],ink=tone==="warning"?[154,52,18]:[30,64,175];var titleLines=this.wrap(title,this.W-this.M*2-20,8.5,true),bodyLines=this.wrap(value,this.W-this.M*2-20,8.5,false),h=titleLines.length*12+bodyLines.length*12+20;this.ensure(h+10);this.rect(this.M,this.y-h,this.W-this.M*2,h,fill,stroke);var yy=this.y-15;for(var i=0;i<titleLines.length;i+=1){this.text(this.M+10,yy,titleLines[i],8.5,true,ink);yy-=12;}yy-=2;for(var j=0;j<bodyLines.length;j+=1){this.text(this.M+10,yy,bodyLines[j],8.5,false,ink);yy-=12;}this.y-=h+16;};
  PdfBuilder.prototype.table=function(headers,rows,widths,options){options=options||{};var fs=options.fontSize||7.2,leading=options.leading||10,pad=5,headerH=22,self=this;function drawHeader(){self.ensure(headerH+6);var x=self.M;for(var i=0;i<headers.length;i+=1){self.rect(x,self.y-headerH,widths[i],headerH,[234,241,251],[203,213,225]);var lines=self.wrap(headers[i],widths[i]-pad*2,fs,true);for(var j=0;j<Math.min(2,lines.length);j+=1){self.text(x+pad,self.y-9-j*leading,lines[j],fs,true,[30,58,95]);}x+=widths[i];}self.y-=headerH;}drawHeader();(rows||[]).forEach(function(row){var wrapped=row.map(function(cell,i){return self.wrap(cell,widths[i]-pad*2,fs,false);}),maxLines=1;wrapped.forEach(function(lines){maxLines=Math.max(maxLines,lines.length);});var rowH=Math.max(21,maxLines*leading+8);if(self.y-rowH<self.BOTTOM){self.newPage();self.internalHeader();drawHeader();}var x=self.M;for(var i=0;i<row.length;i+=1){self.rect(x,self.y-rowH,widths[i],rowH,[255,255,255],[219,227,239]);for(var j=0;j<wrapped[i].length;j+=1){self.text(x+pad,self.y-10-j*leading,wrapped[i][j],fs,false,[23,32,51]);}x+=widths[i];}self.y-=rowH;});self.y-=20;};
  PdfBuilder.prototype.addFooters=function(){var total=Math.max(0,this.pages.length-1);for(var p=1;p<this.pages.length;p+=1){var page=this.pages[p];page.push(rgb([203,213,225])+" RG 0.5 w 42 33 m 553 33 l S");page.push("BT /F1 7 Tf "+rgb([100,116,139])+" rg 1 0 0 1 42 20 Tm ("+pdfString("Informe de cierre · Stats Requisitos")+") Tj ET");page.push("BT /F1 7 Tf "+rgb([100,116,139])+" rg 1 0 0 1 492 20 Tm ("+pdfString("Página "+p+" de "+total)+") Tj ET");}};

  function serializePdf(builder){
    builder.addFooters();
    var pages=builder.pages,objects=[];function put(number,value){objects[number]=value;}
    var pageRefs=[],contentRefs=[];for(var i=0;i<pages.length;i+=1){pageRefs.push(3+i*2);contentRefs.push(4+i*2);}
    var fontNormal=3+pages.length*2,fontBold=fontNormal+1,imageRef=builder.logo?fontBold+1:0;
    put(1,"<< /Type /Catalog /Pages 2 0 R >>");put(2,"<< /Type /Pages /Count "+pages.length+" /Kids ["+pageRefs.map(function(n){return n+" 0 R";}).join(" ")+"] >>");
    for(var p=0;p<pages.length;p+=1){var content=pages[p].join("\n")+"\n",xObject=builder.logo?" /XObject << /ImLogo "+imageRef+" 0 R >>":"";put(pageRefs[p],"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 "+fontNormal+" 0 R /F2 "+fontBold+" 0 R >>"+xObject+" >> /Contents "+contentRefs[p]+" 0 R >>");put(contentRefs[p],"<< /Length "+content.length+" >>\nstream\n"+content+"endstream");}
    put(fontNormal,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");put(fontBold,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    if(builder.logo){var binary=bytesToBinary(builder.logo.bytes);put(imageRef,"<< /Type /XObject /Subtype /Image /Width "+builder.logo.width+" /Height "+builder.logo.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+builder.logo.bytes.length+" >>\nstream\n"+binary+"\nendstream");}
    var max=builder.logo?imageRef:fontBold,pdf="%PDF-1.4\n%PDFSTATS\n",offsets=[0];for(var n=1;n<=max;n+=1){offsets[n]=pdf.length;pdf+=n+" 0 obj\n"+objects[n]+"\nendobj\n";}var xref=pdf.length;pdf+="xref\n0 "+(max+1)+"\n0000000000 65535 f \n";for(var k=1;k<=max;k+=1){pdf+=String(offsets[k]).padStart(10,"0")+" 00000 n \n";}pdf+="trailer\n<< /Size "+(max+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";var bytes=new Uint8Array(pdf.length);for(var b=0;b<pdf.length;b+=1){bytes[b]=pdf.charCodeAt(b)&255;}return bytes;
  }

  function cover(builder,meta,report){
    builder.rect(0,0,builder.W,builder.H,[248,250,252],null);
    builder.rect(0,650,builder.W,192,[7,26,51],null);
    builder.rect(110,681,375,112,[7,26,51],[201,162,39]);
    builder.image(154,697,287,78);
    builder.line(210,625,385,625,[201,162,39],4);
    builder.text(115,580,"UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL",12,true,[7,26,51]);
    builder.text(115,535,"INFORME DE CIERRE DEL PERÍODO",25,true,[7,26,51]);
    builder.text(115,498,meta.period,16,true,[37,99,235]);
    builder.text(115,454,"Sede: "+meta.sede,9,false,[71,85,105]);
    builder.text(115,432,"División: "+meta.division,9,false,[71,85,105]);
    builder.text(115,410,"Carrera: "+meta.career,9,false,[71,85,105]);
    builder.rect(115,322,365,58,[255,255,255],[219,227,239]);
    builder.text(132,356,"COHORTE ANALIZADA",7,true,[100,116,139]);
    builder.text(132,335,report.total+" estudiantes registrados",15,true,[15,23,42]);
    builder.text(115,115,"Generado: "+meta.generated,8,false,[100,116,139]);
    builder.text(115,92,"Reporte institucional generado desde Stats Requisitos",8,false,[100,116,139]);
  }

  function buildPdfBytes(report,rows,metaOverride,logo){
    rows=Array.isArray(rows)?rows:rowsForReport(report);
    var requirements=requirementSummary(rows),careers=careerSummary(rows),meta=metaOverride||metadata(report),builder=new PdfBuilder(logo||null);
    cover(builder,meta,report);

    builder.sectionPage("1. Resumen ejecutivo","Síntesis de la cohorte completa y de la llegada a la fase final.");
    builder.kpis([
      ["Registrados",report.total,"Cohorte"],["Activos al cierre",report.active,"Sin retirados"],["Retirados",report.retired,"Salieron del proceso"],
      ["Llegaron a fase final",report.reached,"Requisitos previos completos"],["No llegaron a fase final",report.notReached,"Retiro o requisitos previos"],["No aprobaron artículo/defensa",report.failedFinal||0,"Sí llegaron a fase final"]
    ]);
    builder.callout("Análisis del resumen",analysisSummary(report),(report.failedFinal||0)>0?"warning":"info");

    builder.sectionPage("2. Causas de no llegada a fase final","Las causas corresponden únicamente a retiro o requisitos previos pendientes; Titulación y aprobaciones finales se analizan después.");
    var causeRows=(report.causes||[]).map(function(item){return [item.label,item.total,item.percent+"%"];});if(!causeRows.length){causeRows=[["Sin causas registradas",0,"0%"]];}
    builder.table(["Causa","Estudiantes","% de quienes no llegaron"],causeRows,[300,100,111],{fontSize:7.8,leading:10});
    builder.callout("Análisis de causas",analysisCauses(report),"info");

    builder.sectionPage("3. Cumplimiento de requisitos","Cumplimiento de requisitos entre estudiantes activos. Titulación se muestra como resultado del cierre y no se usa para decidir quién llegó a fase final.");
    var reqRows=requirements.map(function(item){return [item.label,item.total,item.cumple,item.noCumple,item.avance+"%"];});
    builder.table(["Requisito","Aplican","Cumplen","Pendientes","Cumplimiento"],reqRows,[220,65,65,75,86],{fontSize:7.4,leading:10});
    builder.callout("Análisis de requisitos",analysisRequirements(requirements),"info");

    builder.sectionPage("4. Resultados por carrera","Comparación de la llegada a fase final y de los resultados de artículo o defensa por carrera.");
    var careerRows=careers.map(function(item){return [item.career,item.total,item.reached,item.notReached,item.failedFinal,item.rate+"%"];});if(!careerRows.length){careerRows=[["Sin datos",0,0,0,0,"0%"]];}
    builder.table(["Carrera","Registrados","Llegaron fase final","No llegaron","No aprobaron artículo/defensa","% llegada"],careerRows,[180,58,72,62,83,56],{fontSize:6.6,leading:9});
    builder.callout("Análisis por carrera",analysisCareers(careers),"info");

    builder.sectionPage("5. Aprobación final","Resultados observados únicamente entre los estudiantes que sí llegaron a la fase final.");
    var finalRows=(report.final||[]).map(function(item){return [item.label,item.total,item.cumple,item.no_cumple,item.avance+"%"];});if(!finalRows.length){finalRows=[["Sin resultados finales",report.reached,0,report.reached,"0%"]];}
    builder.table(["Resultado final","Estudiantes en fase final","Aprobados","No aprobados / sin registro","Aprobación"],finalRows,[190,90,65,105,61],{fontSize:7,leading:10});
    builder.callout("No aprobaron artículo o defensa",(report.failedFinal||0)+" estudiante"+((report.failedFinal||0)===1?"":"s")+" cumple(n) todos los requisitos previos, pero no registra(n) Titulación, Aprobación de titulación ni Aprobación complexivo/proyecto. Por la regla definida para este cierre, se considera que no aprobaron el artículo o la defensa.",(report.failedFinal||0)>0?"warning":"info");
    builder.callout("Análisis de aprobación final",analysisFinal(report),"info");

    builder.sectionPage("6. Conclusiones del período","Hallazgos principales obtenidos automáticamente a partir de la cohorte y sus requisitos.");
    conclusions(report,requirements,careers).forEach(function(item,index){builder.text(builder.M,builder.y,(index+1)+".",10,true,[37,99,235]);builder.paragraph(item,9.2,14,22,[23,32,51]);builder.y-=5;});
    builder.callout("Criterio de interpretación","El informe diferencia tres momentos: cumplimiento de requisitos previos, llegada a fase final y resultado de titulación/artículo/defensa. Esta separación evita clasificar como 'no llegó' a un estudiante que sí completó sus requisitos previos pero no aprobó el cierre académico.","info");

    return serializePdf(builder);
  }

  function validatePdf(bytes){if(!bytes||!(bytes instanceof Uint8Array)){throw new Error("No se generaron bytes PDF válidos.");}if(bytes.byteLength<5000){throw new Error("El PDF generado es demasiado pequeño ("+bytes.byteLength+" bytes). Se canceló la descarga.");}var head=String.fromCharCode.apply(null,Array.prototype.slice.call(bytes,0,5));if(head!=="%PDF-"){throw new Error("El archivo generado no tiene una cabecera PDF válida.");}var start=Math.max(0,bytes.length-1024),tail="";for(var i=start;i<bytes.length;i+=1){tail+=String.fromCharCode(bytes[i]);}if(tail.indexOf("%%EOF")===-1){throw new Error("El PDF quedó incompleto: no se encontró el cierre del documento.");}var raw="";for(var j=0;j<Math.min(bytes.length,30000);j+=1){raw+=String.fromCharCode(bytes[j]);}var pageMatches=raw.match(/\/Type \/Page\b/g)||[];if(pageMatches.length<7){throw new Error("El informe no contiene todas las páginas esperadas.");}if(raw.indexOf("Detalle de quienes no llegaron")>=0){throw new Error("El PDF contiene una sección que debía excluirse.");}lastValidation={ok:true,bytes:bytes.byteLength,pages:pageMatches.length,logo:true,at:new Date().toISOString()};return lastValidation;}
  function filename(report){var s=state(),base="Informe_Cierre_"+slug(report.periodId||"periodo");if(text(s.sede)){base+="_"+slug(s.sede);}if(text(s.division)){base+="_"+slug(s.division);}if(text(s.career)){base+="_"+slug(s.career);}return base+".pdf";}
  function saveBytes(bytes,name){validatePdf(bytes);var blob=new Blob([bytes],{type:"application/pdf"});if(blob.size!==bytes.byteLength){throw new Error("El archivo PDF no conserva el tamaño de los bytes validados.");}var url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.type="application/pdf";anchor.style.display="none";document.body.appendChild(anchor);anchor.click();window.setTimeout(function(){try{URL.revokeObjectURL(url);}catch(error){}try{anchor.remove();}catch(error){}},5000);}
  function syncButton(){var button=el("stats-closure-pdf");if(!button){return;}var report=currentReport();button.disabled=exporting||!report||report.requiresPeriod===true||!text(report.periodId);button.textContent="PDF";}
  function download(){
    if(exporting){return;}
    var report=currentReport(),button=el("stats-closure-pdf");if(!report||report.requiresPeriod===true||!text(report.periodId)){window.alert("Selecciona un período para generar el PDF.");syncButton();return;}
    exporting=true;if(button){button.disabled=true;button.textContent="...";}
    loadInstitutionalLogo().then(function(logo){var bytes=buildPdfBytes(report,null,null,logo);saveBytes(bytes,filename(report));}).catch(function(error){lastValidation={ok:false,error:error.message||String(error),at:new Date().toISOString()};console.error("[StatsClosurePDF]",error);window.alert("No se pudo generar el PDF: "+(error.message||String(error)));}).finally(function(){exporting=false;syncButton();});
  }
  function replaceButton(){var old=el("stats-closure-pdf");if(!old||!old.parentNode){return null;}var fresh=old.cloneNode(true);old.parentNode.replaceChild(fresh,old);fresh.addEventListener("click",download);return fresh;}
  function bind(){replaceButton();["stats-periodo","stats-sede","stats-division","stats-carrera"].forEach(function(id){var node=el(id);if(node){node.addEventListener("change",function(){window.setTimeout(syncButton,0);});}});["stats:bootstrap-ready","stats:cache-invalidated","bdlocal:conexiones-cache-updated","requisitos:bdlocal-cambio-disponible"].forEach(function(name){window.addEventListener(name,function(){window.setTimeout(syncButton,0);});});syncButton();}
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}

  window.StatsClosurePDFVector={version:"3.0.0-institutional-analysis",download:download,syncButton:syncButton,buildPdfBytes:buildPdfBytes,validatePdf:validatePdf,loadInstitutionalLogo:loadInstitutionalLogo,getLastValidation:function(){return lastValidation;}};
})(window,document);