import type { Rol } from '@prisma/client';
import type { PersonalDto } from '@akyuam/shared';

export const PERSONAL_REPOSITORY = Symbol('PERSONAL_REPOSITORY');

export interface ListarPersonalParams {
  area: Rol;
  tipo?: string;
  /** `true` para un rol de área (solo ve activos); `false` para Administración (ve todos). */
  soloActivo: boolean;
}

export interface CrearPersonalParams {
  area: Rol;
  tipo: string;
  nombre: string;
}

export interface EditarPersonalParams {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface BuscarActivoParams {
  id: string;
  area: Rol;
  tipo: string;
}

export interface IPersonalRepository {
  listar(params: ListarPersonalParams): Promise<PersonalDto[]>;
  crear(params: CrearPersonalParams): Promise<PersonalDto>;
  /** `null` si el id no corresponde a un registro de `Personal` existente. */
  editar(params: EditarPersonalParams): Promise<PersonalDto | null>;
  /**
   * Valida que `id` sea un `Personal` existente, del área y tipo esperados, y activo —
   * usado por otras áreas (ej. jurídico) para confirmar una asignación antes de guardarla,
   * en vez de depender solo de la violación de la FK de Postgres.
   */
  buscarActivo(params: BuscarActivoParams): Promise<{ id: string } | null>;
}
