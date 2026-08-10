import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: Supabase environment variables not set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TICKETS_FILE = path.resolve("./tickets.json");
const PROFILE_FILE = path.resolve("./profile.json");

// Helper map functions
const mapTicketToPostgres = (t: any) => ({
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

const mapProfileToPostgres = (p: any) => ({
  id: 'default',
  rfc: p.rfc,
  razon_social: p.razonSocial,
  regimen_fiscal: p.regimenFiscal,
  codigo_postal: p.codigoPostal,
  uso_cfdi: p.usoCFDI,
  email: p.email,
  codigo_cliente: p.codigoCliente || null,
});

async function runMigration() {
  console.log("🚀 Iniciando migración de datos locales a Supabase Cloud...");

  // 1. Migrate Profile
  if (fs.existsSync(PROFILE_FILE)) {
    try {
      const profileContent = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
      if (profileContent && profileContent.rfc) {
        console.log(`[Perfil] Encontrado perfil local para RFC: ${profileContent.rfc}`);
        const postgresProfile = mapProfileToPostgres(profileContent);
        const { error } = await supabase.from("profile").upsert(postgresProfile);
        if (error) throw error;
        console.log("✅ Perfil local migrado exitosamente a Supabase.");
      }
    } catch (err: any) {
      console.error("❌ Error al migrar perfil:", err.message || err);
    }
  } else {
    console.log("[Perfil] No se encontró archivo profile.json local.");
  }

  // 2. Migrate Tickets
  if (fs.existsSync(TICKETS_FILE)) {
    try {
      const ticketsContent = JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
      if (Array.isArray(ticketsContent) && ticketsContent.length > 0) {
        console.log(`[Tickets] Encontrados ${ticketsContent.length} tickets locales.`);
        
        // We will insert them in batches to avoid network payload limits
        const batchSize = 10;
        for (let i = 0; i < ticketsContent.length; i += batchSize) {
          const batch = ticketsContent.slice(i, i + batchSize).map(mapTicketToPostgres);
          const { error } = await supabase.from("tickets").upsert(batch);
          if (error) throw error;
          console.log(`[Tickets] Migrado lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(ticketsContent.length / batchSize)} (${batch.length} tickets)...`);
        }
        console.log("✅ Todos los tickets locales migrados exitosamente a Supabase.");
      } else {
        console.log("[Tickets] El archivo tickets.json está vacío.");
      }
    } catch (err: any) {
      console.error("❌ Error al migrar tickets:", err.message || err);
    }
  } else {
    console.log("[Tickets] No se encontró archivo tickets.json local.");
  }

  console.log("🎉 ¡Migración terminada!");
}

runMigration();
