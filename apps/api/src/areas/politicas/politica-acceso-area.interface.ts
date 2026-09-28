import type { Rol, TipoDocumento } from '@prisma/client';
import type { AreaAtencion } from '@akyuam/shared';

/** Lo que la política necesita saber del referido del área sobre el expediente. */
export interface ReferidoParaPolitica {
  puedeVerDatosCaso: boolean;
}

/** Documento vigente con las áreas a las que Trabajo Social otorgó visibilidad. */
export interface DocumentoConVisibilidad {
  tipo: TipoDocumento;
  areasVisibles: Rol[];
}

/**
 * Qué puede ver un área de un expediente que le fue referido. Un área no referida no ve nada:
 * eso se decide antes (403 genérico), nunca aquí.
 */
export interface IPoliticaAccesoArea {
  readonly area: AreaAtencion;
  puedeVerDatosCaso(referido: ReferidoParaPolitica): boolean;
  puedeVerDocumento(documento: DocumentoConVisibilidad): boolean;
  /** `false` = Trabajo Social no puede restringirla desde la matriz de accesos. */
  esRestringible(): boolean;
}
