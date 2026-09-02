/* =========================================================
Nombre completo: defart.bulk-import.js
Ruta: /defart/defart.bulk-import.js
Función:
- Abrir un popup de carga masiva de N-DEF.
- Leer texto bruto copiado desde Moodle, incluso en formato Markdown.
- Extraer nombre, correo y calificación X/100.
- Cruzar por correo, nombre exacto, huella de nombre y similitud.
- Marcar coincidencias exactas, probables, ambiguas, duplicados y conflictos.
- No sobrescribir N-DEF existente sin confirmación.
- Guardar únicamente mediante DefartCore.saveNotes / ConDefart.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION="1.0.0-smart-moodle-import";
  var state={
    opened:false,
    periodId:"",
    sourceText:"",
    parsed:null,
    students:[],
    items:[],
    tab:"all",
    saving:false,
    analyzed:false,
    saved:0
  };

  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function normalized(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^A-Za-z0-9]+/g," ").replace(/\s+/g," ").trim().toLowerCase();
  }
  function normalizeEmail(value){return text(value).replace(/\\@/g,"@").replace(/^mailto:/i,"").toLowerCase();}
  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function idOf(row){row=row||{};return text(row._defId||row.idEstudiantePeriodo||row.studentId||row.id||row._cedula||row.cedula);}
  function emailOf(row){
    row=row||{};
    return normalizeEmail(
      row.correoInstitucional||row.CorreoInstitucional||row.emailInstitucional||row.EmailInstitucional||
      row.correoElectronico||row.CorreoElectronico||row.direccionCorreo||row.DireccionCorreo||
      row.correo||row.Correo||row.email||row.Email||row.mail||row.Mail||""
    );
  }
  function nameOf(row){
    row=row||{};
    return text(row._nombre||row.Nombres||row.nombres||row.Nombre||row.nombre||row.nombreCompleto||row.NombreCompleto||row.Estudiante||row.estudiante);
  }
  function careerOf(row){return text(row._carrera||row.NombreCarrera||row.nombreCarrera||row.carrera||row.Carrera||"");}
  function currentNdef(row){
    row=row||{};
    var value=row._ndef;
    if(value===undefined||value===null||text(value)===""){
      value=row.Notdef!==undefined?row.Notdef:(row.Ndef!==undefined?row.Ndef:(row.ndef!==undefined?row.ndef:row.notaDefensa));
    }
    if(value===undefined||value===null||text(value)===""){return null;}
    var n=Number(text(value).replace(",","."));
    return Number.isFinite(n)?Math.round(n*100)/100:null;
  }
  function sameNote(a,b){
    if(a==null&&b==null){return true;}
    if(a==null||b==null){return false;}
    return Math.abs(Number(a)-Number(b))<0.005;
  }
  function tokens(value){return normalized(value).split(" ").filter(Boolean);}
  function fingerprint(value){return tokens(value).sort().join("|");}
  function dice(a,b){
    var aa=tokens(a),bb=tokens(b);
    if(!aa.length||!bb.length){return 0;}
    var used={},common=0;
    aa.forEach(function(token){
      var index=bb.findIndex(function(other,i){return !used[i]&&other===token;});
      if(index>=0){used[index]=true;common+=1;}
    });
    return (2*common)/(aa.length+bb.length);
  }
  function levenshtein(a,b){
    a=normalized(a);b=normalized(b);
    if(a===b){return 1;}
    if(!a||!b){return 0;}
    var prev=new Array(b.length+1),curr=new Array(b.length+1);
    for(var j=0;j<=b.length;j++){prev[j]=j;}
    for(var i=1;i<=a.length;i++){
      curr[0]=i;
      for(j=1;j<=b.length;j++){
        curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));
      }
      var tmp=prev;prev=curr;curr=tmp;
    }
    return 1-(prev[b.length]/Math.max(a.length,b.length));
  }
  function nameSimilarity(a,b){
    var na=normalized(a),nb=normalized(b);
    if(!na||!nb){return 0;}
    if(na===nb){return 1;}
    if(fingerprint(a)===fingerprint(b)){return .99;}
    var ta=tokens(a),tb=tokens(b),shorter=ta.length<=tb.length?ta:tb,longer=ta.length<=tb.length?tb:ta;
    var subset=shorter.length>=2&&shorter.every(function(t){return longer.indexOf(t)>=0;});
    var d=dice(a,b),l=levenshtein(a,b);
    var score=Math.max(d*.72+l*.28,l*.62+d*.38);
    if(subset&&shorter.length>=3){score=Math.max(score,.92+(Math.min(shorter.length,5)-3)*.015);}
    return Math.min(1,score);
  }
  function parseNumber(value){
    var n=Number(text(value).replace(",","."));
    return Number.isFinite(n)?n:null;
  }
  function toTen(score,max){
    score=parseNumber(score);max=parseNumber(max);
    if(score==null||max==null||max<=0||score<0||score>max){return null;}
    return Math.round((score/max*10)*100)/100;
  }
  function cleanName(value){
    return text(value).replace(/^\*+|\*+$/g,"").replace(/^Seleccione\s+/i,"").replace(/\[[^\]]*\]\([^)]*\)/g," ").replace(/\s+/g," ").replace(/[|]+$/g,"").trim();
  }
  function extractEmail(block){
    var fixed=String(block||"").replace(/\\@/g,"@");
    var m=fixed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m?normalizeEmail(m[0]):"";
  }
  function extractGrade(block){
    var fixed=String(block||"").replace(/\\\//g,"/");
    var re=/(\d{1,3}(?:[.,]\d{1,2})?)\s*\/\s*(\d{1,3}(?:[.,]\d{1,2})?)/g,m,list=[];
    while((m=re.exec(fixed))!==null){
      var score=parseNumber(m[1]),max=parseNumber(m[2]),ten=toTen(score,max);
      if(ten!=null&&max<=1000){list.push({score:score,max:max,ndef:ten,raw:m[0],index:m.index});}
    }
    return list.length?list[0]:null;
  }
  function previousName(lines,index){
    for(var i=index-1;i>=Math.max(0,index-6);i--){
      var line=cleanName(lines[i]);
      if(!line){continue;}
      if(/@|calific|ocultar|enviado|comentario|archivo|editar|ultima modificacion/i.test(normalized(line))){continue;}
      if(/^\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?$/.test(line)){continue;}
      if(line.split(/\s+/).length>=2&&!/[0-9]/.test(line)){return line;}
    }
    return "";
  }
  function parseBySelected(source){
    var regex=/Seleccione\s+([^|\n\r]{3,140})/gi,m,anchors=[];
    while((m=regex.exec(source))!==null){anchors.push({index:m.index,name:cleanName(m[1])});}
    if(!anchors.length){return [];}
    return anchors.map(function(anchor,index){
      var end=index+1<anchors.length?anchors[index+1].index:source.length;
      var block=source.slice(anchor.index,end),grade=extractGrade(block);
      return {
        rowNumber:index+1,format:"moodle_grading",nombreCompleto:anchor.name,correo:extractEmail(block),
        notaDefensa:grade?grade.ndef:null,rawScore:grade?grade.score:null,rawMax:grade?grade.max:null,
        rawGrade:grade?grade.raw:"",rawText:block,warnings:grade?[]:["No se detectó una calificación X / Y."]
      };
    }).filter(function(row){return row.nombreCompleto||row.correo;});
  }
  function parseByEmail(source){
    var fixed=String(source||"").replace(/\\@/g,"@"),lines=fixed.split(/\r?\n/),entries=[];
    lines.forEach(function(line,index){
      var emails=line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[];
      emails.forEach(function(email){entries.push({line:index,email:normalizeEmail(email)});});
    });
    return entries.map(function(entry,index){
      var end=index+1<entries.length?entries[index+1].line:lines.length;
      var block=lines.slice(entry.line,end).join("\n"),grade=extractGrade(block);
      return {
        rowNumber:index+1,format:"moodle_grading",nombreCompleto:previousName(lines,entry.line),correo:entry.email,
        notaDefensa:grade?grade.ndef:null,rawScore:grade?grade.score:null,rawMax:grade?grade.max:null,
        rawGrade:grade?grade.raw:"",rawText:block,warnings:grade?[]:["No se detectó una calificación X / Y."]
      };
    });
  }
  function parse(input){
    var source=String(input==null?"":input).replace(/\r\n?/g,"\n").replace(/\u00a0/g," ");
    var result={ok:false,format:"",rows:[],errors:[],warnings:[],total:0,rawText:source};
    if(!text(source)){result.errors.push("No hay contenido para analizar.");return result;}
    var rows=parseBySelected(source);
    if(!rows.length){rows=parseByEmail(source);}
    rows=rows.filter(function(row){return row.correo||row.nombreCompleto;});
    if(!rows.length){result.errors.push("No se detectaron estudiantes. Pegue el contenido completo de la tabla de calificaciones de Moodle.");return result;}
    var withGrade=rows.filter(function(row){return row.notaDefensa!=null;}).length;
    if(!withGrade){result.errors.push("Se detectaron estudiantes, pero ninguna calificación con formato X / Y.");}
    if(withGrade<rows.length){result.warnings.push((rows.length-withGrade)+" estudiante(s) no tienen una calificación reconocible.");}
    result.ok=withGrade>0;result.format="moodle_grading";result.rows=rows;result.total=rows.length;
    return result;
  }

  function candidateScore(imported,student){
    var email=normalizeEmail(imported.correo),studentEmail=emailOf(student);
    var name=imported.nombreCompleto,studentName=nameOf(student);
    if(email&&studentEmail&&email===studentEmail){return {score:100,method:"correo",exact:true};}
    if(normalized(name)&&normalized(name)===normalized(studentName)){return {score:99,method:"nombre exacto",exact:true};}
    if(name&&studentName&&fingerprint(name)===fingerprint(studentName)){return {score:98,method:"nombre reordenado",exact:true};}
    var similarity=nameSimilarity(name,studentName);
    var score=Math.round(similarity*100);
    if(email&&studentEmail&&email.split("@")[0]===studentEmail.split("@")[0]){score=Math.max(score,96);}
    return {score:score,method:"nombre aproximado",exact:false};
  }
  function topCandidates(imported,students){
    return (students||[]).map(function(student){
      var s=candidateScore(imported,student);
      return {student:student,score:s.score,method:s.method,exact:s.exact};
    }).sort(function(a,b){return b.score-a.score;}).slice(0,8);
  }
  function chooseMatch(imported,students){
    var ranked=topCandidates(imported,students),first=ranked[0]||null,second=ranked[1]||null;
    if(!first||first.score<78){return {student:null,kind:"unmatched",confidence:first?first.score:0,method:"",candidates:ranked};}
    if(first.exact){
      var sameExact=ranked.filter(function(x){return x.exact&&x.score===first.score;});
      if(sameExact.length>1){return {student:null,kind:"ambiguous",confidence:first.score,method:first.method,candidates:ranked};}
      return {student:first.student,kind:"exact",confidence:first.score,method:first.method,candidates:ranked};
    }
    if(first.score>=90&&(!second||first.score-second.score>=4)){return {student:first.student,kind:"probable",confidence:first.score,method:first.method,candidates:ranked};}
    return {student:null,kind:"ambiguous",confidence:first.score,method:first.method,candidates:ranked};
  }
  function defaultAction(item){
    if(!item.student||item.importConflict||item.duplicate){return "skip";}
    var current=currentNdef(item.student);
    if(item.kind!=="exact"){return "skip";}
    if(current==null){return "load";}
    if(sameNote(current,item.imported.notaDefensa)){return "same";}
    return "keep";
  }
  function importedIdentity(row){return normalizeEmail(row.correo)||fingerprint(row.nombreCompleto)||("row_"+row.rowNumber);}
  function buildItems(parsedRows,students){
    var items=(parsedRows||[]).map(function(imported,index){
      var match=chooseMatch(imported,students);
      var item={
        key:"import_"+index,imported:imported,student:match.student,kind:match.kind,confidence:match.confidence,
        method:match.method,candidates:match.candidates||[],duplicate:false,importConflict:false,duplicateOf:"",
        action:"skip",selected:false,saved:false
      };
      item.action=defaultAction(item);
      item.selected=item.action==="load";
      return item;
    });

    var byImported={};
    items.forEach(function(item){
      var key=importedIdentity(item.imported);
      if(!byImported[key]){byImported[key]=[];}
      byImported[key].push(item);
    });
    Object.keys(byImported).forEach(function(key){
      var group=byImported[key];
      if(group.length<2){return;}
      var grades={};
      group.forEach(function(item){if(item.imported.notaDefensa!=null){grades[String(item.imported.notaDefensa)]=true;}});
      if(Object.keys(grades).length>1){
        group.forEach(function(item){item.importConflict=true;item.kind="conflict";item.action="skip";item.selected=false;});
      }else{
        group.slice(1).forEach(function(item){item.duplicate=true;item.kind="duplicate";item.action="skip";item.selected=false;item.duplicateOf=group[0].key;});
      }
    });

    var byStudent={};
    items.forEach(function(item){
      var id=item.student&&idOf(item.student);
      if(!id||item.duplicate||item.importConflict){return;}
      if(!byStudent[id]){byStudent[id]=[];}
      byStudent[id].push(item);
    });
    Object.keys(byStudent).forEach(function(id){
      var group=byStudent[id];
      if(group.length<2){return;}
      var grades={};
      group.forEach(function(item){grades[String(item.imported.notaDefensa)]=true;});
      if(Object.keys(grades).length>1){
        group.forEach(function(item){item.importConflict=true;item.kind="conflict";item.action="skip";item.selected=false;});
      }else{
        group.slice(1).forEach(function(item){item.duplicate=true;item.kind="duplicate";item.action="skip";item.selected=false;item.duplicateOf=group[0].key;});
      }
    });
    return items;
  }
  function summary(items){
    items=items||[];
    return {
      total:items.length,
      exact:items.filter(function(x){return x.kind==="exact";}).length,
      review:items.filter(function(x){return x.kind==="probable"||x.kind==="ambiguous";}).length,
      conflict:items.filter(function(x){return x.kind==="conflict";}).length,
      duplicate:items.filter(function(x){return x.kind==="duplicate";}).length,
      unmatched:items.filter(function(x){return x.kind==="unmatched";}).length,
      ready:items.filter(function(x){return x.selected&&x.student&&(x.action==="load"||x.action==="replace")&&!x.importConflict&&!x.duplicate;}).length
    };
  }
  function manualAssign(item,student){
    if(!item){return item;}
    item.student=student||null;
    if(!student){item.kind="unmatched";item.confidence=0;item.method="manual";item.action="skip";item.selected=false;return item;}
    item.kind="manual";item.confidence=100;item.method="selección manual";item.importConflict=false;item.duplicate=false;
    var current=currentNdef(student);
    if(current==null){item.action="load";item.selected=true;}
    else if(sameNote(current,item.imported.notaDefensa)){item.action="same";item.selected=false;}
    else{item.action="keep";item.selected=false;}
    return item;
  }
  function changesForSave(items){
    return (items||[]).filter(function(item){
      return item.student&&item.selected&&!item.importConflict&&!item.duplicate&&(item.action==="load"||item.action==="replace")&&item.imported.notaDefensa!=null;
    }).map(function(item){
      return {id:idOf(item.student),ndef:item.imported.notaDefensa,_row:item.student,_bulkImport:true};
    });
  }

  function el(id){return document&&document.getElementById(id);}
  function setMessage(message,kind){
    var box=el("def-bulk-message");
    if(!box){return;}
    box.textContent=message||"";
    box.className="def-bulk-message "+(kind||"");
  }
  function currentPeriod(){
    try{
      var s=window.DefartApp&&window.DefartApp.getState?window.DefartApp.getState():{};
      return text(s.periodId);
    }catch(error){return "";}
  }
  function loadStudents(periodId){
    if(!periodId){return Promise.reject(new Error("Seleccione un período antes de analizar."));}
    if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.getExportRows==="function"){
      return Promise.resolve(window.DefartServiceBridge.getExportRows({periodId:periodId,division:"",career:"",status:"",sede:"",search:"",sortKey:"_nombre",sortDir:"asc"}));
    }
    var s=window.DefartApp&&window.DefartApp.getState?window.DefartApp.getState():{};
    var data=s&&s.data||{};
    return Promise.resolve(Array.isArray(data.exportRows)?data.exportRows:(Array.isArray(data.rows)?data.rows:[]));
  }
  function open(){
    if(!document){return;}
    var modal=el("def-bulk-modal");if(!modal){return;}
    state.opened=true;state.periodId=currentPeriod();
    el("def-bulk-period").textContent=state.periodId||"Sin período seleccionado";
    modal.hidden=false;modal.setAttribute("aria-hidden","false");document.body.classList.add("def-bulk-open");
    window.setTimeout(function(){var area=el("def-bulk-paste");if(area){area.focus();}},30);
    setMessage(state.periodId?"Pegue el contenido completo copiado desde Moodle.":"Seleccione un período en Defensas antes de analizar.",state.periodId?"":"warn");
  }
  function close(){
    if(!document){return;}
    var modal=el("def-bulk-modal");if(!modal){return;}
    modal.hidden=true;modal.setAttribute("aria-hidden","true");document.body.classList.remove("def-bulk-open");state.opened=false;
  }
  function clear(){
    state.sourceText="";state.parsed=null;state.students=[];state.items=[];state.analyzed=false;state.saved=0;state.tab="all";
    if(el("def-bulk-paste"))el("def-bulk-paste").value="";
    render();
    setMessage("Pegue el contenido completo copiado desde Moodle.","");
  }
  function category(item){
    if(item.kind==="exact"||item.kind==="manual"){return "exact";}
    if(item.kind==="probable"||item.kind==="ambiguous"){return "review";}
    if(item.kind==="conflict"||item.kind==="duplicate"){return "conflict";}
    return "unmatched";
  }
  function visibleItems(){return state.tab==="all"?state.items:state.items.filter(function(item){return category(item)===state.tab;});}
  function statusLabel(item){
    if(item.kind==="exact")return "Exacta · "+item.confidence+"%";
    if(item.kind==="manual")return "Manual";
    if(item.kind==="probable")return "Probable · "+item.confidence+"%";
    if(item.kind==="ambiguous")return "Ambigua · "+item.confidence+"%";
    if(item.kind==="conflict")return "Conflicto";
    if(item.kind==="duplicate")return "Duplicado";
    return "No encontrado";
  }
  function actionOptions(item){
    var current=item.student?currentNdef(item.student):null,opts=[];
    if(!item.student||item.importConflict||item.duplicate){return '<option value="skip">No cargar</option>';}
    if(current==null){
      opts.push(["load","Cargar N-DEF"]);
      opts.push(["skip","No cargar"]);
    }else if(sameNote(current,item.imported.notaDefensa)){
      opts.push(["same","Ya es igual"]);
      opts.push(["skip","No cargar"]);
    }else{
      opts.push(["keep","Mantener "+current.toFixed(2)]);
      opts.push(["replace","Reemplazar por "+Number(item.imported.notaDefensa).toFixed(2)]);
      opts.push(["skip","No cargar"]);
    }
    return opts.map(function(opt){return '<option value="'+opt[0]+'" '+(item.action===opt[0]?"selected":"")+'>'+esc(opt[1])+'</option>';}).join("");
  }
  function candidateSelect(item){
    if(item.kind==="exact"&&item.student){
      return '<strong>'+esc(nameOf(item.student))+'</strong><small>'+esc(emailOf(item.student)||careerOf(item.student))+'</small>';
    }
    var seen={},options=['<option value="">Elegir estudiante...</option>'];
    (item.candidates||[]).forEach(function(c){
      var id=idOf(c.student);if(!id||seen[id])return;seen[id]=true;
      options.push('<option value="'+esc(id)+'" '+(item.student&&idOf(item.student)===id?"selected":"")+'>'+esc(nameOf(c.student))+' · '+c.score+'%</option>');
    });
    return '<select class="def-bulk-candidate" data-key="'+esc(item.key)+'">'+options.join("")+'</select>';
  }
  function rowHtml(item){
    var current=item.student?currentNdef(item.student):null;
    var canSelect=item.student&&!item.importConflict&&!item.duplicate&&(item.action==="load"||item.action==="replace");
    return '<tr class="def-bulk-row is-'+esc(category(item))+'">'+
      '<td class="def-bulk-check"><input type="checkbox" data-bulk-select="'+esc(item.key)+'" '+(item.selected?"checked":"")+' '+(!canSelect?"disabled":"")+'></td>'+
      '<td><strong>'+esc(item.imported.nombreCompleto||"Nombre no detectado")+'</strong><small>'+esc(item.imported.correo||"Sin correo")+'</small></td>'+
      '<td>'+candidateSelect(item)+'</td>'+
      '<td class="def-bulk-note">'+(current==null?"—":current.toFixed(2))+'</td>'+
      '<td class="def-bulk-note"><strong>'+esc(item.imported.notaDefensa==null?"—":Number(item.imported.notaDefensa).toFixed(2))+'</strong><small>'+esc(item.imported.rawGrade||"")+'</small></td>'+
      '<td><span class="def-bulk-badge is-'+esc(category(item))+'">'+esc(statusLabel(item))+'</span><small>'+esc(item.method||"")+'</small></td>'+
      '<td><select class="def-bulk-action" data-key="'+esc(item.key)+'">'+actionOptions(item)+'</select></td>'+
    '</tr>';
  }
  function renderSummary(){
    var s=summary(state.items),box=el("def-bulk-summary");if(!box)return;
    box.innerHTML=[
      ["Detectados",s.total,"all"],["Exactos",s.exact,"exact"],["Revisar",s.review,"review"],
      ["Conflictos",s.conflict+s.duplicate,"conflict"],["No encontrados",s.unmatched,"unmatched"],["Listos",s.ready,"ready"]
    ].map(function(x){return '<button type="button" class="def-bulk-stat '+(state.tab===x[2]?"is-active":"")+'" data-bulk-tab="'+x[2]+'" '+(x[2]==="ready"?"disabled":"")+'><span>'+esc(x[0])+'</span><strong>'+x[1]+'</strong></button>';}).join("");
    var apply=el("def-bulk-apply");if(apply){apply.disabled=state.saving||s.ready===0;apply.textContent=s.ready?"Guardar "+s.ready+" nota(s) confirmada(s)":"Guardar notas confirmadas";}
  }
  function render(){
    if(!document)return;
    renderSummary();
    var body=el("def-bulk-results");if(!body)return;
    if(!state.analyzed){body.innerHTML='<div class="def-bulk-empty">Todavía no se han analizado datos.</div>';return;}
    var rows=visibleItems();
    if(!rows.length){body.innerHTML='<div class="def-bulk-empty">No hay registros en esta categoría.</div>';return;}
    body.innerHTML='<div class="def-bulk-table-wrap"><table class="def-bulk-table"><thead><tr><th></th><th>Moodle</th><th>Coincidencia en Defensas</th><th>Actual</th><th>Nueva N-DEF</th><th>Coincidencia</th><th>Acción</th></tr></thead><tbody>'+rows.map(rowHtml).join("")+'</tbody></table></div>';
  }
  function analyze(){
    if(state.saving)return;
    var period=currentPeriod(),source=el("def-bulk-paste")?el("def-bulk-paste").value:"";
    state.periodId=period;state.sourceText=source;
    if(el("def-bulk-period"))el("def-bulk-period").textContent=period||"Sin período seleccionado";
    if(!period){setMessage("Seleccione un período en Defensas antes de analizar.","warn");return;}
    var parsed=parse(source);state.parsed=parsed;
    if(!parsed.ok){state.items=[];state.analyzed=true;render();setMessage(parsed.errors.join(" "),"warn");return;}
    setMessage("Leyendo estudiantes activos del período y cruzando coincidencias...","info");
    loadStudents(period).then(function(students){
      state.students=Array.isArray(students)?students:[];
      state.items=buildItems(parsed.rows,state.students);
      state.analyzed=true;state.tab="all";render();
      var s=summary(state.items);
      setMessage("Cruce terminado: "+s.exact+" exactos, "+s.review+" por revisar, "+(s.conflict+s.duplicate)+" conflictos/duplicados y "+s.unmatched+" no encontrados.","ok");
    }).catch(function(error){state.items=[];state.analyzed=true;render();setMessage(error&&error.message?error.message:String(error),"warn");});
  }
  function findItem(key){return state.items.find(function(item){return item.key===key;})||null;}
  function findStudent(id){return state.students.find(function(student){return idOf(student)===id;})||null;}
  function changeCandidate(select){
    var item=findItem(select.getAttribute("data-key"));if(!item)return;
    manualAssign(item,findStudent(select.value));render();
  }
  function changeAction(select){
    var item=findItem(select.getAttribute("data-key"));if(!item)return;
    item.action=select.value;
    item.selected=item.action==="load"||item.action==="replace";
    render();
  }
  function toggleSelect(input){
    var item=findItem(input.getAttribute("data-bulk-select"));if(!item)return;
    item.selected=!!input.checked;
    if(item.selected&&item.action==="keep")item.action="replace";
    if(item.selected&&item.action==="review")item.action=currentNdef(item.student)==null?"load":"replace";
    if(!item.selected&&(item.action==="load"||item.action==="replace"))item.action="skip";
    render();
  }
  function save(){
    if(state.saving)return;
    var changes=changesForSave(state.items);
    if(!changes.length){setMessage("No hay notas confirmadas para guardar.","warn");return;}
    if(!window.DefartCore||typeof window.DefartCore.saveNotes!=="function"){setMessage("DefartCore.saveNotes no está disponible.","warn");return;}
    state.saving=true;render();setMessage("Guardando "+changes.length+" nota(s) mediante la ruta oficial de Defensas...","info");
    Promise.resolve(window.DefartCore.saveNotes(changes)).then(function(result){
      result=result||{};
      if(result.ok===false){throw new Error(result.message||"No se pudieron guardar las notas.");}
      state.saved=Number(result.saved||changes.length);
      state.items.forEach(function(item){
        if(item.selected&&(item.action==="load"||item.action==="replace")){
          item.saved=true;
          item.selected=false;
          if(item.student){
            item.student._ndef=item.imported.notaDefensa;
            item.student.Notdef=item.imported.notaDefensa;
            item.student.Ndef=item.imported.notaDefensa;
            item.student.ndef=item.imported.notaDefensa;
            item.student.notaDefensa=item.imported.notaDefensa;
          }
          item.action="same";
        }
      });
      try{if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.clear==="function")window.DefartServiceBridge.clear({resetPage:false,keepLast:false});}catch(error){}
      try{if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.refresh==="function")window.DefartServiceBridge.refresh();else if(window.DefartApp&&typeof window.DefartApp.render==="function")window.DefartApp.render();}catch(error2){}
      setMessage(state.saved+" nota(s) guardada(s). N-FIN y estado fueron recalculados; quedan listas para la sincronización habitual con Firebase.","ok");
      render();
    }).catch(function(error){setMessage(error&&error.message?error.message:String(error),"warn");}).finally(function(){state.saving=false;render();});
  }
  function handleClick(event){
    var target=event.target;
    if(target&&target.matches("[data-def-bulk-close]")){close();return;}
    if(target&&target.id==="def-bulk-analyze"){analyze();return;}
    if(target&&target.id==="def-bulk-clear"){clear();return;}
    if(target&&target.id==="def-bulk-apply"){save();return;}
    if(target&&target.hasAttribute("data-bulk-tab")){state.tab=target.getAttribute("data-bulk-tab");render();return;}
  }
  function handleChange(event){
    var target=event.target;
    if(target&&target.classList.contains("def-bulk-candidate"))changeCandidate(target);
    else if(target&&target.classList.contains("def-bulk-action"))changeAction(target);
    else if(target&&target.hasAttribute("data-bulk-select"))toggleSelect(target);
  }
  function bind(){
    if(!document||bind.done)return;bind.done=true;
    var openBtn=el("def-btn-bulk-import");if(openBtn)openBtn.addEventListener("click",open);
    document.addEventListener("click",handleClick);
    document.addEventListener("change",handleChange);
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&state.opened)close();});
    var modal=el("def-bulk-modal");if(modal){modal.addEventListener("click",function(event){if(event.target===modal)close();});}
    render();
  }

  var api={
    version:VERSION,parse:parse,parseBySelected:parseBySelected,parseByEmail:parseByEmail,
    match:function(rows,students){return buildItems(rows,students);},buildItems:buildItems,
    chooseMatch:chooseMatch,topCandidates:topCandidates,nameSimilarity:nameSimilarity,
    normalizeEmail:normalizeEmail,normalizeCedula:normalizeCedula,fingerprint:fingerprint,
    summary:summary,manualAssign:manualAssign,changesForSave:changesForSave,
    open:open,close:close,analyze:analyze,save:save,bind:bind,
    getState:function(){return {periodId:state.periodId,parsed:state.parsed,items:state.items.slice(),summary:summary(state.items)};}
  };
  window.DefartBulkImport=api;
  if(document){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();}
})(window, typeof document!=="undefined"?document:null);
