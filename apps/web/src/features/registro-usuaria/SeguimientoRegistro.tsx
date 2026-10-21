import { CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ExpedienteCreado } from '@akyuam/shared'
import Button from '../../components/ui/Button'
import ConfirmacionRegistro from './components/ConfirmacionRegistro'
import MarcoWizard from './components/MarcoWizard'
import { useDocumentosNuevoCaso } from './hooks/useDocumentosNuevoCaso'
import { useReferirAreas } from './hooks/useReferirAreas'
import PasoDocumentos from './steps/PasoDocumentos'
import PasoReferir from './steps/PasoReferir'
import { construirPasos, type PasoId } from './wizard'

interface SeguimientoRegistroProps {
  expediente: ExpedienteCreado
  usuariaExistente: boolean
  cantidadHijos: number
  onRegistrarOtraUsuaria: () => void
}

/**
 * Lo que sigue al registro, con el caso ya guardado: referir (opcional) y subir los escaneos
 * (opcional). Salir de aquí en cualquier momento no pierde nada — la usuaria ya existe y lo
 * pendiente se puede hacer desde su ficha.
 */
export default function SeguimientoRegistro({
  expediente,
  usuariaExistente,
  cantidadHijos,
  onRegistrarOtraUsuaria,
}: SeguimientoRegistroProps) {
  const pasos = construirPasos(usuariaExistente, expediente.tipoRegistro)
  const [pasoActual, setPasoActual] = useState<'referir' | 'documentos' | 'listo'>('referir')
  const referir = useReferirAreas(expediente.id)
  const documentos = useDocumentosNuevoCaso(expediente.id)

  if (pasoActual === 'listo') {
    return (
      <ConfirmacionRegistro
        expediente={expediente}
        usuariaExistente={usuariaExistente}
        cantidadHijos={cantidadHijos}
        areasReferidas={referir.referidas}
        documentosSubidos={documentos.subidos}
        onNuevoRegistro={onRegistrarOtraUsuaria}
      />
    )
  }

  function irAPaso(id: PasoId) {
    // Los pasos de datos ya no se reabren; entre referir y documentos sí se puede volver.
    if (id === 'referir') setPasoActual('referir')
  }

  async function continuarDesdeReferir() {
    if (referir.porEnviar.length > 0 && !(await referir.referirSeleccionadas())) return
    setPasoActual('documentos')
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Enter en el motivo no debe enviar nada: cada paso avanza con su propio botón.
    event.preventDefault()
  }

  const cantidadPorEnviar = referir.porEnviar.length

  return (
    <MarcoWizard
      pasos={pasos}
      pasoActualId={pasoActual}
      onIrAPaso={irAPaso}
      encabezadoLateral={
        <>
          Expediente <span className="font-semibold">{expediente.numero}</span>
        </>
      }
      onSubmit={onSubmit}
      avisos={
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-800"
        >
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">
              {usuariaExistente ? 'Caso registrado' : 'Usuaria registrada'}: {expediente.usuariaNombreCompleto}
            </span>{' '}
            · Expediente {expediente.numero}. Lo que sigue es opcional; puedes terminar cuando quieras y completarlo
            después desde su ficha.
          </span>
        </p>
      }
      pie={
        pasoActual === 'referir' ? (
          <>
            <Button
              type="button"
              variante="secondary"
              tamano="md"
              onClick={() => setPasoActual('listo')}
              disabled={referir.enviando}
            >
              Terminar aquí
            </Button>
            <Button type="button" tamano="md" onClick={() => void continuarDesdeReferir()} cargando={referir.enviando}>
              {cantidadPorEnviar === 0
                ? referir.referidas.length > 0
                  ? 'Continuar'
                  : 'Omitir y continuar'
                : `Referir a ${cantidadPorEnviar} ${cantidadPorEnviar === 1 ? 'área' : 'áreas'} y continuar`}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variante="secondary" tamano="md" onClick={() => setPasoActual('referir')}>
              Anterior
            </Button>
            <Button
              type="button"
              tamano="md"
              onClick={() => setPasoActual('listo')}
              disabled={documentos.haySubidasEnCurso}
              title={documentos.haySubidasEnCurso ? 'Espera a que terminen de subir los documentos' : undefined}
            >
              Finalizar
            </Button>
          </>
        )
      }
    >
      {pasoActual === 'referir' && <PasoReferir referir={referir} />}
      {pasoActual === 'documentos' && (
        <PasoDocumentos
          tipoRegistro={expediente.tipoRegistro}
          documentos={documentos}
          areasReferidas={referir.referidas}
        />
      )}
    </MarcoWizard>
  )
}
