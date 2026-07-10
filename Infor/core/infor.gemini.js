/* =========================================================
Nombre completo: infor.gemini.js
Ruta o ubicación: /Requisitos/Infor/core/infor.gemini.js
Función o funciones:
- Preparar prompt académico formal para Gemini desde la carpeta definitiva /Requisitos/Infor.
- Enviar resumen del informe a Gemini usando la API key local.
- Recibir análisis general, análisis por carrera/modalidad, conclusiones y recomendaciones.
- Detener el proceso cuando Gemini falle o tarde demasiado.
Con qué se conecta:
- infor.report.js
- infor.state.js
- ../frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  var DEFAULT_MODEL = "gemini-1.5-flash";
  var DEFAULT_TIMEOUT_MS = 45000;

  function text(value){return String(value == null ? "" : value).trim();}

  function compactReport(report){
    report = report || {};
    return {
      tipo:report.kind,
      periodo:report.periodLabel,
      resumen:report.resumen,
      modalidades:report.modalidades,
      carreras:(report.carreras || []).map(function(c){return {carrera:c.carrera,resumen:c.resumen};}),
      graficos:report.charts,
      controlRegular:report.regularAnalysis ? {
        validos:report.regularAnalysis.summary && report.regularAnalysis.summary.validForReport,
        fueraDelPeriodo:report.regularAnalysis.summary && report.regularAnalysis.summary.excludedByPeriod,
        duplicados:report.regularAnalysis.summary && report.regularAnalysis.summary.duplicates
      } : null,
      secciones:(report.sections || []).map(function(s){return {id:s.id,title:s.title,type:s.type,resumen:s.resumen || null,totalRows:s.rows ? s.rows.length : null};})
    };
  }

  function buildPrompt(report){
    var data = compactReport(report);
    return [
      "Actúa como redactor académico institucional de la Unidad de Titulación y Eficiencia Terminal.",
      "Redacta contenido formal, claro y técnico para un Informe de Titulación.",
      "No inventes datos. Usa únicamente los datos estadísticos entregados.",
      "Devuelve únicamente JSON válido, sin markdown, con esta estructura exacta:",
      "{\"analisisGeneral\":\"...\",\"analisisPorModalidad\":\"...\",\"analisisPorCarrera\":\"...\",\"conclusiones\":[\"...\"],\"recomendaciones\":[\"...\"]}",
      "Datos del informe:",
      JSON.stringify(data, null, 2)
    ].join("\n");
  }

  function cleanJson(raw){
    raw = text(raw);
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    var start = raw.indexOf("{");
    var end = raw.lastIndexOf("}");
    if(start >= 0 && end > start){raw = raw.slice(start, end + 1);}
    return raw;
  }

  function parseAnalysis(raw){
    var cleaned = cleanJson(raw);
    try{return JSON.parse(cleaned);}catch(error){
      return {analisisGeneral:raw, analisisPorModalidad:"", analisisPorCarrera:"", conclusiones:[], recomendaciones:[]};
    }
  }

  function timeoutError(ms){
    return new Promise(function(resolve, reject){
      setTimeout(function(){reject(new Error("Gemini tardó demasiado en responder. Revisa internet o intenta nuevamente."));}, ms);
    });
  }

  async function generate(report, key, options){
    key = text(key);
    options = options || {};
    if(!key){throw new Error("Falta clave API de Gemini.");}
    if(!report || !report.ok){throw new Error("No hay datos suficientes para enviar a Gemini.");}
    var model = text(options.model) || DEFAULT_MODEL;
    var timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
    var body = {
      contents:[{role:"user", parts:[{text:buildPrompt(report)}]}],
      generationConfig:{temperature:0.25, topP:0.8, maxOutputTokens:1800}
    };
    var request = fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    var response = await Promise.race([request, timeoutError(timeoutMs)]);
    var payload = await response.json().catch(function(){return {};});
    if(!response.ok){
      var message = payload && payload.error && payload.error.message ? payload.error.message : "Gemini no respondió correctamente.";
      throw new Error(message);
    }
    var content = payload && payload.candidates && payload.candidates[0] && payload.candidates[0].content;
    var parts = content && Array.isArray(content.parts) ? content.parts : [];
    var raw = parts.map(function(p){return p.text || "";}).join("\n").trim();
    if(!raw){throw new Error("Gemini respondió vacío.");}
    return parseAnalysis(raw);
  }

  window.InforGemini = {generate:generate, buildPrompt:buildPrompt, parseAnalysis:parseAnalysis};
})(window);
