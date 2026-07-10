/* =========================================================
Nombre completo: sn-sisacad-automation.js
Ruta o ubicacion: /Requisitos/electron/sn-sisacad-automation.js
Modulo: Sacar N
Funcion o funciones:
- Ejecutar la prueba visible de lectura en SISACAD.
- Buscar estudiantes por cedula, seleccionar el registro y leer las tres notas objetivo.
- Trabajar solo en modo lectura: no guardar, no grabar, no modificar y no eliminar informacion.
Con que se conecta:
- electron/main.js
- sn-sacar-n/sn-sisacad-extractor.service.js
========================================================= */

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function texto(valor) {
  return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
}

function limpiarCedula(valor) {
  return texto(valor).replace(/[^0-9]/g, '');
}

function estudianteSeguro(raw, index) {
  raw = raw || {};
  return {
    id: texto(raw.id || raw.cedula || `sn-prueba-${index + 1}`),
    orden: Number(raw.orden || index + 1),
    cedula: limpiarCedula(raw.cedula),
    nombres: texto(raw.nombres),
    carrera: texto(raw.carrera),
    periodo: texto(raw.periodo),
    modalidad: texto(raw.modalidad)
  };
}

async function executeInWindow(sisacadWindow, script) {
  if (!sisacadWindow || sisacadWindow.isDestroyed()) {
    return { ok: false, error: 'SISACAD no esta abierto.' };
  }
  try {
    return await sisacadWindow.webContents.executeJavaScript(script, true);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function pageStatusScript() {
  return `(() => {
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const bodyText = normalize(document.body ? document.body.innerText : '');
    const title = document.title || '';
    const url = location.href;
    const hasAny = (terms) => terms.some((term) => bodyText.includes(normalize(term)));
    const hasUser = hasAny(['usuario', 'user', 'correo']);
    const hasPassword = hasAny(['contraseña', 'contrasena', 'password', 'clave']);
    const necesitaLogin = (hasUser && hasPassword) || hasAny(['iniciar sesion', 'iniciar sesión', 'login']);
    const enRegistro = hasAny([
      'registro notas proyecto',
      'registro de notas proyecto',
      'notas proyecto',
      'promedio trabajo escrito',
      'promedio defensa oral del proyecto de titulacion',
      'promedio defensa oral del proyecto de titulación',
      'calificacion final del proyecto de titulacion',
      'calificación final del proyecto de titulación'
    ]);
    return { ok:true, url, title, necesitaLogin, enRegistro, textoMuestra: bodyText.slice(0, 1200) };
  })()`;
}

function searchStudentScript(cedula) {
  return `(() => {
    const cedula = ${JSON.stringify(limpiarCedula(cedula))};
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const labelFor = (el) => {
      const id = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      return id ? id.innerText : '';
    };
    const inputs = Array.from(document.querySelectorAll('input, textarea'))
      .filter((el) => visible(el))
      .filter((el) => !['hidden','password','checkbox','radio','submit','button','file'].includes(String(el.type || '').toLowerCase()));
    const scored = inputs.map((el) => {
      const meta = normalize([el.id, el.name, el.placeholder, el.title, el.getAttribute('aria-label'), labelFor(el)].join(' '));
      let score = 1;
      if (meta.includes('cedula')) score += 20;
      if (meta.includes('identificacion')) score += 16;
      if (meta.includes('documento')) score += 10;
      if (meta.includes('estudiante')) score += 8;
      if (meta.includes('buscar')) score += 4;
      return { el, meta, score };
    }).sort((a,b) => b.score - a.score);
    const input = scored[0] && scored[0].el;
    if (!input) return { ok:false, paso:'buscar', error:'No se encontro campo para escribir cedula.' };
    input.focus();
    input.value = cedula;
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));

    const forbidden = /(guardar|grabar|actualizar|eliminar|borrar|modificar|editar|calificar|registrar|aprobar|anular)/i;
    const nodes = Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"],a,[role="button"],[onclick]'))
      .filter((el) => visible(el));
    const buttons = nodes.map((el) => {
      const label = normalize(el.innerText || el.textContent || el.value || el.title || el.getAttribute('aria-label') || '');
      let score = 0;
      if (forbidden.test(label)) score -= 100;
      if (label.includes('buscar')) score += 30;
      if (label.includes('consultar')) score += 20;
      if (label.includes('filtrar')) score += 15;
      if (label.includes('search')) score += 10;
      return { el, label, score };
    }).filter((item) => item.score > 0).sort((a,b) => b.score - a.score);
    const btn = buttons[0] && buttons[0].el;
    if (btn) {
      try { btn.scrollIntoView({ block:'center', inline:'center' }); } catch (error) {}
      btn.click();
      return { ok:true, paso:'buscar', cedula, click:true, boton:buttons[0].label, campo:scored[0].meta };
    }
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, key:'Enter' }));
    return { ok:true, paso:'buscar', cedula, click:false, enter:true, campo:scored[0].meta };
  })()`;
}

function selectStudentScript() {
  return `(() => {
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const body = normalize(document.body ? document.body.innerText : '');
    if (body.includes('promedio trabajo escrito') || body.includes('calificacion final del proyecto')) {
      return { ok:true, paso:'seleccionar', clicked:false, yaEnDetalle:true };
    }
    const forbidden = /(guardar|grabar|actualizar|eliminar|borrar|modificar|editar|calificar|registrar|aprobar|anular)/i;
    const nodes = Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"],a,[role="button"],[onclick],td,span'))
      .filter((el) => visible(el));
    const scored = nodes.map((el) => {
      const label = normalize(el.innerText || el.textContent || el.value || el.title || el.getAttribute('aria-label') || '');
      let score = 0;
      if (forbidden.test(label)) score -= 100;
      if (label === 'seleccionar') score += 40;
      if (label.includes('seleccionar')) score += 30;
      if (label === 'ver') score += 12;
      if (label.includes('detalle')) score += 10;
      return { el, label, score };
    }).filter((item) => item.score > 0).sort((a,b) => b.score - a.score || a.label.length - b.label.length);
    const found = scored[0];
    if (!found) return { ok:false, paso:'seleccionar', clicked:false, error:'No se encontro boton Seleccionar.' };
    const target = found.el.closest('a,button,[role="button"],[onclick]') || found.el;
    try { target.scrollIntoView({ block:'center', inline:'center' }); } catch (error) {}
    target.click();
    return { ok:true, paso:'seleccionar', clicked:true, label:found.label };
  })()`;
}

function readNotesScript() {
  return `(() => {
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toUpperCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const rawBody = document.body ? document.body.innerText : '';
    const bodyNorm = normalize(rawBody);
    const necesitaLogin = bodyNorm.includes('USUARIO') && (bodyNorm.includes('CONTRASENA') || bodyNorm.includes('CONTRASEÑA') || bodyNorm.includes('PASSWORD'));
    const noEncontrado = ['NO SE ENCONTRARON', 'NO EXISTEN REGISTROS', 'SIN RESULTADOS', 'NO ENCONTRADO', 'NO EXISTE'].some((txt) => bodyNorm.includes(txt));
    const numberFromText = (text) => {
      const matches = String(text || '').match(/[0-9]{1,3}(?:[.,][0-9]{1,2})?/g) || [];
      const clean = matches.map((n) => n.replace(',', '.')).filter((n) => {
        const value = Number(n);
        return Number.isFinite(value) && value >= 0 && value <= 100;
      });
      return clean.length ? clean[clean.length - 1] : '';
    };
    const labels = {
      promedioTrabajoEscrito: ['PROMEDIO TRABAJO ESCRITO', 'TRABAJO ESCRITO'],
      promedioDefensaOral: ['PROMEDIO DEFENSA ORAL DEL PROYECTO DE TITULACION', 'PROMEDIO DEFENSA ORAL DEL PROYECTO DE TITULACIÓN', 'DEFENSA ORAL'],
      calificacionFinalProyecto: ['CALIFICACION FINAL DEL PROYECTO DE TITULACION', 'CALIFICACIÓN FINAL DEL PROYECTO DE TITULACIÓN', 'CALIFICACION FINAL', 'CALIFICACIÓN FINAL']
    };
    const rows = Array.from(document.querySelectorAll('tr')).map((tr) => tr.innerText || '').filter(Boolean);
    const lines = rawBody.split(String.fromCharCode(10)).map((l) => l.replace(String.fromCharCode(13), '').trim()).filter(Boolean);
    const allRows = rows.length ? rows : lines;
    const notas = { promedioTrabajoEscrito:'', promedioDefensaOral:'', calificacionFinalProyecto:'' };
    const fuentes = {};
    const buscarNota = (terms) => {
      const normalizedTerms = terms.map(normalize);
      for (const row of allRows) {
        const rowNorm = normalize(row);
        if (normalizedTerms.some((term) => rowNorm.includes(term))) {
          const value = numberFromText(row);
          if (value) return { value, source:row.slice(0, 250) };
        }
      }
      for (let i = 0; i < lines.length; i++) {
        const lineNorm = normalize(lines[i]);
        if (normalizedTerms.some((term) => lineNorm.includes(term))) {
          const joined = [lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(' ');
          const value = numberFromText(joined);
          if (value) return { value, source:joined.slice(0, 250) };
        }
      }
      return { value:'', source:'' };
    };
    Object.keys(labels).forEach((key) => {
      const found = buscarNota(labels[key]);
      notas[key] = found.value;
      fuentes[key] = found.source;
    });
    const tieneNotas = !!(notas.promedioTrabajoEscrito || notas.promedioDefensaOral || notas.calificacionFinalProyecto);
    return { ok:true, necesitaLogin, noEncontrado, tieneNotas, notas, fuentes, url:location.href, title:document.title || '', textoMuestra: rawBody.slice(0, 1600) };
  })()`;
}

async function procesarEstudiante(estudiante, context) {
  const sisacadWindow = context.getWindow();
  if (!estudiante.cedula) {
    return { ok:false, id:estudiante.id, cedula:estudiante.cedula, nombres:estudiante.nombres, estado:'Revisar manualmente', notas:{}, observacion:'Cedula vacia. No se puede buscar en SISACAD.', paso:'validacion' };
  }

  const buscar = await executeInWindow(sisacadWindow, searchStudentScript(estudiante.cedula));
  await wait(1800);
  const seleccionar = await executeInWindow(sisacadWindow, selectStudentScript());
  await wait(1800);
  const lectura = await executeInWindow(sisacadWindow, readNotesScript());

  let estado = 'Revisar manualmente';
  let observacion = 'Revise manualmente el caso en SISACAD.';
  let ok = false;

  if (lectura && lectura.necesitaLogin) {
    estado = 'Sesion expirada';
    observacion = 'SISACAD requiere inicio de sesion manual.';
  } else if (lectura && lectura.noEncontrado) {
    estado = 'No encontrado';
    observacion = 'SISACAD no mostro registros para la cedula.';
    ok = true;
  } else if (lectura && lectura.tieneNotas) {
    estado = 'Procesado';
    observacion = 'Notas leidas en prueba visible.';
    ok = true;
  } else if (lectura && lectura.ok) {
    estado = 'Sin notas';
    observacion = 'Estudiante localizado o pantalla cargada, pero no se encontraron las tres notas objetivo.';
    ok = true;
  }

  return { ok, id:estudiante.id, cedula:estudiante.cedula, nombres:estudiante.nombres, carrera:estudiante.carrera, periodo:estudiante.periodo, estado, notas:(lectura && lectura.notas) || {}, observacion, paso:'prueba_visible', buscar, seleccionar, lectura };
}

async function runPruebaVisible(estudiantes, context) {
  const lista = (Array.isArray(estudiantes) ? estudiantes : []).slice(0, 3).map(estudianteSeguro);
  if (!lista.length) return { ok:false, mensaje:'No hay estudiantes para prueba visible.', resultados:[] };

  await context.ensureOpen();
  await wait(700);

  const sisacadWindow = context.getWindow();
  const status = await executeInWindow(sisacadWindow, pageStatusScript());

  if (status && status.necesitaLogin) {
    return {
      ok:false,
      necesitaLogin:true,
      mensaje:'SISACAD necesita inicio de sesion manual. Ingrese y vuelva a ejecutar la prueba visible.',
      resultados: lista.map((e) => ({ ok:false, id:e.id, cedula:e.cedula, nombres:e.nombres, estado:'Sesion expirada', notas:{}, observacion:'SISACAD requiere inicio de sesion manual.', paso:'sesion' }))
    };
  }

  if (!status || !status.enRegistro) {
    return {
      ok:false,
      mensaje:'Antes de la prueba visible, vaya a Registro Notas Proyecto.',
      resultados: lista.map((e) => ({ ok:false, id:e.id, cedula:e.cedula, nombres:e.nombres, estado:'Revisar manualmente', notas:{}, observacion:'La ventana de SISACAD no esta en Registro Notas Proyecto.', paso:'pantalla' }))
    };
  }

  const resultados = [];
  for (const estudiante of lista) {
    if (sisacadWindow && !sisacadWindow.isDestroyed()) sisacadWindow.focus();
    const resultado = await procesarEstudiante(estudiante, context);
    resultados.push(resultado);
    await wait(1200);
  }

  const resumen = resultados.reduce((acc, item) => {
    acc.total += 1;
    if (item.estado === 'Procesado') acc.procesados += 1;
    else if (item.estado === 'Sin notas') acc.sinNotas += 1;
    else if (item.estado === 'No encontrado') acc.noEncontrados += 1;
    else acc.revisar += 1;
    return acc;
  }, { total:0, procesados:0, sinNotas:0, noEncontrados:0, revisar:0 });

  return { ok:true, modo:'prueba_visible', mensaje:'Prueba visible finalizada.', resultados, resumen };
}

module.exports = { runPruebaVisible };
