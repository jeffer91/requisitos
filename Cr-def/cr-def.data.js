/* =========================================================
Nombre completo: cr-def.data.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.data.js
Función o funciones:
- Leer exclusivamente desde ConCrDef.
- Cargar períodos y estudiantes con requisitos y notas hidratadas.
- Construir estudiantes aptos para defensa usando reglas Cr-def.
- Calcular una firma de datos sin abrir IndexedDB directamente.
Con qué se conecta:
- ../BDLocal/conexiones/cone.crdef.js
- cr-def.rules.js
- cr-def.cache.js
========================================================= */
(function(window){
  "use strict";

  var rules=window.CR_DEF_RULES||{};

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){
    return text(value).toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"_")
      .replace(/^_+|_+$/g,"");
  }
  function clone(value){
    if(value===undefined){return undefined;}
    try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}
  }
  function connector(){return window.ConCrDef||window.BDLocalConeCrDef||null;}

  function readFirst(row,keys){
    row=row||{};
    keys=Array.isArray(keys)?keys:[];
    var rawKeys=Object.keys(row);
    var normalized=rawKeys.map(function(key){return {key:key,norm:norm(key)};});
    for(var i=0;i<keys.length;i+=1){
      var wanted=norm(keys[i]);
      var exact=normalized.find(function(item){return item.norm===wanted;});
      if(exact&&text(row[exact.key])!==""){return row[exact.key];}
    }
    for(var j=0;j<keys.length;j+=1){
      var partial=norm(keys[j]);
      var found=normalized.find(function(item){return item.norm.indexOf(partial)!==-1;});
      if(found&&text(row[found.key])!==""){return row[found.key];}
    }
    return "";
  }

  function cedulaOf(row){
    var value=readFirst(row,["cedula","numeroIdentificacion","NumeroIdentificacion","identificacion","Identificación","documento"]);
    var utils=window.BL2Config&&window.BL2Config.utils;
    if(utils&&typeof utils.normalizeCedula==="function"){return utils.normalizeCedula(value);}
    var raw=text(value).replace(/[^\dA-Za-z]/g,"");
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }

  function periodoIdOf(row){return text(readFirst(row,["periodoId","periodId","ultimoPeriodoId","periodo"]));}
  function idEstudiantePeriodoOf(row){return text(readFirst(row,["idEstudiantePeriodo","studentId","id","matriculaId"]));}
  function nombreOf(row){return text(readFirst(row,["nombreCompleto","Nombres","nombres","Nombre","nombre","Estudiante","estudiante"]));}
  function carreraOf(row){return text(readFirst(row,["carrera","NombreCarrera","nombreCarrera","Carrera"]));}
  function sedeOf(row){
    var sede=text(readFirst(row,["Sede","sede","Campus","campus"]));
    var key=norm(sede);
    if(key==="matriz"){return "Matriz";}
    if(key==="sur"){return "Sur";}
    if(key==="virtual"||key==="online"){return "Virtual";}
    return sede;
  }
  function updatedAtOf(row){return text(readFirst(row,["updatedAt","actualizadoEn","fechaActualizacion","createdAt"]));}
  function makeKey(periodoId,cedula){return text(periodoId)+"__"+text(cedula);}

  function groupByPeriodoCedula(rows){
    var map=Object.create(null);
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      var cedula=cedulaOf(row);
      var periodoId=periodoIdOf(row);
      if(!cedula||!periodoId){return;}
      var key=makeKey(periodoId,cedula);
      if(!map[key]){map[key]=[];}
      map[key].push(row);
    });
    return map;
  }

  function putRequirement(record,row){
    var label=text(readFirst(row,["requisito","nombreRequisito","requisitoNombre","requisitoKey","campo","field","nombre"]));
    var estado=text(readFirst(row,["estado","estadoKey","valor","value","cumple","aprobado","resultado"]));
    if(!label||!estado){return;}
    record[label]=estado;
    var key=norm(label);
    if(key.indexOf("academ")!==-1){record["Académico"]=estado;record.Academico=estado;}
    if(key.indexOf("document")!==-1){record["Documentación"]=estado;record.Documentacion=estado;}
    if(key.indexOf("financier")!==-1||key.indexOf("pago")!==-1){record.Financiero=estado;}
    if(key.indexOf("practic")!==-1){record["Prácticas"]=estado;record["PrácticasVinculacion"]=estado;}
    if(key.indexOf("vincul")!==-1){record["Vinculación"]=estado;record.Vinculacion=estado;}
    if(key.indexOf("seguimiento")!==-1){record["Seguimiento graduados"]=estado;record.SeguimientoGraduados=estado;}
    if(key.indexOf("ingles")!==-1){record["Inglés"]=estado;record.Ingles=estado;}
    if(key.indexOf("actualizacion")!==-1&&key.indexOf("dato")!==-1){record["Actualización de datos"]=estado;record["ActualizaciónDatos"]=estado;}
  }

  function noteNumber(row,aliases){
    var value=readFirst(row||{},aliases);
    if(value===""||value==null){return null;}
    if(rules.helpers&&typeof rules.helpers.toNumber==="function"){return rules.helpers.toNumber(value);}
    var match=String(value).replace(",",".").match(/-?\d+(\.\d+)?/);
    var parsed=match?Number(match[0]):NaN;
    return isFinite(parsed)?parsed:null;
  }

  function putNotes(record,rows){
    (Array.isArray(rows)?rows:[]).filter(Boolean).forEach(function(row){
      Object.keys(row||{}).forEach(function(key){
        if(record[key]==null||record[key]===""){record[key]=row[key];}
      });
      var articulo=noteNumber(row,["Notart","Nart","notart","notaArticulo","nota_articulo","nota artículo","articulo","artículo"]);
      var defensa=noteNumber(row,["Notdef","Ndef","notdef","notaDefensa","nota_defensa","nota defensa","defensa","nota de defensa"]);
      var final=noteNumber(row,["Notafinal","Nfinal","notafinal","notaFinal","nota final"]);
      if(articulo!=null){record["nota articulo"]=articulo;record.notaArticulo=articulo;record.Notart=articulo;}
      if(defensa!=null){record["nota defensa"]=defensa;record.notaDefensa=defensa;record.Notdef=defensa;}
      if(final!=null){record.notaFinal=final;record.Notafinal=final;}
    });
  }

  function buildFirma(periodoId,students,requirements){
    students=Array.isArray(students)?students:[];
    requirements=Array.isArray(requirements)?requirements:[];
    var all=students.concat(requirements);
    var maxUpdatedAt=all.reduce(function(max,row){
      var value=updatedAtOf(row);
      return value>max?value:max;
    },"");
    var totalNotas=students.filter(function(row){
      return noteNumber(row,["Notart","Nart","notart","notaArticulo"])!=null||
        noteNumber(row,["Notdef","Ndef","notdef","notaDefensa"])!=null;
    }).length;
    var raw=[periodoId,students.length,requirements.length,totalNotas,maxUpdatedAt].join("|");
    var hash=0;
    for(var i=0;i<raw.length;i+=1){hash=((hash<<5)-hash)+raw.charCodeAt(i);hash|=0;}
    return {
      periodoId:periodoId,hash:String(hash)+"::"+raw.length,maxUpdatedAt:maxUpdatedAt,
      totalMatriculas:students.length,totalEstudiantes:students.length,
      totalRequisitos:requirements.length,totalNotas:totalNotas,calculatedAt:new Date().toISOString(),
      source:"ConCrDef"
    };
  }

  function ensureConnector(){
    var current=connector();
    if(!current){return Promise.reject(new Error("ConCrDef no está cargado."));}
    return typeof current.ready==="function"
      ?current.ready().then(function(result){
          if(result&&result.ok===false){throw new Error(result.error||"ConCrDef no está listo.");}
          return current;
        })
      :Promise.resolve(current);
  }

  function listarPeriodos(){
    return ensureConnector().then(function(current){
      if(typeof current.listPeriods==="function"){return current.listPeriods();}
      if(typeof current.getPeriods==="function"){return current.getPeriods();}
      return [];
    }).then(function(rows){
      var seen=Object.create(null);
      return (Array.isArray(rows)?rows:[]).map(function(row){
        return {id:text(row&& (row.id||row.periodoId||row.value||row.key)),label:text(row&&(row.label||row.periodoLabel||row.nombre||row.id||row.periodoId))};
      }).filter(function(row){
        if(!row.id||seen[row.id]){return false;}
        seen[row.id]=true;
        if(!row.label){row.label=row.id;}
        return true;
      });
    });
  }

  function readPeriod(periodoId){
    return ensureConnector().then(function(current){
      if(typeof current.read!=="function"){throw new Error("ConCrDef.read no está disponible.");}
      return current.read({periodoId:periodoId,periodId:periodoId,matricula:""});
    }).then(function(response){
      if(!response||response.ok===false){throw new Error(response&&response.error||"ConCrDef no entregó datos.");}
      var data=response.data||{};
      return {
        students:Array.isArray(data.students)?data.students:[],
        requirements:Array.isArray(data.requirements)?data.requirements:[]
      };
    });
  }

  function cargarAptos(periodoId){
    periodoId=text(periodoId);
    if(!periodoId){return Promise.resolve({rows:[],firma:null,resumen:{aptos:0,bloqueados:0}});}
    return readPeriod(periodoId).then(function(data){
      var students=data.students;
      var requirements=data.requirements;
      var requirementsByKey=groupByPeriodoCedula(requirements);
      var rows=[];
      var bloqueados=0;
      var defensaAprobada=0;

      students.forEach(function(baseRow){
        var cedula=cedulaOf(baseRow);
        if(!cedula){return;}
        var rowPeriod=periodoIdOf(baseRow)||periodoId;
        if(rowPeriod&&rowPeriod!==periodoId){return;}
        var key=makeKey(periodoId,cedula);
        var record=Object.assign({},clone(baseRow));
        record.cedula=cedula;
        record.periodoId=periodoId;
        record.nombre=nombreOf(baseRow);
        record.carrera=carreraOf(baseRow);
        record.sede=sedeOf(baseRow);

        var embedded=(Array.isArray(baseRow.requisitos)?baseRow.requisitos:[]).concat(Array.isArray(baseRow.requirements)?baseRow.requirements:[]);
        embedded.concat(requirementsByKey[key]||[]).forEach(function(req){putRequirement(record,req);});
        putNotes(record,[baseRow,baseRow._bdlNotas]);

        var evaluacion=rules&&typeof rules.evaluarAptitud==="function"
          ?rules.evaluarAptitud(record)
          :{apto:false,estadoClave:"bloqueado",estado:"No apto",alertas:["Reglas Cr-def no disponibles."]};

        if(evaluacion.estadoClave==="defensa-aprobada"){defensaAprobada+=1;return;}
        if(!evaluacion.apto){bloqueados+=1;return;}

        rows.push({
          id:idEstudiantePeriodoOf(baseRow)||key,periodoId:periodoId,
          aula:"",dia:"",hora:"",sede:record.sede,cedula:cedula,
          nombre:record.nombre,carrera:record.carrera,
          notaArticulo:evaluacion.notaArticulo==null?"":evaluacion.notaArticulo,
          notaDefensa:evaluacion.notaDefensa,tribunal1:"",tribunal2:"",tribunal3:"",
          estadoClave:evaluacion.estadoClave,estado:evaluacion.estado,
          alertas:evaluacion.alertas||[],raw:record
        });
      });

      rows.sort(function(a,b){return [a.carrera,a.sede,a.nombre].join("|").localeCompare([b.carrera,b.sede,b.nombre].join("|"),"es");});
      return {
        rows:rows,
        firma:buildFirma(periodoId,students,requirements),
        resumen:{
          aptos:rows.filter(function(row){return row.estadoClave==="apto";}).length,
          supletorios:rows.filter(function(row){return row.estadoClave==="supletorio";}).length,
          bloqueados:bloqueados,defensaAprobada:defensaAprobada,totalBase:students.length
        }
      };
    });
  }

  function calcularFirma(periodoId){
    periodoId=text(periodoId);
    return readPeriod(periodoId).then(function(data){return buildFirma(periodoId,data.students,data.requirements);});
  }

  window.CR_DEF_DATA=Object.freeze({
    dbAvailable:function(){return !!connector();},
    connectionAvailable:function(){return !!connector();},
    listarPeriodos:listarPeriodos,cargarAptos:cargarAptos,calcularFirma:calcularFirma,
    helpers:Object.freeze({text:text,norm:norm,cedulaOf:cedulaOf,readFirst:readFirst})
  });
})(window);