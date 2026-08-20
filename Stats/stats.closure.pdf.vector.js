/* =========================================================
Nombre completo: stats.closure.pdf.vector.js
Ruta: /Stats/stats.closure.pdf.vector.js
Función:
- Generar el PDF de cierre sin depender de librerías PDF externas.
- Construir un PDF vectorial válido directamente desde los datos de Stats.
- Incluir resumen ejecutivo, causas, requisitos, carreras, aprobación final y detalle.
- Validar cabecera, cierre, páginas y tamaño antes de descargar.
========================================================= */
(function(window,document){
  "use strict";

  var exporting=false;
  var lastValidation=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function pct(value,total){var d=num(total);return d>0?Math.round((num(value)*10000)/d)/100:0;}
  function slug(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^0-9A-Za-z_-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"");}
  function state(){return window.StatsApp&&typeof window.StatsApp.getState==="function"?window.StatsApp.getState()||{}:{};}
  function currentReport(){if(!window.StatsClosure||typeof window.StatsClosure.build!=="function"){return null;}try{return window.StatsClosure.build()||null;}catch(error){return null;}}
  function selectedText(id,fallback){var node=el(id);if(node&&node.options&&node.selectedIndex>=0){var value=text(node.options[node.selectedIndex].textContent);if(value){return value;}}return text(fallback);}
  function isRetired(row){var value=text(row&&(row._estadoMatricula||row.estadoMatricula||row.EstadoMatricula||"ACTIVO")).toUpperCase();return value==="RETIRADO"||!!(row&&row.retirado===true);}
  function approvalOf(row){if(row&&row._approval){return row._approval;}if(window.StatsRules&&typeof window.StatsRules.studentApproval==="function"){try{return window.StatsRules.studentApproval(row||{})||{};}catch(error){}}return {approved:false,missingRequirements:[]};}
  function nameOf(row){return text(row&&(row._nombres||row.nombres||row.Nombres||row.nombre||row.Nombre))||"Sin nombre";}
  function idOf(row){return text(row&&(row._cedula||row.cedula||row.Cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion));}
  function careerOf(row){return text(row&&(row._carrera||row.nombreCarrera||row.NombreCarrera||row.carrera||row.Carrera))||"SIN CARRERA";}

  function rowsForReport(report){
    if(!report||!report.periodId||!window.StatsCore||typeof window.StatsCore.resumen!=="function"){return [];}
    var s=state();
    try{
      var data=window.StatsCore.resumen({periodId:report.periodId,sede:text(s.sede),division:text(s.division),matricula:"",career:text(s.career),status:"",requirementKey:"",force:false})||{};
      return Array.isArray(data.rows)?data.rows:[];
    }catch(error){console.warn("[StatsClosurePDF] No se pudo reconstruir la cohorte.",error);return [];}
  }

  function requirementSummary(rows){
    var rules=window.StatsRules||{};
    var catalog=(Array.isArray(rules.BASE_REQUIREMENTS)?rules.BASE_REQUIREMENTS:[]).concat(Array.isArray(rules.REGULAR_EXTRA_REQUIREMENTS)?rules.REGULAR_EXTRA_REQUIREMENTS:[]);
    var active=(rows||[]).filter(function(row){return !isRetired(row);});
    return catalog.map(function(item){
      var out={label:item.label||item.key,total:0,cumple:0,noCumple:0,avance:0};
      active.forEach(function(row){
        var status=null;
        try{status=typeof rules.requirementStatus==="function"?rules.requirementStatus(row,item.key):null;}catch(error){}
        if(status&&status.applies===false){return;}
        out.total+=1;
        if(status&&status.cumple===true){out.cumple+=1;}else{out.noCumple+=1;}
      });
      out.avance=pct(out.cumple,out.total);
      return out;
    }).filter(function(item){return item.total>0;});
  }

  function careerSummary(rows){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      var career=careerOf(row);
      if(!map[career]){map[career]={career:career,total:0,retired:0,reached:0,notReached:0,rate:0};}
      var item=map[career];item.total+=1;
      if(isRetired(row)){item.retired+=1;item.notReached+=1;return;}
      if(approvalOf(row).approved===true){item.reached+=1;}else{item.notReached+=1;}
    });
    return Object.keys(map).map(function(key){var item=map[key];item.rate=pct(item.reached,item.total);return item;}).sort(function(a,b){return b.notReached-a.notReached||b.total-a.total||a.career.localeCompare(b.career,"es");});
  }

  function metadata(report){
    var s=state();
    return {
      period:selectedText("stats-periodo",report.periodId)||report.periodId,
      sede:selectedText("stats-sede",s.sede||"Todas")||"Todas",
      division:selectedText("stats-division",s.division||"Todas")||"Todas",
      career:selectedText("stats-carrera",s.career||"Todas")||"Todas",
      generated:new Date().toLocaleString("es-EC",{dateStyle:"short",timeStyle:"short"})
    };
  }

  function findings(report,requirements,careers){
    var list=[
      "De "+report.total+" estudiantes registrados, "+report.reached+" llegaron a la fase final con requisitos completos ("+report.arrivalRate+"%).",
      report.notReached+" estudiantes no llegaron a la fase final; "+report.retired+" corresponden a retiros."
    ];
    var cause=report.causes&&report.causes.length?report.causes[0]:null;
    var req=(requirements||[]).slice().sort(function(a,b){return b.noCumple-a.noCumple;})[0]||null;
    var career=careers&&careers.length?careers[0]:null;
    if(cause){list.push("La causa con mayor incidencia fue "+cause.label+", con "+cause.total+" estudiante"+(cause.total===1?"":"s")+".");}
    if(req){list.push("El requisito con mayor número de pendientes entre estudiantes activos fue "+req.label+", con "+req.noCumple+".");}
    if(career&&career.notReached>0){list.push("La carrera con mayor número de estudiantes que no llegaron fue "+career.career+", con "+career.notReached+".");}
    return list;
  }

  function cleanPdfText(value){
    return text(value)
      .replace(/[\u2013\u2014]/g,"-")
      .replace(/[\u2018\u2019]/g,"'")
      .replace(/[\u201c\u201d]/g,'"')
      .replace(/\u2022/g,"-")
      .replace(/\s+/g," ");
  }

  function pdfString(value){
    var s=cleanPdfText(value),out="";
    for(var i=0;i<s.length;i+=1){
      var code=s.charCodeAt(i);
      if(code===40||code===41||code===92){out+="\\"+String.fromCharCode(code);continue;}
      if(code>=32&&code<=126){out+=String.fromCharCode(code);continue;}
      if(code<=255){out+="\\"+code.toString(8).padStart(3,"0");continue;}
      out+="?";
    }
    return out;
  }

  function fmt(value){return Number(value||0).toFixed(2).replace(/\.00$/,"");}
  function rgb(color){return (color||[0,0,0]).map(function(v){return (Math.max(0,Math.min(255,Number(v)||0))/255).toFixed(3);}).join(" ");}

  function PdfBuilder(){
    this.W=595.28;
    this.H=841.89;
    this.M=34;
    this.BOTTOM=38;
    this.pages=[];
    this.page=null;
    this.y=805;
    this.newPage();
  }

  PdfBuilder.prototype.newPage=function(){this.page=[];this.pages.push(this.page);this.y=805;};
  PdfBuilder.prototype.ensure=function(height){if(this.y-height<this.BOTTOM){this.newPage();}};
  PdfBuilder.prototype.line=function(x1,y1,x2,y2,color,width){this.page.push(rgb(color||[203,213,225])+" RG "+fmt(width||0.5)+" w "+fmt(x1)+" "+fmt(y1)+" m "+fmt(x2)+" "+fmt(y2)+" l S");};
  PdfBuilder.prototype.rect=function(x,y,w,h,fill,stroke){var commands=[];if(fill){commands.push(rgb(fill)+" rg");}if(stroke){commands.push(rgb(stroke)+" RG");}commands.push(fmt(x)+" "+fmt(y)+" "+fmt(w)+" "+fmt(h)+" re "+(fill&&stroke?"B":fill?"f":"S"));this.page.push(commands.join(" "));};
  PdfBuilder.prototype.text=function(x,y,value,size,bold,color){this.page.push("BT /"+(bold?"F2":"F1")+" "+fmt(size||9)+" Tf "+rgb(color||[23,32,51])+" rg 1 0 0 1 "+fmt(x)+" "+fmt(y)+" Tm ("+pdfString(value)+") Tj ET");};
  PdfBuilder.prototype.textWidth=function(value,size,bold){var s=cleanPdfText(value),units=0;for(var i=0;i<s.length;i+=1){var ch=s[i];if(ch===" "){units+=0.28;}else if(/[A-ZÁÉÍÓÚÜÑ0-9]/.test(ch)){units+=0.58;}else if(/[.,:;!|ilI'`]/.test(ch)){units+=0.26;}else{units+=0.5;}}return units*(Number(size)||9)*(bold?1.04:1);};
  PdfBuilder.prototype.wrap=function(value,width,size,bold){
    var words=cleanPdfText(value).split(/\s+/).filter(Boolean);
    if(!words.length){return [""];}
    var lines=[],line="";
    for(var i=0;i<words.length;i+=1){
      var candidate=line?line+" "+words[i]:words[i];
      if(this.textWidth(candidate,size,bold)<=width){line=candidate;continue;}
      if(line){lines.push(line);line="";}
      if(this.textWidth(words[i],size,bold)<=width){line=words[i];continue;}
      var part="";
      for(var j=0;j<words[i].length;j+=1){
        var next=part+words[i][j];
        if(part&&this.textWidth(next,size,bold)>width){lines.push(part);part=words[i][j];}else{part=next;}
      }
      line=part;
    }
    if(line){lines.push(line);}
    return lines;
  };
  PdfBuilder.prototype.paragraph=function(value,size,leading,indent,color){
    size=size||9;leading=leading||12;indent=indent||0;
    var lines=this.wrap(value,this.W-(this.M*2)-indent,size,false);
    this.ensure(lines.length*leading+4);
    for(var i=0;i<lines.length;i+=1){this.text(this.M+indent,this.y,lines[i],size,false,color||[23,32,51]);this.y-=leading;}
    this.y-=4;
  };
  PdfBuilder.prototype.section=function(title,subtitle,forcePage){
    if(forcePage&&this.y<790){this.newPage();}
    this.ensure(subtitle?36:26);
    this.rect(this.M,this.y-12,3,17,[37,99,235],null);
    this.text(this.M+8,this.y,title,13,true,[15,23,42]);
    this.y-=17;
    if(subtitle){
      var lines=this.wrap(subtitle,this.W-this.M*2-8,7.5,false);
      for(var i=0;i<lines.length;i+=1){this.text(this.M+8,this.y,lines[i],7.5,false,[100,116,139]);this.y-=9;}
      this.y-=5;
    }else{this.y-=5;}
  };
  PdfBuilder.prototype.kpis=function(items){
    var gap=10,cols=3,col=(this.W-this.M*2-gap*2)/3,rowH=52;
    this.ensure(rowH*2+gap+8);
    for(var i=0;i<items.length;i+=1){
      var r=Math.floor(i/3),c=i%3,x=this.M+c*(col+gap),top=this.y-r*(rowH+gap),bottom=top-rowH;
      this.rect(x,bottom,col,rowH,[248,250,252],[219,227,239]);
      this.text(x+8,top-12,String(items[i][0]).toUpperCase(),6.5,true,[100,116,139]);
      this.text(x+8,top-31,items[i][1],16,true,[15,23,42]);
      this.text(x+8,top-44,items[i][2],6.5,false,[100,116,139]);
    }
    this.y-=rowH*2+gap+8;
  };
  PdfBuilder.prototype.callout=function(value){
    var lines=this.wrap(value,this.W-this.M*2-18,8.5,false),h=lines.length*11+14;
    this.ensure(h+6);
    this.rect(this.M,this.y-h,this.W-this.M*2,h,[239,246,255],[191,219,254]);
    for(var i=0;i<lines.length;i+=1){this.text(this.M+9,this.y-12-i*11,lines[i],8.5,false,[30,64,175]);}
    this.y-=h+8;
  };
  PdfBuilder.prototype.table=function(headers,rows,widths,options){
    options=options||{};
    var fs=options.fontSize||7.2,leading=options.leading||9,pad=4,headerH=18,self=this;
    function drawHeader(){
      self.ensure(headerH+4);
      var x=self.M;
      for(var i=0;i<headers.length;i+=1){
        self.rect(x,self.y-headerH,widths[i],headerH,[234,241,251],[203,213,225]);
        var lines=self.wrap(headers[i],widths[i]-pad*2,fs,true);
        for(var j=0;j<Math.min(2,lines.length);j+=1){self.text(x+pad,self.y-7-j*leading,lines[j],fs,true,[30,58,95]);}
        x+=widths[i];
      }
      self.y-=headerH;
    }
    drawHeader();
    (rows||[]).forEach(function(row){
      var wrapped=row.map(function(cell,i){return self.wrap(cell,widths[i]-pad*2,fs,false);});
      var maxLines=1;
      wrapped.forEach(function(lines){maxLines=Math.max(maxLines,lines.length);});
      var rowH=Math.max(17,maxLines*leading+6);
      if(self.y-rowH<self.BOTTOM){self.newPage();drawHeader();}
      var x=self.M;
      for(var i=0;i<row.length;i+=1){
        self.rect(x,self.y-rowH,widths[i],rowH,[255,255,255],[219,227,239]);
        for(var j=0;j<wrapped[i].length;j+=1){self.text(x+pad,self.y-8-j*leading,wrapped[i][j],fs,false,[23,32,51]);}
        x+=widths[i];
      }
      self.y-=rowH;
    });
    self.y-=10;
  };
  PdfBuilder.prototype.addFooters=function(){
    var total=this.pages.length;
    for(var p=0;p<total;p+=1){
      var page=this.pages[p];
      page.push(rgb([203,213,225])+" RG 0.5 w 34 29 m 561 29 l S");
      page.push("BT /F1 7 Tf "+rgb([100,116,139])+" rg 1 0 0 1 34 18 Tm ("+pdfString("Reporte generado automáticamente desde Stats - Requisitos")+") Tj ET");
      page.push("BT /F1 7 Tf "+rgb([100,116,139])+" rg 1 0 0 1 500 18 Tm ("+pdfString("Página "+(p+1)+" de "+total)+") Tj ET");
    }
  };

  function serializePdf(builder){
    builder.addFooters();
    var pages=builder.pages,objects=[];
    function put(number,value){objects[number]=value;}
    var pageRefs=[],contentRefs=[];
    for(var i=0;i<pages.length;i+=1){pageRefs.push(3+i*2);contentRefs.push(4+i*2);}
    var fontNormal=3+pages.length*2,fontBold=fontNormal+1;
    put(1,"<< /Type /Catalog /Pages 2 0 R >>");
    put(2,"<< /Type /Pages /Count "+pages.length+" /Kids ["+pageRefs.map(function(n){return n+" 0 R";}).join(" ")+"] >>");
    for(var p=0;p<pages.length;p+=1){
      var content=pages[p].join("\n")+"\n";
      put(pageRefs[p],"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 "+fontNormal+" 0 R /F2 "+fontBold+" 0 R >> >> /Contents "+contentRefs[p]+" 0 R >>");
      put(contentRefs[p],"<< /Length "+content.length+" >>\nstream\n"+content+"endstream");
    }
    put(fontNormal,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    put(fontBold,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    var max=fontBold,pdf="%PDF-1.4\n%PDFSTATS\n",offsets=[0];
    for(var n=1;n<=max;n+=1){offsets[n]=pdf.length;pdf+=n+" 0 obj\n"+objects[n]+"\nendobj\n";}
    var xref=pdf.length;
    pdf+="xref\n0 "+(max+1)+"\n0000000000 65535 f \n";
    for(var k=1;k<=max;k+=1){pdf+=String(offsets[k]).padStart(10,"0")+" 00000 n \n";}
    pdf+="trailer\n<< /Size "+(max+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";
    var bytes=new Uint8Array(pdf.length);
    for(var b=0;b<pdf.length;b+=1){bytes[b]=pdf.charCodeAt(b)&255;}
    return bytes;
  }

  function buildPdfBytes(report,rows,metaOverride){
    rows=Array.isArray(rows)?rows:rowsForReport(report);
    var requirements=requirementSummary(rows),careers=careerSummary(rows),meta=metaOverride||metadata(report),notes=findings(report,requirements,careers);
    var builder=new PdfBuilder();

    builder.text(builder.M,builder.y,"UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL",8,true,[37,99,235]);
    builder.y-=18;
    builder.text(builder.M,builder.y,"Reporte de cierre del período",20,true,[15,23,42]);
    builder.y-=23;
    builder.text(builder.M,builder.y,"Período: "+meta.period,8,false,[71,85,105]);
    builder.text(380,builder.y,"Fecha: "+meta.generated,8,false,[71,85,105]);
    builder.y-=15;
    builder.text(builder.M,builder.y,"Sede: "+meta.sede,8,false,[71,85,105]);
    builder.text(380,builder.y,"División: "+meta.division,8,false,[71,85,105]);
    builder.y-=15;
    builder.text(builder.M,builder.y,"Carrera: "+meta.career,8,false,[71,85,105]);
    builder.y-=12;
    builder.line(builder.M,builder.y,builder.W-builder.M,builder.y,[37,99,235],1.2);
    builder.y-=18;

    builder.section("1. Resumen ejecutivo","Cohorte completa del período: estudiantes activos y retirados.");
    builder.kpis([
      ["Registrados",report.total,"Cohorte del período"],
      ["Activos al cierre",report.active,"Sin retirados"],
      ["Retirados",report.retired,"Salieron del proceso"],
      ["Llegaron a fase final",report.reached,"Requisitos completos"],
      ["No llegaron",report.notReached,"Retirados + pendientes"],
      ["Tasa de llegada",report.arrivalRate+"%","Sobre toda la cohorte"]
    ]);
    builder.callout("De los "+report.total+" estudiantes registrados en el período, "+report.reached+" llegaron a la fase final con todos los requisitos aplicables completos, equivalente al "+report.arrivalRate+"%. Un total de "+report.notReached+" estudiantes no llegó a esta fase.");

    builder.section("2. ¿Por qué no llegaron?","Un estudiante puede presentar más de una causa; por ello los porcentajes no necesariamente suman 100%.");
    var causeRows=(report.causes||[]).map(function(item){return [item.label,item.total,item.percent+"%"];});
    if(!causeRows.length){causeRows=[["Sin causas registradas",0,"0%"]];}
    builder.table(["Causa","Estudiantes","% de quienes no llegaron"],causeRows,[300,100,127],{fontSize:7.5,leading:9});

    builder.section("3. Cumplimiento de requisitos","Cumplimiento entre estudiantes activos, según la aplicabilidad del período.",true);
    var reqRows=requirements.map(function(item){return [item.label,item.total,item.cumple,item.noCumple,item.avance+"%"];});
    if(!reqRows.length){reqRows=[["Sin requisitos aplicables",0,0,0,"0%"]];}
    builder.table(["Requisito","Aplican","Cumplen","Pendientes","Cumplimiento"],reqRows,[220,65,65,75,102],{fontSize:7.1,leading:9});

    builder.section("4. Resultados por carrera","Comparación de llegada a fase final por carrera.");
    var careerRows=careers.map(function(item){return [item.career,item.total,item.reached,item.notReached,item.retired,item.rate+"%"];});
    if(!careerRows.length){careerRows=[["Sin datos",0,0,0,0,"0%"]];}
    builder.table(["Carrera","Registrados","Llegaron","No llegaron","Retirados","% llegada"],careerRows,[200,62,62,68,60,75],{fontSize:6.7,leading:8});

    builder.section("5. Aprobación final","Resultados registrados entre quienes llegaron a la fase final.");
    var finalRows=(report.final||[]).map(function(item){return [item.label,item.total,item.cumple,item.no_cumple,item.avance+"%"];});
    if(!finalRows.length){finalRows=[["Sin campos de aprobación final",0,0,0,"0%"]];}
    builder.table(["Evaluación final","Evaluados","Aprobados","No aprobados / pendientes","Aprobación"],finalRows,[230,65,65,100,67],{fontSize:6.8,leading:8});

    builder.section("6. Principales hallazgos","Síntesis automática basada en los datos del período.");
    notes.forEach(function(item){builder.paragraph("- "+item,8.2,11,2,[23,32,51]);});

    builder.section("7. Detalle de quienes no llegaron","Listado individual de retiros y requisitos pendientes.",true);
    var detailRows=(report.detail||[]).map(function(item,index){var row=item.row||{};return [index+1,nameOf(row),idOf(row),careerOf(row),item.type==="retirado"?"Retirado":"No llegó",(item.causes||[]).join(", ")];});
    if(!detailRows.length){detailRows=[["-","Todos los estudiantes llegaron","","","","Sin pendientes"]];}
    builder.table(["#","Estudiante","Cédula","Carrera","Estado","Motivo(s)"],detailRows,[25,110,75,135,65,117],{fontSize:6.3,leading:8});

    return serializePdf(builder);
  }

  function validatePdf(bytes){
    if(!bytes||!(bytes instanceof Uint8Array)){throw new Error("No se generaron bytes PDF válidos.");}
    if(bytes.byteLength<2500){throw new Error("El PDF generado es demasiado pequeño ("+bytes.byteLength+" bytes). Se canceló la descarga.");}
    var head=String.fromCharCode.apply(null,Array.prototype.slice.call(bytes,0,5));
    if(head!=="%PDF-"){throw new Error("El archivo generado no tiene una cabecera PDF válida.");}
    var start=Math.max(0,bytes.length-1024),tail="";
    for(var i=start;i<bytes.length;i+=1){tail+=String.fromCharCode(bytes[i]);}
    if(tail.indexOf("%%EOF")===-1){throw new Error("El PDF quedó incompleto: no se encontró el cierre del documento.");}
    var raw="";for(var j=0;j<Math.min(bytes.length,20000);j+=1){raw+=String.fromCharCode(bytes[j]);}
    var pageMatches=raw.match(/\/Type \/Page\b/g)||[];
    if(pageMatches.length<1){throw new Error("El PDF no contiene páginas.");}
    lastValidation={ok:true,bytes:bytes.byteLength,pages:pageMatches.length,at:new Date().toISOString()};
    return lastValidation;
  }

  function filename(report){var s=state(),base="Reporte_Cierre_"+slug(report.periodId||"periodo");if(text(s.sede)){base+="_"+slug(s.sede);}if(text(s.division)){base+="_"+slug(s.division);}if(text(s.career)){base+="_"+slug(s.career);}return base+".pdf";}

  function saveBytes(bytes,name){
    validatePdf(bytes);
    var blob=new Blob([bytes],{type:"application/pdf"});
    if(blob.size!==bytes.byteLength){throw new Error("El archivo PDF no conserva el tamaño de los bytes validados.");}
    var url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download=name;anchor.type="application/pdf";anchor.style.display="none";
    document.body.appendChild(anchor);anchor.click();
    window.setTimeout(function(){try{URL.revokeObjectURL(url);}catch(error){}try{anchor.remove();}catch(error){}},5000);
  }

  function syncButton(){var button=el("stats-closure-pdf");if(!button){return;}var report=currentReport();button.disabled=exporting||!report||report.requiresPeriod===true||!text(report.periodId);button.textContent="PDF";}

  function download(){
    if(exporting){return;}
    var report=currentReport(),button=el("stats-closure-pdf");
    if(!report||report.requiresPeriod===true||!text(report.periodId)){window.alert("Selecciona un período para generar el PDF.");syncButton();return;}
    exporting=true;if(button){button.disabled=true;button.textContent="...";}
    try{
      var bytes=buildPdfBytes(report);
      saveBytes(bytes,filename(report));
    }catch(error){
      lastValidation={ok:false,error:error.message||String(error),at:new Date().toISOString()};
      console.error("[StatsClosurePDF]",error);
      window.alert("No se pudo generar el PDF: "+(error.message||String(error)));
    }finally{exporting=false;syncButton();}
  }

  function replaceButton(){var old=el("stats-closure-pdf");if(!old||!old.parentNode){return null;}var fresh=old.cloneNode(true);old.parentNode.replaceChild(fresh,old);fresh.addEventListener("click",download);return fresh;}
  function bind(){replaceButton();["stats-periodo","stats-sede","stats-division","stats-carrera"].forEach(function(id){var node=el(id);if(node){node.addEventListener("change",function(){window.setTimeout(syncButton,0);});}});["stats:bootstrap-ready","stats:cache-invalidated","bdlocal:conexiones-cache-updated","requisitos:bdlocal-cambio-disponible"].forEach(function(name){window.addEventListener(name,function(){window.setTimeout(syncButton,0);});});syncButton();}

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}
  window.StatsClosurePDFVector={version:"2.0.0-native-pdf",download:download,syncButton:syncButton,buildPdfBytes:buildPdfBytes,validatePdf:validatePdf,getLastValidation:function(){return lastValidation;}};
})(window,document);
