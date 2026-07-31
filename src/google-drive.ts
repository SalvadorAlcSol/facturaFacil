import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const CREDENTIALS_PATH = path.resolve("./google-credentials.json");
const FOLDER_ID = "1V56mnluC7pcuZDzJUvV_gRrqWjFVmKGX";

export interface DriveStatus {
  configured: boolean;
  serviceAccountEmail?: string;
  error?: string;
}

/**
 * Checks if the credentials file exists and parses it to read the client email.
 */
export function getDriveStatus(): DriveStatus {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return { configured: false };
  }
  try {
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
    if (!creds.client_email || !creds.private_key) {
      return { configured: false, error: "El archivo JSON no contiene client_email o private_key válidos." };
    }
    return {
      configured: true,
      serviceAccountEmail: creds.client_email
    };
  } catch (e: any) {
    return { configured: false, error: e.message || "Error al leer el archivo de credenciales." };
  }
}

/**
 * Instantiates the Google Drive client.
 */
function getDriveClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error("Credenciales de Google Drive no configuradas. Por favor, suba el archivo google-credentials.json");
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Uploads a file buffer to the shared Google Drive folder.
 */
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  contentBuffer: Buffer
): Promise<string> {
  try {
    const drive = getDriveClient();
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: mimeType,
        body: Readable.from(contentBuffer),
      },
      fields: "id, webViewLink",
    });

    const fileId = response.data.id;
    const viewLink = response.data.webViewLink;
    console.log(`[Drive Service] Archivo subido con éxito a Google Drive: ${fileName} (ID: ${fileId})`);
    return viewLink || "";
  } catch (err: any) {
    console.error(`[Drive Service] Falló la subida de ${fileName}:`, err.message || err);
    throw err;
  }
}

/**
 * Uploads a scanned ticket image (Base64) to Google Drive.
 */
export async function uploadTicketImage(
  ticketId: string,
  base64Data: string,
  originalName: string
): Promise<string> {
  const status = getDriveStatus();
  if (!status.configured) {
    console.log("[Drive Service] Google Drive no configurado. Omitiendo subida de imagen de ticket.");
    return "";
  }

  // Extract base64 details
  const rawBase64 = base64Data.includes("base64,") ? base64Data.split("base64,")[1] : base64Data;
  const mimeMatch = base64Data.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const extension = mimeType.split("/")[1] || "jpg";

  const buffer = Buffer.from(rawBase64, "base64");
  const fileName = `TICKET_${ticketId}_${originalName.replace(/\s+/g, "_")}`;

  return uploadToDrive(fileName, mimeType, buffer);
}

/**
 * Uploads invoice XML and PDF files to Google Drive.
 */
export async function uploadInvoiceFiles(
  ticketFolio: string,
  xmlContent: string,
  pdfBase64: string
): Promise<{ xmlLink?: string; pdfLink?: string }> {
  const status = getDriveStatus();
  if (!status.configured) {
    console.log("[Drive Service] Google Drive no configurado. Omitiendo subida de facturas.");
    return {};
  }

  const results: { xmlLink?: string; pdfLink?: string } = {};

  // 1. Upload XML
  try {
    const xmlBuffer = Buffer.from(xmlContent, "utf8");
    const xmlFileName = `FACTURA_${ticketFolio}.xml`;
    results.xmlLink = await uploadToDrive(xmlFileName, "text/xml", xmlBuffer);
  } catch (err) {
    console.error("[Drive Service] No se pudo subir el archivo XML:", err);
  }

  // 2. Upload PDF
  if (pdfBase64) {
    try {
      const rawPdf = pdfBase64.includes("base64,") ? pdfBase64.split("base64,")[1] : pdfBase64;
      const pdfBuffer = Buffer.from(rawPdf, "base64");
      const pdfFileName = `FACTURA_${ticketFolio}.pdf`;
      results.pdfLink = await uploadToDrive(pdfFileName, "application/pdf", pdfBuffer);
    } catch (err) {
      console.error("[Drive Service] No se pudo subir el archivo PDF:", err);
    }
  }

  return results;
}
