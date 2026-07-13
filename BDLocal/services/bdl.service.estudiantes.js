/* =========================================================
Archivo: bdl.service.estudiantes.js
Ruta: /BDLocal/services/bdl.service.estudiantes.js
Función:
- Servicio general de estudiantes sobre modelo DB_VERSION 2.
- Usar matriculas_periodo como base central.
- Hidratar datos personales desde personas.
- Hidratar celular, correo y Telegram desde contactos_estudiante.
- Consultar por índices cuando existen.
- Hidratar personas y contactos por lote cuando sea necesario.
- Mantener fallback legacy mediante repositorios.
========================================================= */
(function(window){
  "use strict";

  var Services =
    window.BDLServices;

  if (!Services){
    return;
  }

  var VERSION =
    "1.3.0-contactos-hydration";

  function text(value){
    return Services.text
      ? Services.text(value)
      : String(
        value == null
          ? ""
          : value
      ).trim();
  }

  function normalizeSearch(value){
    return Services.normalizeSearch
      ? Services.normalizeSearch(
        value
      )
      : text(value)
        .toLowerCase();
  }

  function normalizeCedula(value){
    var raw =
      text(value).replace(
        /[^0-9A-Za-z]/g,
        ""
      );

    return /^\d{9}$/.test(raw)
      ? "0" + raw
      : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);

    if (!value){
      return "";
    }

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] +
        "-" +
        match[2] +
        "__" +
        match[3] +
        "-" +
        match[4]

      : value.replace(
        /_+/g,
        "__"
      );
  }

  function studentPeriodId(
    periodoId,
    cedula
  ){
    periodoId =
      canonicalPeriodId(
        periodoId
      );

    cedula =
      normalizeCedula(
        cedula
      );

    return (
      cedula &&
      periodoId
    )
      ? cedula +
        "__" +
        periodoId
      : "";
  }

  function matriculasRepo(){
    return (
      Services.repo(
        "matriculas"
      ) ||
      Services.repo(
        "matriculas_periodo"
      )
    );
  }

  function personasRepo(){
    return Services.repo(
      "personas"
    );
  }

  function contactosRepo(){
    return (
      Services.repo(
        "contactos"
      ) ||
      window.BDLRepoContactos ||
      null
    );
  }

  function estudiantesRepo(){
    return (
      Services.repo(
        "estudiantes"
      ) ||
      window.BDLRepoEstudiantesV2 ||
      null
    );
  }

  function repos(){
    return Services.repos
      ? Services.repos()
      : null;
  }

  function isActive(row){
    var estado = text(
      row &&
      (
        row.estadoMatricula ||
        row._estadoMatricula
      )
    ).toUpperCase();

    return estado !==
      "RETIRADO";
  }

  function normalizeMatricula(row){
    row =
      Object.assign(
        {},
        row || {}
      );

    var periodoId =
      canonicalPeriodId(
        row.periodoId ||
        row.periodId ||
        row.periodoCanonicoId ||
        row._periodoId ||
        row._bl2PeriodoId ||
        ""
      );

    var cedula =
      normalizeCedula(
        row.cedula ||
        row._cedula ||
        row.numeroIdentificacion ||
        row.NumeroIdentificacion ||
        row.Cedula ||
        row["Cédula"] ||
        ""
      );

    var previousId = text(
      row.idEstudiantePeriodo ||
      row.studentId ||
      row.id ||
      row._id ||
      ""
    );

    var idEstudiantePeriodo =
      studentPeriodId(
        periodoId,
        cedula
      ) || previousId;

    if (
      idEstudiantePeriodo &&
      previousId &&
      previousId !==
        idEstudiantePeriodo
    ){
      row._legacyStudentId =
        row._legacyStudentId ||
        previousId;
    }

    var carrera = text(
      row.carrera ||
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.Carrera ||
      row._carrera ||
      ""
    );

    var division = text(
      row.division ||
      row.Division ||
      row["División"] ||
      row._division ||
      "Sin división"
    );

    var sede = text(
      row.sede ||
      row.Sede ||
      row._sede ||
      ""
    );

    row.idEstudiantePeriodo =
      idEstudiantePeriodo;

    row.studentId =
      idEstudiantePeriodo;

    row.id =
      idEstudiantePeriodo ||
      cedula;

    row._id =
      row.id;

    row.periodoId =
      periodoId;

    row.periodId =
      periodoId;

    row.periodoCanonicoId =
      row.periodoCanonicoId ||
      periodoId;

    row._periodoId =
      row._periodoId ||
      periodoId;

    row.cedula =
      cedula;

    row._cedula =
      row._cedula ||
      cedula;

    row.numeroIdentificacion =
      row.numeroIdentificacion ||
      cedula;

    row.NumeroIdentificacion =
      row.NumeroIdentificacion ||
      cedula;

    row.carrera =
      carrera;

    row.NombreCarrera =
      row.NombreCarrera ||
      carrera;

    row.nombreCarrera =
      row.nombreCarrera ||
      carrera;

    row.Carrera =
      row.Carrera ||
      carrera;

    row._carrera =
      row._carrera ||
      carrera ||
      "SIN CARRERA";

    row.division =
      division;

    row.Division =
      row.Division ||
      division;

    row._division =
      row._division ||
      division;

    row.sede =
      sede;

    row.Sede =
      row.Sede ||
      sede;

    row._sede =
      row._sede ||
      sede ||
      "SIN SEDE";

    row.estadoMatricula =
      text(
        row.estadoMatricula ||
        row.EstadoMatricula ||
        row._estadoMatricula ||
        "ACTIVO"
      ).toUpperCase() ===
      "RETIRADO"
        ? "RETIRADO"
        : "ACTIVO";

    row._estadoMatricula =
      row.estadoMatricula;

    return row;
  }

  function mergeNonEmpty(
    existing,
    incoming
  ){
    existing =
      existing || {};

    incoming =
      incoming || {};

    var merged =
      Object.assign(
        {},
        existing
      );

    Object.keys(
      incoming
    ).forEach(function(key){
      var value =
        incoming[key];

      if (
        value !== undefined &&
        value !== null &&
        text(value) !== ""
      ){
        merged[key] =
          value;
      }else if (
        merged[key] === undefined
      ){
        merged[key] =
          value;
      }
    });

    return normalizeMatricula(
      merged
    );
  }

  function dedupeMatriculas(rows){
    var map =
      Object.create(null);

    var order = [];

    (
      Array.isArray(rows)
        ? rows
        : []
    ).forEach(function(input){
      var row =
        normalizeMatricula(
          input
        );

      var id = text(
        row.idEstudiantePeriodo ||
        row.studentId ||
        row.id
      );

      if (!id){
        return;
      }

      if (!map[id]){
        order.push(id);
      }

      map[id] =
        mergeNonEmpty(
          map[id],
          row
        );
    });

    return order.map(
      function(id){
        return map[id];
      }
    );
  }

  function mergePersona(
    row,
    persona
  ){
    row =
      Object.assign(
        {},
        row || {}
      );

    persona =
      persona || null;

    if (persona){
      var nombres = text(
        persona.nombreCompleto ||
        persona.nombres ||
        persona.Nombres ||
        row.nombreCompleto ||
        row.nombres ||
        row.Nombres ||
        ""
      );

      row.nombreCompleto =
        row.nombreCompleto ||
        nombres;

      row.nombres =
        row.nombres ||
        nombres;

      row.Nombres =
        row.Nombres ||
        nombres;

      row.correoPersonal =
        row.correoPersonal ||
        persona.correoPersonal ||
        persona.CorreoPersonal ||
        "";

      row.CorreoPersonal =
        row.CorreoPersonal ||
        row.correoPersonal ||
        "";

      row.correoInstitucional =
        row.correoInstitucional ||
        persona.correoInstitucional ||
        persona.CorreoInstitucional ||
        "";

      row.CorreoInstitucional =
        row.CorreoInstitucional ||
        row.correoInstitucional ||
        "";

      row.celular =
        row.celular ||
        persona.celular ||
        persona.Celular ||
        persona.telefono ||
        persona.whatsapp ||
        persona.Whatsapp ||
        "";

      row.Celular =
        row.Celular ||
        row.celular ||
        "";

      row._persona =
        persona;
    }

    row.NombreCarrera =
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.carrera;

    row.nombreCarrera =
      row.nombreCarrera ||
      row.NombreCarrera ||
      row.carrera;

    row.Carrera =
      row.Carrera ||
      row.NombreCarrera ||
      row.carrera;

    return row;
  }

  function mergeContacto(
    row,
    contacto
  ){
    row =
      Object.assign(
        {},
        row || {}
      );

    contacto =
      contacto || null;

    if (!contacto){
      return row;
    }

    var correoPersonal =
      text(
        contacto.correoPersonal ||
        contacto.CorreoPersonal ||
        contacto.emailPersonal ||
        row.correoPersonal ||
        row.CorreoPersonal ||
        ""
      );

    var correoInstitucional =
      text(
        contacto.correoInstitucional ||
        contacto.CorreoInstitucional ||
        contacto.emailInstitucional ||
        row.correoInstitucional ||
        row.CorreoInstitucional ||
        ""
      );

    var correoGeneral =
      text(
        contacto.correo ||
        contacto.Correo ||
        contacto.email ||
        contacto.Email ||
        correoPersonal ||
        correoInstitucional ||
        row.correo ||
        row.Correo ||
        ""
      );

    var celular =
      text(
        contacto.celular ||
        contacto.Celular ||
        contacto.telefono ||
        contacto.Telefono ||
        contacto.whatsapp ||
        contacto.Whatsapp ||
        row.celular ||
        row.Celular ||
        row.telefono ||
        row.whatsapp ||
        ""
      );

    var telegramUser =
      text(
        contacto.telegramUser ||
        contacto._telegramUser ||
        contacto.usuarioTelegram ||
        contacto.telegram ||
        row.telegramUser ||
        row._telegramUser ||
        ""
      );

    var telegramChatId =
      text(
        contacto.telegramChatId ||
        contacto._telegramChatId ||
        contacto.chatIdTelegram ||
        contacto.chatId ||
        row.telegramChatId ||
        row._telegramChatId ||
        ""
      );

    if (correoPersonal){
      row.correoPersonal =
        correoPersonal;

      row.CorreoPersonal =
        correoPersonal;
    }

    if (correoInstitucional){
      row.correoInstitucional =
        correoInstitucional;

      row.CorreoInstitucional =
        correoInstitucional;
    }

    if (correoGeneral){
      row.correo =
        correoGeneral;

      row.Correo =
        row.Correo ||
        correoGeneral;

      row._correo =
        correoGeneral;
    }

    if (celular){
      row.celular =
        celular;

      row.Celular =
        celular;

      row.telefono =
        row.telefono ||
        celular;

      row.Telefono =
        row.Telefono ||
        celular;

      row.whatsapp =
        row.whatsapp ||
        celular;

      row._celular =
        celular;
    }

    if (telegramUser){
      row.telegramUser =
        telegramUser;

      row._telegramUser =
        telegramUser;
    }

    if (telegramChatId){
      row.telegramChatId =
        telegramChatId;

      row._telegramChatId =
        telegramChatId;
    }

    row._contacto =
      contacto;

    return row;
  }

  function uniqueCedulas(rows){
    var map =
      Object.create(null);

    var out = [];

    (
      Array.isArray(rows)
        ? rows
        : []
    ).forEach(function(row){
      var cedula =
        normalizeCedula(
          row &&
          (
            row.cedula ||
            row.numeroIdentificacion
          )
        );

      if (
        cedula &&
        !map[cedula]
      ){
        map[cedula] =
          true;

        out.push(
          cedula
        );
      }
    });

    return out;
  }

  function hydratePersonas(
    rows,
    options
  ){
    rows =
      Array.isArray(rows)
        ? rows.map(
          normalizeMatricula
        )
        : [];

    options =
      options || {};

    var repo =
      personasRepo();

    if (
      !repo ||
      !rows.length
    ){
      return Promise.resolve(
        rows
      );
    }

    var cedulas =
      uniqueCedulas(rows);

    if (!cedulas.length){
      return Promise.resolve(
        rows
      );
    }

    var helper =
      repos();

    var threshold =
      Number(
        options.batchThreshold ||
        40
      );

    if (
      cedulas.length >= threshold &&
      helper &&
      typeof helper.safeGetAll ===
        "function"
    ){
      var storeName =
        helper.storeName(
          "personas",
          "personas"
        );

      return helper
        .safeGetAll(
          storeName
        )
        .then(function(personas){
          var map =
            Object.create(null);

          (
            Array.isArray(personas)
              ? personas
              : []
          ).forEach(function(persona){
            var cedula =
              normalizeCedula(
                persona &&
                (
                  persona.cedula ||
                  persona.numeroIdentificacion
                )
              );

            if (cedula){
              map[cedula] =
                persona;
            }
          });

          return rows.map(
            function(row){
              return mergePersona(
                row,
                map[
                  normalizeCedula(
                    row.cedula
                  )
                ] || null
              );
            }
          );
        })
        .catch(function(){
          return rows;
        });
    }

    if (
      typeof repo.getByCedula !==
      "function"
    ){
      return Promise.resolve(
        rows
      );
    }

    var personaMap =
      Object.create(null);

    return Promise.all(
      cedulas.map(function(cedula){
        return Promise.resolve(
          repo.getByCedula(
            cedula
          )
        )
          .then(function(persona){
            personaMap[cedula] =
              persona || null;
          })
          .catch(function(){
            personaMap[cedula] =
              null;
          });
      })
    ).then(function(){
      return rows.map(
        function(row){
          return mergePersona(
            row,
            personaMap[
              normalizeCedula(
                row.cedula
              )
            ] || null
          );
        }
      );
    });
  }

  function hydrateContactos(
    rows,
    options
  ){
    rows =
      Array.isArray(rows)
        ? rows.map(
          normalizeMatricula
        )
        : [];

    options =
      options || {};

    var repo =
      contactosRepo();

    if (
      !repo ||
      typeof repo.list !==
        "function" ||
      !rows.length
    ){
      return Promise.resolve(
        rows
      );
    }

    var periodoId =
      canonicalPeriodId(
        options.periodoId ||
        options.periodId ||
        ""
      );

    function readContacts(
      filterByPeriod
    ){
      var query =
        filterByPeriod &&
        periodoId
          ? {
            periodoId:
              periodoId
          }
          : {};

      return Promise.resolve(
        repo.list(
          query
        )
      ).catch(function(){
        return [];
      });
    }

    return readContacts(
      true
    )
      .then(function(contactos){
        contactos =
          Array.isArray(contactos)
            ? contactos
            : [];

        if (
          contactos.length ||
          !periodoId
        ){
          return contactos;
        }

        return readContacts(
          false
        );
      })
      .then(function(contactos){
        var byId =
          Object.create(null);

        var byCedula =
          Object.create(null);

        (
          Array.isArray(contactos)
            ? contactos
            : []
        ).forEach(function(contacto){
          var item =
            typeof repo.normalize ===
              "function"
              ? repo.normalize(
                contacto
              )
              : Object.assign(
                {},
                contacto || {}
              );

          var cedula =
            normalizeCedula(
              item.cedula ||
              item.numeroIdentificacion ||
              ""
            );

          var itemPeriodoId =
            canonicalPeriodId(
              item.periodoId ||
              item.periodId ||
              ""
            );

          var id =
            text(
              item.id ||
              item.idEstudiantePeriodo ||
              item.studentId ||
              ""
            );

          var canonicalId =
            studentPeriodId(
              itemPeriodoId,
              cedula
            );

          if (id){
            byId[id] =
              item;
          }

          if (canonicalId){
            byId[canonicalId] =
              item;
          }

          if (cedula){
            if (!byCedula[cedula]){
              byCedula[cedula] =
                [];
            }

            byCedula[cedula].push(
              item
            );
          }
        });

        return rows.map(function(row){
          var cedula =
            normalizeCedula(
              row.cedula ||
              row.numeroIdentificacion ||
              ""
            );

          var rowPeriodoId =
            canonicalPeriodId(
              row.periodoId ||
              row.periodId ||
              row.periodoCanonicoId ||
              ""
            );

          var id =
            text(
              row.idEstudiantePeriodo ||
              row.studentId ||
              row.id ||
              ""
            );

          var canonicalId =
            studentPeriodId(
              rowPeriodoId,
              cedula
            );

          var cedulaContacts =
            byCedula[cedula] ||
            [];

          var contacto =
            byId[id] ||
            byId[canonicalId] ||
            null;

          if (
            !contacto &&
            cedulaContacts.length
          ){
            for (
              var i = 0;
              i < cedulaContacts.length;
              i += 1
            ){
              var candidate =
                cedulaContacts[i] || {};

              var candidatePeriodoId =
                canonicalPeriodId(
                  candidate.periodoId ||
                  candidate.periodId ||
                  ""
                );

              if (
                rowPeriodoId &&
                candidatePeriodoId ===
                  rowPeriodoId
              ){
                contacto =
                  candidate;

                break;
              }
            }
          }

          if (
            !contacto &&
            cedulaContacts.length === 1
          ){
            contacto =
              cedulaContacts[0];
          }

          return mergeContacto(
            row,
            contacto
          );
        });
      })
      .catch(function(){
        return rows;
      });
  }

  function hydrateStudentDetails(
    rows,
    options
  ){
    return hydratePersonas(
      rows,
      options
    ).then(function(hydrated){
      return hydrateContactos(
        hydrated,
        options
      );
    });
  }

  function queryMatriculasIndexed(
    options
  ){
    options =
      options || {};

    var helper =
      repos();

    if (
      !helper ||
      typeof helper.safeQueryByIndex !==
        "function"
    ){
      return Promise.resolve(
        null
      );
    }

    var periodoId =
      canonicalPeriodId(
        options.periodoId ||
        options.periodId ||
        ""
      );

    var cedula =
      normalizeCedula(
        options.cedula ||
        options.numeroIdentificacion ||
        ""
      );

    var storeName =
      helper.storeName(
        "matriculasPeriodo",
        "matriculas_periodo"
      );

    if (
      periodoId &&
      cedula
    ){
      return helper.safeQueryByIndex(
        storeName,
        "periodo_cedula",
        [
          periodoId,
          cedula
        ]
      );
    }

    if (periodoId){
      return helper.safeQueryByIndex(
        storeName,
        "periodoId",
        periodoId
      );
    }

    if (cedula){
      return helper.safeQueryByIndex(
        storeName,
        "cedula",
        cedula
      );
    }

    return Promise.resolve(
      null
    );
  }

  function queryMatriculas(options){
    options =
      options || {};

    var repo =
      matriculasRepo();

    var legacy =
      estudiantesRepo();

    return queryMatriculasIndexed(
      options
    ).then(function(rows){
      if (
        Array.isArray(rows) &&
        rows.length
      ){
        return rows.map(
          normalizeMatricula
        );
      }

      if (
        repo &&
        typeof repo.list ===
          "function"
      ){
        return Promise.resolve(
          repo.list(
            options
          )
        ).then(function(repoRows){
          repoRows =
            Array.isArray(repoRows)
              ? repoRows
              : [];

          if (repoRows.length){
            return repoRows.map(
              normalizeMatricula
            );
          }

          if (
            legacy &&
            typeof legacy.list ===
              "function"
          ){
            return Promise.resolve(
              legacy.list(
                options
              )
            ).then(function(legacyRows){
              return (
                Array.isArray(
                  legacyRows
                )
                  ? legacyRows
                  : []
              ).map(
                normalizeMatricula
              );
            });
          }

          return [];
        });
      }

      if (
        legacy &&
        typeof legacy.list ===
          "function"
      ){
        return Promise.resolve(
          legacy.list(
            options
          )
        ).then(function(legacyRows){
          return (
            Array.isArray(
              legacyRows
            )
              ? legacyRows
              : []
          ).map(
            normalizeMatricula
          );
        });
      }

      return [];
    });
  }

  function filterRows(
    rows,
    options
  ){
    rows =
      Array.isArray(rows)
        ? rows.map(
          normalizeMatricula
        )
        : [];

    options =
      options || {};

    var periodoId =
      canonicalPeriodId(
        options.periodoId ||
        options.periodId ||
        ""
      );

    var cedula =
      normalizeCedula(
        options.cedula ||
        options.numeroIdentificacion ||
        ""
      );

    var matricula =
      text(
        options.matricula ||
        options.estadoMatricula ||
        ""
      );

    var carrera =
      text(
        options.carrera ||
        options.career ||
        ""
      );

    var division =
      text(
        options.division ||
        ""
      );

    var sede =
      text(
        options.sede ||
        ""
      );

    var search =
      text(
        options.search ||
        options.busqueda ||
        options.query ||
        ""
      );

    if (periodoId){
      rows =
        rows.filter(
          function(row){
            return canonicalPeriodId(
              row.periodoId ||
              row.periodId
            ) === periodoId;
          }
        );
    }

    if (cedula){
      rows =
        rows.filter(
          function(row){
            return normalizeCedula(
              row.cedula
            ) === cedula;
          }
        );
    }

    if (matricula){
      if (
        matricula.toUpperCase() ===
        "ACTIVO"
      ){
        rows =
          rows.filter(
            isActive
          );
      }else if (
        matricula.toUpperCase() !==
          "TODOS" &&
        matricula.toUpperCase() !==
          "TODO"
      ){
        rows =
          rows.filter(
            function(row){
              return text(
                row.estadoMatricula ||
                row._estadoMatricula
              ).toUpperCase() ===
                matricula.toUpperCase();
            }
          );
      }
    }

    if (carrera){
      rows =
        rows.filter(
          function(row){
            return normalizeSearch(
              row.carrera ||
              row.NombreCarrera ||
              row.nombreCarrera ||
              row.Carrera
            ).indexOf(
              normalizeSearch(
                carrera
              )
            ) >= 0;
          }
        );
    }

    if (division){
      rows =
        rows.filter(
          function(row){
            var current =
              row.division ||
              row.Division ||
              row._division ||
              "";

            if (
              normalizeSearch(
                current
              ) ===
              normalizeSearch(
                division
              )
            ){
              return true;
            }

            try{
              if (
                window.BLDivisionesService &&
                typeof window.BLDivisionesService
                  .hasDivision ===
                  "function"
              ){
                return window.BLDivisionesService
                  .hasDivision(
                    row,
                    division
                  );
              }
            }catch(error){}

            return false;
          }
        );
    }

    if (sede){
      rows =
        rows.filter(
          function(row){
            return normalizeSearch(
              row.sede ||
              row.Sede ||
              row._sede
            ).indexOf(
              normalizeSearch(
                sede
              )
            ) >= 0;
          }
        );
    }

    if (search){
      rows =
        rows.filter(
          function(row){
            var haystack = [
              row.cedula,
              row.numeroIdentificacion,
              row.NumeroIdentificacion,
              row.nombreCompleto,
              row.nombres,
              row.Nombres,
              row.carrera,
              row.NombreCarrera,
              row.nombreCarrera,
              row.Carrera,
              row.sede,
              row.Sede,
              row.division,
              row.Division,
              row._division,
              row.correo,
              row.Correo,
              row.correoPersonal,
              row.correoInstitucional,
              row.CorreoPersonal,
              row.CorreoInstitucional,
              row.celular,
              row.Celular,
              row.telefono,
              row.Telefono,
              row.whatsapp,
              row.telegramUser,
              row.telegramChatId
            ].join(" ");

            return normalizeSearch(
              haystack
            ).indexOf(
              normalizeSearch(
                search
              )
            ) >= 0;
          }
        );
    }

    return sortRows(
      rows,
      options
    );
  }

  function sortRows(
    rows,
    options
  ){
    rows =
      Array.isArray(rows)
        ? rows.slice()
        : [];

    options =
      options || {};

    var key =
      text(
        options.sortKey ||
        "nombres"
      );

    var dir =
      text(
        options.sortDir ||
        "asc"
      ).toLowerCase() ===
      "desc"
        ? -1
        : 1;

    return rows.sort(
      function(a, b){
        var av = "";
        var bv = "";

        if (
          key === "nombres" ||
          key === "nombreCompleto"
        ){
          av =
            normalizeSearch(
              a.nombreCompleto ||
              a.nombres ||
              a.Nombres
            );

          bv =
            normalizeSearch(
              b.nombreCompleto ||
              b.nombres ||
              b.Nombres
            );
        }else if (
          key === "carrera" ||
          key === "NombreCarrera"
        ){
          av =
            normalizeSearch(
              a.carrera ||
              a.NombreCarrera ||
              a.nombreCarrera
            );

          bv =
            normalizeSearch(
              b.carrera ||
              b.NombreCarrera ||
              b.nombreCarrera
            );
        }else{
          av =
            normalizeSearch(
              a[key]
            );

          bv =
            normalizeSearch(
              b[key]
            );
        }

        if (av < bv){
          return -1 * dir;
        }

        if (av > bv){
          return 1 * dir;
        }

        return 0;
      }
    );
  }

  function needsPersonaBeforeFilter(
    options
  ){
    options =
      options || {};

    var sortKey =
      text(
        options.sortKey ||
        "nombres"
      );

    return (
      !!text(
        options.search ||
        options.busqueda ||
        options.query
      ) ||
      sortKey === "nombres" ||
      sortKey === "nombreCompleto"
    );
  }

  function list(options){
    options =
      options || {};

    return queryMatriculas(
      options
    ).then(function(rows){
      rows =
        dedupeMatriculas(
          rows
        );

      if (
        needsPersonaBeforeFilter(
          options
        )
      ){
        return hydrateStudentDetails(
          rows,
          options
        ).then(function(hydrated){
          return filterRows(
            hydrated,
            options
          );
        });
      }

      var filtered =
        filterRows(
          rows,
          options
        );

      return hydrateStudentDetails(
        filtered,
        options
      );
    });
  }

  function page(options){
    options =
      Object.assign(
        {
          page:1,
          limit:25
        },
        options || {}
      );

    return queryMatriculas(
      options
    ).then(function(rows){
      rows =
        dedupeMatriculas(
          rows
        );

      if (
        needsPersonaBeforeFilter(
          options
        )
      ){
        return hydrateStudentDetails(
          rows,
          options
        ).then(function(hydrated){
          var filtered =
            filterRows(
              hydrated,
              options
            );

          var paged =
            Services.paginate(
              filtered,
              options
            );

          paged.rows =
            paged.rows || [];

          paged.source =
            "matriculas_periodo";

          paged.queryMode =
            text(
              options.periodoId ||
              options.periodId
            )
              ? "indexed_periodoId"
              : "repository";

          paged.personasHydrated =
            true;

          paged.contactosHydrated =
            true;

          return paged;
        });
      }

      var filtered =
        filterRows(
          rows,
          options
        );

      var paged =
        Services.paginate(
          filtered,
          options
        );

      return hydrateStudentDetails(
        paged.rows || [],
        options
      ).then(function(hydratedRows){
        paged.rows =
          hydratedRows;

        paged.source =
          "matriculas_periodo";

        paged.queryMode =
          text(
            options.periodoId ||
            options.periodId
          )
            ? "indexed_periodoId"
            : "repository";

        paged.personasHydrated =
          true;

        paged.contactosHydrated =
          true;

        return paged;
      });
    });
  }

  function getByPeriodoCedula(
    periodoId,
    cedula
  ){
    periodoId =
      canonicalPeriodId(
        periodoId
      );

    cedula =
      normalizeCedula(
        cedula
      );

    if (
      !periodoId ||
      !cedula
    ){
      return Promise.resolve(
        null
      );
    }

    return queryMatriculas({
      periodoId:
        periodoId,

      cedula:
        cedula
    }).then(function(rows){
      rows =
        dedupeMatriculas(
          rows
        );

      if (!rows.length){
        return null;
      }

      return hydrateStudentDetails(
        [rows[0]],
        {
          periodoId:
            periodoId,

          batchThreshold:
            999
        }
      ).then(function(hydrated){
        return hydrated[0] ||
          null;
      });
    });
  }

  function save(row){
    var repo =
      matriculasRepo();

    if (
      !repo ||
      typeof repo.save !==
        "function"
    ){
      return Promise.reject(
        new Error(
          "Repositorio de matrículas no disponible."
        )
      );
    }

    return repo.save(
      normalizeMatricula(
        row || {}
      )
    );
  }

  function saveMany(rows){
    var repo =
      matriculasRepo();

    if (
      !repo ||
      typeof repo.saveMany !==
        "function"
    ){
      return Promise.reject(
        new Error(
          "Repositorio de matrículas no disponible."
        )
      );
    }

    return repo.saveMany(
      dedupeMatriculas(
        Array.isArray(rows)
          ? rows
          : []
      )
    );
  }

  var api = {
    version:
      VERSION,

    list:
      list,

    page:
      page,

    filterRows:
      filterRows,

    getByPeriodoCedula:
      getByPeriodoCedula,

    hydratePersonas:
      hydratePersonas,

    hydrateContactos:
      hydrateContactos,

    hydrateStudentDetails:
      hydrateStudentDetails,

    isActive:
      isActive,

    normalizeMatricula:
      normalizeMatricula,

    studentPeriodId:
      studentPeriodId,

    dedupeMatriculas:
      dedupeMatriculas,

    save:
      save,

    saveMany:
      saveMany
  };

  Services.register(
    "estudiantes",
    api
  );

  window.BDLServiceEstudiantes =
    api;
})(window);