import axios from 'axios'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type {
  ExpedienteCreado,
  RegistroUsuariaNuevaFormValues,
  TipoDocumento,
  UsuariaExpedienteHub,
  UsuariaResumenBusqueda,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import ResumenIdentidadUsuaria from '../trabajo-social/ResumenIdentidadUsuaria'
import ConfirmacionRegistro from './components/ConfirmacionRegistro'
import IndicadorPasos from './components/IndicadorPasos'
import IndicadorPasosVertical from './components/IndicadorPasosVertical'
import { useDocumentosStaging } from './hooks/useDocumentosStaging'
import { useRegistroUsuariaForm, valoresIniciales } from './hooks/useRegistroUsuariaForm'
import { subirDocumento, type DocumentoEnSubida } from './lib/documentosUpload'
import PasoDatosAgresor from './steps/PasoDatosAgresor'
import PasoDatosCaso from './steps/PasoDatosCaso'
import PasoDatosUsuaria from './steps/PasoDatosUsuaria'
import PasoAreasAtencion from './steps/PasoAreasAtencion'
import PasoBuscarUsuaria from './steps/PasoBuscarUsuaria'
import PasoDocumentos from './steps/PasoDocumentos'
import PasoRevision from './steps/PasoRevision'
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
  const pasos = construirPasos(usuariaExistente)
  const [pasoActual, setPasoActual] = useState(0)
  const [expedienteCreado, setExpedienteCreado] = useState<ExpedienteCreado | null>(null)
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
    api
      .get<UsuariaExpedienteHub>(`/trabajo-social/usuarias/${usuariaId}`)
      .then(({ data }) => {
        if (!cancelado) setUsuaria(data)
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

  const paso = pasos[pasoActual]
  const esPrimerPaso = pasoActual === 0
  const esUltimoPaso = pasoActual === pasos.length - 1

  async function irAlSiguientePaso() {
    const camposValidos = paso.campos.length === 0 || (await form.trigger(paso.campos))
    if (camposValidos) {
      setPasoActual((actual) => Math.min(actual + 1, pasos.length - 1))
    }
  }

  function irAlPasoAnterior() {
    setPasoActual((actual) => Math.max(actual - 1, 0))
  }

  function irAPaso(id: PasoId) {
    const indice = pasos.findIndex((p) => p.id === id)
    if (indice !== -1 && indice <= pasoActual) {
      setPasoActual(indice)
    }
  }

  async function onSubmit(datos: RegistroUsuariaNuevaFormValues) {
    setGuardando(true)
    setErrorGuardado(null)
    setConflictoDpi(false)
    try {
      const { data } =
        usuariaExistente && usuariaId
          ? await api.post<ExpedienteCreado>(`/trabajo-social/usuarias/${usuariaId}/expedientes`, datos.datosCaso)
          : await api.post<ExpedienteCreado>('/trabajo-social/expedientes', datos)
      setExpedienteCreado(data)
      subirDocumentosPreparados(data.id)
    } catch (err) {
      setErrorGuardado(extraerMensajeError(err))
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setConflictoDpi(true)
      }
    } finally {
      setGuardando(false)
    }
  }

  function subirDocumentosPreparados(expedienteId: string) {
    const documentosValidos = documentosStaging.documentos.filter((documento) => !documento.error)
    setDocumentosEnSubida(documentosValidos.map((documento) => ({ ...documento, estado: 'subiendo' })))

    for (const documento of documentosValidos) {
      subirDocumento(expedienteId, documento)
        .then(() => actualizarEstadoDocumento(documento.tipo, 'ok'))
        .catch((err) => actualizarEstadoDocumento(documento.tipo, 'error', extraerMensajeError(err)))
    }
  }

  function actualizarEstadoDocumento(
    tipo: TipoDocumento,
    estado: 'ok' | 'error',
    mensajeError?: string,
  ) {
    setDocumentosEnSubida((actual) =>
      actual.map((documento) =>
        documento.tipo === tipo ? { ...documento, estado, mensajeError } : documento,
      ),
    )
  }

  function reintentarDocumento(tipo: TipoDocumento) {
    if (!expedienteCreado) return
    const documento = documentosEnSubida.find((d) => d.tipo === tipo)
    if (!documento) return

    setDocumentosEnSubida((actual) =>
      actual.map((d) => (d.tipo === tipo ? { ...d, estado: 'subiendo', mensajeError: undefined } : d)),
    )
    subirDocumento(expedienteCreado.id, documento)
      .then(() => actualizarEstadoDocumento(tipo, 'ok'))
      .catch((err) => actualizarEstadoDocumento(tipo, 'error', extraerMensajeError(err)))
  }

  if (expedienteCreado) {
    return (
      <ConfirmacionRegistro
        expediente={expedienteCreado}
        usuariaExistente={usuariaExistente}
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
        <button
          type="button"
          onClick={onVolverABuscar}
          className="mt-4 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Volver a buscar
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="lg:hidden">
        <IndicadorPasos pasos={pasos} pasoActualId={paso.id} onIrAPaso={irAPaso} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-0 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-10">
        <aside className="hidden lg:sticky lg:top-8 lg:block">
          <IndicadorPasosVertical pasos={pasos} pasoActualId={paso.id} onIrAPaso={irAPaso} />
        </aside>

        <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
          <header className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{paso.titulo}</h2>
            <p className="text-sm text-gray-500">{paso.descripcion}</p>
          </header>

          {usuariaExistente && usuaria && (
            <div className="mb-6">
              <ResumenIdentidadUsuaria usuaria={usuaria} onActualizado={setUsuaria} />
            </div>
          )}

          {paso.id === 'revision' && errorGuardado && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{errorGuardado}</p>
              {conflictoDpi && (
                <button type="button" onClick={onVolverABuscar} className="mt-1 font-medium underline">
                  Volver a buscar
                </button>
              )}
            </div>
          )}

          {paso.id === 'caso' && <PasoDatosCaso form={form} />}
          {paso.id === 'usuaria' && <PasoDatosUsuaria form={form} />}
          {paso.id === 'agresor' && <PasoDatosAgresor form={form} />}
          {paso.id === 'registro' && <PasoTipoRegistro form={form} ninosFieldArray={ninosFieldArray} />}
          {paso.id === 'areas' && <PasoAreasAtencion form={form} />}
          {paso.id === 'documentos' && (
            <PasoDocumentos
              tipoRegistro={form.watch('datosCaso.tipoRegistro')}
              areasReferidas={form.watch('datosCaso.areasReferidas')}
              staging={documentosStaging}
            />
          )}
          {paso.id === 'revision' && (
            <PasoRevision form={form} onEditar={irAPaso} usuariaExistente={usuariaExistente} />
          )}

          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={irAlPasoAnterior}
              disabled={esPrimerPaso}
              className="rounded px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-0"
            >
              Atrás
            </button>

            {!esUltimoPaso && (
              <button
                type="button"
                onClick={irAlSiguientePaso}
                className="rounded bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Siguiente
              </button>
            )}
            {esUltimoPaso && (
              <button
                type="submit"
                disabled={guardando}
                className="rounded bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : usuariaExistente ? 'Guardar caso' : 'Guardar usuaria'}
              </button>
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
