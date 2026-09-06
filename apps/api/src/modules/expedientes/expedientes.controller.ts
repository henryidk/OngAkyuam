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
import { BadRequestException } from '@nestjs/common';

@Controller('expedientes')
@UseGuards(JwtAuthGuard)
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Post()
  async create(@Body() body: any, @Request() req: any) {
    const parseResult = createExpedienteSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'ValidaciÃ³n fallida',
        errors: parseResult.error.format(),
      });
    }

    // req.user asume que el AuthGuard mete la info del JWT (id, username, nombreCompleto)
    const currentUserName = req.user?.nombreCompleto || 'Usuario Desconocido';

    return this.expedientesService.create(parseResult.data, currentUserName);
  }

  @Get('next-id')
  async getNextId() {
    const nextId = await this.expedientesService.generarCodigoCasoPublico();
    return { nextId };
  }

  @Get()
  async findAll() {
    return this.expedientesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.expedientesService.findOne(id);
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
    const currentUserName = req.user?.nombreCompleto || 'Usuario Desconocido';
    const areas: any[] = [];
    for (const ref of body.referencias) {
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
    }
    return { success: true };
  }
}
