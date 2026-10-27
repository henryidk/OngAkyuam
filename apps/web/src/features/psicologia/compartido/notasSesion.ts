import type { SesionProcesoDto } from '@akyuam/shared'

export interface NotaSesion {
  titulo: string
  texto: string
}

type CamposNotas = Pick<
  SesionProcesoDto,
  'estado' | 'temas' | 'intervencion' | 'enfoqueTerapeutico' | 'recomendaciones' | 'acuerdos' | 'observaciones' | 'motivoNoAsistencia'
>

/** Las notas con contenido, en el orden del formulario de registro. */
export function notasDe(sesion: CamposNotas): NotaSesion[] {
  const todas: [string, string | null][] =
    sesion.estado === 'ATENDIDA'
      ? [
          ['Temas abordados', sesion.temas],
          ['Intervención', sesion.intervencion],
          ['Enfoque terapéutico', sesion.enfoqueTerapeutico],
          ['Recomendaciones', sesion.recomendaciones],
          ['Acuerdos', sesion.acuerdos],
          ['Observaciones', sesion.observaciones],
        ]
      : [['Motivo', sesion.motivoNoAsistencia]]
  return todas.flatMap(([titulo, texto]) => (texto?.trim() ? [{ titulo, texto }] : []))
}
