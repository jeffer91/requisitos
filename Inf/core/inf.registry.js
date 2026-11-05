/* Registro de textos institucionales por capítulo: no altera BDLocal. */
(function (window) {
  "use strict";
  var catalog = window.InfCatalog;
  if (!catalog) { throw new Error("InfCatalog debe cargarse antes del registro."); }
  var templates = Object.create(null);
  function nodesOf(chapter) {
    var out = [];
    function visit(node) {
      out.push(node);
      (node.sections || []).forEach(visit);
    }
    visit(chapter);
    return out;
  }
  function register(number, values) {
    number = String(number);
    var chapter = catalog.chapters.find(function (item) { return item.number === number; });
    if (!chapter) { throw new Error("Capítulo no registrado en el índice: " + number); }
    if (templates[number]) { throw new Error("Capítulo duplicado: " + number); }
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new TypeError("Los textos deben registrarse por clave numérica.");
    }
    var allowed = nodesOf(chapter).map(function (item) { return item.number; });
    var body = Object.create(null);
    allowed.forEach(function (key) { body[key] = ""; });
    Object.keys(values).forEach(function (key) {
      if (allowed.indexOf(key) === -1) { throw new Error("Clave fuera del índice oficial: " + key); }
      if (typeof values[key] !== "string") { throw new TypeError("Texto no válido en: " + key); }
      body[key] = values[key];
    });
    templates[number] = Object.freeze(body);
  }
  function textFor(number) {
    var key = String(number);
    var chapterId = key.split(".")[0];
    return templates[chapterId] ? (templates[chapterId][key] || "") : "";
  }
  function missingChapters() {
    return catalog.chapters.filter(function (chapter) { return !templates[chapter.number]; })
      .map(function (chapter) { return chapter.number; });
  }
  window.InfRegistry = Object.freeze({
    register: register, textFor: textFor, missingChapters: missingChapters,
    registeredChapters: function () { return Object.keys(templates).sort(); }
  });
})(window);
