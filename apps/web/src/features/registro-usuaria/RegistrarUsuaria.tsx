import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import type {
  ExpedienteCreado,
  RegistroUsuariaNuevaFormValues,
  TipoDocumentoTrabajoSocial,
  UsuariaExpedienteHub,
} from '@akyuam/shared'
import Button from '../../components/ui/Button'
import { extraerMensajeError } from '../../lib/errors'
import ResumenIdentidadUsuaria from '../trabajo-social/ResumenIdentidadUsuaria'
import {
  crearCasoParaUsuaria,
  crearExpedienteConUsuaria,
  obtenerUsuaria,
} from '../trabajo-social/api/trabajoSocial.api'
import ConfirmacionRegistro from './components/ConfirmacionRegistro'
import FranjaRegistro from './components/FranjaRegistro'
import IndicadorPasos from './components/IndicadorPasos'
import IndicadorPasosVertical from './components/IndicadorPasosVertical'
import { useDocumentosStaging } from './hooks/useDocumentosStaging'
import { usePosiblesDuplicadas } from './hooks/usePosiblesDuplicadas'
import { useRegistroUsuariaForm, valoresIniciales } from './hooks/useRegistroUsuariaForm'
import PasoDatosUsuaria from './steps/PasoDatosUsuaria'
import PasoDocumentos from './steps/PasoDocumentos'
import PasoHijos from './steps/PasoHijos'
import PasoRevision from './steps/PasoRevision'
import PasoSituacion from './steps/PasoSituacion'
import PasoTipoRegistro from './steps/PasoTipoRegistro'
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
  const documentosStaging = useDocumentosStaging()
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
  const [documentoNoDisponible, setDocumentoNoDisponible] = useState(false)
  const [documentosAdjuntados, setDocumentosAdjuntados] = useState<TipoDocumentoTrabajoSocial[]>([])

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

  // "Hijas e hijos" aparece y desaparece según el tipo de registro; como va después de "Tipo de
  // registro", el índice del paso actual nunca apunta a otro paso — el tope es solo defensivo.
  const indiceActual = Math.min(pasoActual, pasos.length - 1)
  const paso = pasos[indiceActual]
  const esPrimerPaso = indiceActual === 0
  const esUltimoPaso = indiceActual === pasos.length - 1

  async function irAlSiguientePaso() {
    const camposValidos = paso.campos.length === 0 || (await form.trigger(paso.campos))
    if (!camposValidos) return
    // Sin bloquear: el aviso se muestra una vez y un segundo "Siguiente" continúa.
    if (paso.id === 'usuaria' && (await hayAvisoNuevo(form.getValues('datosUsuaria')))) return
    setPasoActual(Math.min(indiceActual + 1, pasos.length - 1))
  }

  function irAlPasoAnterior() {
    setPasoActual(Math.max(indiceActual - 1, 0))
  }

  function irAPaso(id: PasoId) {
    const indice = pasos.findIndex((p) => p.id === id)
    if (indice !== -1 && indice <= indiceActual) {
      setPasoActual(indice)
    }
  }

  async function onSubmit(datos: RegistroUsuariaNuevaFormValues) {
    // El botón ya se deshabilita mientras suben; esto cubre un Enter en el formulario.
    if (documentosStaging.haySubidasEnCurso) return
    setGuardando(true)
    setErrorGuardado(null)
    setConflictoDpi(false)
    setDocumentoNoDisponible(false)
    const documentosPendientesIds = documentosStaging.idsParaRegistrar(datos.datosCaso.tipoRegistro)
    try {
      const creado =
        usuariaExistente && usuariaId
          ? await crearCasoParaUsuaria(usuariaId, { ...datos.datosCaso, documentosPendientesIds })
          : await crearExpedienteConUsuaria({ ...datos, documentosPendientesIds })
      documentosStaging.marcarAdjuntados(documentosPendientesIds)
      setDocumentosAdjuntados(
        documentosStaging.documentos
          .filter((documento) => documento.estado === 'subido' && documentosPendientesIds.includes(documento.pendienteId))
          .map((documento) => documento.tipo),
      )
      setCantidadHijos(datos.datosCaso.ninos.length)
      setExpedienteCreado(creado)
    } catch (err) {
      setErrorGuardado(extraerMensajeError(err))
      if (axios.isAxiosError(err)) {
        // 409 solo lo devuelve el DPI duplicado; los documentos usan 422/400 a propósito.
        setConflictoDpi(err.response?.status === 409)
        setDocumentoNoDisponible(err.response?.status === 422 || err.response?.status === 400)
      }
    } finally {
      setGuardando(false)
    }
  }

  if (expedienteCreado) {
    return (
      <ConfirmacionRegistro
        expediente={expedienteCreado}
        usuariaExistente={usuariaExistente}
        cantidadHijos={cantidadHijos}
        documentosAdjuntados={documentosAdjuntados}
        onNuevoRegistro={onRegistrarOtraUsuaria}
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
    <div className="mx-auto max-w-6xl">
      <div className="lg:hidden">
        <IndicadorPasos pasos={pasos} pasoActualId={paso.id} onIrAPaso={irAPaso} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <p className="mb-4 text-xs text-gray-500">
            Expediente <span className="font-semibold">se asigna al guardar</span>
          </p>
          <IndicadorPasosVertical pasos={pasos} pasoActualId={paso.id} onIrAPaso={irAPaso} />
        </aside>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <header className="border-b border-gray-100 px-6 py-5">
            <p className="text-xs font-medium text-brand-600">
              Paso {indiceActual + 1} de {pasos.length}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">{paso.titulo}</h2>
            {paso.ayuda && <p className="text-[13px] text-gray-500">{paso.ayuda}</p>}
          </header>

          <div className="flex flex-col gap-5 p-6">
            {usuariaExistente && usuaria && (
              <ResumenIdentidadUsuaria usuaria={usuaria} onActualizado={setUsuaria} />
            )}

            {esPrimerPaso && <FranjaRegistro form={form} />}

            {paso.id === 'revision' && errorGuardado && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{errorGuardado}</p>
                {conflictoDpi && (
                  <button type="button" onClick={() => irAPaso('usuaria')} className="mt-1 font-medium underline">
                    Revisar el DPI
                  </button>
                )}
                {documentoNoDisponible && (
                  <button type="button" onClick={() => irAPaso('documentos')} className="mt-1 font-medium underline">
                    Ir a Documentos
                  </button>
                )}
              </div>
            )}

            {paso.id === 'revision' && documentosStaging.haySubidasEnCurso && (
              <p
                role="status"
                className="flex items-center gap-2 rounded border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800"
              >
                <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
                Terminando de subir los documentos… podrás registrar en cuanto acaben.
              </p>
            )}

            {paso.id === 'usuaria' && (
              <PasoDatosUsuaria
                form={form}
                posiblesDuplicadas={posiblesDuplicadas}
                onRegistrarCasoPara={onRegistrarCasoPara}
              />
            )}
            {paso.id === 'situacion' && (
              <PasoSituacion
                form={form}
                sinDatosAgresor={sinDatosAgresor}
                onCambiarSinDatosAgresor={setSinDatosAgresor}
              />
            )}
            {paso.id === 'registro' && <PasoTipoRegistro form={form} />}
            {paso.id === 'hijos' && <PasoHijos form={form} ninosFieldArray={ninosFieldArray} />}
            {paso.id === 'documentos' && <PasoDocumentos tipoRegistro={tipoRegistro} staging={documentosStaging} />}
            {paso.id === 'revision' && (
              <PasoRevision
                form={form}
                onEditar={irAPaso}
                usuariaExistente={usuariaExistente}
                documentos={documentosStaging.documentos}
                tipoRegistro={tipoRegistro}
              />
            )}
          </div>

          <div className="flex justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-4">
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
              <Button
                type="submit"
                tamano="md"
                cargando={guardando}
                disabled={documentosStaging.haySubidasEnCurso}
                title={documentosStaging.haySubidasEnCurso ? 'Espera a que terminen de subir los documentos' : undefined}
              >
                {usuariaExistente ? 'Registrar caso' : 'Registrar usuaria'}
              </Button>
            ) : (
              <Button type="button" tamano="md" onClick={irAlSiguientePaso}>
                Siguiente
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// Exportado solo para que iniciarNuevoRegistro pueda resetear el formulario si en el futuro se
// reusa el wizard sin desmontarlo; hoy `key` en RegistrarUsuaria ya garantiza un formulario limpio.
export { valoresIniciales as valoresInicialesRegistroUsuaria }
