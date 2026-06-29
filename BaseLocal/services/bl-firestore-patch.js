/* =========================================================
Nombre completo: bl-firestore-patch.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-firestore-patch.js
Función o funciones:
- Preparar correcciones controladas para Firestore.
- Actualizar campos permitidos de matrícula, cédula, período, divisiones, notas de defensa y sincronización.
- Evitar sobrescribir datos académicos, correos, carrera, sede o requisitos salvo en limpieza controlada.
Con qué se conecta:
- bl-campos.js
- bl-matricula.service.js
- bl-divisiones.service.js
- baselocal.firebase.js
- bl-limpiar-base.service.js
========================================================= */
(function(window){
  "use strict";

  var COLLECTION = "Estudiantes";
  var NOTE_FIELDS = ["Notart", "Notdef", "Notafinal"];
  var ALLOWED = ["cedula","numeroIdentificacion","estadoMatricula","retiradoEn","historialEstadoMatricula","periodoId","ultimoPeriodoId","periodoLabel","divisiones","division","divisionActualizadaEn","Notart","Notdef","Notafinal","updatedAt","ultimaSincronizacion","ultimaEdicionLocal"];

  function text(value){if(window.BLCampos){return window.BLCampos.text(value);}return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function cedulaFromDocId(value){var raw = text(value);var match = raw.match(/^(\d{7,13})(?:\D|$)/);return match ? match[1] : "";}

  function cedulaOf(student){
    if(window.BLMatriculaService && typeof window.BLMatriculaService.getCedula === "function"){
      var ced = window.BLMatriculaService.getCedula(student);
      if(text(ced)){return text(ced);}
    }
    return text(student && (student.cedula || student.numeroIdentificacion || student.numeroidentificacion || cedulaFromDocId(student.docId || student._docId || student._firebaseId || student.id)));
  }

  function isNoteField(field){return NOTE_FIELDS.indexOf(field) >= 0;}

  function normalizeNote(value){
    if(value === undefined){return undefined;}
    if(value === null || text(value) === ""){return null;}
    var num = Number(text(value).replace(",", "."));
    if(!Number.isFinite(num)){return null;}
    return Math.round(num * 100) / 100;
  }

  function normalizeDivisiones(value){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.normalizeDivisiones === "function"){
      return window.BLDivisionesService.normalizeDivisiones(value);
    }
    if(Array.isArray(value)){return value.map(text).filter(Boolean);}
    var single = text(value);
    return single ? [single] : [];
  }

  function buildPatch(student, extra){
    var source = Object.assign({}, student || {}, extra || {});
    var patch = {};
    ALLOWED.forEach(function(field){
      if(isNoteField(field)){
        if(Object.prototype.hasOwnProperty.call(source, field)){patch[field] = normalizeNote(source[field]);}
        return;
      }
      if(field === "divisiones"){
        var divs = normalizeDivisiones(source.divisiones || source.division || source.Division || source.División);
        patch.divisiones = divs;
        if(divs.length){patch.division = divs[0];}
        return;
      }
      if(source[field] !== undefined && source[field] !== null && text(source[field]) !== ""){patch[field] = clone(source[field]);}
    });
    var id = cedulaOf(source);
    if(id){patch.cedula = text(patch.cedula || id);patch.numeroIdentificacion = text(patch.numeroIdentificacion || patch.cedula || id);}
    patch.updatedAt = now();
    patch.ultimaSincronizacion = now();
    return patch;
  }

  async function patchOne(db, student, extra){
    if(!db || typeof db.collection !== "function"){throw new Error("Firestore no disponible para corrección controlada.");}
    var id = cedulaOf(student || extra || {});
    if(!id){return {ok:false, skipped:true, reason:"sin_cedula"};}
    var patch = buildPatch(student, extra);
    await db.collection(COLLECTION).doc(id).set(patch, {merge:true});
    return {ok:true, id:id, patch:patch};
  }

  async function patchMany(db, students, extraBuilder){
    var list = Array.isArray(students) ? students : [];
    var results = [];
    for(var i = 0; i < list.length; i += 1){var item = list[i];var extra = typeof extraBuilder === "function" ? extraBuilder(item, i) : null;results.push(await patchOne(db, item, extra));}
    return results;
  }

  window.BLFirestorePatch = {collection:COLLECTION,allowedFields:ALLOWED.slice(),noteFields:NOTE_FIELDS.slice(),buildPatch:buildPatch,patchOne:patchOne,patchMany:patchMany,cedulaOf:cedulaOf};
})(window);
