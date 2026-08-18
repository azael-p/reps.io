// JS que se embebe en el reporte para navegar del índice al detalle de cada
// usuario. Va como string exportado y no como archivo .js propio por dos
// razones: el HTML tiene que seguir siendo un único archivo autocontenido que
// se abre con file://, y eslint.config.js le asigna globals.node a todo
// scripts/**/*.js (un archivo de browser ahí marcaría document/window).
//
// Convenciones internas, para que el string no pelee con el template literal
// que lo embebe: sin backticks y sin ${ }. Y todo el render se hace con
// createElement/textContent — nunca innerHTML — así ningún dato de usuario
// puede inyectar markup, sin depender de acordarse de escapar.

export const CLIENTE_JS = String.raw`
(function () {
  var datos = JSON.parse(document.getElementById('datos').textContent)
  var porUid = {}
  datos.usuarios.forEach(function (u) { porUid[u.uid] = u })

  var vistaIndice = document.getElementById('vista-indice')
  var vistaDetalle = document.getElementById('vista-detalle')

  function el(tag, clase, texto) {
    var n = document.createElement(tag)
    if (clase) n.className = clase
    if (texto !== undefined && texto !== null) n.textContent = String(texto)
    return n
  }

  function num(n) {
    return Number(n || 0).toLocaleString('es-UY')
  }

  function tile(valor, label) {
    var t = el('div', 'tile')
    t.appendChild(el('div', 'valor', valor))
    t.appendChild(el('div', 'label', label))
    return t
  }

  function fechaCorta(iso) {
    if (!iso) return '—'
    var d = new Date(iso)
    if (isNaN(d)) return iso
    return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function tabla(headers, filas) {
    var t = el('table')
    var thead = el('thead')
    var trh = el('tr')
    headers.forEach(function (h) { trh.appendChild(el('th', null, h)) })
    thead.appendChild(trh)
    t.appendChild(thead)
    var tbody = el('tbody')
    filas.forEach(function (celdas) {
      var tr = el('tr')
      celdas.forEach(function (c) { tr.appendChild(el('td', null, c)) })
      tbody.appendChild(tr)
    })
    t.appendChild(tbody)
    return t
  }

  function textoSeries(series) {
    if (!series.length) return '—'
    return series.map(function (s) {
      var peso = s.pesoUsado === null || s.pesoUsado === undefined ? '?' : num(s.pesoUsado)
      var reps = s.repsHechas === null || s.repsHechas === undefined ? '?' : s.repsHechas
      return peso + ' kg x ' + reps
    }).join('  ·  ')
  }

  function seccionRutinas(detalle) {
    var wrap = el('section')
    var h = el('h3', null, 'Rutinas guardadas')
    if (detalle.eliminados) {
      h.appendChild(el('span', 'chip', detalle.eliminados + ' eliminado(s)'))
    }
    wrap.appendChild(h)

    if (!detalle.programas.length) {
      wrap.appendChild(el('p', 'vacio', 'Sin rutinas guardadas.'))
      return wrap
    }

    detalle.programas.forEach(function (p) {
      var card = el('div', 'card')
      card.appendChild(el('h4', null, p.nombre))
      if (!p.dias.length) {
        card.appendChild(el('p', 'vacio', 'Sin días.'))
      }
      p.dias.forEach(function (d) {
        card.appendChild(el('h5', null, d.nombre))
        if (!d.ejercicios.length) {
          card.appendChild(el('p', 'vacio', 'Sin ejercicios.'))
          return
        }
        card.appendChild(tabla(
          ['Ejercicio', 'Grupo', 'Series x reps'],
          d.ejercicios.map(function (e) {
            return [
              e.nombre + (e.esCustom ? ' (custom)' : ''),
              e.grupoMuscular || '—',
              (e.seriesEsperadas || '?') + ' x ' + (e.repsEsperadas || '?'),
            ]
          })
        ))
      })
      wrap.appendChild(card)
    })
    return wrap
  }

  function seccionSesiones(detalle) {
    var wrap = el('section')
    wrap.appendChild(el('h3', null, 'Historial de sesiones (' + detalle.sesiones.length + ')'))

    if (!detalle.sesiones.length) {
      wrap.appendChild(el('p', 'vacio', 'Sin sesiones completadas.'))
      return wrap
    }

    detalle.sesiones.forEach(function (s) {
      var det = el('details', 'sesion')
      var sum = el('summary')
      sum.appendChild(el('span', 'fecha', s.fecha || 'sin fecha'))
      sum.appendChild(el('span', 'ruta', (s.programaNombre || '–') + ' · ' + (s.diaNombre || '–')))
      sum.appendChild(el('span', 'meta', num(s.volumenTotal) + ' kg · ' + s.totalSeries + ' series'))
      if (s.sinResumen) sum.appendChild(el('span', 'chip', 'sin resumen'))
      det.appendChild(sum)

      if (s.nota) det.appendChild(el('p', 'nota', s.nota))

      if (s.ejercicios.length) {
        det.appendChild(tabla(
          ['Ejercicio', 'Grupo', 'Series'],
          s.ejercicios.map(function (e) {
            return [e.nombre, e.grupoMuscular || '—', textoSeries(e.series)]
          })
        ))
      } else if (s.sinResumen) {
        det.appendChild(el('p', 'vacio', 'Sesión anterior al campo resumen: no hay desglose de series.'))
      } else {
        det.appendChild(el('p', 'vacio', 'Sin ejercicios registrados.'))
      }

      wrap.appendChild(det)
    })
    return wrap
  }

  function renderDetalle(u) {
    vistaDetalle.textContent = ''

    var volver = el('a', 'volver', '← Volver al reporte')
    volver.href = '#'
    vistaDetalle.appendChild(volver)

    vistaDetalle.appendChild(el('h2', null, u.nombre))
    vistaDetalle.appendChild(el('p', 'sub', (u.email || 'sin email') + ' · ' + u.uid))

    var tiles = el('div', 'tiles')
    tiles.appendChild(tile(u.diasEntrenados, 'Días entrenados'))
    tiles.appendChild(tile(u.sesionesTotal === null ? '—' : u.sesionesTotal, 'Sesiones'))
    tiles.appendChild(tile(u.rachaActual, 'Racha actual'))
    tiles.appendChild(tile(u.rachaMaxima, 'Racha máxima'))
    tiles.appendChild(tile(fechaCorta(u.creadoEn), 'Alta'))
    tiles.appendChild(tile(fechaCorta(u.ultimoLogin), 'Último login'))
    vistaDetalle.appendChild(tiles)

    if (!u.detalle) {
      vistaDetalle.appendChild(el('p', 'vacio', 'Reporte generado con --sin-detalle: no hay sesiones ni rutinas cargadas.'))
      return
    }

    vistaDetalle.appendChild(seccionRutinas(u.detalle))
    vistaDetalle.appendChild(seccionSesiones(u.detalle))
  }

  function router() {
    var m = /^#\/u\/(.+)$/.exec(location.hash)
    var u = m ? porUid[decodeURIComponent(m[1])] : null
    if (u) {
      renderDetalle(u)
      vistaIndice.hidden = true
      vistaDetalle.hidden = false
    } else {
      vistaDetalle.hidden = true
      vistaIndice.hidden = false
    }
    window.scrollTo(0, 0)
  }

  Array.prototype.forEach.call(document.querySelectorAll('tr[data-uid]'), function (tr) {
    function abrir() { location.hash = '#/u/' + encodeURIComponent(tr.dataset.uid) }
    tr.addEventListener('click', abrir)
    tr.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir() }
    })
  })

  window.addEventListener('hashchange', router)
  router()
})()
`
