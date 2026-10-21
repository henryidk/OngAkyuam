import type {
  GrupoEtnico,
  MunicipioAltaVerapaz,
  TipologiaDelito,
  TipoRegistro,
} from '@prisma/client';
import type { ExpedienteDetalleCaso } from '@akyuam/shared';

export const EXPEDIENTES_REPOSITORY = Symbol('EXPEDIENTES_REPOSITORY');

/** Ya no reconciliamos por DPI en silencio — este error señala la colisión para que el service
 * la traduzca a un 409 explícito (ver ExpedientesService.crear). */
export class DpiUsuariaDuplicadoError extends Error {
  constructor() {
    super('Ya existe una usuaria registrada con este DPI');
  }
}

/** `crearParaUsuariaExistente` recibe un `usuariaId` que el caller ya debió validar — esto es
 * la última línea de defensa si de todos modos no existe (p. ej. borrado entre la validación y
 * el submit). */
export class UsuariaNoEncontradaError extends Error {
  constructor() {
    super('Usuaria no encontrada');
  }
}

export interface DatosIdentidadUsuaria {
  nombres: string;
  apellidos: string;
  dpi: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
  municipio: MunicipioAltaVerapaz | null;
  departamentoOtro: string | null;
  municipioOtro: string | null;
  ubicacionGeografica: string | null;
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

/** Todo lo que puede variar de un caso a otro de la misma usuaria — ver `datosCasoSchema`. */
export interface DatosCasoParams {
  fecha: string;
  tipoRegistro: TipoRegistro;
  tipologiaDelito: TipologiaDelito[];
  /** "YYYY-MM-DD", solo en casos INTERNA. */
  fechaIngresoAlbergue: string | null;
  observaciones: string | null;
  creadoPorId: string;
  agresor: DatosAgresor | null;
  ninos: DatosNino[];
}

export interface CrearExpedienteConUsuariaNuevaParams {
  identidadUsuaria: DatosIdentidadUsuaria;
  datosCaso: DatosCasoParams;
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
  /** Usuaria nueva: crea la `Usuaria` y su primer `Expediente` en una sola transacción. */
  crearConUsuariaNueva(
    params: CrearExpedienteConUsuariaNuevaParams,
  ): Promise<ExpedienteCreadoResultado>;
  /** Usuaria ya existente: solo crea el `Expediente` — nunca vuelve a tocar la identidad. */
  crearParaUsuariaExistente(
    usuariaId: string,
    datosCaso: DatosCasoParams,
  ): Promise<ExpedienteCreadoResultado>;
  /** Vista de solo lectura de un caso puntual para trabajo social — sin datos de identidad de
   * la usuaria (esos se consultan por separado vía el hub, ver `UsuariasRepository.obtenerHub`)
   * y sin filtrar documentos por área: trabajo social ve todo lo que subió. */
  obtenerDetalle(id: string): Promise<ExpedienteDetalleCaso | null>;
}
