import { TIPOS_DOCUMENTO_RESTRINGIBLES } from '@akyuam/shared';
import type {
  DocumentoConVisibilidad,
  IPoliticaAccesoArea,
} from './politica-acceso-area.interface';

/**
 * Jurídico tiene acceso completo por normativa a lo que Trabajo Social registra del caso
 * (datos del caso y sus formularios escaneados), sin que se pueda restringir. Los documentos
 * que suben otras áreas (p. ej. el formato de atención psicológica) siguen necesitando
 * visibilidad explícita: el acceso completo es a lo de Trabajo Social, no a notas clínicas.
 */
export class PoliticaJuridico implements IPoliticaAccesoArea {
  readonly area = 'JURIDICO' as const;

  puedeVerDatosCaso(): boolean {
    return true;
  }

  puedeVerDocumento(documento: DocumentoConVisibilidad): boolean {
    return (
      (TIPOS_DOCUMENTO_RESTRINGIBLES as readonly string[]).includes(
        documento.tipo,
      ) || documento.areasVisibles.includes(this.area)
    );
  }

  esRestringible(): boolean {
    return false;
  }
}
