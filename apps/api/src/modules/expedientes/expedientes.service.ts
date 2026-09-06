/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpedienteDto } from '@akyuam/shared';

@Injectable()
export class ExpedientesService {
  constructor(private readonly prisma: PrismaService) {}

  async generarCodigoCasoPublico(): Promise<string> {
    const year = new Date().getFullYear();
    const shortYear = year.toString().slice(-2); // '26'

    // Busca el Ãºltimo expediente creado este aÃ±o
    const ultimo = await this.prisma.expediente.findFirst({
      where: {
        codigoCaso: {
          endsWith: `-${shortYear}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!ultimo) {
      return `1-${shortYear}`;
    }

    const correlativoStr = ultimo.codigoCaso.split('-')[0];
    const correlativo = parseInt(correlativoStr, 10);
    const nuevoCorrelativo = (correlativo + 1).toString(); // Sin padding (ej. '2' en lugar de '002')

    return `${nuevoCorrelativo}-${shortYear}`;
  }

  async create(data: CreateExpedienteDto, currentUserName: string) {
    const codigoCaso = await this.generarCodigoCasoPublico();

    // Usa una transacciÃ³n para crear el Expediente, su sub-registro de TS y la BitÃ¡cora inicial
    return this.prisma.$transaction(async (tx) => {
      const expediente = await tx.expediente.create({
        data: {
          codigoCaso,
          nombresUsuaria: data.nombresUsuaria,
          apellidosUsuaria: data.apellidosUsuaria,
          dpi: data.dpi || null,
          telefono: data.telefono || null,
          direccion: data.direccion,

          nombresAgresor: data.nombresAgresor || null,
          apellidosAgresor: data.apellidosAgresor || null,
          telefonoAgresor: data.telefonoAgresor || null,
          direccionAgresor: data.direccionAgresor || null,

          tipologiasViolencia: data.tipologiasViolencia,
          condicionRegistro: data.condicionRegistro,
          fechaIngreso: data.fechaIngreso
            ? new Date(data.fechaIngreso)
            : new Date(),

          // Crear de una vez el sub-registro
          trabajoSocial: {
            create: {
              observacionesGenerales: data.observacionesGenerales || null,
            },
          },

          // Loggear en bitÃ¡cora
          bitacora: {
            create: {
              area: 'TRABAJO_SOCIAL',
              titulo: 'CreaciÃ³n de Expediente',
              descripcion: `Expediente creado y guardado como registro de Trabajo Social`,
              usuarioNombre: currentUserName,
            },
          },
        },
        include: {
          trabajoSocial: true,
        },
      });

      return expediente;
    });
  }

  async findAll() {
    return this.prisma.expediente.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        bitacora: true,
        trabajoSocial: true,
        archivos: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.expediente.findUnique({
      where: { id },
      include: {
        trabajoSocial: true,
        bitacora: {
          orderBy: { createdAt: 'desc' },
        },
        archivos: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async updateCaratula(id: string, data: any) {
    return this.prisma.expediente.update({
      where: { id },
      data: {
        nombresUsuaria: data.nombresUsuaria,
        apellidosUsuaria: data.apellidosUsuaria,
        dpi: data.dpi,
        fechaNacimiento: data.fechaNacimiento
          ? new Date(data.fechaNacimiento)
          : null,
        edad: data.edad ? parseInt(data.edad, 10) : null,
        genero: data.genero,
        telefono: data.telefono,
        direccion: data.direccion,
        departamento: data.departamento,
        municipio: data.municipio,
        grupoEtnico: data.grupoEtnico,
        ubicacionGeo: data.ubicacionGeografica,

        nombresAgresor: data.nombresAgresor,
        apellidosAgresor: data.apellidosAgresor,
        telefonoAgresor: data.telefonoAgresor,
        direccionAgresor: data.direccionAgresor,

        condicionRegistro: data.condicionRegistro,
      },
    });
  }

  async saveEntrevista(id: string, data: any) {
    return this.prisma.trabajoSocialRegistro.update({
      where: { expedienteId: id },
      data: {
        descripcionHecho: data.descripcionHecho,
        observacionesEntrevista: data.observacionesEntrevista,
      },
    });
  }

  async asignarAreas(id: string, areas: any[]) {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id },
      select: { areasAsignadas: true },
    });

    if (!expediente) return null;

    // Union de areas existentes con las nuevas (sin duplicados)
    const nuevasAreas = Array.from(
      new Set([...expediente.areasAsignadas, ...areas]),
    );

    return this.prisma.expediente.update({
      where: { id },
      data: { areasAsignadas: nuevasAreas },
    });
  }

  async addBitacoraEntry(id: string, data: any, currentUserName: string) {
    return this.prisma.bitacora.create({
      data: {
        expedienteId: id,
        area: 'TRABAJO_SOCIAL',
        titulo: data.titulo || 'Registro Manual',
        descripcion: data.descripcion,
        usuarioNombre: currentUserName,
      },
    });
  }

  async addArchivoDigital(
    id: string,
    file: any,
    categoria: string,
    currentUserId: string | null,
  ) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    return this.prisma.archivoDigital.create({
      data: {
        expedienteId: id,
        nombre: file.originalname,
        categoria: categoria || 'General',
        peso: sizeInMB,
        url: `/uploads/${file.filename}`,
        uploadedById: currentUserId,
      },
    });
  }
}
