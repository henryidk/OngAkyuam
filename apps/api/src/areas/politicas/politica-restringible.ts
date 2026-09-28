import type { AreaAtencion } from '@akyuam/shared';
import type {
  DocumentoConVisibilidad,
  IPoliticaAccesoArea,
  ReferidoParaPolitica,
} from './politica-acceso-area.interface';

/** Psicología y Médica: solo ven lo que Trabajo Social les habilitó. Privado por defecto. */
export class PoliticaRestringible implements IPoliticaAccesoArea {
  constructor(readonly area: Exclude<AreaAtencion, 'JURIDICO'>) {}

  puedeVerDatosCaso(referido: ReferidoParaPolitica): boolean {
    return referido.puedeVerDatosCaso;
  }

  puedeVerDocumento(documento: DocumentoConVisibilidad): boolean {
    return documento.areasVisibles.includes(this.area);
  }

  esRestringible(): boolean {
    return true;
  }
}
