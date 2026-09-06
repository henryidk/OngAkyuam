/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ExpedientesService } from './expedientes.service';
import { createExpedienteSchema } from '@akyuam/shared';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Utilizamos una herramienta ligera de pipe (si no usamos ZodPipe por defecto) para validar, o validamos a mano.
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { ExpedientesGateway } from './expedientes.gateway';

@Controller('expedientes')
@UseGuards(JwtAuthGuard)
export class ExpedientesController {
  constructor(
    private readonly expedientesService: ExpedientesService,
    private readonly expedientesGateway: ExpedientesGateway,
  ) {}

  @Post()
  async create(@Body() body: any, @Request() req: any) {
    const parseResult = createExpedienteSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'ValidaciYn fallida',
        errors: parseResult.error.format(),
      });
    }

    // Solo Trabajo Social debera poder crear expedientes, pero lo dejamos segn requerimientos
    const currentUserName = req.user?.nombreCompleto || 'Usuario Desconocido';

    const expediente = await this.expedientesService.create(parseResult.data, currentUserName);
    
    // Notificar a clientes sobre el nuevo expediente (opcional, para UI en tiempo real)
    this.expedientesGateway.emitNewReference({ type: 'NEW_EXPEDIENTE', data: expediente });

    return expediente;
  }

  @Get('next-id')
  async getNextId() {
    const nextId = await this.expedientesService.generarCodigoCasoPublico();
    return { nextId };
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.expedientesService.findAll(req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const expediente = await this.expedientesService.findOne(id, req.user);
    if (!expediente) {
      throw new NotFoundException(`Expediente con ID ${id} no encontrado o no tienes permiso para verlo`);
    }
    return expediente;
  }

  @Put(':id/caratula')
  async updateCaratula(@Param('id') id: string, @Body() body: any) {
    return this.expedientesService.updateCaratula(id, body);
  }

  @Post(':id/entrevista')
  async saveEntrevista(@Param('id') id: string, @Body() body: any) {
    return this.expedientesService.saveEntrevista(id, body);
  }

  @Post(':id/bitacora')
  async addBitacoraEntry(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const currentUserName = req.user?.nombreCompleto || 'Usuario Desconocido';
    return this.expedientesService.addBitacoraEntry(id, body, currentUserName);
  }

  @Post(':id/archivos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: any,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.sub || null;
    return this.expedientesService.addArchivoDigital(
      id,
      file,
      body.categoria,
      currentUserId,
    );
  }

  @Post(':id/referir')
  async referirExpediente(
    @Param('id') id: string,
    @Body() body: { referencias: { area: string; motivo: string }[] },
    @Request() req: any,
  ) {
    console.log('REFERIR CALLED', id, body);

    // 1. Validar quin puede referir
    if (req.user?.rol !== 'TRABAJO_SOCIAL') {
      throw new ForbiddenException('Solo los usuarios de Trabajo Social pueden referir expedientes.');
    }

    const currentUserName = req.user?.nombreCompleto || 'Usuario Desconocido';
    const areasValidas = ['MEDICA', 'PSICOLOGIA', 'JURIDICO'];
    const areas: any[] = [];
    
    for (const ref of body.referencias) {
      // 2. Validar que las ǭreas de destino sean vǭlidas
      if (!areasValidas.includes(ref.area)) {
        throw new BadRequestException(`El área ${ref.area} no es un destino válido para referir.`);
      }

      areas.push(ref.area);
      await this.expedientesService.addBitacoraEntry(
        id,
        {
          titulo: `Expediente Referido a ${ref.area}`,
          descripcion: ref.motivo,
        },
        currentUserName,
      );
    }
    
    if (areas.length > 0) {
      await this.expedientesService.asignarAreas(id, areas);
      
      // Emitir el evento de WebSockets a todos los conectados
      this.expedientesGateway.emitNewReference({
        expedienteId: id,
        areas: areas,
        motivos: body.referencias,
        referidoPor: currentUserName
      });
    }
    return { success: true };
  }
}
