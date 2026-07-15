/* =========================================================
Nombre completo: infor.match.js
Ruta o ubicación: /Requisitos/Infor/core/infor.match.js
Función o funciones:
- Unir filas del Excel con estudiantes obtenidos exclusivamente desde ConInfor.
- Hacer match por cédula y usar nombres normalizados como respaldo.
- Priorizar modalidad y datos académicos provenientes del Excel.
Con qué se conecta:
- ../../BDLocal/conexiones/cone.infor.js
- infor.state.js
- infor.periodo.js
- infor.regular.js
========================================================= */
(function(window){
  "use strict";

  function text(value){
    var out=String(value==null?"":value).trim();
    return /^(null|undefined|nan|n\/a|s\/n)$/i.test(out)?"":out;
  }
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function onlyDigits(value){return text(value).replace(/[^0-9]/g,"");}
  function connector(){return window.ConInfor||window.BDLocalConeInfor||null;}

  var CEDULA_ALIASES=["cedula","cédula","numeroidentificacion","numero identificacion","identificacion","identificacionestudiante","identificacion estudiante","id","documento","dni"];
  var NAME_ALIASES=["nombre_est","nombre est","nombres","nombre","estudiante","apellidosynombres","apellidos nombres","alumno","participante"];
  var CAREER_ALIASES=["carrera","nombrecarrera","nombre carrera","programa","especialidad"];
  var TITLE_ALIASES=["titulo","título","tema","articulo","artículo","trabajo","propuesta","nombretrabajo"];
  var TUTOR_ALIASES=["tutor","docente tutor","director","asesor"];
  var MODALIDAD_ALIASES=["modalidadtitulacion","modalidad titulación","modalidad titulacion","modalidad","tipo titulacion"];

  function findValue(row,aliases){
    row=row||{};
    var keys=Object.keys(row);
    for(var i=0;i<aliases.length;i+=1){
      var wanted=compact(aliases[i]);
      for(var j=0;j<keys.length;j+=1){
        var key=compact(keys[j]);
        if(key===wanted||key.indexOf(wanted)>=0||wanted.indexOf(key)>=0){
          var value=text(row[keys[j]]);
          if(value){return value;}
        }
      }
    }
    return "";
  }

  function cedulaVariants(value){
    var digits=onlyDigits(value);
    if(!digits){return [];}
    var out=[digits];
    if(digits.charAt(0)==="0"){out.push(digits.slice(1));}
    else if(digits.length===9){out.push("0"+digits);}
    return out.filter(function(item,index,list){return item&&list.indexOf(item)===index;});
  }

  function nameKey(value){
    return norm(value).split(/\s+/).filter(function(word){return word.length>1;}).join(" ");
  }

  function modalityLabel(id){
    id=text(id).toUpperCase();
    if(id==="EXAMEN_COMPLEXIVO"){return "Examen Complexivo";}
    if(id==="TRABAJO_TITULACION"){return "Trabajo de Titulación";}
    if(id==="ARTICULO_ACADEMICO"){return "Artículo Académico";}
    return id||"Sin modalidad";
  }

  function normalizeModality(value,periodType){
    var raw=norm(value);
    if(raw.indexOf("trabajo")>=0||raw.indexOf("tesis")>=0||raw.indexOf("proyecto")>=0){return "TRABAJO_TITULACION";}
    if(raw.indexOf("articulo")>=0||raw.indexOf("pvc")>=0){return "ARTICULO_ACADEMICO";}
    if(raw.indexOf("complexivo")>=0||raw.indexOf("complex")>=0||raw.indexOf("examen")>=0){return "EXAMEN_COMPLEXIVO";}
    if(periodType&&periodType.id==="PVC"){return "ARTICULO_ACADEMICO";}
    if(periodType&&periodType.id==="REGULAR"){return "EXAMEN_COMPLEXIVO";}
    return "";
  }

  function baseCedula(row){
    row=row||{};
    return text(row._cedula||row.cedula||row.Cedula||row.CEDULA||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion||findValue(row,CEDULA_ALIASES));
  }
  function baseName(row){
    row=row||{};
    return text(row._nombres||row.nombreCompleto||row.nombres||row.Nombres||row.nombre||row.nombre_est||row.estudiante||findValue(row,NAME_ALIASES));
  }
  function baseCareer(row){
    row=row||{};
    return text(row._carrera||row.NombreCarrera||row.nombreCarrera||row.nombrecarrera||row.carrera||row.Carrera||findValue(row,CAREER_ALIASES));
  }

  function normalizeBaseStudent(row,periodType){
    row=row||{};
    var modalidadRaw=text(row.modalidadTitulacion||row.ModalidadTitulacion||findValue(row,MODALIDAD_ALIASES));
    var modalidad=normalizeModality(modalidadRaw,periodType);
    return {
      id:text(row.idEstudiantePeriodo||row.studentId||row.id||baseCedula(row)),
      cedula:baseCedula(row),nombres:baseName(row),carrera:baseCareer(row),
      periodo:text(row.periodoId||row.periodId||row.periodoLabel||row.ultimoPeriodoId||row.periodo||""),
      modalidadTitulacion:modalidad,modalidadLabel:modalityLabel(modalidad),raw:row
    };
  }

  function normalizeExcelRow(row,periodType){
    row=row||{};
    var modalidadRaw=text(row.modalidadTitulacion||row.ModalidadTitulacion||findValue(row,MODALIDAD_ALIASES));
    var modalidad=normalizeModality(modalidadRaw,periodType);
    return {
      sheet:text(row._inforSheet||""),rowNumber:row._inforRowNumber||"",
      cedula:text(row.cedula||findValue(row,CEDULA_ALIASES)),
      nombres:text(row.nombres||findValue(row,NAME_ALIASES)),
      carrera:text(row.carrera||findValue(row,CAREER_ALIASES)),
      titulo:text(row.titulo||findValue(row,TITLE_ALIASES)),
      tutor:text(row.tutor||findValue(row,TUTOR_ALIASES)),
      modalidadTitulacion:modalidad,modalidadLabel:modalityLabel(modalidad),raw:row
    };
  }

  function loadBaseStudents(periodId){
    var current=connector();
    if(!current){return {source:"ConInfor no disponible",rows:[]};}
    var rows=[];
    try{
      if(typeof current.listStudentsSync==="function"){
        rows=current.listStudentsSync({periodoId:periodId,matricula:"ACTIVO",search:"",limit:0})||[];
      }else if(typeof current.getStudentsSync==="function"){
        rows=current.getStudentsSync({periodoId:periodId,matricula:"ACTIVO",search:"",limit:0})||[];
      }
    }catch(error){
      try{console.warn("[InforMatch ConInfor]",error);}catch(innerError){}
      rows=[];
    }
    return {source:"ConInfor",rows:Array.isArray(rows)?rows:[]};
  }

  function indexBase(rows,periodType){
    var byCedula=Object.create(null);
    var byName=Object.create(null);
    var normalized=(rows||[]).map(function(row){return normalizeBaseStudent(row,periodType);});
    normalized.forEach(function(student){
      cedulaVariants(student.cedula).forEach(function(key){if(key&&!byCedula[key]){byCedula[key]=student;}});
      var key=nameKey(student.nombres);
      if(key&&!byName[key]){byName[key]=student;}
    });
    return {rows:normalized,byCedula:byCedula,byName:byName};
  }

  function buildMatch(method,excel,base,periodType){
    var modalidad=normalizeModality(excel.modalidadTitulacion||(base&&base.modalidadTitulacion),periodType);
    return {
      status:base?"unido":"pendiente",method:method,
      cedula:excel.cedula||(base&&base.cedula)||"",
      nombres:excel.nombres||(base&&base.nombres)||"",
      carrera:excel.carrera||(base&&base.carrera)||"",
      titulo:excel.titulo||"",tutor:excel.tutor||"",
      modalidadTitulacion:modalidad,modalidadLabel:modalityLabel(modalidad),excel:excel,base:base
    };
  }

  function matchExcelRow(excel,index,periodType){
    var byCedula=null;
    cedulaVariants(excel.cedula).some(function(key){
      if(index.byCedula[key]){byCedula=index.byCedula[key];return true;}
      return false;
    });
    if(byCedula){return buildMatch("cedula",excel,byCedula,periodType);}
    var byName=index.byName[nameKey(excel.nombres)]||null;
    if(byName){return buildMatch("nombre",excel,byName,periodType);}
    return buildMatch("sin_match",excel,null,periodType);
  }

  function summarize(matches,baseSource,baseTotal,regularAnalysis){
    var out={total:matches.length,unidos:0,pendientes:0,porCedula:0,porNombre:0,baseSource:baseSource,baseTotal:baseTotal,modalidades:{}};
    matches.forEach(function(item){
      if(item.status==="unido"){out.unidos+=1;}else{out.pendientes+=1;}
      if(item.method==="cedula"){out.porCedula+=1;}
      if(item.method==="nombre"){out.porNombre+=1;}
      var modalidad=item.modalidadTitulacion||"SIN_MODALIDAD";
      out.modalidades[modalidad]=(out.modalidades[modalidad]||0)+1;
    });
    if(regularAnalysis&&regularAnalysis.summary){
      out.regular=regularAnalysis.summary;
      out.excluidosPeriodo=0;
      out.duplicadosOmitidos=regularAnalysis.summary.duplicates||0;
      out.inconsistencias=regularAnalysis.summary.inconsistencias||0;
      out.supletorios=regularAnalysis.summary.supletorios||0;
      out.retirados=regularAnalysis.summary.retirados||0;
    }
    return out;
  }

  function regularRows(snapshot,periodType){
    if(!(periodType&&periodType.id==="REGULAR")){return null;}
    if(!(window.InforRegular&&typeof window.InforRegular.analyze==="function")){return null;}
    var analysis=window.InforRegular.analyze(snapshot);
    return analysis&&Array.isArray(analysis.rows)?analysis:null;
  }

  function match(snapshot){
    snapshot=snapshot||{};
    var periodId=text(snapshot.periodId||snapshot.periodLabel);
    var periodType=snapshot.periodType||(window.InforPeriodo&&window.InforPeriodo.classify?window.InforPeriodo.classify(snapshot.periodLabel||snapshot.periodId):null);
    var sourceRows=snapshot.excelData&&Array.isArray(snapshot.excelData.rows)?snapshot.excelData.rows:[];
    var regularAnalysis=regularRows(snapshot,periodType);
    var excelRows=regularAnalysis?regularAnalysis.rows:sourceRows;
    var base=loadBaseStudents(periodId);
    var index=indexBase(base.rows,periodType);
    var excel=excelRows.map(function(row){return normalizeExcelRow(row,periodType);});
    var matches=excel.map(function(row){return matchExcelRow(row,index,periodType);});
    return {
      ok:excelRows.length>0,periodId:periodId,periodType:periodType,
      baseSource:base.source,baseTotal:index.rows.length,totalExcel:excelRows.length,
      totalExcelOriginal:sourceRows.length,regularAnalysis:regularAnalysis,matches:matches,
      summary:summarize(matches,base.source,index.rows.length,regularAnalysis),generatedAt:new Date().toISOString()
    };
  }

  window.InforMatch={
    match:match,normalizeModality:normalizeModality,modalityLabel:modalityLabel,
    cedulaVariants:cedulaVariants,nameKey:nameKey,loadBaseStudents:loadBaseStudents
  };
})(window);