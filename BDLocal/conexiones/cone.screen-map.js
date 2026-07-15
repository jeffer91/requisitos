/* =========================================================
Nombre completo: cone.screen-map.js
Ruta o ubicación: /BDLocal/conexiones/cone.screen-map.js
Función o funciones:
- Mantener el mapa oficial uno-a-uno entre pantallas activas y conectores.
- Corregir asociaciones heredadas donde Infor usaba Stats y Cr-def usaba Defensas.
- Excluir pantallas pendientes que todavía no existen.
Con qué se conecta:
- BDLocal/conexiones/cone.registry.js
- Maqueta/maq-modulos-registry.js
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-one-screen-one-connector";
  var definitions=[
    {id:"carga",label:"Carga",global:"ConCarga",file:"cone.carga.js",pathHints:["/carga/","carga.html"],canWrite:true},
    {id:"baselocal",label:"Base Local",global:"ConBaseLocal",file:"cone.baselocal.js",pathHints:["/bdlocal/bl2.html"],canWrite:true},
    {id:"tabla",label:"Tabla",global:"ConTabla",file:"cone.tabla.js",pathHints:["/gestion/tabla/","tabla.html"]},
    {id:"ficha",label:"Ficha",global:"ConFicha",file:"cone.ficha.js",pathHints:["/ficha/","ficha.html"],canWrite:true},
    {id:"stats",label:"Estadísticas",global:"ConStats",file:"cone.stats.js",pathHints:["/stats/","stats.html"]},
    {id:"coordi",label:"Coordinación",global:"ConCoordi",file:"cone.coordi.js",pathHints:["/coordi/","coordi.html"]},
    {id:"global",label:"Global",global:"ConGlobal",file:"cone.global.js",pathHints:["/global/","global.html"]},
    {id:"reportes",label:"Reportes",global:"ConReportes",file:"cone.reportes.js",pathHints:["/reportes/","repo.html"]},
    {id:"defart",label:"Defensas",global:"ConDefart",file:"cone.defart.js",pathHints:["/defart/","defart.html"],canWrite:true},
    {id:"ncomplex",label:"Ncomplex",global:"ConNcomplex",file:"cone.ncomplex.js",pathHints:["/ncomplex/","ncomplex.html"],canWrite:true},
    {id:"cr_def",label:"Cr-def",global:"ConCrDef",file:"cone.crdef.js",pathHints:["/cr-def/","cr-def.html"]},
    {id:"infor",label:"Infor",global:"ConInfor",file:"cone.infor.js",pathHints:["/infor/","infor/frontend/titulacion.html"]}
  ];

  var tables={
    common:["periodos","personas","matriculas_periodo","requisitos_estudiante"],
    carga:["contactos_estudiante","notas_titulacion","divisiones_estudiante","importaciones"],
    baselocal:["contactos_estudiante","notas_titulacion","divisiones_estudiante","importaciones","cambios_pendientes","evaluaciones_titulacion"],
    tabla:["contactos_estudiante"],
    ficha:["contactos_estudiante","notas_titulacion","divisiones_estudiante"],
    stats:["notas_titulacion","divisiones_estudiante"],
    coordi:["contactos_estudiante","divisiones_estudiante"],
    global:["contactos_estudiante","notas_titulacion","divisiones_estudiante"],
    reportes:["contactos_estudiante","notas_titulacion","divisiones_estudiante"],
    defart:["notas_titulacion","divisiones_estudiante","cambios_pendientes"],
    ncomplex:["evaluaciones_titulacion","importaciones","cambios_pendientes"],
    cr_def:["notas_titulacion","divisiones_estudiante"],
    infor:["notas_titulacion","evaluaciones_titulacion"]
  };

  function unique(values){
    var seen=Object.create(null);
    return (values||[]).filter(function(value){
      value=String(value||"").trim();
      if(!value||seen[value]){return false;}
      seen[value]=true;
      return true;
    });
  }

  function definition(item){
    return {
      label:item.label,
      global:item.global,
      file:item.file,
      pathHints:item.pathHints.slice(),
      aliases:[item.id],
      canRead:true,
      canWrite:item.canWrite===true,
      operations:item.canWrite===true
        ?["ready","read","save","update","refresh","status","diagnose"]
        :["ready","read","refresh","status","diagnose"],
      tables:unique((tables.common||[]).concat(tables[item.id]||[])),
      description:"Conector exclusivo de la pantalla "+item.label+"."
    };
  }

  function apply(){
    var registry=window.BDLocalConeRegistry;
    if(!registry||typeof registry.register!=="function"){return false;}

    registry.register("defensas",{
      label:"Defensas legacy",
      global:"ConDefensas",
      file:"cone.defensas.js",
      pathHints:["__legacy_defensas__"],
      aliases:["defensas_legacy"],
      canRead:true,
      canWrite:true,
      operations:["ready","read","save","update","refresh","status"],
      tables:unique((tables.common||[]).concat(["notas_titulacion","divisiones_estudiante"])),
      description:"Compatibilidad interna; ninguna pantalla debe declararse como defensas."
    });

    definitions.forEach(function(item){registry.register(item.id,definition(item));});
    return true;
  }

  function status(){
    var registry=window.BDLocalConeRegistry;
    var rows=definitions.map(function(item){
      var registered=registry&&typeof registry.get==="function"?registry.get(item.id):null;
      return {
        id:item.id,
        file:item.file,
        global:item.global,
        registered:!!registered,
        loaded:!!window[item.global]
      };
    });
    return {
      ok:rows.every(function(row){return row.registered;}),
      version:VERSION,
      total:rows.length,
      registered:rows.filter(function(row){return row.registered;}).length,
      loaded:rows.filter(function(row){return row.loaded;}).length,
      missing:rows.filter(function(row){return !row.registered;}).map(function(row){return row.id;}),
      screens:rows
    };
  }

  window.BDLocalConeScreenMap={version:VERSION,definitions:definitions.slice(),apply:apply,status:status};
  apply();
})(window);