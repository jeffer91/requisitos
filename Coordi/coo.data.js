/* =========================================================
Nombre completo: coo.data.js
Ruta o ubicación: /Coordi/coo.data.js
Función o funciones:
- Leer períodos, estudiantes y requisitos exclusivamente mediante ConCoordi.
- Normalizar estudiantes y relacionar requisitos por cédula y período.
- Filtrar por período, división, carrera y búsqueda.
- Entregar catálogos listos para coo.report.js.
========================================================= */
(function(window){
  "use strict";

  var VERSION="3.0.0-concoordi-only";
  var REQUIREMENT_ALIASES={
    academico:["academico","academica","academicoestado","estadoacademico"],
    documentacion:["documentacion","documentacionacademica","documentos","requisitosdocumentales"],
    financiero:["financiero","finanzas","estadopagos","pagos","deuda"],
    titulacion:["titulacion"],
    practicasvinculacion:["practicasvinculacion","practicas","practicaspreprofesionales"],
    vinculacion:["vinculacion","vinculacionconlasociedad","vinculacionsociedad"],
    seguimientograduados:["seguimientograduados","seguimientoagraduados","graduados"],
    ingles:["ingles","segundalengua","idiomas","english"],
    actualizaciondatos:["actualizaciondatos","actualizaciondedatos","datosactualizados"],
    aprobaciontitulacion:["aprobaciontitulacion"],
    aprobacioncomplexivoproyecto:["aprobacioncomplexivoproyecto"]
  };
  var aliasToCanonical=Object.create(null);

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]+/g,"");}
  function arr(value){return Array.isArray(value)?value:[];}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function delay(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

  Object.keys(REQUIREMENT_ALIASES).forEach(function(canonical){
    aliasToCanonical[compact(canonical)]=canonical;
    REQUIREMENT_ALIASES[canonical].forEach(function(alias){aliasToCanonical[compact(alias)]=canonical;});
  });

  function connector(){return window.ConCoordi||window.BDLocalCoordi||null;}
  function waitConnector(attempt){
    attempt=Number(attempt||0);
    var con=connector();
    if(con){
      return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(status){
        if(status&&status.ok===false){throw new Error(status.error||"ConCoordi no está listo.");}
        return con;
      });
    }
    if(attempt>=50){return Promise.reject(new Error("ConCoordi no está disponible."));}
    return delay(40).then(function(){return waitConnector(attempt+1);});
  }
  function first(row,keys){
    row=row||{};
    for(var i=0;i<keys.length;i+=1){
      if(row[keys[i]]!==undefined&&row[keys[i]]!==null&&text(row[keys[i]])!==""){return row[keys[i]];}
    }
    return "";
  }
  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function samePeriod(a,b){
    a=canonicalPeriodId(a);b=canonicalPeriodId(b);
    return !b||a===b||compact(a)===compact(b);
  }
  function unique(values){
    var map=Object.create(null);
    arr(values).forEach(function(value){value=text(value);if(value){map[norm(value)]=value;}});
    return Object.keys(map).map(function(key){return map[key];});
  }
  function canonicalRequirementKey(value){
    var original=text(value);
    return aliasToCanonical[compact(original)]||original;
  }
  function readableRequirementLabel(key,fallback){
    key=canonicalRequirementKey(key);
    try{
      if(window.StatsRules&&typeof window.StatsRules.getRequirementByKey==="function"){
        var item=window.StatsRules.getRequirementByKey(key)||{};
        if(text(item.label)){return text(item.label);}
      }
    }catch(error){}
    return text(fallback||key);
  }
  function cedulaOf(row){return normalizeCedula(first(row||{},["_cedula","cedula","Cedula","cédula","numeroIdentificacion","NumeroIdentificacion","identificacion","Identificacion","_bl2Id"]));}
  function periodOf(row){return canonicalPeriodId(first(row||{},["_periodoId","periodoId","periodId","periodoCanonicoId","ultimoPeriodoId","idPeriodo","_bl2PeriodoId","periodo","Periodo"]));}
  function requirementKey(req){
    req=req||{};
    return canonicalRequirementKey(req.requisitoKey||req.requirementKey||req.key||req.campo||req.field||req.codigo||req.nombre||(typeof req.requisito==="string"?req.requisito:""));
  }
  function requirementValue(req){
    req=req||{};
    var keys=["valor","value","estado","cumple","aprobado","resultado"];
    for(var i=0;i<keys.length;i+=1){
      var value=req[keys[i]];
      if(value===undefined||value===null){continue;}
      if(value&&typeof value==="object"){value=value.id||value.value||value.label||"";}
      if(typeof value==="boolean"||typeof value==="number"||text(value)!==""){return value;}
    }
    return "";
  }
  function normalizeRequirement(input){
    var req=Object.assign({},input||{});
    var rawKey=text(req.requisitoKey||req.requirementKey||req.key||req.campo||req.field||req.codigo||req.nombre||(typeof req.requisito==="string"?req.requisito:""));
    var key=canonicalRequirementKey(rawKey);
    var value=requirementValue(req);
    req.requisitoKeyOriginal=rawKey;
    req.requisitoKey=key;
    req.requirementKey=key;
    req.requisitoLabel=readableRequirementLabel(key,req.requisitoLabel||req.label||req.titulo||req.nombre||rawKey||key);
    req.valor=value;
    req.estado=text(req.estado)!==""?req.estado:value;
    req.cedula=cedulaOf(req);
    req.numeroIdentificacion=req.numeroIdentificacion||req.cedula;
    req.periodoId=periodOf(req);
    req.periodId=req.periodoId;
    return req;
  }
  function divisionOf(row){
    row=row||{};
    var list=arr(row.divisiones||row.Divisiones||row._divisiones);
    return text(row._division||row._bl2Division||row.divisionPrincipal||row.division||row.Division||row["División"]||list[0]||"Sin división")||"Sin división";
  }
  function divisionsOf(row){
    var values=arr(row&&(row.divisiones||row.Divisiones||row._divisiones)).map(function(value){return text(value&&typeof value==="object"?(value.nombre||value.label||value.id):value);}).filter(Boolean);
    var main=divisionOf(row);
    if(main){values.unshift(main);}
    return unique(values);
  }
  function normalizeStudent(input){
    var row=Object.assign({},input||{});
    var cedula=cedulaOf(row);
    var nombres=text(first(row,["_nombres","_bl2Nombre","nombres","Nombres","nombreCompleto","nombre","Nombre","estudiante","Estudiante","alumno","Alumno"]));
    var carrera=text(first(row,["_carrera","_bl2Carrera","nombreCarrera","NombreCarrera","nombrecarrera","carrera","Carrera","programa","Programa"]))||"SIN CARRERA";
    var periodoId=periodOf(row);
    var periodo=text(first(row,["_periodo","_bl2Periodo","periodoLabel","periodoCanonicoLabel","Periodo","periodo","nombrePeriodo","NombrePeriodo","periodoId"]))||periodoId||"SIN PERÍODO";
    var division=divisionOf(row);
    var divisiones=divisionsOf(row);
    var requisitos=arr(row.requisitos).map(normalizeRequirement).filter(function(req){return !!req.requisitoKey;});
    requisitos.forEach(function(req){row[req.requisitoKey]=req.valor;});
    row._cooId=text(first(row,["idEstudiantePeriodo","studentId","detalleId","id","_id"]))||[periodoId||periodo,cedula,nombres].join("|");
    row._cedula=cedula;
    row._nombres=nombres;
    row._carrera=carrera;
    row._periodoId=periodoId||periodo;
    row._periodo=periodo;
    row._division=division;
    row._divisiones=divisiones;
    row._correoPersonal=text(first(row,["correoPersonal","CorreoPersonal","correo","Correo","email","Email"]));
    row._correoInstitucional=text(first(row,["correoInstitucional","CorreoInstitucional","correoInst","CorreoInst"]));
    row._correo=row._correoPersonal||row._correoInstitucional;
    row._celular=text(first(row,["celular","Celular","telefono","Telefono","Teléfono","whatsapp","Whatsapp"]));
    row.requisitos=requisitos;
    row._bdlRequirementsHydrated=true;
    row._bdlRequirementsCount=requisitos.length;
    row._search=norm([cedula,nombres,carrera,periodoId,periodo,division,divisiones.join(" "),row._correoPersonal,row._correoInstitucional,row._celular].join(" "));
    return row;
  }
  function hydrateStudents(students,requirements,periodId){
    var index=Object.create(null);
    arr(requirements).map(normalizeRequirement).forEach(function(req){
      if(!req.cedula||!req.requisitoKey){return;}
      if(periodId&&req.periodoId&&!samePeriod(req.periodoId,periodId)){return;}
      if(!index[req.cedula]){index[req.cedula]=[];}
      index[req.cedula].push(req);
    });
    return arr(students).map(function(input){
      var row=normalizeStudent(input);
      var map=Object.create(null);
      arr(row.requisitos).concat(index[row._cedula]||[]).forEach(function(req){
        req=normalizeRequirement(req);
        if(!req.requisitoKey){return;}
        if(row._periodoId&&req.periodoId&&!samePeriod(row._periodoId,req.periodoId)){return;}
        map[compact(req.requisitoKey)]=req;
      });
      row.requisitos=Object.keys(map).map(function(key){return map[key];});
      row.requisitos.forEach(function(req){row[req.requisitoKey]=req.valor;});
      row._bdlRequirementsCount=row.requisitos.length;
      return row;
    });
  }
  function hasDivision(row,selected){selected=text(selected);return !selected||divisionsOf(row).some(function(value){return norm(value)===norm(selected);});}
  function filterRows(students,options){
    options=options||{};
    var periodId=text(options.periodId||options.periodoId||options.periodo||"");
    var division=text(options.division||"");
    var career=text(options.career||options.carrera||"");
    var search=norm(options.search||"");
    var limit=options.limit==null?0:Number(options.limit||0);
    var rows=arr(students).filter(function(row){
      if(periodId&&!samePeriod(row._periodoId||row._periodo,periodId)){return false;}
      if(division&&!hasDivision(row,division)){return false;}
      if(career&&norm(row._carrera)!==norm(career)){return false;}
      if(search&&row._search.indexOf(search)<0){return false;}
      return true;
    }).sort(function(a,b){return (a._nombres||"").localeCompare(b._nombres||"","es")||(a._cedula||"").localeCompare(b._cedula||"","es");});
    return limit>0?rows.slice(0,limit):rows;
  }
  function listDivisions(students){var values=[];arr(students).forEach(function(row){values=values.concat(divisionsOf(row));});return unique(values).sort(function(a,b){return a.localeCompare(b,"es");});}
  function listCareers(students){return unique(arr(students).map(function(row){return row._carrera;})).sort(function(a,b){return a.localeCompare(b,"es");});}
  function listRequirements(students,connectorCatalog){
    var map=Object.create(null);
    arr(connectorCatalog).forEach(function(item){
      var key=canonicalRequirementKey(item&&typeof item==="object"?(item.key||item.requisitoKey||item.id):item);
      if(key){map[compact(key)]={key:key,label:readableRequirementLabel(key,item&&typeof item==="object"?(item.label||item.nombre):key)};}
    });
    arr(students).forEach(function(row){arr(row.requisitos).forEach(function(req){var key=requirementKey(req);if(key){map[compact(key)]={key:key,label:req.requisitoLabel||readableRequirementLabel(key,key)};}});});
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});
  }
  function rowsFromResult(result){if(Array.isArray(result)){return result;}result=result||{};return arr(result.rows||result.students||result.estudiantes);}
  function periodsFromConnector(con){
    var rows=[];
    try{
      if(typeof con.listPeriods==="function"){rows=con.listPeriods()||[];}
      else if(typeof con.periods==="function"){rows=con.periods()||[];}
      else if(typeof con.getPeriods==="function"){rows=con.getPeriods()||[];}
    }catch(error){}
    return arr(rows).map(function(item){
      if(typeof item==="string"){return {id:canonicalPeriodId(item),value:canonicalPeriodId(item),label:item};}
      item=item||{};
      var id=canonicalPeriodId(item.id||item.value||item.periodoId||item.periodId||item.label||item.periodoLabel);
      var label=text(item.label||item.periodoLabel||item.nombre||item.name||id);
      return id||label?{id:id||label,value:id||label,label:label||id}:null;
    }).filter(Boolean);
  }
  function read(options){
    options=options||{};
    var periodId=canonicalPeriodId(options.periodId||options.periodoId||options.periodo||"");
    return waitConnector(0).then(function(con){
      var refreshTask=options.refresh===true&&typeof con.refresh==="function"
        ?Promise.resolve(con.refresh({periodoId:periodId,periodId:periodId,source:"COOData.refresh",mode:"full",full:true,force:true,immediate:true}))
        :Promise.resolve(null);
      return refreshTask.then(function(){
        var periods=periodsFromConnector(con);
        if(!periodId){
          return {source:"ConCoordi",version:VERSION,periodList:periods,divisionList:[],careerList:[],requirementList:[],rows:[],total:0,diagnostics:{source:"ConCoordi",totalPeriods:periods.length,totalSnapshotStudents:0,totalFilteredStudents:0,totalRequirementsRead:0,totalRequirementsLinked:0}};
        }
        var result=typeof con.listStudents==="function"
          ?con.listStudents({periodoId:periodId,periodId:periodId,matricula:options.matricula==null?"ACTIVO":options.matricula})
          :{rows:typeof con.getStudents==="function"?con.getStudents({periodoId:periodId,matricula:options.matricula==null?"ACTIVO":options.matricula}):[]};
        var rawRows=rowsFromResult(result);
        var requirements=arr(result&&result.requirements);
        if(!requirements.length&&typeof con.getRequirements==="function"){requirements=arr(con.getRequirements({periodoId:periodId,periodId:periodId}));}
        var students=hydrateStudents(rawRows,requirements,periodId);
        var baseByPeriod=filterRows(students,{periodId:periodId});
        var baseByDivision=filterRows(students,{periodId:periodId,division:options.division||""});
        var baseByCareer=filterRows(students,{periodId:periodId,division:options.division||"",career:options.career||options.carrera||""});
        var rows=filterRows(students,options);
        var connectorCatalog=[];
        if(typeof con.listRequirements==="function"){try{connectorCatalog=arr(con.listRequirements({periodoId:periodId}));}catch(error){}}
        var linked=students.reduce(function(total,row){return total+arr(row.requisitos).length;},0);
        return {
          source:"ConCoordi",version:VERSION,periodList:periods,
          divisionList:listDivisions(baseByPeriod),careerList:listCareers(baseByDivision),
          requirementList:listRequirements(baseByCareer,connectorCatalog),rows:rows,total:rows.length,
          diagnostics:{source:"ConCoordi",generatedAt:new Date().toISOString(),filters:clone(options),totalSnapshotStudents:students.length,totalFilteredStudents:rows.length,totalRequirementsRead:requirements.length,totalRequirementsLinked:linked,totalPeriods:periods.length,totalDivisions:listDivisions(baseByPeriod).length,totalCareers:listCareers(baseByDivision).length}
        };
      });
    });
  }

  window.COOData={
    version:VERSION,read:read,getSnapshot:read,normalizeStudent:normalizeStudent,normalizeRequirement:normalizeRequirement,
    hydrateStudents:hydrateStudents,filterRows:filterRows,listDivisions:listDivisions,listCareers:listCareers,
    listRequirements:listRequirements,samePeriod:samePeriod,hasDivision:hasDivision,
    helpers:{text:text,norm:norm,compact:compact,divisionOf:divisionOf,divisionsOf:divisionsOf,canonicalRequirementKey:canonicalRequirementKey,readableRequirementLabel:readableRequirementLabel,requirementValue:requirementValue}
  };
})(window);
