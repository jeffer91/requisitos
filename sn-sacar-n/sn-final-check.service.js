/* =========================================================
Nombre completo: sn-final-check.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-final-check.service.js
Modulo: Sacar N
Funcion o funciones:
- Ejecutar una verificacion final de dependencias del modulo Sacar N.
- Revisar que existan servicios, botones y APIs necesarias antes de la prueba local.
- Dejar un resultado visible en consola y en window.SN_FINAL_CHECK.
Con que se conecta:
- sn-sacar-n.js
- sn-config.js
- sn-state.service.js
- sn-export-excel.service.js
========================================================= */
(function(window, document){
  "use strict";

  function existe(path){
    try{
      return path.split(".").reduce(function(obj, key){ return obj && obj[key]; }, window) != null;
    }catch(error){ return false; }
  }

  function boton(id){ return !!document.getElementById(id); }

  function run(){
    var checks = [
      { nombre:"SNConfig", ok:existe("SNConfig") },
      { nombre:"SNModels", ok:existe("SNModels") },
      { nombre:"SNState", ok:existe("SNState") },
      { nombre:"SNStore", ok:existe("SNStore") },
      { nombre:"SNQueue", ok:existe("SNQueue") },
      { nombre:"SNEstudiantes", ok:existe("SNEstudiantes") },
      { nombre:"SNSisacadBrowser", ok:existe("SNSisacadBrowser") },
      { nombre:"SNSisacadNavigation", ok:existe("SNSisacadNavigation") },
      { nombre:"SNSisacadExtractor", ok:existe("SNSisacadExtractor") },
      { nombre:"SNReport", ok:existe("SNReport") },
      { nombre:"SNExportExcel", ok:existe("SNExportExcel") },
      { nombre:"SNUIRender", ok:existe("SNUIRender") },
      { nombre:"SNUIEvents", ok:existe("SNUIEvents") },
      { nombre:"Boton cargar estudiantes", ok:boton("snBtnCargarEstudiantes") },
      { nombre:"Boton abrir SISACAD", ok:boton("snBtnAbrirSisacad") },
      { nombre:"Boton ir a Registro", ok:boton("snBtnIrRegistro") },
      { nombre:"Boton prueba visible", ok:boton("snBtnPruebaVisible") },
      { nombre:"Boton continuar automatico", ok:boton("snBtnContinuarAutomatico") },
      { nombre:"Boton pausar", ok:boton("snBtnPausar") },
      { nombre:"Boton continuar", ok:boton("snBtnContinuar") },
      { nombre:"Boton exportar", ok:boton("snBtnExportar") },
      { nombre:"Tabla", ok:boton("snTablaBody") },
      { nombre:"Resumen final", ok:boton("snResumenFinalBody") },
      { nombre:"Panel novedades", ok:boton("snNovedadesPanel") }
    ];

    var fallos = checks.filter(function(item){ return !item.ok; });
    var resultado = {
      ok: fallos.length === 0,
      total: checks.length,
      correctos: checks.length - fallos.length,
      fallos: fallos,
      fecha: new Date().toISOString()
    };

    window.SN_FINAL_CHECK = resultado;
    if(window.console && console.table){ console.table(checks); }
    if(window.console){
      console.log("[Sacar N] Verificacion final", resultado.ok ? "OK" : "REVISAR", resultado);
    }
    return resultado;
  }

  window.SNFinalCheck = { run: run };
})(window, document);
