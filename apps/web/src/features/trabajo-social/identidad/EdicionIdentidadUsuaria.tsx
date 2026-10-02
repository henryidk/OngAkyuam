import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import type { UsuariaExpedienteHub } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { registrarGuardiaSalida } from '../../../lib/guardiaSalida'
import FormularioIdentidadUsuaria, { type DisposicionIdentidad } from './FormularioIdentidadUsuaria'
import ModalConfirmarDpi from './ModalConfirmarDpi'
import { useFormularioIdentidad } from './useFormularioIdentidad'

interface EdicionIdentidadUsuariaProps {
  usuaria: UsuariaExpedienteHub
  disposicion: DisposicionIdentidad
  onGuardado: (usuaria: UsuariaExpedienteHub) => void
  /** Se llama al cancelar o descartar; quien lo contiene vuelve a su modo de lectura. */
  onSalir: () => void
  /** Márgenes del pie para pegarlo a los bordes del contenedor (dependen de su padding). */
  clasePie?: string
}

function textoCambios(cantidad: number): string {
  return cantidad === 1 ? '1 cambio sin guardar' : `${cantidad} cambios sin guardar`
}

function estadoDelPie(estado: { errorEnvio: string | null; esValido: boolean; cantidad: number }) {
  if (estado.errorEnvio) return { texto: estado.errorEnvio, clase: 'text-red-600' }
  if (!estado.esValido) return { texto: 'Revisa los campos marcados en rojo.', clase: 'text-red-600' }
  if (estado.cantidad > 0) return { texto: textoCambios(estado.cantidad), clase: 'text-brand-700' }
  return { texto: 'Sin cambios todavía', clase: 'text-gray-400' }
}

/**
 * Edición en línea de la identidad: campos + pie con el estado y los botones + confirmaciones
 * (cambio de DPI, descartar). No sabe dónde está montada: la ficha y el wizard le ponen su marco.
 */
export default function EdicionIdentidadUsuaria({
  usuaria,
  disposicion,
  onGuardado,
  onSalir,
  clasePie = '',
}: EdicionIdentidadUsuariaProps) {
  const formulario = useFormularioIdentidad(usuaria, onGuardado)
  const { form, camposModificados, dpiModificado, esValido, enviando, errorEnvio, guardar } = formulario
  const cantidad = camposModificados.length
  const puedeGuardar = cantidad > 0 && esValido

  const [confirmandoDpi, setConfirmandoDpi] = useState(false)
  // Lo que se iba a hacer cuando apareció "¿Descartar los cambios?" (salir de la edición o navegar).
  const [salidaPendiente, setSalidaPendiente] = useState<(() => void) | null>(null)
  const hayModalAbierto = confirmandoDpi || salidaPendiente !== null

  const pedirSalida = useCallback(
    (continuar: () => void) => {
      if (cantidad === 0) continuar()
      else setSalidaPendiente(() => continuar)
    },
    [cantidad],
  )

  useEffect(() => {
    form.setFocus('nombres')
  }, [form])

  // Pestañas, menú y migas consultan esta guardia antes de navegar.
  useEffect(() => {
    if (cantidad === 0) return
    return registrarGuardiaSalida((continuar) => setSalidaPendiente(() => continuar))
  }, [cantidad])

  // Recargar o cerrar la pestaña del navegador: el aviso lo muestra el propio navegador.
  useEffect(() => {
    if (cantidad === 0) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cantidad])

  useEffect(() => {
    // Con un modal abierto, Esc lo cierra a él (ver `useDialogoModal`).
    if (hayModalAbierto || enviando) return
    function onKeyDown(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape') pedirSalida(onSalir)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [hayModalAbierto, enviando, pedirSalida, onSalir])

  function pedirGuardar() {
    if (!puedeGuardar || enviando) return
    if (dpiModificado) setConfirmandoDpi(true)
    else void guardar()
  }

  async function confirmarDpi() {
    await guardar()
    setConfirmandoDpi(false)
  }

  function descartar() {
    const continuar = salidaPendiente
    setSalidaPendiente(null)
    onSalir()
    if (continuar !== onSalir) continuar?.()
  }

  // No es un `<form>`: en el wizard vive dentro del formulario del caso y Enter lo enviaría.
  function onKeyDown(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Enter' && evento.target instanceof HTMLInputElement) {
      evento.preventDefault()
      pedirGuardar()
    }
  }

  const pie = estadoDelPie({ errorEnvio, esValido, cantidad })

  return (
    <div onKeyDown={onKeyDown}>
      <FormularioIdentidadUsuaria formulario={formulario} registradaEl={usuaria.createdAt} disposicion={disposicion} />

      <div
        className={`sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/80 py-3.5 backdrop-blur ${clasePie}`}
      >
        <p aria-live="polite" className={`min-w-0 flex-1 text-[13px] ${pie.clase}`}>
          {pie.texto}
        </p>
        <Button type="button" variante="secondary" tamano="md" onClick={() => pedirSalida(onSalir)} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="button" tamano="md" onClick={pedirGuardar} disabled={!puedeGuardar} cargando={enviando && !confirmandoDpi}>
          Guardar cambios
        </Button>
      </div>

      {confirmandoDpi && (
        <ModalConfirmarDpi
          usuariaId={usuaria.id}
          dpiAnterior={usuaria.dpi}
          dpiNuevo={form.getValues('dpi')}
          cargando={enviando}
          onConfirmar={() => void confirmarDpi()}
          onVolver={() => setConfirmandoDpi(false)}
        />
      )}

      <ConfirmModal
        abierto={salidaPendiente !== null}
        titulo="¿Descartar los cambios?"
        descripcion={`Tienes ${textoCambios(cantidad)}. Si sales ahora, se pierden.`}
        confirmarLabel="Descartar"
        cancelarLabel="Seguir editando"
        peligro
        onConfirmar={descartar}
        onCancelar={() => setSalidaPendiente(null)}
      />
    </div>
  )
}
