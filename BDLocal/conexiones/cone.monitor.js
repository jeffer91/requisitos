/* =========================================================
Nombre completo: cone.monitor.js
Ruta: /BDLocal/conexiones/cone.monitor.js
Función:
- Probar la comunicación real de cada pantalla.
- Comparar conteos y revisión con la caché central.
- Detectar conectores ausentes, datos vacíos y requisitos huérfanos.
- Mostrar, copiar y descargar el diagnóstico.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0";

  var STYLE_ID=
    "bdlocal-connections-monitor-style";

  var state={
    running:false,
    container:null,
    lastReport:null,
    timer:null,
    unsubscribe:null
  };

  function C(){
    return (
      window.BDLocalConeContract||
      null
    );
  }

  function R(){
    return (
      window.BDLocalConeRegistry||
      null
    );
  }

  function Client(){
    return (
      window.BDLocalConnectionClient||
      null
    );
  }

  function text(value){
    return (
      C() &&
      C().text
    )
      ? C().text(value)
      : String(
          value==null
            ? ""
            : value
        ).trim();
  }

  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function array(value){
    return Array.isArray(value)
      ? value
      : [];
  }

  function object(value){
    return (
      value &&
      typeof value==="object" &&
      !Array.isArray(value)
    )
      ? value
      : {};
  }

  function clone(value){
    try{
      return (
        C() &&
        C().clone
      )
        ? C().clone(value)
        : JSON.parse(
            JSON.stringify(value)
          );
    }catch(error){
      return value;
    }
  }

  function nowISO(){
    return new Date()
      .toISOString();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]+/g,
        ""
      );
  }

  function digits(value){
    return text(value)
      .replace(
        /\D+/g,
        ""
      );
  }

  function arrays(response){
    var data=
      object(
        response &&
        response.data
      );

    return {
      periods:array(
        data.periods||
        data.periodos
      ),

      students:array(
        data.students||
        data.estudiantes||
        data.rows||
        data.filas
      ),

      requirements:array(
        data.requirements||
        data.requisitos
      ),

      contacts:array(
        data.contacts||
        data.contactos
      ),

      grades:array(
        data.grades||
        data.notes||
        data.notas
      )
    };
  }

  function counts(response){
    var data=
      arrays(response);

    return {
      periods:
        data.periods.length,

      students:
        data.students.length,

      requirements:
        data.requirements.length,

      contacts:
        data.contacts.length,

      grades:
        data.grades.length
    };
  }

  function relationKey(row){
    row=object(row);

    var cedula=
      digits(
        row.cedula||
        row.numeroIdentificacion||
        row.identificacion||
        row.documento||
        row._cedula
      );

    var periodo=
      norm(
        row.periodoId||
        row.periodId||
        row._bl2PeriodoId||
        row.periodo||
        row.Periodo
      );

    return cedula
      ? (
          cedula+
          "__"+
          periodo
        )
      : "";
  }

  function integrity(response){
    var data=
      arrays(response);

    var students=
      Object.create(null);

    var duplicates=
      Object.create(null);

    var missing=0;
    var orphans=0;

    data.students
      .forEach(function(row){
        var key=
          relationKey(row);

        if(!key){
          missing+=1;
          return;
        }

        if(students[key]){
          duplicates[key]=true;
        }

        students[key]=true;
      });

    data.requirements
      .forEach(function(row){
        var key=
          relationKey(row);

        if(
          !key ||
          !students[key]
        ){
          orphans+=1;
        }
      });

    return {
      studentsWithoutIdentity:
        missing,

      duplicateStudentRelations:
        Object.keys(
          duplicates
        ).length,

      orphanRequirements:
        orphans
    };
  }

  function issue(
    level,
    code,
    message,
    detail
  ){
    return {
      level:level,
      code:code,
      message:message,
      detail:detail||null
    };
  }

  function evaluate(
    definition,
    response,
    status,
    duration
  ){
    definition=
      object(definition);

    response=
      object(response);

    status=
      object(status);

    var received=
      counts(response);

    var central=
      object(status.cache);

    var quality=
      integrity(response);

    var issues=[];

    var revision=
      Number(
        response.revision||
        response.meta &&
        response.meta.revision||
        0
      );

    var centralRevision=
      Number(
        central.revision||0
      );

    if(
      !status.connectorLoaded
    ){
      issues.push(
        issue(
          "error",
          "CONNECTOR_NOT_LOADED",
          "El conector "+
          text(definition.global)+
          " no está cargado."
        )
      );
    }

    if(
      response.ok===false
    ){
      issues.push(
        issue(
          "error",
          "READ_FAILED",

          text(
            response.error &&
            response.error.message
          )||
          "La lectura del conector falló."
        )
      );
    }

    if(
      Number(
        central.students||0
      )>0 &&
      received.students===0
    ){
      issues.push(
        issue(
          "error",
          "STUDENTS_NOT_DELIVERED",
          "La caché central tiene estudiantes, pero la pantalla recibió cero."
        )
      );
    }

    if(
      Number(
        central.requirements||0
      )>0 &&
      received.requirements===0
    ){
      issues.push(
        issue(
          "error",
          "REQUIREMENTS_NOT_DELIVERED",
          "La caché central tiene requisitos, pero la pantalla recibió cero."
        )
      );
    }

    if(
      centralRevision>0 &&
      revision>0 &&
      revision<centralRevision
    ){
      issues.push(
        issue(
          "warning",
          "OUTDATED_REVISION",
          "La pantalla utiliza una revisión anterior de la caché."
        )
      );
    }

    if(
      quality.studentsWithoutIdentity>
      0
    ){
      issues.push(
        issue(
          "error",
          "STUDENTS_WITHOUT_KEY",
          "Hay estudiantes sin cédula o período para relacionar las tablas.",
          quality.studentsWithoutIdentity
        )
      );
    }

    if(
      quality.duplicateStudentRelations>
      0
    ){
      issues.push(
        issue(
          "warning",
          "DUPLICATE_RELATIONS",
          "Hay relaciones repetidas de cédula y período.",
          quality.duplicateStudentRelations
        )
      );
    }

    if(
      quality.orphanRequirements>
      0
    ){
      issues.push(
        issue(
          "error",
          "ORPHAN_REQUIREMENTS",
          "Hay requisitos sin estudiante relacionado en el mismo período.",
          quality.orphanRequirements
        )
      );
    }

    var level=
      issues.some(
        function(item){
          return (
            item.level===
            "error"
          );
        }
      )
        ? "error"
        : issues.length
          ? "warning"
          : "ok";

    return {
      ok:
        level!=="error",

      level:level,
      screen:definition.id,
      label:definition.label,

      connector:
        definition.global,

      connectorFile:
        definition.file,

      connectorLoaded:
        !!status.connectorLoaded,

      revision:revision,

      centralRevision:
        centralRevision,

      counts:received,

      centralCounts:{
        periods:Number(
          central.periods||0
        ),

        students:Number(
          central.students||0
        ),

        requirements:Number(
          central.requirements||0
        )
      },

      integrity:quality,

      tables:
        array(
          definition.tables
        ),

      source:text(
        response.meta &&
        response.meta.source||
        response.source
      ),

      fallbackUsed:
        !!(
          response.meta &&
          response.meta.fallbackUsed
        ),

      durationMs:
        Number(duration||0),

      issues:issues,
      testedAt:nowISO()
    };
  }

  function diagnoseScreen(
    screen,
    options
  ){
    options=options||{};

    var definition=
      R() &&
      R().get
        ? R().get(screen)
        : null;

    var started=
      Date.now();

    if(!definition){
      return Promise.resolve({
        ok:false,
        level:"error",
        screen:text(screen),
        label:text(screen),
        connector:"",
        connectorLoaded:false,
        revision:0,
        centralRevision:0,

        counts:{
          periods:0,
          students:0,
          requirements:0,
          contacts:0,
          grades:0
        },

        centralCounts:{
          periods:0,
          students:0,
          requirements:0
        },

        integrity:{
          studentsWithoutIdentity:0,
          duplicateStudentRelations:0,
          orphanRequirements:0
        },

        tables:[],
        source:"",
        fallbackUsed:false,
        durationMs:0,

        issues:[
          issue(
            "error",
            "SCREEN_NOT_REGISTERED",
            "La pantalla no está registrada."
          )
        ],

        testedAt:nowISO()
      });
    }

    if(
      !Client() ||
      typeof Client().read!==
      "function"
    ){
      return Promise.resolve(
        evaluate(
          definition,

          {
            ok:false,
            data:{},

            error:{
              message:
                "BDLocalConnectionClient no está disponible."
            }
          },

          {
            connectorLoaded:false,
            cache:{}
          },

          Date.now()-started
        )
      );
    }

    return Client()
      .read(
        definition.id,

        Object.assign(
          {
            matricula:""
          },

          object(
            options.filters
          )
        )
      )

      .then(function(response){
        return evaluate(
          definition,
          response,
          Client().status(
            definition.id
          ),
          Date.now()-started
        );
      })

      .catch(function(error){
        return evaluate(
          definition,

          {
            ok:false,
            data:{},

            error:{
              message:text(
                error.message||
                error
              )
            }
          },

          Client().status(
            definition.id
          ),

          Date.now()-started
        );
      });
  }

  function run(options){
    options=options||{};

    if(state.running){
      return Promise.resolve(
        state.lastReport||
        {
          ok:false,
          running:true,
          screens:[]
        }
      );
    }

    state.running=true;
    renderLoading();

    var definitions=
      R() &&
      R().list
        ? R().list()
        : [];

    if(
      array(
        options.screens
      ).length
    ){
      definitions=
        definitions.filter(
          function(item){
            return (
              options.screens
                .indexOf(
                  item.id
                )>=0
            );
          }
        );
    }

    var results=[];
    var started=Date.now();

    var chain=
      Promise.resolve();

    definitions
      .forEach(function(item){
        chain=chain.then(
          function(){
            return diagnoseScreen(
              item.id,
              options
            ).then(function(result){
              results.push(result);

              renderProgress(
                results.length,
                definitions.length
              );
            });
          }
        );
      });

    return chain
      .then(function(){
        var level=
          results.some(
            function(item){
              return (
                item.level===
                "error"
              );
            }
          )
            ? "error"
            : results.some(
                function(item){
                  return (
                    item.level===
                    "warning"
                  );
                }
              )
              ? "warning"
              : "ok";

        var report={
          ok:
            level!=="error",

          level:level,
          version:VERSION,
          generatedAt:nowISO(),

          durationMs:
            Date.now()-started,

          summary:{
            total:
              results.length,

            ok:
              results.filter(
                function(item){
                  return (
                    item.level===
                    "ok"
                  );
                }
              ).length,

            warning:
              results.filter(
                function(item){
                  return (
                    item.level===
                    "warning"
                  );
                }
              ).length,

            error:
              results.filter(
                function(item){
                  return (
                    item.level===
                    "error"
                  );
                }
              ).length
          },

          central:
            Client() &&
            Client().status
              ? Client().status("")
              : null,

          screens:results
        };

        state.running=false;
        state.lastReport=report;

        render(report);

        if(
          C() &&
          C().dispatch
        ){
          C().dispatch(
            C().EVENTS
              .MONITOR_UPDATED,

            clone(report)
          );
        }

        return report;
      })

      .catch(function(error){
        state.running=false;

        var report={
          ok:false,
          level:"error",
          version:VERSION,
          generatedAt:nowISO(),

          error:{
            message:text(
              error.message||
              error
            )
          },

          summary:{
            total:results.length,
            ok:0,
            warning:0,
            error:1
          },

          screens:results
        };

        state.lastReport=report;
        render(report);

        return report;
      });
  }

  function injectStyle(){
    if(
      document.getElementById(
        STYLE_ID
      )
    ){
      return;
    }

    var style=
      document.createElement(
        "style"
      );

    style.id=STYLE_ID;

    style.textContent=[
      ".bdlc-monitor{font-family:Arial,sans-serif;color:#172033;background:#fff;border:1px solid #dce3ef;border-radius:16px;overflow:hidden}",
      ".bdlc-head{display:flex;justify-content:space-between;gap:16px;padding:18px 20px;background:#f7f9fc;border-bottom:1px solid #e5eaf2}",
      ".bdlc-head h2{margin:0 0 4px;font-size:18px;color:#102a56}.bdlc-head p{margin:0;color:#60708a;font-size:13px}",
      ".bdlc-actions{display:flex;gap:8px;flex-wrap:wrap}.bdlc-btn{border:1px solid #cbd5e1;background:#fff;color:#17345f;border-radius:9px;padding:8px 11px;font-weight:700;cursor:pointer}",
      ".bdlc-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 20px}.bdlc-kpi{border:1px solid #e5eaf2;border-radius:12px;padding:12px}.bdlc-kpi span{display:block;color:#64748b;font-size:12px}.bdlc-kpi strong{font-size:22px;color:#102a56}",
      ".bdlc-wrap{overflow:auto;padding:0 20px 20px}.bdlc-table{width:100%;border-collapse:collapse;min-width:900px}.bdlc-table th,.bdlc-table td{text-align:left;padding:10px;border-bottom:1px solid #e8edf4;font-size:13px;vertical-align:top}.bdlc-table th{background:#f8fafc;color:#526178}",
      ".bdlc-badge{display:inline-block;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;text-transform:uppercase}.bdlc-badge.ok{background:#dcfce7;color:#166534}.bdlc-badge.warning{background:#fef3c7;color:#92400e}.bdlc-badge.error{background:#fee2e2;color:#991b1b}",
      ".bdlc-issues{margin:0;padding-left:16px}.bdlc-empty,.bdlc-progress{padding:22px 20px;color:#64748b}.bdlc-bar{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:8px}.bdlc-bar span{display:block;height:100%;background:#1d4ed8}",
      "@media(max-width:760px){.bdlc-head{flex-direction:column}.bdlc-summary{grid-template-columns:repeat(2,1fr)}}"
    ].join("");

    document.head
      .appendChild(style);
  }

  function badge(level){
    var labels={
      ok:"Correcto",
      warning:"Revisar",
      error:"Error"
    };

    return (
      '<span class="bdlc-badge '+
      esc(level)+
      '">'+
      esc(
        labels[level]||
        level
      )+
      "</span>"
    );
  }

  function issues(items){
    if(
      !array(items).length
    ){
      return "Sin novedades.";
    }

    return (
      '<ul class="bdlc-issues">'+
      items.map(
        function(item){
          return (
            "<li>"+
            esc(item.message)+
            "</li>"
          );
        }
      ).join("")+
      "</ul>"
    );
  }

  function html(report){
    report=object(report);

    var summary=
      object(report.summary);

    var screens=
      array(report.screens);

    return (
      '<section class="bdlc-monitor">'+

      '<header class="bdlc-head">'+
      '<div>'+
      '<h2>Comunicación con pantallas</h2>'+
      '<p>Prueba real de los conectores contra la caché central.</p>'+
      '</div>'+

      '<div class="bdlc-actions">'+
      '<button class="bdlc-btn" data-bdlc="run" type="button">Probar</button>'+
      '<button class="bdlc-btn" data-bdlc="copy" type="button">Copiar</button>'+
      '<button class="bdlc-btn" data-bdlc="download" type="button">Descargar JSON</button>'+
      '</div>'+
      '</header>'+

      '<div class="bdlc-summary">'+

      '<article class="bdlc-kpi">'+
      '<span>Pantallas</span>'+
      '<strong>'+
      esc(summary.total||0)+
      '</strong>'+
      '</article>'+

      '<article class="bdlc-kpi">'+
      '<span>Correctas</span>'+
      '<strong>'+
      esc(summary.ok||0)+
      '</strong>'+
      '</article>'+

      '<article class="bdlc-kpi">'+
      '<span>Por revisar</span>'+
      '<strong>'+
      esc(summary.warning||0)+
      '</strong>'+
      '</article>'+

      '<article class="bdlc-kpi">'+
      '<span>Con error</span>'+
      '<strong>'+
      esc(summary.error||0)+
      '</strong>'+
      '</article>'+

      '</div>'+

      (
        screens.length
          ? (
              '<div class="bdlc-wrap">'+
              '<table class="bdlc-table">'+
              '<thead>'+
              '<tr>'+
              '<th>Pantalla</th>'+
              '<th>Conector</th>'+
              '<th>Estado</th>'+
              '<th>Revisión</th>'+
              '<th>Estudiantes<br><small>pantalla / central</small></th>'+
              '<th>Requisitos<br><small>pantalla / central</small></th>'+
              '<th>Huérfanos</th>'+
              '<th>Tiempo</th>'+
              '<th>Detalle</th>'+
              '</tr>'+
              '</thead>'+
              '<tbody>'+

              screens.map(
                function(item){
                  return (
                    "<tr>"+

                    "<td>"+
                    "<strong>"+
                    esc(item.label)+
                    "</strong>"+
                    "<br>"+
                    "<small>"+
                    esc(item.screen)+
                    "</small>"+
                    "</td>"+

                    "<td>"+
                    "<code>"+
                    esc(item.connector)+
                    "</code>"+
                    "</td>"+

                    "<td>"+
                    badge(item.level)+
                    "</td>"+

                    "<td>"+
                    esc(item.revision)+
                    " / "+
                    esc(item.centralRevision)+
                    "</td>"+

                    "<td>"+
                    esc(item.counts.students)+
                    " / "+
                    esc(item.centralCounts.students)+
                    "</td>"+

                    "<td>"+
                    esc(item.counts.requirements)+
                    " / "+
                    esc(item.centralCounts.requirements)+
                    "</td>"+

                    "<td>"+
                    esc(
                      item.integrity
                        .orphanRequirements
                    )+
                    "</td>"+

                    "<td>"+
                    esc(item.durationMs)+
                    " ms"+
                    "</td>"+

                    "<td>"+
                    issues(item.issues)+
                    "</td>"+

                    "</tr>"
                  );
                }
              ).join("")+

              '</tbody>'+
              '</table>'+
              '</div>'
            )
          : (
              '<div class="bdlc-empty">'+
              'Todavía no se ha ejecutado la prueba.'+
              '</div>'
            )
      )+

      "</section>"
    );
  }

  function bindActions(){
    if(!state.container){
      return;
    }

    Array.prototype
      .forEach.call(
        state.container
          .querySelectorAll(
            "[data-bdlc]"
          ),

        function(button){
          button.addEventListener(
            "click",
            function(){
              var action=
                button.getAttribute(
                  "data-bdlc"
                );

              if(action==="run"){
                run();
              }else if(
                action==="copy"
              ){
                copyReport();
              }else{
                downloadReport();
              }
            }
          );
        }
      );
  }

  function render(report){
    if(!state.container){
      return report;
    }

    injectStyle();

    state.container.innerHTML=
      html(
        report||
        state.lastReport||
        {}
      );

    bindActions();

    return report;
  }

  function renderLoading(){
    if(!state.container){
      return;
    }

    injectStyle();

    state.container.innerHTML=
      '<section class="bdlc-monitor">'+
      '<div class="bdlc-progress">'+
      'Preparando conectores…'+
      '<div class="bdlc-bar">'+
      '<span style="width:5%"></span>'+
      '</div>'+
      '</div>'+
      '</section>';
  }

  function renderProgress(
    done,
    total
  ){
    if(!state.container){
      return;
    }

    var percent=
      total
        ? Math.round(
            done/total*100
          )
        : 0;

    state.container.innerHTML=
      '<section class="bdlc-monitor">'+
      '<div class="bdlc-progress">'+
      'Pantallas revisadas: '+
      esc(done)+
      ' de '+
      esc(total)+
      '<div class="bdlc-bar">'+
      '<span style="width:'+
      esc(percent)+
      '%"></span>'+
      '</div>'+
      '</div>'+
      '</section>';
  }

  function findContainer(target){
    if(
      target &&
      target.nodeType===1
    ){
      return target;
    }

    if(
      typeof target===
      "string"
    ){
      return document
        .querySelector(target);
    }

    return (
      document.getElementById(
        "bdlocal-connections-monitor"
      )||
      document.querySelector(
        "[data-bdl-connections-monitor]"
      )
    );
  }

  function schedule(){
    if(state.timer){
      window.clearTimeout(
        state.timer
      );
    }

    state.timer=
      window.setTimeout(
        function(){
          state.timer=null;
          run();
        },
        350
      );
  }

  function mount(
    target,
    options
  ){
    options=options||{};

    state.container=
      findContainer(target);

    if(!state.container){
      return false;
    }

    render({
      summary:{
        total:0,
        ok:0,
        warning:0,
        error:0
      },

      screens:[]
    });

    if(
      !state.unsubscribe &&
      Client() &&
      Client().onUpdated
    ){
      state.unsubscribe=
        Client().onUpdated(
          function(){
            if(
              options.autoRefresh!==
              false
            ){
              schedule();
            }
          }
        );
    }

    if(
      options.autoRun!==
      false
    ){
      run(options);
    }

    return true;
  }

  function reportText(){
    return JSON.stringify(
      state.lastReport||
      {
        ok:false,
        message:
          "Todavía no se ha ejecutado el diagnóstico."
      },
      null,
      2
    );
  }

  function copyReport(){
    var value=
      reportText();

    if(
      navigator.clipboard &&
      navigator.clipboard.writeText
    ){
      return navigator.clipboard
        .writeText(value)
        .then(function(){
          return true;
        });
    }

    var area=
      document.createElement(
        "textarea"
      );

    area.value=value;
    area.style.position="fixed";
    area.style.opacity="0";

    document.body
      .appendChild(area);

    area.select();

    var ok=false;

    try{
      ok=document.execCommand(
        "copy"
      );
    }catch(error){}

    area.remove();

    return Promise.resolve(ok);
  }

  function downloadReport(){
    var blob=
      new Blob(
        [reportText()],
        {
          type:
            "application/json;charset=utf-8"
        }
      );

    var url=
      URL.createObjectURL(blob);

    var link=
      document.createElement("a");

    link.href=url;

    link.download=
      "diagnostico-comunicacion-bdlocal-"+
      nowISO()
        .replace(
          /[:.]/g,
          "-"
        )+
      ".json";

    document.body
      .appendChild(link);

    link.click();
    link.remove();

    window.setTimeout(
      function(){
        URL.revokeObjectURL(url);
      },
      1000
    );

    return true;
  }

  var api={
    version:VERSION,

    source:
      "BDLocal/conexiones/cone.monitor.js",

    mount:mount,
    run:run,

    diagnoseScreen:
      diagnoseScreen,

    render:render,

    copyReport:
      copyReport,

    downloadReport:
      downloadReport,

    getReport:function(){
      return clone(
        state.lastReport
      );
    },

    status:function(){
      return {
        ok:true,
        version:VERSION,
        running:state.running,
        mounted:
          !!state.container,

        hasReport:
          !!state.lastReport
      };
    }
  };

  window.BDLocalConnectionMonitor=
    api;

  function autoMount(){
    var container=
      findContainer();

    if(container){
      mount(
        container,
        {
          autoRun:true,
          autoRefresh:true
        }
      );
    }
  }

  if(
    document.readyState===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      autoMount,
      {
        once:true
      }
    );
  }else{
    autoMount();
  }
})(window,document);