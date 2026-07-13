/* =========================================================
Nombre completo: bl2.google-push.guard.js
Ruta o ubicación: /BDLocal/bl2.google-push.guard.js
Función o funciones:
- Mantener Firebase en modo exclusivamente manual.
- Leer un período o todos los períodos desde EstudiantesPeriodo.
- Detectar automáticamente los períodos guardados en Firebase.
- Excluir todos los campos relacionados con Telegram.
- Proteger cambios locales pendientes y datos locales más recientes.
- Crear respaldos antes de aplicar cada período.
- Normalizar cédulas y evitar duplicados.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "4.3.0-all-periods-safe";
  var pulling = false;
  var installed = false;

  var TELEGRAM_FIELDS = [
    "telegram",
    "telegramUser",
    "telegramUsername",
    "usuarioTelegram",
    "telegramChatId",
    "chatIdTelegram",
    "chatId",
    "telegramUpdatedAt",
    "telegramSource",
    "telegramCheckedAt",
    "telegramVerifiedAt",
    "_telegramUser",
    "_telegramChatId"
  ];

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function now(){
    return new Date().toISOString();
  }

  function store(){
    return window.BDLocalConfigStore || null;
  }

  function core(){
    return window.BL2Core || null;
  }

  function sync(){
    return window.BL2Sync || null;
  }

  function manager(){
    return window.BDLocalSyncManager || null;
  }

  function outbox(){
    return window.BDLSyncOutbox || null;
  }

  function config(){
    return window.BL2Config &&
      window.BL2Config.firebase ||
      {};
  }

  function academicCollection(){
    var current = config();

    return text(
      current.academicCollection ||
      current.collection ||
      "EstudiantesPeriodo"
    ) || "EstudiantesPeriodo";
  }

  function personCollection(){
    var current = config();

    return text(
      current.personCollection ||
      current.telegramCollection ||
      "Estudiantes"
    ) || "Estudiantes";
  }

  function cedula(value){
    var rules = window.BDLRulesPersona;

    if(
      rules &&
      typeof rules.normalizeCedula ===
      "function"
    ){
      return rules.normalizeCedula(value);
    }

    var utils =
      window.BL2Config &&
      window.BL2Config.utils;

    if(
      utils &&
      typeof utils.normalizeCedula ===
      "function"
    ){
      return utils.normalizeCedula(value);
    }

    var raw = text(value)
      .replace(/[^0-9A-Za-z]/g,"")
      .toUpperCase();

    return /^\d{9}$/.test(raw)
      ? "0" + raw
      : raw;
  }

  function period(value){
    value = text(value);

    if(!value){
      return "";
    }

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] + "-" + match[2] +
        "__" +
        match[3] + "-" + match[4]
      : value.replace(/_+/g,"__");
  }

  function stripTelegram(row){
    row = Object.assign({},row || {});

    TELEGRAM_FIELDS.forEach(function(key){
      delete row[key];
    });

    return row;
  }

  function periodFromDocument(row,documentId){
    var periodoId = period(
      row && (
        row.periodoId ||
        row.periodoCanonicoId
      )
    );

    if(periodoId){
      return periodoId;
    }

    documentId = text(documentId);

    var separator =
      documentId.lastIndexOf("__");

    return separator > 0
      ? period(
          documentId.slice(
            0,
            separator
          )
        )
      : "";
  }

  function periodLabel(row,periodoId){
    return text(
      row && (
        row.periodoLabel ||
        row.periodoCanonicoLabel
      ) ||
      periodoId
    );
  }

  function emitProgress(percent,message){
    try{
      window.dispatchEvent(
        new CustomEvent("bl2:sync-progress",{
          detail:{
            target:"firebase",
            percent:Math.max(
              0,
              Math.min(
                100,
                Number(percent || 0)
              )
            ),
            detail:message,
            at:now()
          }
        })
      );
    }catch(error){}
  }

  function emitFinished(summary){
    try{
      window.dispatchEvent(
        new CustomEvent(
          "bl2:external-pull-finished",
          {
            detail:{
              target:"firebase",
              summary:summary,
              at:now()
            }
          }
        )
      );
    }catch(error){}
  }

  function log(message,level,data){
    try{
      if(
        store() &&
        typeof store().addLog === "function"
      ){
        store().addLog(
          "firebase_academic_guard",
          message,
          level || "success",
          data || {}
        );
      }
    }catch(error){}
  }

  function blocked(message){
    return Promise.resolve({
      ok:false,
      skipped:true,
      blocked:true,
      target:"firebase",
      message:message
    });
  }

  function activePeriod(){
    try{
      if(
        window.BL2App &&
        typeof window.BL2App.getSelectedPeriod ===
        "function"
      ){
        var selected =
          window.BL2App.getSelectedPeriod();

        if(
          selected &&
          text(selected.id)
        ){
          return Promise.resolve({
            id:period(selected.id),
            label:text(
              selected.label ||
              selected.id
            )
          });
        }
      }
    }catch(error){}

    if(
      core() &&
      typeof core().getActivePeriod ===
      "function"
    ){
      return core().getActivePeriod()
        .then(function(current){
          if(
            !current ||
            !text(current.id)
          ){
            return null;
          }

          return {
            id:period(current.id),
            label:text(
              current.label ||
              current.periodoLabel ||
              current.id
            )
          };
        });
    }

    return Promise.resolve(null);
  }

  function ensureFirebase(){
    return (
      sync() &&
      typeof sync().ensureFirebase ===
      "function"
    )
      ? sync().ensureFirebase()
      : Promise.reject(
          new Error(
            "Firebase no está disponible."
          )
        );
  }

  function registerReads(amount,label){
    try{
      if(
        store() &&
        typeof store().registerFirebaseUsage ===
        "function"
      ){
        store().registerFirebaseUsage({
          reads:Number(amount || 0),
          label:label
        });
      }
    }catch(error){}
  }

  function time(row){
    var value = Date.parse(
      text(
        row && (
          row.updatedAt ||
          row.ultimaSincronizacion ||
          row.fechaActualizacion ||
          row.createdAt
        )
      )
    );

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function normalizeDocument(
    documentSnapshot,
    forcedPeriod
  ){
    var row = stripTelegram(
      documentSnapshot.data() || {}
    );

    var documentId =
      text(documentSnapshot.id);

    var periodoId = period(
      forcedPeriod ||
      periodFromDocument(
        row,
        documentId
      )
    );

    if(!periodoId){
      return null;
    }

    var prefix = periodoId + "__";

    var identification = cedula(
      row.cedula ||
      row.numeroIdentificacion ||
      (
        documentId.indexOf(prefix) === 0
          ? documentId.slice(
              prefix.length
            )
          : ""
      )
    );

    if(!identification){
      return null;
    }

    row.cedula = identification;

    row.numeroIdentificacion = cedula(
      row.numeroIdentificacion ||
      identification
    );

    row.periodoId = periodoId;
    row.periodoCanonicoId = periodoId;

    row.periodoLabel = periodLabel(
      row,
      periodoId
    );

    row.periodoCanonicoLabel = text(
      row.periodoCanonicoLabel ||
      row.periodoLabel
    );

    row.firebaseDocumentId =
      documentId;

    row.firebaseCollection =
      academicCollection();

    row.source =
      "firebase_academic_pull";

    return row;
  }

  function buildGroups(snapshot,forcedPeriod){
    var map = {};
    var groups = {};
    var rawByPeriod = {};
    var duplicateByPeriod = {};
    var ignoredWithoutPeriod = 0;
    var ignoredWithoutCedula = 0;

    snapshot.forEach(function(doc){
      var source = doc.data() || {};

      var periodoId = period(
        forcedPeriod ||
        periodFromDocument(
          source,
          doc.id
        )
      );

      if(!periodoId){
        ignoredWithoutPeriod += 1;
        return;
      }

      rawByPeriod[periodoId] =
        Number(
          rawByPeriod[periodoId] || 0
        ) + 1;

      var row = normalizeDocument(
        doc,
        periodoId
      );

      if(!row){
        ignoredWithoutCedula += 1;
        return;
      }

      var mapKey =
        periodoId +
        "::" +
        row.cedula;

      if(map[mapKey]){
        duplicateByPeriod[periodoId] =
          Number(
            duplicateByPeriod[periodoId] ||
            0
          ) + 1;

        if(
          time(row) <
          time(map[mapKey])
        ){
          return;
        }
      }

      map[mapKey] = row;
    });

    Object.keys(map).forEach(function(mapKey){
      var row = map[mapKey];
      var periodoId = row.periodoId;

      if(!groups[periodoId]){
        groups[periodoId] = {
          period:{
            id:periodoId,
            label:periodLabel(
              row,
              periodoId
            )
          },
          rows:[],
          rawCount:Number(
            rawByPeriod[periodoId] || 0
          ),
          duplicates:Number(
            duplicateByPeriod[periodoId] ||
            0
          )
        };
      }

      groups[periodoId].rows.push(row);
    });

    return {
      groups:groups,
      rawCount:Number(
        snapshot.size || 0
      ),
      ignoredWithoutPeriod:
        ignoredWithoutPeriod,
      ignoredWithoutCedula:
        ignoredWithoutCedula
    };
  }

  function readRemote(currentPeriod){
    return ensureFirebase()
      .then(function(database){
        return database
          .collection(
            academicCollection()
          )
          .where(
            "periodoId",
            "==",
            currentPeriod.id
          )
          .get();
      })
      .then(function(snapshot){
        registerReads(
          snapshot.size,
          "Lectura EstudiantesPeriodo " +
          currentPeriod.id
        );

        var remote = buildGroups(
          snapshot,
          currentPeriod.id
        );

        return remote.groups[
          currentPeriod.id
        ] || {
          period:currentPeriod,
          rows:[],
          rawCount:Number(
            snapshot.size || 0
          ),
          duplicates:0
        };
      });
  }

  function readAllRemote(){
    return ensureFirebase()
      .then(function(database){
        return database
          .collection(
            academicCollection()
          )
          .get();
      })
      .then(function(snapshot){
        registerReads(
          snapshot.size,
          "Lectura completa EstudiantesPeriodo"
        );

        return buildGroups(
          snapshot,
          ""
        );
      });
  }

  function pendingMap(periodoId){
    if(
      !outbox() ||
      typeof outbox().list !== "function"
    ){
      return Promise.resolve({});
    }

    return outbox().list({
      periodoId:periodoId
    }).then(function(rows){
      var map = {};

      (rows || []).forEach(function(row){
        var payload =
          row.payload ||
          row.data ||
          row.registro ||
          {};

        var identification = cedula(
          row.cedula ||
          row.numeroIdentificacion ||
          payload.cedula ||
          payload.numeroIdentificacion
        );

        if(!identification){
          return;
        }

        var open = [
          "google",
          "firebase",
          "supabase"
        ].some(function(target){
          return (
            typeof outbox().isDone !==
            "function" ||
            !outbox().isDone(row,target)
          );
        });

        if(open){
          map[identification] = true;
        }
      });

      return map;
    }).catch(function(){
      return {};
    });
  }

  function compare(local,remote){
    if(
      core() &&
      typeof core().compareRecords ===
      "function"
    ){
      var result =
        core().compareRecords(
          local,
          remote
        );

      if(
        [
          "remote",
          "local",
          "equal"
        ].indexOf(result) >= 0
      ){
        return result;
      }
    }

    if(time(remote) > time(local)){
      return "remote";
    }

    if(time(local) > time(remote)){
      return "local";
    }

    return (
      time(local) &&
      time(remote)
    )
      ? "equal"
      : "ambiguous";
  }

  function compareGroup(group){
    if(
      !core() ||
      typeof core().getStudents !==
      "function"
    ){
      return Promise.reject(
        new Error(
          "BL2Core.getStudents no está disponible."
        )
      );
    }

    var currentPeriod = group.period;

    return Promise.all([
      core().getStudents({
        periodoId:currentPeriod.id
      }),
      pendingMap(currentPeriod.id)
    ]).then(function(values){
      var local = values[0] || [];
      var pending = values[1] || {};
      var localMap = {};
      var apply = [];
      var equal = [];
      var localNewer = [];
      var conflicts = [];
      var ambiguous = [];

      local.forEach(function(row){
        var identification = cedula(
          row.cedula ||
          row.numeroIdentificacion
        );

        if(identification){
          localMap[identification] = row;
        }
      });

      group.rows.forEach(function(row){
        var identification = cedula(
          row.cedula ||
          row.numeroIdentificacion
        );

        if(pending[identification]){
          conflicts.push(identification);
          return;
        }

        if(!localMap[identification]){
          apply.push(row);
          return;
        }

        var winner = compare(
          localMap[identification],
          row
        );

        if(winner === "remote"){
          apply.push(row);
        }else if(winner === "equal"){
          equal.push(identification);
        }else if(winner === "local"){
          localNewer.push(identification);
        }else{
          ambiguous.push(identification);
        }
      });

      return {
        ok:true,
        period:currentPeriod,
        collection:academicCollection(),
        personCollection:
          personCollection(),
        rowsToApply:apply,
        remoteDocuments:Number(
          group.rawCount ||
          group.rows.length
        ),
        remoteUnique:group.rows.length,
        duplicateDocumentsIgnored:Number(
          group.duplicates || 0
        ),
        local:local.length,
        apply:apply.length,
        equal:equal.length,
        localNewer:
          localNewer.length,
        pendingConflict:
          conflicts.length,
        ambiguous:ambiguous.length,
        telegramExcluded:true
      };
    });
  }

  function preview(currentPeriod){
    emitProgress(
      15,
      "Leyendo Firebase del período " +
      currentPeriod.label +
      "..."
    );

    return readRemote(currentPeriod)
      .then(compareGroup);
  }

  function previewAll(){
    emitProgress(
      5,
      "Leyendo todos los períodos de Firebase..."
    );

    return readAllRemote()
      .then(function(remote){
        var ids = Object.keys(
          remote.groups
        ).sort();

        var results = [];
        var chain = Promise.resolve();

        ids.forEach(function(
          periodoId,
          index
        ){
          chain = chain.then(function(){
            emitProgress(
              45 +
              Math.round(
                index /
                Math.max(1,ids.length) *
                25
              ),
              "Comparando período " +
              (index + 1) +
              " de " +
              ids.length +
              "..."
            );

            return compareGroup(
              remote.groups[periodoId]
            ).then(function(result){
              results.push(result);
            });
          });
        });

        return chain.then(function(){
          return {
            ok:true,
            scope:"all",
            periods:results,
            periodCount:results.length,
            remoteDocuments:
              remote.rawCount,
            remoteUnique:
              results.reduce(
                function(total,item){
                  return total +
                    item.remoteUnique;
                },
                0
              ),
            apply:
              results.reduce(
                function(total,item){
                  return total +
                    item.apply;
                },
                0
              ),
            equal:
              results.reduce(
                function(total,item){
                  return total +
                    item.equal;
                },
                0
              ),
            localNewer:
              results.reduce(
                function(total,item){
                  return total +
                    item.localNewer;
                },
                0
              ),
            pendingConflict:
              results.reduce(
                function(total,item){
                  return total +
                    item.pendingConflict;
                },
                0
              ),
            ambiguous:
              results.reduce(
                function(total,item){
                  return total +
                    item.ambiguous;
                },
                0
              ),
            duplicateDocumentsIgnored:
              results.reduce(
                function(total,item){
                  return total +
                    item.duplicateDocumentsIgnored;
                },
                0
              ),
            ignoredWithoutPeriod:
              remote.ignoredWithoutPeriod,
            ignoredWithoutCedula:
              remote.ignoredWithoutCedula,
            telegramExcluded:true
          };
        });
      });
  }

  function publicPreview(result){
    var copy = Object.assign({},result);

    delete copy.rowsToApply;

    copy.previewOnly = true;

    copy.message =
      "Comparación Firebase terminada sin modificar Telegram.";

    return copy;
  }

  function publicAllPreview(result){
    var copy = Object.assign({},result);

    copy.periods = (
      result.periods || []
    ).map(publicPreview);

    copy.previewOnly = true;

    copy.message =
      "Firebase revisado: " +
      copy.periodCount +
      " período(s) detectado(s).";

    return copy;
  }

  function backup(currentPeriod){
    var currentBackup =
      window.BL2BackupV2 ||
      window.BL2Backup;

    return (
      currentBackup &&
      typeof currentBackup.createBackup ===
      "function"
    )
      ? currentBackup.createBackup({
          scope:"period",
          periodoId:currentPeriod.id,
          periodoLabel:
            currentPeriod.label,
          type:
            "pre_firebase_academic_pull"
        })
      : Promise.reject(
          new Error(
            "No se pudo crear respaldo."
          )
        );
  }

  function ensureLocalPeriod(currentPeriod){
    if(
      !core() ||
      typeof core().savePeriod !==
      "function"
    ){
      return Promise.resolve(null);
    }

    return core().savePeriod({
      id:currentPeriod.id,
      periodoId:currentPeriod.id,
      label:currentPeriod.label,
      periodoLabel:
        currentPeriod.label,
      updatedAt:now(),
      source:
        "firebase_academic_pull"
    });
  }

  function closeImported(changes){
    if(
      !changes ||
      !changes.length ||
      !outbox() ||
      typeof outbox().markSynced !==
      "function"
    ){
      return Promise.resolve();
    }

    var chain = Promise.resolve();

    [
      "firebase",
      "google",
      "supabase"
    ].forEach(function(target){
      chain = chain.then(function(){
        return outbox().markSynced(
          changes,
          target,
          {
            syncedAt:now(),
            source:
              "firebase_academic_pull",
            imported:true
          }
        );
      });
    });

    return chain;
  }

  function apply(result){
    if(!result.rowsToApply.length){
      var empty = publicPreview(result);

      empty.previewOnly = false;
      empty.applied = 0;

      empty.message =
        "No hay cambios seguros para " +
        result.period.label +
        ".";

      return Promise.resolve(empty);
    }

    emitProgress(
      72,
      "Creando respaldo de " +
      result.period.label +
      "..."
    );

    return backup(result.period)
      .then(function(backupResult){
        return ensureLocalPeriod(
          result.period
        ).then(function(){
          return core().saveStudents(
            result.rowsToApply,
            {
              normalized:true,
              periodoId:
                result.period.id,
              periodoLabel:
                result.period.label,
              source:
                "firebase_academic_pull",
              markRetired:false,
              sync:false,
              localOnly:true,
              cloudSync:false,
              manualCloudSync:true
            }
          );
        }).then(function(saveResult){
          return closeImported(
            saveResult.changes
          ).then(function(){
            var applied =
              publicPreview(result);

            applied.previewOnly = false;

            applied.applied =
              result.rowsToApply.length;

            applied.summary =
              saveResult;

            applied.safetyBackupId =
              backupResult &&
              backupResult.record &&
              backupResult.record.id ||
              "";

            applied.message =
              "Período " +
              result.period.label +
              " aplicado. Telegram no fue modificado.";

            return applied;
          });
        });
      });
  }

  function applyAll(result){
    var appliedPeriods = [];
    var totalApplied = 0;
    var periods = result.periods || [];
    var chain = Promise.resolve();

    periods.forEach(function(
      periodResult,
      index
    ){
      chain = chain.then(function(){
        emitProgress(
          72 +
          Math.round(
            index /
            Math.max(1,periods.length) *
            24
          ),
          "Aplicando período " +
          (index + 1) +
          " de " +
          periods.length +
          ": " +
          periodResult.period.label
        );

        return apply(periodResult)
          .then(function(applied){
            appliedPeriods.push(applied);

            totalApplied += Number(
              applied.applied || 0
            );
          });
      });
    });

    return chain.then(function(){
      var finalResult =
        publicAllPreview(result);

      finalResult.previewOnly = false;
      finalResult.applied = totalApplied;
      finalResult.aplicados =
        totalApplied;
      finalResult.periods =
        appliedPeriods;
      finalResult.periodosProcesados =
        result.periodCount;

      finalResult.message =
        "Firebase → Base Local completado: " +
        result.periodCount +
        " período(s) y " +
        totalApplied +
        " estudiante(s) aplicado(s).";

      return finalResult;
    });
  }

  function finish(result){
    emitProgress(
      100,
      result.message ||
      "Firebase procesado."
    );

    log(
      result.message ||
      "Firebase procesado.",
      result.blocked
        ? "warning"
        : "success",
      result
    );

    emitFinished(result);

    if(
      window.BL2App &&
      typeof window.BL2App.refresh ===
      "function"
    ){
      return window.BL2App.refresh({
        force:true,
        reason:"firebase-pull"
      }).catch(function(){
        return null;
      }).then(function(){
        return result;
      });
    }

    return result;
  }

  function pull(periodInfo,options){
    options = options || {};

    if(
      options.scope === "all" ||
      options.all === true
    ){
      return pullAll(options);
    }

    if(pulling){
      return blocked(
        "Ya existe una descarga Firebase en curso."
      );
    }

    pulling = true;
    window.BL2_FIREBASE_PULLING = true;

    var selected =
      periodInfo &&
      text(periodInfo.id)
        ? Promise.resolve({
            id:period(periodInfo.id),
            label:text(
              periodInfo.label ||
              periodInfo.id
            )
          })
        : activePeriod();

    return selected
      .then(function(currentPeriod){
        if(!currentPeriod){
          throw new Error(
            "Seleccione un período."
          );
        }

        return preview(currentPeriod)
          .then(function(view){
            if(options.previewOnly){
              return publicPreview(view);
            }

            var approved =
              options.confirm === false ||
              window.confirm(
                "Firebase → Base Local\n\n" +
                "Período: " +
                currentPeriod.label +
                "\nCambios seguros: " +
                view.apply +
                "\n\nTelegram no se modificará. ¿Continuar?"
              );

            return approved
              ? apply(view)
              : Object.assign(
                  publicPreview(view),
                  {
                    cancelled:true,
                    previewOnly:false
                  }
                );
          });
      })
      .then(finish)
      .finally(function(){
        pulling = false;

        window.BL2_FIREBASE_PULLING =
          false;
      });
  }

  function pullAll(options){
    options = options || {};

    if(pulling){
      return blocked(
        "Ya existe una descarga Firebase en curso."
      );
    }

    pulling = true;
    window.BL2_FIREBASE_PULLING = true;

    return previewAll()
      .then(function(view){
        if(options.previewOnly){
          return publicAllPreview(view);
        }

        if(!view.periodCount){
          var empty =
            publicAllPreview(view);

          empty.previewOnly = false;
          empty.applied = 0;

          empty.message =
            "Firebase no contiene períodos académicos para importar.";

          return empty;
        }

        var approved =
          options.confirm === false ||
          window.confirm(
            "Firebase → Base Local\n\n" +
            "Períodos detectados: " +
            view.periodCount +
            "\nDocumentos remotos: " +
            view.remoteDocuments +
            "\nCambios seguros: " +
            view.apply +
            "\n\nSe crearán respaldos y Telegram no se modificará. ¿Continuar?"
          );

        return approved
          ? applyAll(view)
          : Object.assign(
              publicAllPreview(view),
              {
                cancelled:true,
                previewOnly:false
              }
            );
      })
      .then(finish)
      .finally(function(){
        pulling = false;

        window.BL2_FIREBASE_PULLING =
          false;
      });
  }

  function requestManual(options){
    options = Object.assign(
      {},
      options || {}
    );

    if(options.manual !== true){
      return blocked(
        "Solicitud automática bloqueada."
      );
    }

    if(
      !window.BDLSyncV2 ||
      typeof window.BDLSyncV2.request !==
      "function"
    ){
      return Promise.reject(
        new Error(
          "BDLSyncV2 no está disponible."
        )
      );
    }

    return activePeriod()
      .then(function(currentPeriod){
        if(!currentPeriod){
          throw new Error(
            "Seleccione un período."
          );
        }

        return window.BDLSyncV2.request({
          manual:true,
          automatic:false,
          source:
            "BL2Sync.firebase.manual",
          targets:["firebase"],
          periodoId:
            currentPeriod.id,
          periodoLabel:
            currentPeriod.label,
          limit:Math.min(
            25,
            Math.max(
              1,
              Number(options.limit || 25)
            )
          ),
          batchSize:Math.min(
            25,
            Math.max(
              1,
              Number(
                options.batchSize || 25
              )
            )
          )
        });
      });
  }

  function install(){
    var currentManager = manager();

    if(currentManager){
      currentManager.pullFirebaseToLocal =
        function(options){
          options = options || {};

          if(
            options.scope === "all" ||
            options.all === true
          ){
            return pullAll({
              confirm:
                options.confirm !== false,
              previewOnly:
                options.previewOnly === true
            });
          }

          return pull(
            options.period || null,
            {
              confirm:
                options.confirm !== false,
              previewOnly:
                options.previewOnly === true
            }
          );
        };

      currentManager
        .__externalFirebasePullGuardInstalled =
        true;
    }

    var currentSync = sync();

    if(currentSync){
      currentSync.maybeSyncFirebaseDaily =
        function(){
          return blocked(
            "Sincronización diaria desactivada."
          );
        };

      currentSync.syncBeforeClose =
        function(){
          return blocked(
            "Sincronización al cerrar desactivada."
          );
        };

      currentSync.syncFirebase =
        function(options){
          options = options || {};

          var action = text(
            options.action ||
            "upload"
          ).toLowerCase();

          var all =
            options.scope === "all" ||
            options.all === true ||
            action === "download_all" ||
            action === "compare_all";

          if(
            action === "compare" ||
            action === "compare_all"
          ){
            return all
              ? pullAll({
                  confirm:false,
                  previewOnly:true
                })
              : pull(
                  {
                    id:options.periodoId,
                    label:
                      options.periodoLabel
                  },
                  {
                    confirm:false,
                    previewOnly:true
                  }
                );
          }

          if(
            action === "download" ||
            action === "download_all"
          ){
            return all
              ? pullAll({
                  confirm:
                    options.confirm !==
                    false
                })
              : pull(
                  {
                    id:options.periodoId,
                    label:
                      options.periodoLabel
                  },
                  {
                    confirm:
                      options.confirm !==
                      false
                  }
                );
          }

          return requestManual(
            Object.assign(
              {},
              options,
              {
                manual:
                  options.manual === true
              }
            )
          );
        };

      currentSync
        .__externalSyncGuardInstalled =
        true;
    }

    installed =
      !!currentManager &&
      !!currentSync;

    return installed;
  }

  window.BL2GooglePushGuard = {
    version:VERSION,
    manualOnly:true,
    singleGate:true,
    supportsAllPeriods:true,
    install:install,
    requestManualTarget:
      requestManual,
    status:function(){
      return {
        version:VERSION,
        installed:installed,
        singleGate:true,
        intervals:false,
        supportsAllPeriods:true,
        academicCollection:
          academicCollection(),
        personCollection:
          personCollection(),
        telegramExcluded:true
      };
    }
  };

  window.BL2FirebaseGuard = {
    version:VERSION,
    manualOnly:true,
    singleGate:true,
    supportsAllPeriods:true,
    install:install,
    pullFirebaseToLocal:pull,
    pullAllFirebaseToLocal:pullAll,
    previewFirebase:function(currentPeriod){
      return pull(
        currentPeriod || null,
        {
          confirm:false,
          previewOnly:true
        }
      );
    },
    previewAllFirebase:function(){
      return pullAll({
        confirm:false,
        previewOnly:true
      });
    },
    documentId:function(
      periodoId,
      identification
    ){
      return (
        period(periodoId) +
        "__" +
        cedula(identification)
      );
    },
    academicCollectionName:
      academicCollection,
    personCollectionName:
      personCollection,
    stripTelegramFields:
      stripTelegram,
    isPulling:function(){
      return pulling;
    },
    status:function(){
      return {
        version:VERSION,
        installed:installed,
        pulling:pulling,
        singleGate:true,
        supportsAllPeriods:true,
        academicCollection:
          academicCollection(),
        personCollection:
          personCollection(),
        telegramExcluded:true
      };
    }
  };

  window.addEventListener(
    "bdlocal:bl2-html-scripts-loaded",
    install,
    { once:true }
  );

  if(
    !document.querySelector(
      "script[data-bl2-loader-src]"
    )
  ){
    if(document.readyState === "loading"){
      document.addEventListener(
        "DOMContentLoaded",
        install,
        { once:true }
      );
    }else{
      install();
    }
  }
})(window,document);