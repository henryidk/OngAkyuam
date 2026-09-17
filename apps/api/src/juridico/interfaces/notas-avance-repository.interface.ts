import type { NotaAvanceDto } from '@akyuam/shared';

export const NOTAS_AVANCE_REPOSITORY = Symbol('NOTAS_AVANCE_REPOSITORY');

export interface CrearNotaAvanceParams {
  procesoId: string;
  contenido: string;
  registradoPorId: string;
}

// Interfaz chica y específica (ISP): un servicio que solo agrega notas no depende de
// métodos de documentos o de procesos que nunca usa.
export interface INotasAvanceRepository {
  crear(params: CrearNotaAvanceParams): Promise<NotaAvanceDto>;
  listarPorProceso(procesoId: string): Promise<NotaAvanceDto[]>;
}
