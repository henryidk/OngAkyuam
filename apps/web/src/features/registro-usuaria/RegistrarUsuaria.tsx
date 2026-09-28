import axios from 'axios'
import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useLocation } from 'react-router-dom'
import type {
  ExpedienteCreado,
  RegistroUsuariaNuevaFormValues,
  TipoDocumentoTrabajoSocial,
  UsuariaExpedienteHub,
  UsuariaResumenBusqueda,
} from '@akyuam/shared'
import Button from '../../components/ui/Button'
import { extraerMensajeError } from '../../lib/errors'
import ResumenIdentidadUsuaria from '../trabajo-social/ResumenIdentidadUsuaria'
import {
  crearCasoParaUsuaria,
  crearExpedienteConUsuaria,
  obtenerUsuaria,
  subirDocumentoCaso,
} from '../trabajo-social/api/trabajoSocial.api'
import ConfirmacionRegistro from './components/ConfirmacionRegistro'
import FranjaRegistro from './components/FranjaRegistro'
import IndicadorPasos from './components/IndicadorPasos'
import IndicadorPasosVertical from './components/IndicadorPasosVertical'
import { useDocumentosStaging, type DocumentoEnSubida } from './hooks/useDocumentosStaging'
import { useRegistroUsuariaForm, valoresIniciales } from './hooks/useRegistroUsuariaForm'
import PasoBuscarUsuaria from './steps/PasoBuscarUsuaria'
import PasoDatosUsuaria from './steps/PasoDatosUsuaria'
import PasoDocumentos from './steps/PasoDocumentos'
import PasoHijos from './steps/PasoHijos'
import PasoRevision from './steps/PasoRevision'
import PasoSituacion from './steps/PasoSituacion'
import PasoTipoRegistro from './steps/PasoTipoRegistro'
import { construirPasos, type PasoId } from './wizard'

/** Estado de navegación que el hub "Expediente" (Fase 6) pasa vía React Router al arrancar el wizard directo en modo caso-existente. */
interface EstadoNavegacionRegistro {
  usuariaId?: string
}

type ModoWizard = { tipo: 'buscando' } | { tipo: 'nueva' } | { tipo: 'existente'; usuariaId: string }

export default function RegistrarUsuaria() {
  const location = useLocation()
  const estadoRuta = (location.state ?? null) as EstadoNavegacionRegistro | null

  const [modo, setModo] = useState<ModoWizard>(
    estadoRuta?.usuariaId ? { tipo: 'existente', usuariaId: estadoRuta.usuariaId } : { tipo: 'buscando' },
  )

  if (modo.tipo === 'buscando') {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
          <header className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Buscar usuaria</h2>
            <p className="text-sm text-gray-500">
              Antes de registrar, confirma que la usuaria no esté ya registrada.
            </p>
          </header>
          <PasoBuscarUsuaria
            onSeleccionar={(usuaria: UsuariaResumenBusqueda) => setModo({ tipo: 'existente', usuariaId: usuaria.id })}
            onEsNueva={() => setModo({ tipo: 'nueva' })}
          />
        </div>
      </div>
    )
  }

  return (
    <WizardRegistro
      key={modo.tipo === 'existente' ? modo.usuariaId : 'nueva'}
      usuariaExistente={modo.tipo === 'existente'}
      usuariaId={modo.tipo === 'existente' ? modo.usuariaId : undefined}
      onVolverABuscar={() => setModo({ tipo: 'buscando' })}
    />
  )
}

interface WizardRegistroProps {
  usuariaExistente: boolean
  usuariaId?: string
  onVolverABuscar: () => void
}

function WizardRegistro({ usuariaExistente, usuariaId, onVolverABuscar }: WizardRegistroProps) {
  const { form, ninosFieldArray } = useRegistroUsuariaForm(usuariaExistente)
  const documentosStaging = useDocumentosStaging()
  const tipoRegistro = useWatch({ control: form.control, name: 'datosCaso.tipoRegistro' })
  const pasos = construirPasos(usuariaExistente, tipoRegistro)
  const [pasoActual, setPasoActual] = useState(0)
  const [sinDatosAgresor, setSinDatosAgresor] = useState(false)
  const [expedienteCreado, setExpedienteCreado] = useState<ExpedienteCreado | null>(null)
  const [cantidadHijos, setCantidadHijos] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [conflictoDpi, setConflictoDpi] = useState(false)
  const [documentosEnSubida, setDocumentosEnSubida] = useState<DocumentoEnSubida[]>([])

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
    if (camposValidos) {
      setPasoActual(Math.min(indiceActual + 1, pasos.length - 1))
    }
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
      subirDocumentosPreparados(creado.id)
    } catch (err) {
      setErrorGuardado(extraerMensajeError(err))
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setConflictoDpi(true)
      }
    } finally {
      setGuardando(false)
    }
  }

  function subirUno(expedienteId: string, documento: DocumentoEnSubida) {
    subirDocumentoCaso(expedienteId, documento.tipo, documento.archivo)
      .then(() => actualizarEstadoDocumento(documento.tipo, 'ok'))
      .catch((err) => actualizarEstadoDocumento(documento.tipo, 'error', extraerMensajeError(err)))
  }

  function subirDocumentosPreparados(expedienteId: string) {
    const enSubida: DocumentoEnSubida[] = documentosStaging.documentos
      .filter((documento) => !documento.error)
      .map((documento) => ({ ...documento, estado: 'subiendo' }))
    setDocumentosEnSubida(enSubida)
    for (const documento of enSubida) {
      subirUno(expedienteId, documento)
    }
  }

  function actualizarEstadoDocumento(
    tipo: TipoDocumentoTrabajoSocial,
    estado: 'ok' | 'error',
    mensajeError?: string,
  ) {
    setDocumentosEnSubida((actual) =>
      actual.map((documento) =>
        documento.tipo === tipo ? { ...documento, estado, mensajeError } : documento,
      ),
    )
  }

  function reintentarDocumento(tipo: TipoDocumentoTrabajoSocial) {
    if (!expedienteCreado) return
    const documento = documentosEnSubida.find((d) => d.tipo === tipo)
    if (!documento) return

    setDocumentosEnSubida((actual) =>
      actual.map((d) => (d.tipo === tipo ? { ...d, estado: 'subiendo', mensajeError: undefined } : d)),
    )
    subirUno(expedienteCreado.id, documento)
  }

  if (expedienteCreado) {
    return (
      <ConfirmacionRegistro
        expediente={expedienteCreado}
        usuariaExistente={usuariaExistente}
        cantidadHijos={cantidadHijos}
        documentosEnSubida={documentosEnSubida}
        onReintentarDocumento={reintentarDocumento}
        onNuevoRegistro={onVolverABuscar}
      />
    )
  }

  if (usuariaExistente && cargandoUsuaria) {
    return <p className="text-sm text-gray-500">Cargando datos de la usuaria…</p>
  }

  if (usuariaExistente && (errorUsuaria || !usuaria)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{errorUsuaria ?? 'No se pudo cargar la usuaria.'}</p>
        <Button type="button" tamano="md" onClick={onVolverABuscar} className="mt-4">
          Volver a buscar
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
            <p className="text-[13px] text-gray-500">{paso.ayuda}</p>
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
                  <button type="button" onClick={onVolverABuscar} className="mt-1 font-medium underline">
                    Volver a buscar
                  </button>
                )}
              </div>
            )}

            {paso.id === 'usuaria' && <PasoDatosUsuaria form={form} />}
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
              <Button type="submit" tamano="md" cargando={guardando}>
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
