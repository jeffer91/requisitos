(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var T = window.BDLNormText;
  if(!B || !T){ throw new Error("BDLRepoCarreras requiere BDLRepoBase y BDLNormText."); }

  function normalizar(row){
    row = row || {};
    var codigo = T.upper(T.first(row, ["codigoCarrera", "CodigoCarrera", "CódigoCarrera", "codCarrera", "CodCarrera"]));
    var nombre = T.upper(T.first(row, ["nombreCarrera", "NombreCarrera", "carrera", "Carrera", "programa", "Programa"]));
    return {
      codigoCarrera: codigo || T.key(nombre || "SIN_CARRERA"),
      nombreCarrera: nombre || "SIN CARRERA",
      nombreCarreraKey: T.key(nombre || "SIN CARRERA"),
      modalidad: T.upper(T.first(row, ["modalidad", "Modalidad"])),
      activa: true,
      createdAt: row.createdAt || B.now(),
      updatedAt: B.now()
    };
  }

  function guardar(row){
    var carrera = normalizar(row);
    return B.put(B.stores.carreras, carrera).then(function(){ return carrera; });
  }

  function guardarDesdeEstudiantes(rows){
    var map = {};
    B.asArray(rows).forEach(function(row){
      var carrera = normalizar(row);
      map[carrera.codigoCarrera] = carrera;
    });
    return B.putAll(B.stores.carreras, Object.keys(map).map(function(k){ return map[k]; }));
  }

  function listar(){
    return B.list(B.stores.carreras, { limit: 0 });
  }

  window.BDLRepoCarreras = {
    normalizar: normalizar,
    guardar: guardar,
    guardarDesdeEstudiantes: guardarDesdeEstudiantes,
    listar: listar
  };
})(window);
