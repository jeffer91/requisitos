/* =========================================================
Nombre completo: coo.period-regular-fix.js
Ruta: /Coordi/coo.period-regular-fix.js
Función:
- Recuperar estudiantes cuando el período del selector usa ID canónico pero la matrícula quedó guardada con etiqueta legible.
- Reconocer períodos por ID (2026-04__2026-09) y por etiquetas como "Abril 2026 a Septiembre 2026".
- Evitar mezclar requisitos de la misma cédula entre períodos durante la recuperación.
- Mantener intacto el flujo normal de COOData cuando ya devuelve estudiantes.
========================================================= */
(function(window){
  "use strict";

  var api=window.COOData;
  if(!api||api.__regularPeriodRecoveryPatched||typeof api.read!=="function"){return;}

  var VERSION="1.0.0-regular-period-recovery";
  var originalRead=api.read.bind(api);
  var MONTHS={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
  function compact(value){return norm(value).replace(/[^a-z0-9]+/g,"");}
  function arr(value){return Array.isArray(value)?value:[];}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function pad2(value){value=Number(value||0);return value<10?"0"+value:String(value);}

  function periodSignature(value){
    var raw=text(value);
    if(!raw){return "";}

    var numeric=raw.match(/((?:19|20)\d{2})\D{0,6}(0?[1-9]|1[0-2])\D+((?:19|20)\d{2})\D{0,6}(0?[1-9]|1[0-2])/);
    if(numeric){return numeric[1]+"-"+pad2(numeric[2])+"__"+numeric[3]+"-"+pad2(numeric[4]);}

    var source=norm(raw);
    var tokens=[];
    var re=/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)[^0-9]{0,12}((?:19|20)\d{2})/g;
    var match;
    while((match=re.exec(source))!==null){tokens.push({month:MONTHS[match[1]],year:Number(match[2])});}
    if(tokens.length>=2){return tokens[0].year+"-"+pad2(tokens[0].month)+"__"+tokens[1].year+"-"+pad2(tokens[1].month);}

    return raw.replace(/_+/g,"__");
  }

  function periodValue(row){
    row=row||{};
    return text(
      row.periodoCanonicoId||row.periodoId||row.periodId||row.idPeriodo||row._periodoId||row._bl2PeriodoId||
      row.periodoCanonicoLabel||row.periodoLabel||row.Periodo||row.periodo||row._periodo||row._bl2Periodo||""
    );
  }

  function samePeriodValue(value,targetSignature){
    return !!targetSignature&&periodSignature(value)===targetSignature;
  }

  function rowsFromResult(result){
    if(Array.isArray(result)){return result;}
    result=result||{};
    return arr(result.rows||result.students||result.estudiantes);
  }

  function periodListFromConnector(con,fallback){
    var list=arr(fallback);
    if(list.length){return list;}
    try{
      if(con&&typeof con.listPeriods==="function"){list=arr(con.listPeriods());}
      else if(con&&typeof con.getPeriods==="function"){list=arr(con.getPeriods());}
      else if(con&&typeof con.periods==="function"){list=arr(con.periods());}
    }catch(error){}
    return list;
  }

  function periodIdOf(item){
    if(typeof item==="string"){return text(item);}
    item=item||{};
    return text(item.id||item.value||item.periodoId||item.periodId||item.key||item.label||item.periodoLabel||"");
  }

  function periodLabelOf(item){
    if(typeof item==="string"){return text(item);}
    item=item||{};
    return text(item.label||item.periodoLabel||item.nombre||item.name||item.id||item.value||"");
  }

  function resolvePeriod(periods,selected){
    var target=periodSignature(selected);
    var found=null;
    arr(periods).some(function(item){
      if(periodSignature(periodIdOf(item))===target||periodSignature(periodLabelOf(item))===target){found=item;return true;}
      return false;
    });
    return {
      id:text(found&&periodIdOf(found))||text(selected),
      label:text(found&&periodLabelOf(found))||text(selected),
      signature:target||periodSignature(found&&periodLabelOf(found))
    };
  }

  function requirementKey(req){
    req=req||{};
    return text(req.requisitoKey||req.requirementKey||req.key||req.campo||req.field||req.codigo||req.nombre||(typeof req.requisito==="string"?req.requisito:""));
  }

  function requirementPeriod(req){
    req=req||{};
    return text(req.periodoCanonicoId||req.periodoId||req.periodId||req.idPeriodo||req._periodoId||req.periodoLabel||req.periodo||req.Periodo||"");
  }

  function requirementKeyMap(requirements){
    var map=Object.create(null);
    arr(requirements).forEach(function(req){var key=requirementKey(req);if(key){map[compact(key)]=true;}});
    try{
      var rules=window.StatsRules||{};
      arr(rules.BASE_REQUIREMENTS).concat(arr(rules.REGULAR_EXTRA_REQUIREMENTS)).concat(arr(rules.FINAL_REQUIREMENTS)).forEach(function(item){
        var key=text(item&&item.key);if(key){map[compact(key)]=true;}
      });
    }catch(error){}
    return map;
  }

  function cleanStudent(input,period,knownRequirementKeys){
    var row=Object.assign({},input||{});
    Object.keys(row).forEach(function(key){
      if(knownRequirementKeys[compact(key)]){delete row[key];}
    });
    row.requisitos=[];
    row.periodoId=period.id;
    row.periodId=period.id;
    row.periodoCanonicoId=period.id;
    row._periodoId=period.id;
    row.periodoLabel=period.label;
    row.periodoCanonicoLabel=period.label;
    row.periodo=period.label;
    row.Periodo=period.label;
    row._periodo=period.label;
    return row;
  }

  function filterTargetRequirements(requirements,period){
    return arr(requirements).filter(function(req){
      var value=requirementPeriod(req);
      return value&&samePeriodValue(value,period.signature);
    }).map(function(req){
      var copy=Object.assign({},req);
      copy.periodoId=period.id;
      copy.periodId=period.id;
      return copy;
    });
  }

  function recover(options,base){
    options=options||{};
    base=base||{};
    var selected=text(options.periodId||options.periodoId||options.periodo||"");
    if(!selected){return base;}

    var con=window.ConCoordi||window.BDLocalCoordi||null;
    if(!con){return base;}

    var periods=periodListFromConnector(con,base.periodList);
    var period=resolvePeriod(periods,selected);
    if(!period.signature){return base;}

    var allResult;
    try{
      allResult=typeof con.listStudents==="function"
        ?con.listStudents({matricula:options.matricula==null?"ACTIVO":options.matricula})
        :{rows:typeof con.getStudents==="function"?con.getStudents({matricula:options.matricula==null?"ACTIVO":options.matricula}):[]};
    }catch(error){return base;}

    var allRows=rowsFromResult(allResult);
    if(!allRows.length){return base;}

    var matched=allRows.filter(function(row){return samePeriodValue(periodValue(row),period.signature);});
    if(!matched.length){return base;}

    var allRequirements=arr(allResult&&allResult.requirements);
    if(!allRequirements.length&&typeof con.getRequirements==="function"){
      try{allRequirements=arr(con.getRequirements({}));}catch(error2){}
    }

    var targetRequirements=filterTargetRequirements(allRequirements,period);
    var keyMap=requirementKeyMap(allRequirements);
    var cleaned=matched.map(function(row){return cleanStudent(row,period,keyMap);});
    var students=typeof api.hydrateStudents==="function"
      ?api.hydrateStudents(cleaned,targetRequirements,period.id)
      :cleaned.map(function(row){return typeof api.normalizeStudent==="function"?api.normalizeStudent(row):row;});

    var baseByPeriod=typeof api.filterRows==="function"?api.filterRows(students,{periodId:period.id}):students;
    var baseByDivision=typeof api.filterRows==="function"?api.filterRows(students,{periodId:period.id,division:options.division||""}):baseByPeriod;
    var baseByCareer=typeof api.filterRows==="function"?api.filterRows(students,{periodId:period.id,division:options.division||"",career:options.career||options.carrera||""}):baseByDivision;
    var rows=typeof api.filterRows==="function"?api.filterRows(students,Object.assign({},options,{periodId:period.id,periodoId:period.id})):students;

    var connectorCatalog=[];
    try{if(typeof con.listRequirements==="function"){connectorCatalog=arr(con.listRequirements({periodoId:period.id,periodId:period.id}));}}catch(error3){}
    if(!connectorCatalog.length){
      var catalogMap=Object.create(null);
      targetRequirements.forEach(function(req){
        var key=requirementKey(req);if(!key){return;}
        catalogMap[compact(key)]={key:key,label:text(req.requisitoLabel||req.label||req.titulo||req.nombre||key)};
      });
      connectorCatalog=Object.keys(catalogMap).map(function(key){return catalogMap[key];});
    }

    var result=Object.assign({},base,{
      source:"ConCoordi+PeriodRecovery",
      version:VERSION,
      periodList:periods,
      divisionList:typeof api.listDivisions==="function"?api.listDivisions(baseByPeriod):arr(base.divisionList),
      careerList:typeof api.listCareers==="function"?api.listCareers(baseByDivision):arr(base.careerList),
      requirementList:typeof api.listRequirements==="function"?api.listRequirements(baseByCareer,connectorCatalog):arr(base.requirementList),
      rows:rows,
      total:rows.length
    });

    result.diagnostics=Object.assign({},base.diagnostics||{}, {
      source:"ConCoordi+PeriodRecovery",
      periodRecovery:true,
      selectedPeriod:selected,
      selectedPeriodId:period.id,
      selectedPeriodLabel:period.label,
      selectedPeriodSignature:period.signature,
      totalSnapshotStudents:students.length,
      totalFilteredStudents:rows.length,
      totalRequirementsRead:targetRequirements.length,
      totalRequirementsLinked:students.reduce(function(total,row){return total+arr(row&&row.requisitos).length;},0)
    });

    return result;
  }

  function read(options){
    return Promise.resolve(originalRead(options||{})).then(function(result){
      if(!text(options&&(options.periodId||options.periodoId||options.periodo))||arr(result&&result.rows).length){return result;}
      return recover(options,result);
    });
  }

  api.read=read;
  api.getSnapshot=read;
  api.periodSignature=periodSignature;
  api.__regularPeriodRecoveryPatched=true;
  api.regularPeriodRecoveryVersion=VERSION;

  window.COORegularPeriodFix={version:VERSION,periodSignature:periodSignature,recover:recover};
})(window);
