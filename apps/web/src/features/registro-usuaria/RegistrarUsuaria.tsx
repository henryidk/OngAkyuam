import { useState } from 'react'
import type { ExpedienteCreado, RegistroUsuariaFormValues } from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import ConfirmacionRegistro from './components/ConfirmacionRegistro'
import IndicadorPasos from './components/IndicadorPasos'
import IndicadorPasosVertical from './components/IndicadorPasosVertical'
import { useRegistroUsuariaForm, valoresIniciales } from './hooks/useRegistroUsuariaForm'
import PasoDatosAgresor from './steps/PasoDatosAgresor'
import PasoDatosCaso from './steps/PasoDatosCaso'
import PasoDatosUsuaria from './steps/PasoDatosUsuaria'
import PasoAreasAtencion from './steps/PasoAreasAtencion'
import PasoDocumentos from './steps/PasoDocumentos'
import PasoRevision from './steps/PasoRevision'
import PasoTipoRegistro from './steps/PasoTipoRegistro'
import { PASOS_REGISTRO_USUARIA, type PasoId } from './wizard'

export default function RegistrarUsuaria() {
  const { form, ninosFieldArray } = useRegistroUsuariaForm()
  const [pasoActual, setPasoActual] = useState(0)
  const [expedienteCreado, setExpedienteCreado] = useState<ExpedienteCreado | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const paso = PASOS_REGISTRO_USUARIA[pasoActual]
  const esPrimerPaso = pasoActual === 0
  const esUltimoPaso = pasoActual === PASOS_REGISTRO_USUARIA.length - 1

  async function irAlSiguientePaso() {
    const camposValidos = paso.campos.length === 0 || (await form.trigger(paso.campos))
    if (camposValidos) {
      setPasoActual((actual) => Math.min(actual + 1, PASOS_REGISTRO_USUARIA.length - 1))
    }
  }

  function irAlPasoAnterior() {
    setPasoActual((actual) => Math.max(actual - 1, 0))
  }

  function irAPaso(id: PasoId) {
    const indice = PASOS_REGISTRO_USUARIA.findIndex((p) => p.id === id)
    if (indice <= pasoActual) {
      setPasoActual(indice)
    }
  }

  async function onSubmit(datos: RegistroUsuariaFormValues) {
    setGuardando(true)
    setErrorGuardado(null)
    try {
      const { data } = await api.post<ExpedienteCreado>('/trabajo-social/expedientes', datos)
      setExpedienteCreado(data)
    } catch (err) {
      setErrorGuardado(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  function iniciarNuevoRegistro() {
    form.reset(valoresIniciales)
    setExpedienteCreado(null)
    setPasoActual(0)
  }

  if (expedienteCreado) {
    return <ConfirmacionRegistro expediente={expedienteCreado} onNuevoRegistro={iniciarNuevoRegistro} />
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="lg:hidden">
        <IndicadorPasos pasos={PASOS_REGISTRO_USUARIA} pasoActualId={paso.id} onIrAPaso={irAPaso} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-0 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-10">
        <aside className="hidden lg:sticky lg:top-8 lg:block">
          <IndicadorPasosVertical pasos={PASOS_REGISTRO_USUARIA} pasoActualId={paso.id} onIrAPaso={irAPaso} />
        </aside>

        <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
          <header className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{paso.titulo}</h2>
            <p className="text-sm text-gray-500">{paso.descripcion}</p>
          </header>

          {paso.id === 'revision' && errorGuardado && (
            <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorGuardado}
            </p>
          )}

          {paso.id === 'caso' && <PasoDatosCaso form={form} />}
          {paso.id === 'usuaria' && <PasoDatosUsuaria form={form} />}
          {paso.id === 'agresor' && <PasoDatosAgresor form={form} />}
          {paso.id === 'registro' && <PasoTipoRegistro form={form} ninosFieldArray={ninosFieldArray} />}
          {paso.id === 'areas' && <PasoAreasAtencion form={form} />}
          {paso.id === 'documentos' && <PasoDocumentos tipoRegistro={form.watch('tipoRegistro')} />}
          {paso.id === 'revision' && <PasoRevision form={form} onEditar={irAPaso} />}

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
                {guardando ? 'Guardando…' : 'Guardar usuaria'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
