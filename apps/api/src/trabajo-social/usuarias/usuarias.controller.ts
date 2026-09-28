import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  buscarUsuariaQuerySchema,
  editarIdentidadUsuariaSchema,
  listarUsuariasQuerySchema,
  nuevoCasoSchema,
  type BuscarUsuariaQuery,
  type DatosCaso,
  type EditarIdentidadUsuariaInput,
  type ListarUsuariasQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ExpedientesService } from '../expedientes.service';
import { UsuariasService } from './usuarias.service';

@Controller('trabajo-social/usuarias')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class UsuariasController {
  constructor(
    private readonly usuariasService: UsuariasService,
    private readonly expedientesService: ExpedientesService,
  ) {}

  @Get()
  async listar(
    @Query(new ZodValidationPipe(listarUsuariasQuerySchema))
    query: ListarUsuariasQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariasService.listar(query, contexto);
  }

  // Debe declararse antes de `:id` para que Nest no lo confunda con un id.
  @Get('buscar')
  async buscar(
    @Query(new ZodValidationPipe(buscarUsuariaQuerySchema))
    query: BuscarUsuariaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariasService.buscar(query, contexto);
  }

  @Get(':id')
  async obtenerHub(
    @Param('id', ParseUUIDPipe) id: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariasService.obtenerHub(id, contexto);
  }

  @Patch(':id')
  async actualizarIdentidad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarIdentidadUsuariaSchema))
    datos: EditarIdentidadUsuariaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariasService.actualizarIdentidad(id, datos, contexto);
  }

  @Post(':id/expedientes')
  @HttpCode(HttpStatus.CREATED)
  async crearCaso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(nuevoCasoSchema))
    datosCaso: DatosCaso,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.expedientesService.crearCasoParaUsuariaExistente(
      id,
      datosCaso,
      contexto,
    );
  }
}
