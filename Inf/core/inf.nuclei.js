/* Diagrama de cuatro núcleos por carrera, generado a partir del texto de 3.4.4.x. */
(function(window){
"use strict";
function careers(){
  var parent=window.InfCatalog.find("3.4.4");
  if(!parent)throw Error("No se encontró el catálogo de carreras.");
  return parent.sections.map(function(section){
    var content=window.InfRegistry.textFor(section.number);
    var names=Array.from(content.matchAll(/^\*\*Núcleo\s+([1-4])\.\s+(.+?)\*\*\s*$/gm))
      .map(function(m){return {number:Number(m[1]),name:m[2].trim()};})
      .sort(function(a,b){return a.number-b.number;});
    if(names.length!==4||names.some(function(n,i){return n.number!==i+1;}))
      throw Error("Faltan núcleos en "+section.number+" "+section.title);
    return {career:section.title,section:section.number,nuclei:names};
  });
}
window.InfNuclei=Object.freeze({careers:careers});
})(window);
