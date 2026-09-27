import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CATALOGOS_TIPO_PERSONAL,
  type CrearPersonalInput,
  type EditarPersonalInput,
  type ListarPersonalQuery,
  type PersonalDto,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { ContextoAuditoria } from '../common/types/contexto-auditoria';
import { PERSONAL_REPOSITORY } from './interfaces/personal-repository.interface';
import type { IPersonalRepository } from './interfaces/personal-repository.interface';

@Injectable()
export class PersonalService {
  constructor(
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: IPersonalRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Administración elige qué área quiere ver y ve tanto activos como inactivos; un rol de
   * área (JURIDICO, PSICOLOGIA, MEDICA) solo ve su propia área y solo el personal activo —
   * el `area` de la query se ignora en ese caso, no se confía en lo que pida el cliente.
   */
  async listar(
    usuario: AuthenticatedUser,
    query: ListarPersonalQuery,
  ): Promise<PersonalDto[]> {
    const esAdministracion = usuario.rol === 'ADMINISTRACION';
    return this.personalRepository.listar({
      area: esAdministracion ? query.area : usuario.rol,
      tipo: query.tipo,
      soloActivo: !esAdministracion,
    });
  }

  async crear(
    datos: CrearPersonalInput,
    contexto: ContextoAuditoria,
  ): Promise<PersonalDto> {
    this.validarTipoDelCatalogo(datos.area, datos.tipo);

    const personal = await this.personalRepository.crear({
      area: datos.area,
      tipo: datos.tipo,
      nombre: datos.nombre,
    });

    // Nunca `nombre` en `detalles` — mismo criterio de mínima exposición que en jurídico.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PERSONAL_CREADO',
      entidad: 'Personal',
      entidadId: personal.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { area: datos.area, tipo: datos.tipo },
    });

    return personal;
  }

  async editar(
    id: string,
    datos: EditarPersonalInput,
    contexto: ContextoAuditoria,
  ): Promise<PersonalDto> {
    const personal = await this.personalRepository.editar({
      id,
      nombre: datos.nombre,
      activo: datos.activo,
    });
    if (!personal) {
      throw new NotFoundException('Personal no encontrado');
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PERSONAL_EDITADO',
      entidad: 'Personal',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { activo: datos.activo },
    });

    return personal;
  }

  /**
   * Solo valida contra un catálogo cuando el área ya definió uno (hoy, solo jurídico) — una
   * área sin catálogo todavía acepta cualquier `tipo` no vacío (OCP, ver planjuridico.md y
   * pendientes.md).
   */
  private validarTipoDelCatalogo(area: string, tipo: string): void {
    const catalogo =
      CATALOGOS_TIPO_PERSONAL[area as keyof typeof CATALOGOS_TIPO_PERSONAL];
    if (catalogo && !catalogo.includes(tipo)) {
      throw new BadRequestException('Cargo no válido para esta área');
    }
  }
}
