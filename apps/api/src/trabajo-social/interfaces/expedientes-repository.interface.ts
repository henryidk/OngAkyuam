import type {
  GrupoEtnico,
  MunicipioAltaVerapaz,
  Rol,
  TipologiaDelito,
  TipoRegistro,
} from '@prisma/client';

export const EXPEDIENTES_REPOSITORY = Symbol('EXPEDIENTES_REPOSITORY');

export interface DatosIdentidadUsuaria {
  nombres: string;
  apellidos: string;
  dpi: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
}

export interface DatosAgresor {
  nombres: string | null;
  apellidos: string | null;
  telefono: string | null;
  direccion: string | null;
}

export interface DatosNino {
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  genero: 'MUJER' | 'HOMBRE';
}

export interface CrearExpedienteConUsuariaParams {
  identidadUsuaria: DatosIdentidadUsuaria;
  fecha: string;
  municipio: MunicipioAltaVerapaz | null;
  departamentoOtro: string | null;
  municipioOtro: string | null;
  ubicacionGeografica: string;
  tipoRegistro: TipoRegistro;
  tipologiaDelito: TipologiaDelito[];
  creadoPorId: string;
  agresor: DatosAgresor | null;
  ninos: DatosNino[];
  areasReferidas: Rol[];
}

export interface ExpedienteCreadoResultado {
  id: string;
  numero: string;
  usuariaId: string;
  usuariaNombreCompleto: string;
  fecha: string;
  municipio: string | null;
  tipoRegistro: TipoRegistro;
}

export interface IExpedientesRepository {
  crearConUsuaria(
    params: CrearExpedienteConUsuariaParams,
  ): Promise<ExpedienteCreadoResultado>;
}
