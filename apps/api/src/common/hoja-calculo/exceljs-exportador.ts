import { Injectable } from '@nestjs/common';
import { Workbook, type Worksheet } from 'exceljs';
import type {
  HojaCalculo,
  IExportadorHojaCalculo,
  ValorCeldaHoja,
} from './exportador-hoja-calculo.interface';

const MS_POR_DIA = 86_400_000;
/** Día 0 del sistema de fechas de Excel (1900, con el desfase histórico del 29/02/1900). */
const EPOCA_EXCEL_UTC = Date.UTC(1899, 11, 30);

/**
 * "YYYY-MM-DD" → número de serie de Excel. `Date.UTC` se usa solo para contar días entre dos
 * fechas de calendario (sin zona horaria de por medio); el valor nunca se guarda como `Date`.
 */
export function serialExcelDeFecha(fechaIso: string): number {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return (Date.UTC(anio, mes - 1, dia) - EPOCA_EXCEL_UTC) / MS_POR_DIA;
}

/**
 * Implementación con `exceljs`. Los textos se escriben como valores, no como fórmulas: un
 * nombre que empiece con "=" no se ejecuta al abrir el archivo.
 */
@Injectable()
export class ExcelJsExportador implements IExportadorHojaCalculo {
  readonly tipoContenido =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  readonly extension = 'xlsx';

  async generar(hoja: HojaCalculo): Promise<Buffer> {
    const libro = new Workbook();
    // Sin nombre de la persona que exporta en los metadatos del archivo.
    libro.creator = 'AKyuam';

    const conGrupos = hoja.columnas.some((columna) => columna.grupo);
    const filasEncabezado = conGrupos ? 2 : 1;
    const hojaExcel = libro.addWorksheet(hoja.nombreHoja, {
      views: [{ state: 'frozen', ySplit: filasEncabezado }],
    });
    hojaExcel.columns = hoja.columnas.map((columna) => ({
      width: columna.ancho,
      style: columna.tipo === 'fecha' ? { numFmt: 'dd/mm/yyyy' } : {},
    }));

    if (conGrupos) {
      this.escribirEncabezadoAgrupado(hojaExcel, hoja);
    } else {
      hojaExcel.addRow(hoja.columnas.map((columna) => columna.titulo));
    }
    for (let numero = 1; numero <= filasEncabezado; numero++) {
      const fila = hojaExcel.getRow(numero);
      fila.font = { bold: true };
      fila.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    }

    for (const fila of hoja.filas) {
      hojaExcel.addRow(
        fila.map((valor, indice) =>
          this.valorCelda(valor, hoja.columnas[indice]?.tipo),
        ),
      );
    }

    if (hoja.filas.length > 0) {
      hojaExcel.autoFilter = {
        from: { row: filasEncabezado, column: 1 },
        to: { row: filasEncabezado, column: hoja.columnas.length },
      };
    }

    const contenido = await libro.xlsx.writeBuffer();
    return Buffer.from(contenido);
  }

  /**
   * Fila 1: el grupo combinado sobre sus columnas consecutivas; fila 2: el título de cada
   * columna. Las columnas sin grupo combinan sus dos filas con su propio título.
   */
  private escribirEncabezadoAgrupado(hojaExcel: Worksheet, hoja: HojaCalculo) {
    const filaGrupos = hojaExcel.getRow(1);
    const filaTitulos = hojaExcel.getRow(2);
    let indice = 0;
    while (indice < hoja.columnas.length) {
      const columna = hoja.columnas[indice];
      const desde = indice + 1;
      if (!columna.grupo) {
        filaGrupos.getCell(desde).value = columna.titulo;
        hojaExcel.mergeCells(1, desde, 2, desde);
        indice++;
        continue;
      }
      let hasta = desde;
      while (
        hasta < hoja.columnas.length &&
        hoja.columnas[hasta].grupo === columna.grupo
      ) {
        hasta++;
      }
      filaGrupos.getCell(desde).value = columna.grupo;
      if (hasta > desde) {
        hojaExcel.mergeCells(1, desde, 1, hasta);
      }
      for (let n = desde; n <= hasta; n++) {
        filaTitulos.getCell(n).value = hoja.columnas[n - 1].titulo;
      }
      indice = hasta;
    }
  }

  private valorCelda(
    valor: ValorCeldaHoja,
    tipo: string | undefined,
  ): string | number | null {
    if (valor === null) {
      return null;
    }
    if (tipo === 'fecha' && typeof valor === 'string') {
      return serialExcelDeFecha(valor);
    }
    return valor;
  }
}
