/* =========================================================
Nombre: defart.correo.js
Función: preparar comunicado formal de titulación pendiente en Outlook.
Fuente: ConDefart.getStudentContact (misma cédula y período que WhatsApp).
No envía correos; únicamente abre el borrador para revisión humana.
========================================================= */
(function(window,document){
  "use strict";
  var VERSION="1.0.0-outlook-pendientes";
  var OUTLOOK_URL="https://outlook.office.com/mail/deeplink/compose";
  var pending=Object.create(null);

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function numberOrNull(value){
    if(value===null||value===undefined||text(value)==="")return null;
    var n=Number(String(value).replace(",","."));
    return Number.isFinite(n)?n:null;
  }
  function note(row,keys){
    row=row||{};
    for(var i=0;i<keys.length;i++){
      if(row[keys[i]]!==undefined&&row[keys[i]]!==null&&text(row[keys[i]])!=="")return numberOrNull(row[keys[i]]);
    }
    return null;
  }
  function academicSituation(row){
    row=row||{};
    var article=note(row,["_nart","Notart","Nart","notaArticulo"]);
    var defense=note(row,["_ndef","Notdef","Ndef","notaDefensa"]);
    if(article===null)return "Se encuentra pendiente el registro o la aprobación de su artículo académico. La defensa oral solo podrá continuar cuando corresponda según los requisitos institucionales.";
    if(article<7)return "El artículo académico no registra una nota aprobatoria. Debe regularizar la evaluación correspondiente, incluida la instancia supletoria cuando aplique, antes de continuar con la defensa oral.";
    if(defense===null)return "El artículo académico registra una nota aprobatoria; sin embargo, está pendiente la sustentación oral y/o el registro de la calificación de su defensa.";
    if(defense<7)return "El artículo académico registra una nota aprobatoria, pero su defensa oral no alcanza la nota mínima requerida. Debe gestionar la evaluación supletoria o segunda defensa correspondiente.";
    return "";
  }
  function eligible(row){
    return text(row&&row._estadoDefensa)!=="Completo"&&!!academicSituation(row);
  }
  function buildMessage(row){
    if(!eligible(row))return null;
    var name=text(row._nombre||row.nombreCompleto||row.nombre);
    if(!name)return null;
    return {
      subject:"Notificación formal: proceso de titulación pendiente – ITSQMET",
      body:[
        "Estimado/a estudiante "+name+":","",
        "Reciba un cordial saludo.","",
        "La Unidad de Titulación y Eficiencia Terminal del Instituto Superior Tecnológico Quito Metropolitano (ITSQMET) le informa que, de acuerdo con los registros académicos disponibles, su proceso de titulación aún no se encuentra concluido. En consecuencia, no consta completada la etapa académica requerida para su graduación.","",
        "Situación identificada:","",
        academicSituation(row),"",
        "Solicitamos que se comunique a la brevedad al 0984082332 para revisar su situación y recibir las orientaciones necesarias para continuar y regularizar su proceso de titulación.","",
        "Este comunicado tiene carácter informativo y deberá contrastarse con los registros académicos institucionales si identifica alguna inconsistencia.","",
        "Atentamente,","",
        "Mgs. Jefferson Villarreal",
        "Coordinador de Titulación y Eficiencia Terminal",
        "ITSQMET"
      ].join("\n")
    };
  }
  function normalizeEmail(value){
    var raw=text(value).replace(/^mailto:/i,"");
    var match=raw.match(/^([^<>\s,;]+@[^<>\s,;]+)$/);
    if(!match)return "";
    var mail=match[1];
    // Impedir salto de línea, inyección de destinatarios y direcciones mal formadas.
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(mail)?mail:"";
  }
  function firstEmail(record,names){
    for(var i=0;i<names.length;i++){
      var email=normalizeEmail(record&&record[names[i]]);
      if(email)return email;
    }
    return "";
  }
  function addresses(record,row){
    record=record||{};
    var sources=(Array.isArray(record.contactosMismoPeriodo)?record.contactosMismoPeriodo:[])
      .concat([record.contacto,record.persona,record.estudiante])
      .concat(Array.isArray(record.contactosOtrosPeriodos)?record.contactosOtrosPeriodos:[])
      .concat([row])
      .filter(function(item){return item&&typeof item==="object";});
    var personalNames=["correoPersonal","CorreoPersonal","emailPersonal","EmailPersonal","_correoPersonal","_bl2CorreoPersonal"];
    var institutionalNames=["correoInstitucional","CorreoInstitucional","emailInstitucional","EmailInstitucional","_correoInstitucional","_bl2CorreoInstitucional"];
    var generalNames=["correoElectronico","CorreoElectronico","correo","Correo","email","Email"];
    var personal="",institutional="",general="";
    sources.forEach(function(source){
      if(!personal)personal=firstEmail(source,personalNames);
      if(!institutional)institutional=firstEmail(source,institutionalNames);
      if(!general)general=firstEmail(source,generalNames);
    });
    if(!personal&&!institutional)personal=general;
    var unique=Object.create(null),to=[];
    [personal,institutional].forEach(function(address){
      var key=address.toLowerCase();
      if(address&&!unique[key]){unique[key]=true;to.push(address);}
    });
    return to;
  }
  function studentIdentity(row){
    row=row||{};
    var values=[row.cedula,row.numeroIdentificacion,row.NumeroIdentificacion,row._cedula,row._bl2Id],cedula="";
    for(var i=0;i<values.length;i++){
      var v=text(values[i]).replace(/[ .-]/g,"");
      if(/^\d{10}$/.test(v)){cedula=v;break;}
      if(/^\d{9}$/.test(v)){cedula="0"+v;break;}
    }
    return {cedula:cedula,periodoId:text(row.periodoId||row._periodoId||row.periodId)};
  }
  function outlookUrl(recipients,message){
    if(!recipients.length)throw new Error("El estudiante no tiene un correo personal ni institucional válido registrado.");
    var url=OUTLOOK_URL+"?to="+encodeURIComponent(recipients.join(";"))+
      "&subject="+encodeURIComponent(message.subject)+
      "&body="+encodeURIComponent(message.body);
    if(url.length>120000)throw new Error("El comunicado es demasiado extenso para Outlook.");
    return url;
  }
  function electronApi(){
    try{
      if(window.top&&window.top.electronAPI&&typeof window.top.electronAPI.openExternal==="function")return window.top.electronAPI;
    }catch(error){}
    try{
      if(window.electronAPI&&typeof window.electronAPI.openExternal==="function")return window.electronAPI;
    }catch(error){}
    return null;
  }
  function runningInElectron(){
    try{if(window.top&&window.top.document&&window.top.document.documentElement.getAttribute("data-runtime")==="electron")return true;}catch(error){}
    try{if(document.documentElement.getAttribute("data-runtime")==="electron")return true;}catch(error){}
    return /Electron\//i.test(String(window.navigator&&window.navigator.userAgent||""));
  }
  function closeTab(tab){if(tab){try{tab.close();}catch(error){}}}
  function openOutlook(url,api,tab){
    if(api){
      return Promise.resolve().then(function(){return api.openExternal(url);}).then(function(result){
        if(result===true||(result&&result.ok===true&&result.opened!==false))return true;
        throw new Error(text(result&&(result.error||result.message))||"No se pudo abrir Outlook.");
      });
    }
    if(!tab)return Promise.reject(new Error("No se pudo preparar Outlook en el navegador."));
    try{tab.opener=null;tab.location.replace(url);return Promise.resolve(true);}
    catch(error){return Promise.reject(error);}
  }
  function openForStudent(row,button){
    row=row||{};
    var draft=buildMessage(row);
    if(!draft){window.alert("No se encontró una situación pendiente de artículo o defensa para este estudiante.");return Promise.resolve(false);}
    var identity=studentIdentity(row);
    if(!identity.cedula||!identity.periodoId){window.alert("Falta la cédula o el período para consultar los correos.");return Promise.resolve(false);}
    var key=identity.cedula+"__"+identity.periodoId;
    if(pending[key])return Promise.resolve(false);
    var connector=window.ConDefart||window.BDLocalConeDefart;
    if(!connector||typeof connector.getStudentContact!=="function"){
      window.alert("No está disponible la consulta de contactos de Base Local.");return Promise.resolve(false);
    }
    var api=electronApi(),tab=null;
    if(!api&&runningInElectron()){
      window.alert("Requisitos no tiene disponible la conexión con Outlook externo de Windows.");
      return Promise.resolve(false);
    }
    // Únicamente en navegador web: reservar pestaña durante el clic para evitar el bloqueo de popups.
    if(!api){
      tab=window.open("about:blank","_blank");
      if(!tab){window.alert("Habilite las ventanas emergentes para abrir Outlook.");return Promise.resolve(false);}
    }
    if(button){button.disabled=true;button.textContent="...";}
    pending[key]=true;
    return Promise.resolve().then(function(){return connector.getStudentContact(identity);})
      .then(function(contact){
        var recipients=addresses(contact,row);
        if(!recipients.length){
          closeTab(tab);
          window.alert("El estudiante "+text(row._nombre)+" no tiene correo personal ni institucional válido registrado.");
          return false;
        }
        var url=outlookUrl(recipients,draft);
        return openOutlook(url,api,tab).catch(function(error){
          closeTab(tab);
          window.alert("No se pudo preparar Outlook para "+text(row._nombre)+": "+text(error&&error.message||error));
          return false;
        });
      }).catch(function(error){
        closeTab(tab);
        window.alert("No se pudieron consultar los correos de "+text(row._nombre)+": "+text(error&&error.message||error));
        return false;
      }).finally(function(){
        delete pending[key];
        if(button){button.disabled=false;button.textContent="C";}
      });
  }
  window.DefartCorreo=Object.freeze({
    version:VERSION,eligible:eligible,academicSituation:academicSituation,buildMessage:buildMessage,
    normalizeEmail:normalizeEmail,addresses:addresses,studentIdentity:studentIdentity,
    outlookUrl:outlookUrl,openForStudent:openForStudent
  });
})(window,document);
