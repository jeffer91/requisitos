/* =========================================================
Nombre completo: ncomplex.modal.js
Ruta o ubicación: /Ncomplex/ncomplex.modal.js
Función o funciones:
- Abrir y cerrar el popup de cambio de modalidad.
- Mostrar nombre, cédula y modalidad actual del estudiante.
- Cambiar entre examen complexivo y trabajo de titulación sin borrar notas previas.
Con qué se conecta:
- ncomplex.config.js
- ncomplex.state.js
- ncomplex.calculator.js
- ncomplex.table.js
- ncomplex.app.js
========================================================= */
(function(window,document){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var State = window.NcomplexState || {};
  var Calculator = window.NcomplexCalculator || {};
  var current = null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function element(id){
    return document.getElementById(id);
  }

  function recordId(row){
    return State.recordId ? State.recordId(row) : text(row && (row.idEstudiantePeriodo || row.id || row.cedula));
  }

  function studentName(row){
    row = row || {};
    return text(row.Nombres || row.nombres || row.Nombre || row.nombre || row.nombreCompleto);
  }

  function open(row){
    current = row || null;
    if(!current){ return; }

    var modal = element("ncomplex-modality-modal");
    var name = element("ncomplex-modal-student");
    var cedula = element("ncomplex-modal-cedula");
    var currentLabel = element("ncomplex-modal-current");
    var select = element("ncomplex-modal-select");

    if(name){ name.textContent = studentName(current) || "Sin nombre"; }
    if(cedula){ cedula.textContent = text(current.cedula || current.numeroIdentificacion); }
    if(currentLabel){
      currentLabel.textContent = Config.labelModalidad
        ? Config.labelModalidad(current.modalidadTitulacion)
        : text(current.modalidadTitulacion);
    }
    if(select){
      select.value = text(current.modalidadTitulacion) ||
        (Config.modalidades && Config.modalidades.COMPLEXIVO) ||
        "EXAMEN_COMPLEXIVO";
    }

    if(State.patch){ State.patch({ selectedStudentId: recordId(current) }, "modal-open"); }
    if(modal){
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("ncomplex-modal-open");
      window.setTimeout(function(){ if(select){ select.focus(); } }, 0);
    }
  }

  function close(){
    var modal = element("ncomplex-modality-modal");
    if(modal){
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("ncomplex-modal-open");
    current = null;
    if(State.patch){ State.patch({ selectedStudentId: "" }, "modal-close"); }
  }

  function confirm(){
    if(!current){ close(); return; }
    var select = element("ncomplex-modal-select");
    var mode = select ? text(select.value) : "";
    var id = recordId(current);

    var next = Object.assign({}, current, {
      modalidadTitulacion: mode,
      origen: "ncomplex_modalidad",
      updatedAt: new Date().toISOString()
    });
    next = Calculator.recalculate ? Calculator.recalculate(next) : next;

    if(State.updateRecord){ State.updateRecord(id, next, "modality-changed"); }
    close();

    if(window.NcomplexApp && typeof window.NcomplexApp.render === "function"){
      window.NcomplexApp.render();
    }
  }

  function bind(){
    var modal = element("ncomplex-modality-modal");
    if(!modal || modal.__ncomplexBound){ return; }
    modal.__ncomplexBound = true;

    modal.addEventListener("click", function(event){
      if(event.target === modal || event.target.closest("[data-ncomplex-modal-close]")){
        close();
      }
      if(event.target.closest("[data-ncomplex-modal-save]")){
        confirm();
      }
    });

    document.addEventListener("keydown", function(event){
      if(event.key === "Escape" && modal.hidden === false){ close(); }
    });
  }

  window.NcomplexModal = {
    version: "1.0.0-bloque-2",
    open: open,
    close: close,
    confirm: confirm,
    bind: bind
  };
})(window,document);