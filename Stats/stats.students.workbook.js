/* =========================================================
Nombre: stats.students.workbook.js
Ruta: /Stats/stats.students.workbook.js
Función: Libro XLSX de seguimiento por requisito para Stats/Estudiantes.
Se genera a partir de la misma cohorte filtrada que la vista de estudiantes.
No modifica notas, requisitos, BDLocal ni PDF.
========================================================= */
(function(root){
  "use strict";

  function txt(value){return String(value==null?"":value).trim();}
  function norm(value){return txt(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");}
  function pct(value,total){return total>0?value/total:0;}

  function studentInfo(row,helpers){
    return {
      nombre:txt(helpers.studentName(row)),
      cedula:txt(helpers.studentId(row)),
      carrera:txt(helpers.studentCareer(row))||"SIN CARRERA"
    };
  }
  function uniqueRows(rows,helpers){
    var seen=Object.create(null),output=[],duplicates=0;
    (rows||[]).forEach(function(row,index){
      var info=studentInfo(row,helpers);
      // El período ya está limitado por los filtros de la vista.
      var id=info.cedula.replace(/\D/g,"");
      var key=id?"ci:"+id : info.nombre ? "sin-ci:"+norm(info.nombre)+"|"+norm(info.carrera) : "registro:"+index;
      if(seen[key]){duplicates+=1;return;}
      seen[key]=true;
      output.push(row);
    });
    return {rows:output,duplicates:duplicates};
  }
  function requiredCatalog(rules,rows){
    var result=[],seen=Object.create(null);
    function add(item){
      var key=txt(item&&item.key);
      if(!key||seen[key]){return;}
      seen[key]=true;
      result.push({key:key,label:txt(item.label)||key});
    }
    (rules.BASE_REQUIREMENTS||[]).forEach(add);
    (rows||[]).forEach(function(row){
      (rules.requirementsForStudent(row)||[]).forEach(add);
    });
    // Solo los requisitos aplicables; no se incorporan aprobaciones finales
    // ni el requisito virtual Telegram a esta exportación.
    return result.filter(function(item){
      return (rows||[]).some(function(row){
        var applicable=rules.requirementsForStudent(row)||[];
        if(!applicable.some(function(r){return txt(r.key)===item.key;})){return false;}
        var status=rules.requirementStatus(row,item.key)||{};
        return status.applies!==false && status.status!=="no_aplica";
      });
    });
  }
  function missingItems(row,rules,catalog){
    var applicable=Object.create(null),out=[];
    (rules.requirementsForStudent(row)||[]).forEach(function(item){applicable[txt(item.key)]=true;});
    catalog.forEach(function(item){
      if(!applicable[item.key]){return;}
      var status=rules.requirementStatus(row,item.key)||{};
      if(status.applies===false||status.status==="no_aplica"){return;}
      if(status.cumple!==true && status.status!=="cumple"){out.push(item);}
    });
    return out;
  }
  function buildData(rows,options){
    options=options||{};
    var rules=options.rules,helpers=options.helpers;
    if(!rules||typeof rules.requirementsForStudent!=="function"||typeof rules.requirementStatus!=="function"){
      throw new Error("No están disponibles las reglas oficiales de requisitos para generar el Excel.");
    }
    if(!helpers||typeof helpers.studentId!=="function"||typeof helpers.studentName!=="function"||typeof helpers.studentCareer!=="function"){
      throw new Error("No se pueden identificar los estudiantes para generar el Excel.");
    }
    var unique=uniqueRows(rows,helpers);
    var catalog=requiredCatalog(rules,unique.rows);
    var counters=Object.create(null);
    catalog.forEach(function(item){counters[item.key]=0;});
    var students=unique.rows.map(function(row){
      var info=studentInfo(row,helpers),missing=missingItems(row,rules,catalog);
      missing.forEach(function(item){counters[item.key]+=1;});
      return {
        nombre:info.nombre,cedula:info.cedula,carrera:info.carrera,
        faltantes:missing,numeroFaltantes:missing.length
      };
    });
    var pending=students.filter(function(item){return item.numeroFaltantes>0;}).length;
    var requirements=catalog.map(function(item){
      return {key:item.key,label:item.label,pendientes:counters[item.key],porcentaje:pct(counters[item.key],students.length)};
    });
    return {
      students:students,requirements:requirements,
      summary:{
        total:students.length,conFaltantes:pending,completos:students.length-pending,
        incidencias:requirements.reduce(function(sum,item){return sum+item.pendientes;},0),
        duplicadosOmitidos:unique.duplicates
      }
    };
  }
  function sheetName(value,used){
    var base=txt(value).replace(/[\\\/\?\*\[\]:]/g," ").replace(/^'+|'+$/g,"").slice(0,31)||"Requisito";
    var result=base,count=2;
    while(used[norm(result)]){
      var suffix=" ("+(count++)+")";
      result=base.slice(0,31-suffix.length)+suffix;
    }
    used[norm(result)]=true;
    return result;
  }
  function autofilter(sheet,headerRow,columns,lastRow){
    sheet["!autofilter"]={ref:"A"+headerRow+":"+columns+Math.max(headerRow,lastRow)};
  }
  function createBook(XLSX,rows,options){
    if(!XLSX||!XLSX.utils||typeof XLSX.utils.aoa_to_sheet!=="function"){
      throw new Error("SheetJS no está disponible para crear el archivo.");
    }
    var data=buildData(rows,options);
    var meta=options.meta||{},book=XLSX.utils.book_new(),used=Object.create(null);
    book.Props={
      Title:"Seguimiento de requisitos pendientes",
      Subject:"Estudiantes y requisitos faltantes de Stats",
      Author:"Requisitos",
      CreatedDate:new Date()
    };
    var summary=data.summary;
    var summaryRows=[
      ["CONSOLIDADO DE REQUISITOS PENDIENTES"],
      ["Período",txt(meta.periodo)],["Sede",txt(meta.sede)],["División",txt(meta.division)],
      ["Matrícula",txt(meta.matricula)],["Carrera",txt(meta.carrera)],
      ["Estado",txt(meta.estado)],["Requisito seleccionado",txt(meta.requisito)],
      ["Vista",txt(meta.vista)],["Búsqueda",txt(meta.busqueda)],
      ["Orden",txt(meta.orden)],["Generado",txt(meta.generado)],
      [],
      ["Estudiantes únicos",summary.total],["Con faltantes",summary.conFaltantes],
      ["Sin faltantes",summary.completos],["Incidencias",summary.incidencias],
      ["Registros duplicados omitidos",summary.duplicadosOmitidos],
      [],
      ["REQUISITO","ESTUDIANTES PENDIENTES","% DE ESTUDIANTES","HOJA"]
    ];
    var summaryHeader=summaryRows.length;
    data.requirements.forEach(function(item){
      summaryRows.push([item.label,item.pendientes,item.porcentaje,item.label]);
    });
    summaryRows.push([],["Nota","Un estudiante puede tener varios requisitos pendientes; por eso la suma de incidencias puede superar el total de estudiantes."]);
    var summarySheet=XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"]=[{wch:34},{wch:65},{wch:23},{wch:30}];
    autofilter(summarySheet,summaryHeader,"D",summaryHeader+data.requirements.length);
    for(var sr=summaryHeader+1;sr<=summaryHeader+data.requirements.length;sr+=1){
      var cell=summarySheet["C"+sr];if(cell){cell.z="0.00%";}
    }
    XLSX.utils.book_append_sheet(book,summarySheet,sheetName("Consolidado",used));

    var globalRows=[
      ["GLOBAL DE ESTUDIANTES"],["Período",txt(meta.periodo)],["Vista",txt(meta.vista)],
      ["Estudiantes",summary.total],[],
      ["#","NOMBRE","CÉDULA","CARRERA","N.º FALTANTES","REQUISITOS FALTANTES"]
    ];
    data.students.forEach(function(s,i){
      globalRows.push([i+1,s.nombre,s.cedula,s.carrera,s.numeroFaltantes,s.faltantes.map(function(item){return item.label;}).join(", ")]);
    });
    var globalSheet=XLSX.utils.aoa_to_sheet(globalRows);
    globalSheet["!cols"]=[{wch:8},{wch:43},{wch:19},{wch:43},{wch:18},{wch:100}];
    autofilter(globalSheet,6,"F",globalRows.length);
    XLSX.utils.book_append_sheet(book,globalSheet,sheetName("Global",used));

    data.requirements.forEach(function(req){
      var relevant=data.students.filter(function(student){
        return student.faltantes.some(function(item){return item.key===req.key;});
      });
      var detailRows=[
        [req.label.toUpperCase()+" - PENDIENTES"],
        ["Período",txt(meta.periodo)],["Estudiantes pendientes",relevant.length],
        ["Vista",txt(meta.vista)],[],
        ["#","NOMBRE","CÉDULA","CARRERA","N.º FALTANTES","OTROS REQUISITOS FALTANTES"]
      ];
      relevant.forEach(function(student,i){
        detailRows.push([
          i+1,student.nombre,student.cedula,student.carrera,student.numeroFaltantes,
          student.faltantes.filter(function(item){return item.key!==req.key;}).map(function(item){return item.label;}).join(", ")
        ]);
      });
      if(!relevant.length){detailRows.push(["","Sin estudiantes pendientes"]);}
      var detailSheet=XLSX.utils.aoa_to_sheet(detailRows);
      detailSheet["!cols"]=[{wch:8},{wch:43},{wch:19},{wch:43},{wch:18},{wch:85}];
      autofilter(detailSheet,6,"F",6+relevant.length);
      XLSX.utils.book_append_sheet(book,detailSheet,sheetName(req.label,used));
    });
    return {book:book,summary:summary,requirements:data.requirements};
  }

  var api={version:"1.0.0",buildData:buildData,createBook:createBook};
  if(typeof module!=="undefined"&&module.exports){module.exports=api;}
  if(root){root.StatsStudentsWorkbook=api;}
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:this);
