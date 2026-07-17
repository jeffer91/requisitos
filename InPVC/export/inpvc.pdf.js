/* Exportación PDF real por sección y global mediante html2pdf.js. */
(function(window,document){
  "use strict";
  var U=window.InPVCUtils;
  function requireEngine(){if(typeof window.html2pdf!=="function"){throw new Error("La biblioteca PDF no está disponible.");}return window.html2pdf;}
  function filename(ctx,suffix){return U.slug("Informe_PVC_"+(ctx.metadata.periodoLabel||ctx.metadata.periodoId)+"_"+suffix)+".pdf";}
  function source(ctx,sections,title){
    var html=window.InPVCWord.build(ctx,sections,title);var style=(html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)||[])[1]||"";var body=(html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||html;
    var host=document.createElement("div");host.setAttribute("aria-hidden","true");host.style.cssText="position:fixed;left:-100000px;top:0;width:794px;background:#fff;color:#172033;z-index:-1;";host.innerHTML="<style>"+style+"</style>"+body;document.body.appendChild(host);return host;
  }
  function blob(ctx,sections,title){
    sections=Array.isArray(sections)?sections:[];var host=source(ctx,sections,title);var options={margin:[10,10,10,10],image:{type:"jpeg",quality:.98},html2canvas:{scale:1.6,useCORS:true,backgroundColor:"#ffffff",logging:false},jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},pagebreak:{mode:["css","legacy"],before:".section"}};
    var worker;try{worker=requireEngine()().set(options).from(host).outputPdf("blob");}catch(error){host.remove();return Promise.reject(error);}
    return Promise.resolve(worker).then(function(result){if(!(result instanceof Blob)){throw new Error("No se pudo construir el archivo PDF.");}return result;}).finally(function(){host.remove();});
  }
  function downloadSection(ctx,section){return blob(ctx,[section],section.title).then(function(result){var name=filename(ctx,section.folder);U.download(result,name);return {ok:true,filename:name};});}
  function downloadGlobal(ctx,sections){sections=sections&&sections.length?sections:ctx.sections;return blob(ctx,sections,"Informe final del proceso de titulación PVC").then(function(result){var name=filename(ctx,"Completo");U.download(result,name);return {ok:true,filename:name};});}
  window.InPVCPdf={blob:blob,filename:filename,downloadSection:downloadSection,downloadGlobal:downloadGlobal};
})(window,document);
