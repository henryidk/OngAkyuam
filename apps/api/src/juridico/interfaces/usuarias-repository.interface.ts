import type {
  ReferenciaHistorialDto,
  UsuariaJuridicoResumen,
  UsuariaReferidaDto,
} from '@akyuam/shared';

export const USUARIAS_JURIDICO_REPOSITORY = Symbol(
  'USUARIAS_JURIDICO_REPOSITORY',
);

export interface FichaUsuariaJuridico {
  usuaria: UsuariaReferidaDto & { telefono: string | null };
  referencias: ReferenciaHistorialDto[];
}

export interface IUsuariasJuridicoRepository {
  /**
   * Busca por nombre o DPI **solo** entre usuarias con algún expediente referido a JURIDICO,
   * con tope de resultados: no sirve para recorrer la base de usuarias.
   */
  buscar(texto: string): Promise<UsuariaJuridicoResumen[]>;
  /** `null` tanto si la usuaria no existe como si ningún expediente suyo llegó a Jurídico. */
  obtenerFicha(usuariaId: string): Promise<FichaUsuariaJuridico | null>;
}
