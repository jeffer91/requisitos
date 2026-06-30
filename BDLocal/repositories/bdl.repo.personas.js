(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var E = window.BDLNormEstudiante;
  if(!B || !E){ throw new Error("BDLRepoPersonas requiere BDLRepoBase y BDLNormEstudiante."); }

  function guardarPersona(row){
    var persona = row && row.numeroIdentificacion ? row : E.persona(row || {});
    persona.updatedAt = B.now();
    return B.put(B.stores.estudiantesPersona, persona).then(function(){ return persona; });
  }

  function guardarMuchos(rows){
    var map = {};
    B.asArray(rows).forEach(function(row){
      var persona = row && row.numeroIdentificacion ? row : E.persona(row || {});
      persona.updatedAt = B.now();
      map[persona.numeroIdentificacion] = persona;
    });
    return B.putAll(B.stores.estudiantesPersona, Object.keys(map).map(function(k){ return map[k]; }));
  }

  function obtener(numeroIdentificacion){
    return B.get(B.stores.estudiantesPersona, numeroIdentificacion);
  }

  function listar(){
    return B.list(B.stores.estudiantesPersona, { limit: 0 });
  }

  window.BDLRepoPersonas = {
    guardar: guardarPersona,
    guardarMuchos: guardarMuchos,
    obtener: obtener,
    listar: listar
  };
})(window);
