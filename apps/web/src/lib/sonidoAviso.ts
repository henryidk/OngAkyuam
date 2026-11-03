/**
 * Sonido de aviso generado con Web Audio: no hay archivo de audio que servir ni cachear.
 *
 * Los navegadores no dejan sonar una página hasta que la persona interactúa con ella (clic o
 * tecla). Tras el login ya hubo un clic, así que suena; si se recarga la página, el primer clic
 * o tecla desbloquea el audio para los avisos siguientes. Mientras esté bloqueado, el aviso se
 * muestra igual, solo que sin sonido.
 */

type ConstructorAudio = typeof AudioContext

let contexto: AudioContext | null = null

function obtenerContexto(): AudioContext | null {
  if (contexto) return contexto
  const Constructor: ConstructorAudio | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: ConstructorAudio }).webkitAudioContext
  if (!Constructor) return null
  contexto = new Constructor()
  return contexto
}

/** Desbloquea el audio con la primera interacción. Devuelve la función que quita los listeners. */
export function prepararSonidoAviso(): () => void {
  const desbloquear = () => {
    void obtenerContexto()?.resume()
  }
  window.addEventListener('pointerdown', desbloquear)
  window.addEventListener('keydown', desbloquear)
  return () => {
    window.removeEventListener('pointerdown', desbloquear)
    window.removeEventListener('keydown', desbloquear)
  }
}

/** Sin interacción previa, `resume()` queda pendiente para siempre: se espera poco y se sigue. */
async function intentarReanudar(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'running') return true
  await Promise.race([ctx.resume().catch(() => undefined), new Promise((resolver) => setTimeout(resolver, 300))])
  return (ctx.state as AudioContextState) === 'running'
}

// Do – Mi – Sol agudos, dos veces: corto y reconocible, distinto de los sonidos del sistema.
const NOTAS_HZ = [1046.5, 1318.5, 1568]
const DURACION_NOTA_S = 0.16
const PAUSA_ENTRE_REPETICIONES_S = 0.25
const REPETICIONES = 2
const VOLUMEN = 0.22

function tocarNota(ctx: AudioContext, frecuencia: number, inicio: number) {
  const oscilador = ctx.createOscillator()
  const ganancia = ctx.createGain()
  oscilador.type = 'sine'
  oscilador.frequency.value = frecuencia
  // Entrada y salida suaves: sin el "clic" de cortar la onda en seco.
  ganancia.gain.setValueAtTime(0, inicio)
  ganancia.gain.linearRampToValueAtTime(VOLUMEN, inicio + 0.015)
  ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + DURACION_NOTA_S)
  oscilador.connect(ganancia).connect(ctx.destination)
  oscilador.start(inicio)
  oscilador.stop(inicio + DURACION_NOTA_S + 0.02)
}

/** `false` si el navegador todavía no permite sonido (o no tiene Web Audio). */
export async function reproducirSonidoAviso(): Promise<boolean> {
  const ctx = obtenerContexto()
  if (!ctx || !(await intentarReanudar(ctx))) return false
  const duracionSerie = NOTAS_HZ.length * DURACION_NOTA_S
  let instante = ctx.currentTime + 0.05
  for (let repeticion = 0; repeticion < REPETICIONES; repeticion++) {
    NOTAS_HZ.forEach((frecuencia, indice) => tocarNota(ctx, frecuencia, instante + indice * DURACION_NOTA_S))
    instante += duracionSerie + PAUSA_ENTRE_REPETICIONES_S
  }
  return true
}
