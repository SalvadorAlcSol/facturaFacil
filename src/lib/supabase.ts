import { createClient } from '@supabase/supabase-js';
import { Ticket, DatosFacturacion } from '../types';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL;

const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Warning: Faltan las variables de entorno de Supabase VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Column mappings between Postgres snake_case and TypeScript camelCase

export const mapPostgresToTicket = (row: any): Ticket => ({
  id: row.id,
  fileName: row.file_name,
  fileData: row.file_data,
  folio: row.folio,
  webId: row.web_id,
  estacion: row.estacion,
  monto: Number(row.monto),
  iva: row.iva !== null && row.iva !== undefined ? Number(row.iva) : undefined,
  fecha: row.fecha,
  combustible: row.combustible,
  litros: row.litros !== null && row.litros !== undefined ? Number(row.litros) : undefined,
  precioPorLitro: row.precio_por_litro !== null && row.precio_por_litro !== undefined ? Number(row.precio_por_litro) : undefined,
  explanation: row.explanation,
  status: row.status,
  fechaFacturacion: row.fecha_facturacion,
  cfdiFolio: row.cfdi_folio,
  observaciones: row.observaciones,
  categoria: row.categoria || 'combustible',
  driveUrl: row.drive_url,
  xmlDriveLink: row.xml_drive_link,
  pdfDriveLink: row.pdf_drive_link,
  xml: row.xml,
  pdfBase64: row.pdf_base64,
});

export const mapTicketToPostgres = (t: Ticket) => ({
  id: t.id,
  file_name: t.fileName,
  file_data: t.fileData || null,
  folio: t.folio,
  web_id: t.webId,
  estacion: t.estacion,
  monto: t.monto,
  iva: t.iva ?? null,
  fecha: t.fecha,
  combustible: t.combustible || null,
  litros: t.litros ?? null,
  precio_por_litro: t.precioPorLitro ?? null,
  explanation: t.explanation ?? null,
  status: t.status,
  fecha_facturacion: t.fechaFacturacion ?? null,
  cfdi_folio: t.cfdiFolio ?? null,
  observaciones: t.observaciones ?? null,
  categoria: t.categoria || 'combustible',
  drive_url: t.driveUrl ?? null,
  xml_drive_link: t.xmlDriveLink ?? null,
  pdf_drive_link: t.pdfDriveLink ?? null,
  xml: t.xml ?? null,
  pdf_base64: t.pdfBase64 ?? null,
});

export const mapPostgresToProfile = (row: any): DatosFacturacion => ({
  rfc: row.rfc,
  razonSocial: row.razon_social,
  regimenFiscal: row.regimen_fiscal,
  codigoPostal: row.codigo_postal,
  usoCFDI: row.uso_cfdi,
  email: row.email,
  codigoCliente: row.codigo_cliente || undefined,
});

export const mapProfileToPostgres = (p: DatosFacturacion) => ({
  id: 'default',
  rfc: p.rfc,
  razon_social: p.razonSocial,
  regimen_fiscal: p.regimenFiscal,
  codigo_postal: p.codigoPostal,
  uso_cfdi: p.usoCFDI,
  email: p.email,
  codigo_cliente: p.codigoCliente || null,
});
