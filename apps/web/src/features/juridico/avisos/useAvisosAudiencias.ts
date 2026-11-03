import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  contenidoNotificacionAvisos,
  rangoNivelAviso,
  type AvisosAudienciasDto,
  type NivelAvisoAudiencia,
} from '@akyuam/shared'
import { prepararSonidoAviso, reproducirSonidoAviso } from '../../../lib/sonidoAviso'
import { useAuthStore } from '../../../store/auth.store'
import { obtenerAvisosAudiencias } from '../api/juridico.api'
import { RUTAS_JURIDICO } from '../rutas'
import { enHorarioOficina, franjaHora, msHastaSiguienteHora, reclamarFranja } from './programacion'

/** Con la pestaña a la vista, la insignia de la campana se mantiene al día sin sonar. */
const REFRESCO_SILENCIOSO_MS = 15 * 60 * 1000

/** Al volver a la pestaña se actualiza, salvo que la última consulta sea muy reciente. */
const REFRESCO_AL_VOLVER_MS = 60 * 1000

/**
 * Sin ningún clic ni tecla en la página durante una jornada, los avisos se detienen. Cada consulta
 * renueva la sesión: sin este tope, una pestaña olvidada en una computadora compartida quedaría
 * con la sesión abierta para siempre. Se reanudan con la primera interacción.
 */
const INACTIVIDAD_MAXIMA_MS = 10 * 60 * 60 * 1000

const ETIQUETA_NOTIFICACION = 'akyuam-juridico-audiencias'

export type PermisoEscritorio = NotificationPermission | 'no-disponible'

function permisoActual(): PermisoEscritorio {
  return 'Notification' in window ? Notification.permission : 'no-disponible'
}

/**
 * Notificación del navegador (la del sistema operativo, en la esquina de la pantalla). Sale
 * también con la página abierta y en primer plano. Solo cifras: se ve en la pantalla bloqueada y
 * queda en el historial del sistema, fuera del control de acceso de la app. `null` si no hay
 * permiso o el navegador la rechaza.
 */
function notificarEscritorio(titulo: string, opciones: NotificationOptions, alAbrir: () => void): Notification | null {
  if (permisoActual() !== 'granted') return null
  try {
    const notificacion = new Notification(titulo, {
      icon: '/favicon.svg',
      // Misma etiqueta: el aviso de cada hora reemplaza al anterior en vez de apilarse.
      tag: ETIQUETA_NOTIFICACION,
      ...opciones,
    })
    notificacion.onclick = (evento) => {
      evento.preventDefault()
      window.focus()
      alAbrir()
      notificacion.close()
    }
    return notificacion
  } catch {
    // Algunos navegadores (Chrome en Android) solo las permiten desde un service worker.
    return null
  }
}

/**
 * Avisos de audiencias para todo Jurídico: al entrar y a cada hora en punto (de lunes a viernes,
 * de 8:00 a 16:00 en Guatemala), si hay audiencias de hoy a 7 días, suena y manda la notificación del navegador. El panel de la campana solo se
 * abre con un clic. Una sola pestaña avisa por hora. Al hacer clic en la notificación se abre la
 * sección Audiencias acotada a los días que nombra su título.
 */
export function useAvisosAudiencias() {
  const usuarioId = useAuthStore((state) => state.usuario?.id)
  const navigate = useNavigate()
  const [datos, setDatos] = useState<AvisosAudienciasDto | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [permiso, setPermiso] = useState<PermisoEscritorio>(permisoActual)

  const notificacionRef = useRef<Notification | null>(null)
  const ultimaCargaRef = useRef(0)
  const ultimaInteraccionRef = useRef(Date.now())

  // Los avisos son un apoyo: si la consulta falla, se reintenta en el siguiente ciclo.
  const cargar = useCallback(() => {
    if (Date.now() - ultimaInteraccionRef.current > INACTIVIDAD_MAXIMA_MS) return Promise.resolve(null)
    ultimaCargaRef.current = Date.now()
    return obtenerAvisosAudiencias()
      .then((respuesta) => {
        setDatos(respuesta)
        return respuesta
      })
      .catch(() => null)
  }, [])

  const mostrar = useCallback(
    (notificacion: Notification | null) => {
      notificacionRef.current?.close()
      notificacionRef.current = notificacion
    },
    [],
  )

  const irAAudiencias = useCallback(
    (nivel: NivelAvisoAudiencia, hoy: string) => {
      setAbierto(false)
      navigate(RUTAS_JURIDICO.audiencias(rangoNivelAviso(nivel, hoy)))
    },
    [navigate],
  )

  const anunciar = useCallback(async () => {
    if (!usuarioId) return
    // Fuera de horario no suena ni notifica. Si la pestaña está a la vista (alguien trabajando tarde),
    // la cifra de la campana igual se carga; en segundo plano, ni siquiera se consulta al servidor.
    if (!enHorarioOficina(new Date())) {
      if (document.visibilityState === 'visible') await cargar()
      return
    }
    const respuesta = await cargar()
    const contenido = respuesta && contenidoNotificacionAvisos(respuesta.conteos)
    if (!respuesta || !contenido) return
    if (!(await reclamarFranja(usuarioId, franjaHora(new Date())))) return

    void reproducirSonidoAviso()
    const notificacion = notificarEscritorio(
      contenido.titulo,
      {
        body: contenido.cuerpo,
        // Hoy y mañana no desaparecen solas: hay que cerrarlas.
        requireInteraction: respuesta.conteos.HOY + respuesta.conteos.MANANA > 0,
      },
      () => irAAudiencias(contenido.nivel, respuesta.hoy),
    )
    // Sin permiso del navegador quedan el sonido y la cifra de la campana: el panel nunca se abre
    // solo, porque tapaba la pantalla a media tarea.
    mostrar(notificacion)
  }, [cargar, irAAudiencias, mostrar, usuarioId])

  useEffect(() => {
    const quitarDesbloqueo = prepararSonidoAviso()
    void anunciar()

    let temporizador: ReturnType<typeof setTimeout>
    const programar = () => {
      temporizador = setTimeout(() => {
        void anunciar()
        programar()
      }, msHastaSiguienteHora(Date.now()))
    }
    programar()

    // En segundo plano solo corre el aviso de cada hora; el refresco de la insignia, a la vista.
    const refresco = setInterval(() => {
      if (document.visibilityState === 'visible') void cargar()
    }, REFRESCO_SILENCIOSO_MS)

    const alInteractuar = () => {
      ultimaInteraccionRef.current = Date.now()
    }
    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== 'visible') return
      alInteractuar()
      if (Date.now() - ultimaCargaRef.current > REFRESCO_AL_VOLVER_MS) void cargar()
    }
    window.addEventListener('pointerdown', alInteractuar, { passive: true })
    window.addEventListener('keydown', alInteractuar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      quitarDesbloqueo()
      clearTimeout(temporizador)
      clearInterval(refresco)
      window.removeEventListener('pointerdown', alInteractuar)
      window.removeEventListener('keydown', alInteractuar)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      // Al cerrar sesión o salir de Jurídico no queda un aviso que lleve de vuelta a la app.
      notificacionRef.current?.close()
      notificacionRef.current = null
    }
  }, [anunciar, cargar])

  // El permiso solo se puede pedir tras un clic de la persona (botón del panel).
  const pedirPermisoEscritorio = useCallback(async () => {
    if (!('Notification' in window)) return
    const resultado = await Notification.requestPermission()
    setPermiso(resultado)
    // Confirmación inmediata: así se comprueba en el momento que el aviso se ve y suena.
    if (resultado === 'granted') {
      void reproducirSonidoAviso()
      mostrar(
        notificarEscritorio(
          'Avisos de audiencias activados',
          { body: 'Cada hora te avisaremos de las audiencias de los próximos 7 días.' },
          () => setAbierto(true),
        ),
      )
    }
  }, [mostrar])

  const abrir = useCallback(() => {
    setAbierto(true)
    void cargar()
  }, [cargar])
  const cerrar = useCallback(() => setAbierto(false), [])

  return { datos, abierto, abrir, cerrar, permiso, pedirPermisoEscritorio }
}
