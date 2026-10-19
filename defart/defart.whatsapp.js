/* Defensas - WhatsApp individual: teléfono oficial de BDLocal por cédula + período. */
(function(window){
  "use strict";
  var VERSION="2.0.0-row-contact",pending=Object.create(null);
  function txt(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
  var states=["Requisitos no cargados","Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def"];
  function eligible(row){return states.indexOf(txt(row&&row._estadoDefensa))>=0;}
  function issue(row){
    var state=txt(row&&row._estadoDefensa);
    if(state==="Sin requisitos"){
      var missing=Array.isArray(row._missingRequirements)?row._missingRequirements.map(txt).filter(Boolean):[];
      return missing.length?"Requisitos pendientes: "+missing.join(", ")+".":"Tiene requisitos de titulación pendientes de cumplimiento.";
    }
    if(state==="Requisitos no cargados")return "Los requisitos de titulación todavía no constan registrados.";
    if(state==="Pendiente Art")return "Está pendiente la calificación de su artículo académico.";
    if(state==="Supletorio Art")return "Su artículo académico requiere la evaluación supletoria correspondiente.";
    if(state==="Pendiente Def")return "Está pendiente el registro de la calificación de su defensa.";
    if(state==="Supletorio Def")return "Su defensa requiere la evaluación supletoria correspondiente.";
    return "";
  }
  function buildMessage(row){
    if(!eligible(row))return "";
    var name=txt(row._nombre||row.nombreCompleto||row.nombre);
    if(!name)return "";
    return [
      "Buen día, "+name+".","",
      "Le informo que su proceso de titulación aún no puede finalizar debido a la siguiente situación:","",
      issue(row),"",
      "Por favor, regularice su situación para continuar con el proceso.","",
      "Mgts Jefferson Villarreal",
      "Coordinador de Titulación y Eficiencia Terminal","ITSQMET"
    ].join("\n");
  }
  function phoneNumber(value){
    var d=txt(value).replace(/\D/g,"");
    if(/^09\d{8}$/.test(d))return "593"+d.slice(1);
    if(/^9\d{8}$/.test(d))return "593"+d;
    if(/^5939\d{8}$/.test(d))return d;
    if(/^59309\d{8}$/.test(d))return "593"+d.slice(4);
    if(/^005939\d{8}$/.test(d))return d.slice(2);
    // Un fijo ecuatoriano (+593 2...) no debe abrirse como celular.
    if(/^593/.test(d))return "";
    if(/^\d{11,15}$/.test(d)&&!/^0/.test(d))return d;
    return "";
  }
  function phoneOf(record){
    // Dar prioridad a contactos oficiales; usar la fila visible solo al final.
    var sources=[record&&record.contacto,record&&record.persona,record&&record.estudiante]
      .concat(record&&Array.isArray(record.contactosOtrosPeriodos)?record.contactosOtrosPeriodos:[])
      .concat([record&&record.fila])
      .filter(function(r){return r&&typeof r==="object";});
    var aliases=["celular","Celular","_celular","_bl2Celular","telefonoMovil",
      "telefono","Telefono","Teléfono","whatsapp","WhatsApp","numeroCelular"];
    for(var i=0;i<sources.length;i++)for(var j=0;j<aliases.length;j++){
      var n=phoneNumber(sources[i][aliases[j]]);
      if(n)return n;
    }
    return "";
  }
  function studentIdentity(row){
    row=row||{};
    // _bl2Id y _cedula pueden contener identificadores internos compuestos.
    // Nunca consultar contactos con un ID de matrícula en lugar de la cédula.
    var candidates=[row.cedula,row.numeroIdentificacion,row.NumeroIdentificacion,
      row._cedula,row._bl2Id],cedula="";
    for(var i=0;i<candidates.length;i++){
      var value=txt(candidates[i]).replace(/[ .-]/g,"");
      if(/^\d{10}$/.test(value)){cedula=value;break;}
      if(/^\d{9}$/.test(value)){cedula="0"+value;break;}
      if(/^[A-Za-z][A-Za-z0-9]{5,14}$/.test(value)){cedula=value;break;}
    }
    return {cedula:cedula,periodoId:txt(row.periodoId||row._periodoId||row.periodId)};
  }
  function waUrl(number,message){return "https://wa.me/"+number+"?text="+encodeURIComponent(message);}
  function openForStudent(row,button){
    row=row||{};
    var message=buildMessage(row);
    if(!message){window.alert("Este estudiante no tiene una situación pendiente para notificar.");return Promise.resolve(false);}
    var id=studentIdentity(row),key=id.cedula+"__"+id.periodoId;
    if(!id.cedula||!id.periodoId){window.alert("Falta la cédula o el período para consultar el celular.");return Promise.resolve(false);}
    if(pending[key])return Promise.resolve(false);
    var connector=window.ConDefart||window.BDLocalConeDefart;
    if(!connector||typeof connector.getStudentContact!=="function"){
      window.alert("No se pudo conectar con los contactos de Base Local.");return Promise.resolve(false);
    }
    // Abrir pestaña durante el clic evita bloqueos cuando termine la consulta asíncrona.
    var tab=window.open("about:blank","_blank");
    if(!tab){window.alert("El navegador bloqueó la ventana de WhatsApp. Permita ventanas emergentes para esta aplicación.");return Promise.resolve(false);}
    try{tab.document.title="Buscando contacto de "+txt(row._nombre);}catch(error){}
    if(button){button.disabled=true;button.textContent="...";}
    pending[key]=true;
    return Promise.resolve().then(function(){
      return connector.getStudentContact(id);
    }).then(function(record){
      var number=phoneOf(Object.assign({},record,{fila:row}));
      if(!number){
        try{tab.close();}catch(error){}
        window.alert("El estudiante "+txt(row._nombre)+" no tiene un celular válido registrado en Base Local.");
        return false;
      }
      try{
        tab.opener=null;
        tab.location.replace(waUrl(number,message));
      }catch(error){
        try{tab.close();}catch(inner){}
        window.alert("No fue posible abrir WhatsApp para "+txt(row._nombre)+".");
        return false;
      }
      return true;
    }).catch(function(error){
      try{tab.close();}catch(inner){}
      window.alert("No se pudo consultar el celular de "+txt(row._nombre)+": "+txt(error&&error.message||error));
      return false;
    }).finally(function(){
      delete pending[key];
      if(button){button.disabled=false;button.textContent="WA";}
    });
  }
  window.DefartWhatsapp={version:VERSION,eligible:eligible,issue:issue,
    buildMessage:buildMessage,phoneNumber:phoneNumber,phoneOf:phoneOf,
    studentIdentity:studentIdentity,waUrl:waUrl,openForStudent:openForStudent};
})(window);
