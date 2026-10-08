import { resolverNombreVisible, validarArchivo } from './validador-archivo';

const PDF = Buffer.from('%PDF-1.7 contenido de prueba');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);

describe('validarArchivo', () => {
  it.each([
    ['application/pdf', PDF],
    ['image/png', PNG],
    ['image/jpeg', JPEG],
    ['image/webp', WEBP],
  ])('acepta %s con su firma real', (mimeType, contenido) => {
    expect(validarArchivo({ mimeType, contenido })).toBeNull();
  });

  it('rechaza un archivo vacío', () => {
    expect(
      validarArchivo({
        mimeType: 'application/pdf',
        contenido: Buffer.alloc(0),
      }),
    ).toBe('VACIO');
  });

  it.each(['text/html', 'image/svg+xml', 'application/x-msdownload', ''])(
    'rechaza el tipo no permitido "%s"',
    (mimeType) => {
      expect(validarArchivo({ mimeType, contenido: PDF })).toBe(
        'TIPO_NO_PERMITIDO',
      );
    },
  );

  it('rechaza un HTML que se declara como PDF', () => {
    expect(
      validarArchivo({
        mimeType: 'application/pdf',
        contenido: Buffer.from('<html><script>alert(1)</script></html>'),
      }),
    ).toBe('CONTENIDO_NO_COINCIDE');
  });

  it('rechaza un PNG que se declara como JPEG', () => {
    expect(validarArchivo({ mimeType: 'image/jpeg', contenido: PNG })).toBe(
      'CONTENIDO_NO_COINCIDE',
    );
  });
});

describe('resolverNombreVisible', () => {
  it('usa el nombre escrito, recortado', () => {
    expect(resolverNombreVisible('  Demanda inicial  ', 'scan.pdf')).toBe(
      'Demanda inicial',
    );
  });

  it('sin nombre escrito, usa el del archivo sin extensión', () => {
    expect(resolverNombreVisible(undefined, 'acta.de.audiencia.pdf')).toBe(
      'acta.de.audiencia',
    );
    expect(resolverNombreVisible('   ', 'scan.PDF')).toBe('scan');
  });

  it('quita caracteres de control y limita el largo', () => {
    expect(resolverNombreVisible('Acta\u0000\n final', 'x.pdf')).toBe(
      'Acta final',
    );
    expect(resolverNombreVisible('a'.repeat(300), 'x.pdf')).toHaveLength(120);
  });

  it('nunca devuelve un nombre vacío', () => {
    expect(resolverNombreVisible('', '.pdf')).toBe('Documento');
  });
});
