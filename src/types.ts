export interface Ticket {
  id: string;
  fileName: string;
  fileData?: string; // base64 representation for preview
  folio: string;
  webId: string;
  estacion: string;
  monto: number;
  iva?: number; // VAT paid
  fecha: string; // YYYY-MM-DD
  combustible: string;
  litros?: number;
  precioPorLitro?: number;
  explanation?: string;
  status: 'pendiente' | 'facturado' | 'error';
  fechaFacturacion?: string;
  cfdiFolio?: string; // Optional folio fiscal UUID
  observaciones?: string;
  categoria: 'combustible' | 'cafe' | 'otros';
  driveUrl?: string; // Google Drive image backup link
  xmlDriveLink?: string; // Google Drive XML link
  pdfDriveLink?: string; // Google Drive PDF link
}

export interface DatosFacturacion {
  rfc: string;
  razonSocial: string;
  regimenFiscal: string; // e.g., '601', '605', '612', '626', etc.
  codigoPostal: string;
  usoCFDI: string; // e.g., 'G03', 'CN01', 'D01', etc.
  email: string;
  codigoCliente?: string; // Código de cliente opcional para portales Ferchegas
}

export const REGIMENES_FISCALES = [
  { code: '601', description: 'General de Ley Personas Morales' },
  { code: '603', description: 'Personas Morales con Fines no Lucrativos' },
  { code: '605', description: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', description: 'Arrendamiento' },
  { code: '608', description: 'Demás ingresos' },
  { code: '612', description: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '616', description: 'Sin obligaciones fiscales' },
  { code: '621', description: 'Incorporación Fiscal' },
  { code: '625', description: 'Régimen de las Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { code: '626', description: 'Régimen Simplificado de Confianza - RESICO' },
];

export const USOS_CFDI = [
  { code: 'G03', description: 'Gastos en general' },
  { code: 'G01', description: 'Adquisición de mercancías' },
  { code: 'I04', description: 'Equipo de transporte' },
  { code: 'I08', description: 'Otras maquinaria y equipo' },
  { code: 'D01', description: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { code: 'CP01', description: 'Pagos' },
  { code: 'CN01', description: 'Nómina' },
  { code: 'S01', description: 'Sin efectos fiscales' },
];

export const ESTACIONES_FERCHEGAS = [
  { id: 'E04518', name: 'Estación Ferchegas Xalapa Centro' },
  { id: 'E02540', name: 'Estación Ferchegas El Tronconal' },
  { id: 'E03120', name: 'Estación Ferchegas Ruiz Cortines' },
  { id: 'E01140', name: 'Estación Ferchegas Ávila Camacho' },
  { id: 'E05280', name: 'Estación Ferchegas Coatepec' },
  { id: 'E06110', name: 'Estación Ferchegas Veracruz Puerto' },
  { id: 'E08900', name: 'Estación Ferchegas Banderilla' },
  { id: 'OTRA', name: 'Otra Estación Ferchegas' }
];
