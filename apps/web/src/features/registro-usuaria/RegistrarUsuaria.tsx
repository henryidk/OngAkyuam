import axios from 'axios'
import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import type { ExpedienteCreado, RegistroUsuariaNuevaFormValues, UsuariaExpedienteHub } from '@akyuam/shared'
import Button from '../../components/ui/Button'
import { extraerMensajeError } from '../../lib/errors'
import ResumenIdentidadUsuaria from '../trabajo-social/ResumenIdentidadUsuaria'
import {
  crearCasoParaUsuaria,
  crearExpedienteConUsuaria,
  obtenerUsuaria,
} from '../trabajo-social/api/trabajoSocial.api'
import FranjaRegistro from './components/FranjaRegistro'
import MarcoWizard from './components/MarcoWizard'
import { usePosiblesDuplicadas } from './hooks/usePosiblesDuplicadas'
import { useRegistroUsuariaForm, valoresIniciales } from './hooks/useRegistroUsuariaForm'
import PasoDatosUsuaria from './steps/PasoDatosUsuaria'
import PasoHijos from './steps/PasoHijos'
import PasoRevision from './steps/PasoRevision'
import PasoSituacion from './steps/PasoSituacion'
import PasoTipoRegistro from './steps/PasoTipoRegistro'
import SeguimientoRegistro from './SeguimientoRegistro'
import { construirPasos, type PasoId } from './wizard'

/** Estado de navegación que la ficha de la usuaria (pestaña Casos) pasa vía React Router al arrancar el wizard directo en modo caso-existente. */
interface EstadoNavegacionRegistro {
  usuariaId?: string
}

type ModoWizard = { tipo: 'nueva' } | { tipo: 'existente'; usuariaId: string }

/**
 * Entra directo al paso "Usuaria": ya no hay una pantalla previa de búsqueda. Si al verificar el
 * DPI (o por nombre y fecha de nacimiento) resulta que la usuaria ya existe, el wizard cambia a
 * modo "existente" y solo pide los datos del caso.
 *
 * Primero se registra (usuaria y caso, sin depender de nada más); después, con el expediente ya
 * creado, vienen los pasos opcionales de referir y subir documentos (`SeguimientoRegistro`).
 */
export default function RegistrarUsuaria() {
  const location = useLocation()
  const estadoRuta = (location.state ?? null) as EstadoNavegacionRegistro | null

  const [modo, setModo] = useState<ModoWizard>(
    estadoRuta?.usuariaId ? { tipo: 'existente', usuariaId: estadoRuta.usuariaId } : { tipo: 'nueva' },
  )
  // Cada registro arranca con un formulario limpio: cambiar la `key` desmonta el wizard anterior.
  const [numeroRegistro, setNumeroRegistro] = useState(0)

  function iniciarRegistroNuevo() {
    setModo({ tipo: 'nueva' })
    setNumeroRegistro((actual) => actual + 1)
  }

  return (
    <WizardRegistro
      key={modo.tipo === 'existente' ? modo.usuariaId : `nueva-${numeroRegistro}`}
      usuariaExistente={modo.tipo === 'existente'}
      usuariaId={modo.tipo === 'existente' ? modo.usuariaId : undefined}
      onRegistrarOtraUsuaria={iniciarRegistroNuevo}
      onRegistrarCasoPara={(usuariaId) => setModo({ tipo: 'existente', usuariaId })}
    />
  )
}

interface WizardRegistroProps {
  usuariaExistente: boolean
  usuariaId?: string
  onRegistrarOtraUsuaria: () => void
  onRegistrarCasoPara: (usuariaId: string) => void
}

function WizardRegistro({
  usuariaExistente,
  usuariaId,
  onRegistrarOtraUsuaria,
  onRegistrarCasoPara,
}: WizardRegistroProps) {
  const { form, ninosFieldArray } = useRegistroUsuariaForm(usuariaExistente)
  const { posiblesDuplicadas, hayAvisoNuevo } = usePosiblesDuplicadas()
  const tipoRegistro = useWatch({ control: form.control, name: 'datosCaso.tipoRegistro' })
  const pasos = construirPasos(usuariaExistente, tipoRegistro)
  const [pasoActual, setPasoActual] = useState(0)
  const [sinDatosAgresor, setSinDatosAgresor] = useState(false)
  const [expedienteCreado, setExpedienteCreado] = useState<ExpedienteCreado | null>(null)
  const [cantidadHijos, setCantidadHijos] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [conflictoDpi, setConflictoDpi] = useState(false)

  const [usuaria, setUsuaria] = useState<UsuariaExpedienteHub | null>(null)
  const [cargandoUsuaria, setCargandoUsuaria] = useState(usuariaExistente)
  const [errorUsuaria, setErrorUsuaria] = useState<string | null>(null)

  useEffect(() => {
    if (!usuariaExistente || !usuariaId) return
    let cancelado = false
    setCargandoUsuaria(true)
    obtenerUsuaria(usuariaId)
      .then((datos) => {
        if (!cancelado) setUsuaria(datos)
      })
      .catch((err: unknown) => {
        if (!cancelado) setErrorUsuaria(extraerMensajeError(err))
      })
      .finally(() => {
        if (!cancelado) setCargandoUsuaria(false)
      })
    return () => {
      cancelado = true
    }
  }, [usuariaExistente, usuariaId])

  // Solo los pasos de datos: referir y documentos necesitan el caso ya creado.
  const pasosDatos = pasos.filter((p) => p.fase === 'datos')
  // "Hijas e hijos" aparece y desaparece según el tipo de registro; como va después de "Tipo de
  // registro", el índice del paso actual nunca apunta a otro paso — el tope es solo defensivo.
  const indiceActual = Math.min(pasoActual, pasosDatos.length - 1)
  const paso = pasosDatos[indiceActual]
  const esPrimerPaso = indiceActual === 0
  const esUltimoPaso = indiceActual === pasosDatos.length - 1

  async function irAlSiguientePaso() {
    const camposValidos = paso.campos.length === 0 || (await form.trigger(paso.campos))
    if (!camposValidos) return
    // Sin bloquear: el aviso se muestra una vez y un segundo "Siguiente" continúa.
    if (paso.id === 'usuaria' && (await hayAvisoNuevo(form.getValues('datosUsuaria')))) return
    setPasoActual(Math.min(indiceActual + 1, pasosDatos.length - 1))
  }

  function irAlPasoAnterior() {
    setPasoActual(Math.max(indiceActual - 1, 0))
  }

  function irAPaso(id: PasoId) {
    const indice = pasosDatos.findIndex((p) => p.id === id)
    if (indice !== -1 && indice <= indiceActual) {
      setPasoActual(indice)
    }
  }

  async function onSubmit(datos: RegistroUsuariaNuevaFormValues) {
    // Con el formulario ya válido, un Enter en un paso intermedio no registra sin pasar por Revisión.
    if (!esUltimoPaso) {
      await irAlSiguientePaso()
      return
    }
    setGuardando(true)
    setErrorGuardado(null)
    setConflictoDpi(false)
    try {
      const creado =
        usuariaExistente && usuariaId
          ? await crearCasoParaUsuaria(usuariaId, datos.datosCaso)
          : await crearExpedienteConUsuaria(datos)
      setCantidadHijos(datos.datosCaso.ninos.length)
      setExpedienteCreado(creado)
    } catch (err) {
      setErrorGuardado(extraerMensajeError(err))
      if (axios.isAxiosError(err)) {
        // 409 solo lo devuelve el DPI duplicado.
        setConflictoDpi(err.response?.status === 409)
      }
    } finally {
      setGuardando(false)
    }
  }

  if (expedienteCreado) {
    return (
      <SeguimientoRegistro
        expediente={expedienteCreado}
        usuariaExistente={usuariaExistente}
        cantidadHijos={cantidadHijos}
        onRegistrarOtraUsuaria={onRegistrarOtraUsuaria}
      />
    )
  }

  if (usuariaExistente && cargandoUsuaria) {
    return (
      <div role="status" aria-label="Cargando datos de la usuaria" className="mx-auto max-w-6xl space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-96 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (usuariaExistente && (errorUsuaria || !usuaria)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{errorUsuaria ?? 'No se pudo cargar la usuaria.'}</p>
        <Button type="button" tamano="md" onClick={onRegistrarOtraUsuaria} className="mt-4">
          Registrar una usuaria nueva
        </Button>
      </div>
    )
  }

  return (
    <MarcoWizard
      pasos={pasos}
      pasoActualId={paso.id}
      onIrAPaso={irAPaso}
      encabezadoLateral={
        <>
          Expediente <span className="font-semibold">se asigna al registrar</span>
        </>
      }
      onSubmit={form.handleSubmit(onSubmit)}
      avisos={
        <>
          {usuariaExistente && usuaria && <ResumenIdentidadUsuaria usuaria={usuaria} onActualizado={setUsuaria} />}
          {esPrimerPaso && <FranjaRegistro form={form} />}
          {paso.id === 'revision' && errorGuardado && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{errorGuardado}</p>
              {conflictoDpi && (
                <button type="button" onClick={() => irAPaso('usuaria')} className="mt-1 font-medium underline">
                  Revisar el DPI
                </button>
              )}
            </div>
          )}
        </>
      }
      pie={
        <>
          <Button
            type="button"
            variante="secondary"
            tamano="md"
            onClick={irAlPasoAnterior}
            className={esPrimerPaso ? 'invisible' : undefined}
          >
            Anterior
          </Button>

          {esUltimoPaso ? (
            <Button type="submit" tamano="md" cargando={guardando}>
              {usuariaExistente ? 'Registrar caso' : 'Registrar usuaria'}
            </Button>
          ) : (
            <Button type="button" tamano="md" onClick={() => void irAlSiguientePaso()}>
              Siguiente
            </Button>
          )}
        </>
      }
    >
      {paso.id === 'usuaria' && (
        <PasoDatosUsuaria form={form} posiblesDuplicadas={posiblesDuplicadas} onRegistrarCasoPara={onRegistrarCasoPara} />
      )}
      {paso.id === 'situacion' && (
        <PasoSituacion form={form} sinDatosAgresor={sinDatosAgresor} onCambiarSinDatosAgresor={setSinDatosAgresor} />
      )}
      {paso.id === 'registro' && <PasoTipoRegistro form={form} />}
      {paso.id === 'hijos' && <PasoHijos form={form} ninosFieldArray={ninosFieldArray} />}
      {paso.id === 'revision' && <PasoRevision form={form} onEditar={irAPaso} usuariaExistente={usuariaExistente} />}
    </MarcoWizard>
  )
}

// Exportado solo para que iniciarNuevoRegistro pueda resetear el formulario si en el futuro se
// reusa el wizard sin desmontarlo; hoy `key` en RegistrarUsuaria ya garantiza un formulario limpio.
export { valoresIniciales as valoresInicialesRegistroUsuaria }
