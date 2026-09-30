/* =========================================================
Nombre completo: defart.excel-import.js
Ruta: /defart/defart.excel-import.js
Función:
- Conservar Moodle como método independiente de carga masiva.
- Añadir carga Excel de N-ART y N-DEF dentro del mismo popup.
- Generar una plantilla XLSX con estudiantes del período seleccionado.
- Leer archivos XLS/XLSX, detectar encabezados y decimales con coma.
- Cruzar estudiantes por el mismo motor inteligente usado por Moodle.
- Analizar antes de guardar y usar Nota final solo como control.
- Guardar exclusivamente mediante DefartCore.saveNotes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-excel-nart-ndef";
  var state={
    mode:"moodle",
    file:null,
    fileName:"",
    students:[],
    parsed:null,
    items:[],
    analyzed:false,
    saving:false
  };

  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^A-Za-z0-9]+/g," ").replace(/\s+/g," ").trim().toLowerCase();
  }
  function el(id){return document&&document.getElementById(id);}
  function idOf(row){row=row||{};return text(row._defId||row.idEstudiantePeriodo||row.studentId||row.id||row._cedula||row.cedula);}
  function nameOf(row){row=row||{};return text(row._nombre||row.Nombres||row.nombres||row.Nombre||row.nombre||row.nombreCompleto||row.NombreCompleto||row.Estudiante||row.estudiante);}
  function currentNart(row){
    row=row||{};
    var value=row._nart;
    if(value===undefined||value===null||text(value)===""){value=row.Notart!==undefined?row.Notart:(row.Nart!==undefined?row.Nart:row.notaArticulo);}
    var num=Number(text(value).replace(",","."));
    return text(value)!==""&&Number.isFinite(num)?Math.round(num*100)/100:null;
  }
  function currentNdef(row){
    row=row||{};
    var value=row._ndef;
    if(value===undefined||value===null||text(value)===""){value=row.Notdef!==undefined?row.Notdef:(row.Ndef!==undefined?row.Ndef:row.notaDefensa);}
    var num=Number(text(value).replace(",","."));
    return text(value)!==""&&Number.isFinite(num)?Math.round(num*100)/100:null;
  }
  function currentNfin(row){
    row=row||{};
    var value=row._nfin;
    if(value===undefined||value===null||text(value)===""){value=row.Notafinal!==undefined?row.Notafinal:(row.Nfin!==undefined?row.Nfin:row.notaFinal);}
    var num=Number(text(value).replace(",","."));
    return text(value)!==""&&Number.isFinite(num)?Math.round(num*100)/100:null;
  }
  function sameNote(a,b){
    if(a==null&&b==null){return true;}
    if(a==null||b==null){return false;}
    return Math.abs(Number(a)-Number(b))<0.005;
  }
  function currentPeriod(){
    try{
      var appState=window.DefartApp&&typeof window.DefartApp.getState==="function"?window.DefartApp.getState():{};
      return text(appState.periodId);
    }catch(error){return "";}
  }
  function currentPeriodLabel(){
    var select=el("def-filter-periodo");
    if(select&&select.selectedIndex>=0){
      var option=select.options[select.selectedIndex];
      var label=text(option&&option.textContent);
      if(label&&norm(label)!=="todos"){return label;}
    }
    return currentPeriod();
  }
  function fileSafe(value){return text(value).replace(/[\\/:*?"<>|]+/g,"_").replace(/\s+/g,"_").slice(0,90)||"periodo";}

  function setMessage(message,kind){
    var box=el("def-excel-message");if(!box)return;
    box.textContent=message||"";
    box.className="def-bulk-message "+(kind||"");
  }

  function setMode(mode){
    mode=mode==="excel"?"excel":"moodle";
    state.mode=mode;
    Array.prototype.slice.call(document.querySelectorAll("[data-def-import-mode]")).forEach(function(button){
      button.classList.toggle("is-active",button.getAttribute("data-def-import-mode")===mode);
    });
    var moodle=el("def-import-moodle-panel"),excel=el("def-import-excel-panel");
    if(moodle)moodle.hidden=mode!=="moodle";
    if(excel)excel.hidden=mode!=="excel";
  }

  function rowsForPeriod(periodId){
    if(!periodId){return Promise.reject(new Error("Seleccione un período en Defensas."));}
    if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.getExportRows==="function"){
      return Promise.resolve(window.DefartServiceBridge.getExportRows({
        periodId:periodId,division:"",career:"",status:"",sede:"",search:"",sortKey:"_nombre",sortDir:"asc"
      })).then(function(rows){return Array.isArray(rows)?rows:[];});
    }
    var appState=window.DefartApp&&typeof window.DefartApp.getState==="function"?window.DefartApp.getState():{};
    var data=appState&&appState.data||{};
    var rows=Array.isArray(data.exportRows)?data.exportRows:(Array.isArray(data.rows)?data.rows:[]);
    return Promise.resolve(rows.filter(function(row){return !row._periodoId||text(row._periodoId)===periodId;}));
  }

  function noteCell(value){
    var raw=text(value);
    if(!raw){return {value:null,empty:true,error:""};}
    var key=norm(raw);
    if(key==="sin notas"||key==="sin nota"||key==="s n"||key==="sn"||key==="n a"||key==="na"||raw==="-"){
      return {value:null,empty:true,error:""};
    }
    var num=Number(raw.replace(",","."));
    if(!Number.isFinite(num)||num<0||num>10){
      return {value:null,empty:false,error:"Nota inválida: "+raw};
    }
    return {value:Math.round(num*100)/100,empty:false,error:""};
  }

  function findHeader(matrix){
    for(var r=0;r<Math.min(matrix.length,30);r+=1){
      var row=Array.isArray(matrix[r])?matrix[r]:[];
      var normalized=row.map(norm);
      var nameIndex=normalized.findIndex(function(v){return v==="nombre"||v==="estudiante"||v==="nombre estudiante";});
      var artIndex=normalized.findIndex(function(v){return v==="nota articulo"||v==="nota de articulo"||v==="n art"||v==="nart";});
      var defIndex=normalized.findIndex(function(v){return v==="nota defensa"||v==="nota de defensa"||v==="n def"||v==="ndef";});
      var finIndex=normalized.findIndex(function(v){return v==="nota final"||v==="n fin"||v==="nfin";});
      if(nameIndex>=0&&(artIndex>=0||defIndex>=0)){
        return {row:r,name:nameIndex,nart:artIndex,ndef:defIndex,nfin:finIndex};
      }
    }
    return null;
  }

  function parseMatrix(matrix){
    matrix=Array.isArray(matrix)?matrix:[];
    var header=findHeader(matrix);
    var result={ok:false,rows:[],errors:[],warnings:[],header:header,total:0};
    if(!header){
      result.errors.push("No se encontraron los encabezados Nombre, Nota Artículo y Nota Defensa.");
      return result;
    }

    for(var r=header.row+1;r<matrix.length;r+=1){
      var cells=Array.isArray(matrix[r])?matrix[r]:[];
      var nombre=text(cells[header.name]);
      var rawArt=header.nart>=0?cells[header.nart]:"";
      var rawDef=header.ndef>=0?cells[header.ndef]:"";
      var rawFin=header.nfin>=0?cells[header.nfin]:"";
      if(!nombre&&!text(rawArt)&&!text(rawDef)&&!text(rawFin)){continue;}
      if(!nombre){result.warnings.push("Fila "+(r+1)+": sin nombre; se omitió.");continue;}

      var art=noteCell(rawArt),def=noteCell(rawDef);
      var errors=[];
      if(art.error)errors.push("N-ART: "+art.error);
      if(def.error)errors.push("N-DEF: "+def.error);

      result.rows.push({
        rowNumber:r+1,
        format:"excel_defensas",
        nombreCompleto:nombre,
        correo:"",
        notaArticulo:art.value,
        notaDefensa:def.value,
        notaFinalFuente:text(rawFin),
        rawArticulo:text(rawArt),
        rawDefensa:text(rawDef),
        errors:errors,
        warnings:[]
      });
    }

    if(!result.rows.length){result.errors.push("El archivo no contiene filas de estudiantes.");return result;}
    result.total=result.rows.length;
    result.ok=true;
    return result;
  }

  function fallbackMatch(imported,students){
    var wanted=norm(imported.nombreCompleto),exact=null;
    (students||[]).some(function(student){
      if(norm(nameOf(student))===wanted){exact=student;return true;}
      return false;
    });
    return exact
      ?{student:exact,kind:"exact",confidence:99,method:"nombre exacto",candidates:[{student:exact,score:99}]}
      :{student:null,kind:"unmatched",confidence:0,method:"",candidates:[]};
  }

  function chooseMatch(imported,students){
    var matcher=window.DefartBulkImport;
    if(matcher&&typeof matcher.chooseMatch==="function"){return matcher.chooseMatch(imported,students);}
    return fallbackMatch(imported,students);
  }

  function calculateFinal(nart,ndef){
    if(nart==null||ndef==null){return null;}
    if(window.DefartCore&&typeof window.DefartCore.calculateFinal==="function"){
      return window.DefartCore.calculateFinal(nart,ndef);
    }
    return Math.round(((Number(nart)*.7)+(Number(ndef)*.3))*100)/100;
  }

  function finalControl(imported,nart,ndef){
    var raw=text(imported.notaFinalFuente);
    if(!raw){return {label:"—",warning:""};}
    var calculated=calculateFinal(nart,ndef);
    var key=norm(raw);
    if(key==="reprobado"||key==="no aprobado"){
      var consistent=nart!=null&&ndef!=null&&(nart<7||ndef<7);
      return {label:raw,warning:consistent?"":"El archivo marca REPROBADO pero ambas notas son ≥ 7."};
    }
    var numeric=Number(raw.replace(",","."));
    if(Number.isFinite(numeric)){
      numeric=Math.round(numeric*100)/100;
      var warning=calculated!=null&&Math.abs(numeric-calculated)>.03
        ?"Nota final del archivo ("+numeric.toFixed(2)+") difiere del cálculo ("+calculated.toFixed(2)+")."
        :"";
      return {label:numeric.toFixed(2),warning:warning};
    }
    return {label:raw,warning:"La Nota final se usa solo como control y no se guardará."};
  }

  function validateItem(item){
    var imported=item.imported,student=item.student;
    var errors=(imported.errors||[]).slice(),warnings=(imported.warnings||[]).slice();
    if(!student){return {errors:errors,warnings:warnings};}
    var effectiveNart=imported.notaArticulo!=null?imported.notaArticulo:currentNart(student);
    if(imported.notaDefensa!=null){
      if(!student._requirementsOk){errors.push("N-DEF bloqueada: requisitos incompletos o no cargados.");}
      if(effectiveNart==null||effectiveNart<7){errors.push("N-DEF bloqueada: N-ART debe ser igual o mayor a 7.");}
    }
    var control=finalControl(imported,effectiveNart,imported.notaDefensa!=null?imported.notaDefensa:currentNdef(student));
    if(control.warning)warnings.push(control.warning);
    return {errors:errors,warnings:warnings,finalLabel:control.label};
  }

  function buildItems(parsedRows,students){
    return (parsedRows||[]).map(function(imported,index){
      var match=chooseMatch(imported,students);
      var item={
        key:"excel_"+index,
        imported:imported,
        student:match.student||null,
        kind:match.kind||"unmatched",
        confidence:Number(match.confidence||0),
        method:match.method||"",
        candidates:match.candidates||[],
        selected:false,
        errors:[],
        warnings:[],
        finalLabel:"—"
      };

      if(imported.notaArticulo==null&&imported.notaDefensa==null){item.kind="no-grade";}
      var validation=validateItem(item);
      item.errors=validation.errors||[];
      item.warnings=validation.warnings||[];
      item.finalLabel=validation.finalLabel||"—";

      if(item.student){
        item.changeNart=imported.notaArticulo!=null&&!sameNote(imported.notaArticulo,currentNart(item.student));
        item.changeNdef=imported.notaDefensa!=null&&!sameNote(imported.notaDefensa,currentNdef(item.student));
      }else{
        item.changeNart=false;item.changeNdef=false;
      }
      item.hasChanges=!!(item.changeNart||item.changeNdef);
      item.selected=item.kind==="exact"&&item.hasChanges&&!item.errors.length;
      return item;
    });
  }

  function summary(items){
    items=items||[];
    return {
      total:items.length,
      exact:items.filter(function(x){return x.kind==="exact";}).length,
      review:items.filter(function(x){return x.kind==="probable"||x.kind==="ambiguous"||x.kind==="manual";}).length,
      unmatched:items.filter(function(x){return x.kind==="unmatched";}).length,
      noGrade:items.filter(function(x){return x.kind==="no-grade";}).length,
      errors:items.filter(function(x){return x.errors&&x.errors.length;}).length,
      ready:items.filter(function(x){return x.selected&&x.student&&x.hasChanges&&!x.errors.length;}).length
    };
  }

  function candidateSelect(item){
    if(item.student&&item.kind==="exact"){
      return '<strong>'+esc(nameOf(item.student))+'</strong><small>'+esc(item.method||"nombre exacto")+'</small>';
    }
    var seen={},options=['<option value="">Elegir estudiante...</option>'];
    (item.candidates||[]).forEach(function(candidate){
      var student=candidate.student,id=idOf(student);
      if(!id||seen[id])return;seen[id]=true;
      options.push('<option value="'+esc(id)+'">'+esc(nameOf(student))+' · '+Number(candidate.score||0)+'%</option>');
    });
    return '<select class="def-excel-candidate" data-key="'+esc(item.key)+'">'+options.join("")+'</select>';
  }

  function notePair(currentValue,newValue){
    var current=currentValue==null?"—":Number(currentValue).toFixed(2);
    var incoming=newValue==null?"—":Number(newValue).toFixed(2);
    return '<span class="def-excel-note-pair"><small>'+current+'</small><strong>→ '+incoming+'</strong></span>';
  }

  function rowStatus(item){
    if(item.errors.length)return '<span class="def-bulk-badge is-conflict">Bloqueado</span><small>'+esc(item.errors.join(" · "))+'</small>';
    if(item.kind==="no-grade")return '<span class="def-bulk-badge is-no-grade">Sin notas</span>';
    if(item.kind==="unmatched")return '<span class="def-bulk-badge is-unmatched">No encontrado</span>';
    if(item.kind==="probable"||item.kind==="ambiguous")return '<span class="def-bulk-badge is-review">Revisar '+item.confidence+'%</span>';
    if(!item.hasChanges)return '<span class="def-bulk-badge is-exact">Sin cambios</span>';
    return '<span class="def-bulk-badge is-exact">Listo</span>'+(item.warnings.length?'<small>'+esc(item.warnings.join(" · "))+'</small>':"");
  }

  function rowHtml(item){
    var nart=item.student?currentNart(item.student):null;
    var ndef=item.student?currentNdef(item.student):null;
    var canSelect=!!(item.student&&item.hasChanges&&!item.errors.length&&(item.kind==="exact"||item.kind==="manual"));
    return '<tr class="def-bulk-row is-'+(item.errors.length?"conflict":(item.kind==="unmatched"?"unmatched":(item.kind==="probable"||item.kind==="ambiguous"?"review":"exact")))+'">'+
      '<td class="def-bulk-check"><input type="checkbox" data-excel-select="'+esc(item.key)+'" '+(item.selected?"checked":"")+' '+(!canSelect?"disabled":"")+'></td>'+
      '<td><strong>'+esc(item.imported.nombreCompleto)+'</strong><small>Fila '+item.imported.rowNumber+'</small></td>'+
      '<td>'+candidateSelect(item)+'</td>'+
      '<td class="def-bulk-note">'+notePair(nart,item.imported.notaArticulo)+'</td>'+
      '<td class="def-bulk-note">'+notePair(ndef,item.imported.notaDefensa)+'</td>'+
      '<td class="def-bulk-note"><strong>'+esc(item.finalLabel||"—")+'</strong><small>solo control</small></td>'+
      '<td>'+rowStatus(item)+'</td>'+
    '</tr>';
  }

  function render(){
    var sum=summary(state.items),summaryBox=el("def-excel-summary");
    if(summaryBox){
      summaryBox.innerHTML=[
        ["Filas",sum.total],["Exactas",sum.exact],["Revisar",sum.review],
        ["No encontradas",sum.unmatched],["Sin notas",sum.noGrade],["Con bloqueo",sum.errors],["Listas",sum.ready]
      ].map(function(pair){return '<div class="def-excel-stat"><span>'+esc(pair[0])+'</span><strong>'+pair[1]+'</strong></div>';}).join("");
    }
    var apply=el("def-excel-apply");
    if(apply){apply.disabled=state.saving||sum.ready===0;apply.textContent=sum.ready?"Guardar "+sum.ready+" estudiante(s)":"Guardar notas analizadas";}
    var analyze=el("def-excel-analyze");
    if(analyze){analyze.disabled=!state.file||state.saving;}
    var fileName=el("def-excel-file-name");
    if(fileName){fileName.textContent=state.fileName||"Ningún archivo seleccionado";}
    var body=el("def-excel-results");if(!body)return;
    if(!state.analyzed){body.innerHTML='<div class="def-bulk-empty">Todavía no se ha analizado un archivo.</div>';return;}
    if(!state.items.length){body.innerHTML='<div class="def-bulk-empty">No se encontraron registros analizables.</div>';return;}
    body.innerHTML='<div class="def-bulk-table-wrap"><table class="def-bulk-table def-excel-table"><thead><tr><th></th><th>Excel</th><th>Coincidencia</th><th>N-ART actual → nueva</th><th>N-DEF actual → nueva</th><th>Nota final</th><th>Resultado</th></tr></thead><tbody>'+state.items.map(rowHtml).join("")+'</tbody></table></div>';
  }

  function setFile(file){
    if(!file){return;}
    if(!/\.(xlsx|xls)$/i.test(file.name||"")){
      state.file=null;state.fileName="";state.analyzed=false;state.items=[];render();
      setMessage("Seleccione un archivo Excel .xlsx o .xls.","warn");return;
    }
    state.file=file;state.fileName=file.name;state.analyzed=false;state.items=[];state.parsed=null;
    render();setMessage("Archivo cargado. Pulse Analizar archivo para revisar los cambios.","info");
  }

  function readFile(file){
    return new Promise(function(resolve,reject){
      if(!window.XLSX){reject(new Error("SheetJS no está disponible para leer Excel."));return;}
      var reader=new FileReader();
      reader.onload=function(){
        try{
          var workbook=window.XLSX.read(reader.result,{type:"array"});
          var first=workbook.SheetNames&&workbook.SheetNames[0];
          if(!first)throw new Error("El archivo no contiene hojas.");
          var sheet=workbook.Sheets[first];
          var matrix=window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:""});
          resolve({workbook:workbook,sheetName:first,matrix:matrix});
        }catch(error){reject(error);}
      };
      reader.onerror=function(){reject(new Error("No se pudo leer el archivo Excel."));};
      reader.readAsArrayBuffer(file);
    });
  }

  function analyze(){
    if(state.saving)return;
    var period=currentPeriod();
    if(!period){setMessage("Seleccione un período en Defensas antes de analizar.","warn");return;}
    if(!state.file){setMessage("Seleccione primero el archivo Excel.","warn");return;}
    setMessage("Leyendo Excel y cruzando estudiantes del período...","info");
    Promise.all([readFile(state.file),rowsForPeriod(period)]).then(function(values){
      var parsed=parseMatrix(values[0].matrix);
      state.parsed=parsed;
      if(!parsed.ok){
        state.items=[];state.analyzed=true;render();setMessage(parsed.errors.join(" "),"warn");return;
      }
      state.students=Array.isArray(values[1])?values[1]:[];
      state.items=buildItems(parsed.rows,state.students);
      state.analyzed=true;render();
      var sum=summary(state.items);
      setMessage("Análisis terminado: "+sum.total+" filas, "+sum.exact+" coincidencias exactas, "+sum.review+" por revisar, "+sum.noGrade+" sin notas y "+sum.ready+" listas para guardar.","ok");
    }).catch(function(error){
      state.items=[];state.analyzed=true;render();
      setMessage(error&&error.message?error.message:String(error),"warn");
    });
  }

  function downloadTemplate(){
    var period=currentPeriod();
    if(!period){setMessage("Seleccione un período en Defensas antes de descargar la plantilla.","warn");return;}
    if(!window.XLSX){setMessage("SheetJS no está disponible para generar la plantilla.","warn");return;}
    setMessage("Preparando plantilla del período...","info");
    rowsForPeriod(period).then(function(rows){
      rows=(rows||[]).slice().sort(function(a,b){return nameOf(a).localeCompare(nameOf(b),"es",{sensitivity:"base"});});
      var periodLabel=currentPeriodLabel()||period;
      var matrix=[[periodLabel],[],["Nombre","Nota Articulo","Nota Defensa","Nota final"]];
      rows.forEach(function(row){
        var nart=currentNart(row),ndef=currentNdef(row),nfin=currentNfin(row);
        if(nfin==null)nfin=calculateFinal(nart,ndef);
        matrix.push([nameOf(row),nart==null?"":nart,ndef==null?"":ndef,nfin==null?"":nfin]);
      });
      var sheet=window.XLSX.utils.aoa_to_sheet(matrix);
      sheet["!merges"]=[{s:{r:0,c:0},e:{r:0,c:3}}];
      sheet["!cols"]=[{wch:46},{wch:16},{wch:16},{wch:16}];
      sheet["!autofilter"]={ref:"A3:D"+Math.max(3,matrix.length)};
      var book=window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(book,sheet,"Notas");
      var filename="Plantilla_Defensas_"+fileSafe(periodLabel)+".xlsx";
      window.XLSX.writeFile(book,filename);
      setMessage("Plantilla descargada con "+rows.length+" estudiante(s).","ok");
    }).catch(function(error){setMessage(error&&error.message?error.message:String(error),"warn");});
  }

  function findItem(key){return state.items.find(function(item){return item.key===key;})||null;}
  function findStudent(id){return state.students.find(function(student){return idOf(student)===id;})||null;}

  function assignStudent(select){
    var item=findItem(select.getAttribute("data-key"));if(!item)return;
    var student=findStudent(select.value);
    item.student=student||null;
    item.kind=student?"manual":"unmatched";
    item.confidence=student?100:0;
    item.method=student?"selección manual":"";
    var validation=validateItem(item);
    item.errors=validation.errors||[];item.warnings=validation.warnings||[];item.finalLabel=validation.finalLabel||"—";
    item.changeNart=!!(student&&item.imported.notaArticulo!=null&&!sameNote(item.imported.notaArticulo,currentNart(student)));
    item.changeNdef=!!(student&&item.imported.notaDefensa!=null&&!sameNote(item.imported.notaDefensa,currentNdef(student)));
    item.hasChanges=!!(item.changeNart||item.changeNdef);
    item.selected=!!(student&&item.hasChanges&&!item.errors.length);
    render();
  }

  function changesForSave(items){
    return (items||[]).filter(function(item){
      return item.selected&&item.student&&item.hasChanges&&!item.errors.length;
    }).map(function(item){
      var change={id:idOf(item.student),_row:item.student,_bulkImport:true,_excelImport:true};
      if(item.changeNart)change.nart=item.imported.notaArticulo;
      if(item.changeNdef)change.ndef=item.imported.notaDefensa;
      return change;
    });
  }

  function save(){
    if(state.saving)return;
    var changes=changesForSave(state.items);
    if(!changes.length){setMessage("No hay notas analizadas listas para guardar.","warn");return;}
    if(!window.DefartCore||typeof window.DefartCore.saveNotes!=="function"){setMessage("DefartCore.saveNotes no está disponible.","warn");return;}
    state.saving=true;render();setMessage("Guardando "+changes.length+" estudiante(s) mediante la ruta oficial de Defensas...","info");
    Promise.resolve(window.DefartCore.saveNotes(changes)).then(function(result){
      result=result||{};
      var saved=Number(result.saved||0),errors=Array.isArray(result.errors)?result.errors:[];
      try{if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.clear==="function")window.DefartServiceBridge.clear({resetPage:false,keepLast:false});}catch(error){}
      try{if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.refresh==="function")window.DefartServiceBridge.refresh();else if(window.DefartApp&&typeof window.DefartApp.render==="function")window.DefartApp.render();}catch(error2){}
      state.items=[];state.analyzed=false;
      render();
      if(errors.length){
        setMessage(saved+" estudiante(s) guardados. "+errors.length+" cambio(s) quedaron bloqueados: "+errors.slice(0,3).join(" · "),"warn");
      }else{
        setMessage(saved+" estudiante(s) guardados. N-FIN fue recalculada automáticamente y las notas quedan listas para sincronizar.","ok");
      }
    }).catch(function(error){setMessage(error&&error.message?error.message:String(error),"warn");}).finally(function(){state.saving=false;render();});
  }

  function handleClick(event){
    var target=event.target;
    var modeButton=target&&target.closest?target.closest("[data-def-import-mode]"):null;
    if(modeButton){setMode(modeButton.getAttribute("data-def-import-mode"));return;}
    if(target&&target.id==="def-excel-template"){downloadTemplate();return;}
    if(target&&target.id==="def-excel-pick"){var fileInput=el("def-excel-file");if(fileInput)fileInput.click();return;}
    if(target&&target.id==="def-excel-analyze"){analyze();return;}
    if(target&&target.id==="def-excel-apply"){save();return;}
    if(target&&target.id==="def-excel-dropzone"){var input=el("def-excel-file");if(input)input.click();}
  }

  function handleChange(event){
    var target=event.target;
    if(target&&target.id==="def-excel-file"){setFile(target.files&&target.files[0]);return;}
    if(target&&target.classList.contains("def-excel-candidate")){assignStudent(target);return;}
    if(target&&target.hasAttribute("data-excel-select")){
      var item=findItem(target.getAttribute("data-excel-select"));if(item){item.selected=!!target.checked;render();}
    }
  }

  function bindDropzone(){
    var zone=el("def-excel-dropzone");if(!zone)return;
    ["dragenter","dragover"].forEach(function(name){zone.addEventListener(name,function(event){event.preventDefault();zone.classList.add("is-dragging");});});
    ["dragleave","drop"].forEach(function(name){zone.addEventListener(name,function(event){event.preventDefault();zone.classList.remove("is-dragging");});});
    zone.addEventListener("drop",function(event){var file=event.dataTransfer&&event.dataTransfer.files&&event.dataTransfer.files[0];if(file)setFile(file);});
    zone.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();var input=el("def-excel-file");if(input)input.click();}});
  }

  function bind(){
    if(!document||bind.done)return;bind.done=true;
    document.addEventListener("click",handleClick);
    document.addEventListener("change",handleChange);
    bindDropzone();
    setMode("moodle");
    render();
  }

  var api={
    version:VERSION,
    parseMatrix:parseMatrix,
    findHeader:findHeader,
    buildItems:buildItems,
    summary:summary,
    changesForSave:changesForSave,
    setMode:setMode,
    downloadTemplate:downloadTemplate,
    analyze:analyze,
    save:save,
    getState:function(){return {mode:state.mode,fileName:state.fileName,parsed:state.parsed,items:state.items.slice(),summary:summary(state.items)};}
  };
  window.DefartExcelImport=api;
  if(document){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();}
})(window,typeof document!=="undefined"?document:null);
