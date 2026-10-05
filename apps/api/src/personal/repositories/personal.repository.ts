import { Injectable } from '@nestjs/common';
import type { Personal } from '@prisma/client';
import type { PersonalDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  BuscarActivoParams,
  CrearPersonalParams,
  EditarPersonalParams,
  IPersonalRepository,
  ListarPersonalParams,
} from '../interfaces/personal-repository.interface';

function mapear(personal: Personal): PersonalDto {
  return {
    id: personal.id,
    // `Personal.area` es el enum `Rol` completo en la base de datos (más flexible a
    // futuro), pero este módulo solo crea/consulta filas dentro de `AREAS_ATENCION` —
    // reforzado por `areaPersonalSchema` en la entrada y por `PersonalService.listar`,
    // que nunca pasa un `Rol` fuera de ese conjunto como filtro.
    area: personal.area as PersonalDto['area'],
    tipo: personal.tipo,
    nombre: personal.nombre,
    activo: personal.activo,
    usuarioId: personal.usuarioId,
  };
}

@Injectable()
export class PersonalRepository implements IPersonalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(params: ListarPersonalParams): Promise<PersonalDto[]> {
    const personal = await this.prisma.personal.findMany({
      where: {
        area: params.area,
        ...(params.tipo ? { tipo: params.tipo } : {}),
        ...(params.soloActivo ? { activo: true } : {}),
      },
      orderBy: { nombre: 'asc' },
    });
    return personal.map(mapear);
  }

  async crear(params: CrearPersonalParams): Promise<PersonalDto> {
    const personal = await this.prisma.personal.create({
      data: { area: params.area, tipo: params.tipo, nombre: params.nombre },
    });
    return mapear(personal);
  }

  async editar(params: EditarPersonalParams): Promise<PersonalDto | null> {
    try {
      const personal = await this.prisma.personal.update({
        where: { id: params.id },
        data: { nombre: params.nombre, activo: params.activo },
      });
      return mapear(personal);
    } catch {
      // P2025: registro no encontrado — mismo criterio uniforme del resto del proyecto,
      // se traduce a `null` en vez de dejar escapar el error crudo de Prisma.
      return null;
    }
  }

  async buscarActivo(
    params: BuscarActivoParams,
  ): Promise<{ id: string } | null> {
    return this.prisma.personal.findFirst({
      where: {
        id: params.id,
        area: params.area,
        tipo: params.tipo,
        activo: true,
      },
      select: { id: true },
    });
  }
}
