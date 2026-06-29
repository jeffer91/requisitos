/* =========================================================
Nombre completo: excel-ui.periodo.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.periodo.js
Función o funciones:
- Crear períodos desde la pantalla Carga.
- Actualizar selectores de período desde la misma BaseLocal de BL.
- No manejar selector de carga forzada a Firebase porque BL ya sincroniza.
Con qué se conecta:
- excel-periodos.js
- excel-state.js
========================================================= */
(function(window,document){
  "use strict";

  var booted = false;

  function id(value){
    return document.getElementById(value);
  }

  function selects(){
    return [
      id("excel-cargar-period-select"),
      id("excel-delete-period-select")
    ].filter(Boolean);
  }

  async function refresh(selected){
    var list = window.ExcelPeriodos && typeof window.ExcelPeriodos.listarTodos === "function"
      ? await window.ExcelPeriodos.listarTodos()
      : [];

    selects().forEach(function(selector){
      var current = selected || selector.value || "";
      selector.innerHTML = "";

      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Selecciona un período";
      selector.appendChild(empty);

      list.forEach(function(period){
        var option = document.createElement("option");
        option.value = period.id;
        option.textContent = period.label || period.id;
        if(period.id === current){
          option.selected = true;
        }
        selector.appendChild(option);
      });
    });
  }

  async function create(){
    var period = await window.ExcelPeriodos.crearDesdePartes(
      id("inicioAnio").value,
      id("inicioMes").value,
      id("finAnio").value,
      id("finMes").value
    );
    window.ExcelState.set({periodoId:period.id, periodoLabel:period.label}, "periodo:creado");
    await refresh(period.id);
    alert("Período creado en BaseLocal: " + period.label);
  }

  function boot(){
    if(booted){
      return;
    }
    booted = true;

    var year = new Date().getFullYear();
    if(id("inicioAnio") && !id("inicioAnio").value){
      id("inicioAnio").value = year;
    }
    if(id("finAnio") && !id("finAnio").value){
      id("finAnio").value = year;
    }

    var button = id("excel-add-period-btn");
    if(button){
      button.addEventListener("click", function(){
        create().catch(function(error){
          alert(error.message || error);
        });
      });
    }

    refresh().catch(console.error);

    window.addEventListener("storage", function(event){
      if(event.key === "REQ_BL_SIGNAL_V1" || event.key === "REQ_EXCEL_LOCAL_V1:snapshot"){
        refresh().catch(console.error);
      }
    });

    ["requisitos:bl:snapshot-changed", "requisitos:bl:sync-complete", "baselocal:sync-complete", "baselocal:firebase-pull-finished"].forEach(function(name){
      window.addEventListener(name, function(){
        refresh().catch(console.error);
      });
    });
  }

  window.ExcelUIPeriodo = {
    boot:boot,
    refresh:refresh
  };
})(window,document);
