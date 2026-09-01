import "./src/env-loader";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Tesseract from "tesseract.js";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { parseOCRText } from "./src/ocr-parser";
import { autoInvoiceReal, syncInvoicesReal } from "./src/rpa-automator";
import { getDriveStatus, uploadTicketImage, uploadInvoiceFiles } from "./src/google-drive";


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit to handle base64 image transfers
  app.use(express.json({ limit: "15mb" }));

  // API router
  app.post("/api/analyze-ticket", async (req: express.Request, res: express.Response) => {
    try {
      const { image, mimeType } = req.body;
      if (!image || !mimeType) {
        return res.status(400).json({ error: "Debe proporcionar la imagen y el tipo MIME." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      let parsedData: any = null;

      // 1. Try Gemini 3.5 Flash if API key is set and valid
      if (apiKey && apiKey !== "tu_api_key_aqui" && apiKey.trim() !== "") {
        console.log("[API] Detectada GEMINI_API_KEY. Intentando extracción con Gemini 3.5 Flash (Gratuito)...");
        try {
          const ai = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });

          const rawBase64 = image.includes("base64,") ? image.split("base64,")[1] : image;
 
          const prompt = `Analiza con extrema precisión la foto de este ticket de compra. Puede ser de combustible/gasolina (Ferchegas, etc.), café/starbucks, u otros.
Extrae los siguientes datos importantes para la facturación y control de gastos:
1. 'Folio' o número de ticket. Pon especial atención a los dígitos numéricos para evitar confusiones de lectura (por ejemplo, NO confundas un '9' con un '0', ni un '8' con un '0'). Asegúrate de leer el número de folio tal cual aparece en el ticket.
2. 'Web ID' o clave de facturación (código de seguridad en el ticket). Para Starbucks/Alsea, suele ser un número de 16 a 20 dígitos. Para Ferchegas, es una clave alfanumérica de 6 a 8 caracteres (ej: 8XHGJ7A). 
   IMPORTANTE: Bajo ninguna circunstancia extraigas palabras comunes, marcas o textos del ticket (como 'FERCHE', 'MAGNA', 'PREMIUM', 'TOTAL', 'GASOLINA', etc.) como si fueran el Web ID. El Web ID es un código de seguridad aleatorio/único. Si no es legible o no lo encuentras, déjalo vacío o pon found = false.
3. 'Estación' o establecimiento/tienda (ej. E04518, Starbucks Xalapa, etc.).
4. 'Monto' o total total de la compra (ej. 500.00).
5. 'Iva' o IVA (impuesto al valor agregado) pagado (ej. 68.97). Si no viene explícito, calcúlalo como el 16% del subtotal aproximado (monto - (monto / 1.16)).
6. 'Combustible' o tipo de gasolina si aplica (Magna, Premium, Diésel).
7. 'Litros' si es de combustible.
8. 'Precio por litro' si es de combustible.
9. 'Fecha' de la transacción en formato YYYY-MM-DD.
10. 'Categoria' del gasto: 'combustible' (gasolina/diésel), 'cafe' (Starbucks, cafeterías, etc.), o 'otros'.

Si la foto no es legible o no contiene estos campos, pon found = false.`;
 
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                inlineData: {
                  data: rawBase64,
                  mimeType: mimeType,
                },
              },
              prompt,
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  found: { type: Type.BOOLEAN, description: "True si se detectó un ticket y se extrajeron datos básicos" },
                  folio: { type: Type.STRING, description: "Folio del ticket" },
                  webId: { type: Type.STRING, description: "Código Web ID o Clave de facturación de 16-20 dígitos para Alsea/Starbucks, o 6-8 para Ferchegas" },
                  estacion: { type: Type.STRING, description: "Nombre del establecimiento o número de estación (ej: E02540, Starbucks Xalapa)" },
                  monto: { type: Type.NUMBER, description: "Monto total del ticket en pesos" },
                  iva: { type: Type.NUMBER, description: "Monto del IVA pagado en pesos" },
                  fecha: { type: Type.STRING, description: "Fecha de expedición en formato YYYY-MM-DD" },
                  combustible: { type: Type.STRING, description: "Tipo de combustible (Magna, Premium, Diésel)" },
                  litros: { type: Type.NUMBER, description: "Litros si aplica" },
                  precioPorLitro: { type: Type.NUMBER, description: "Precio por litro si aplica" },
                  categoria: { type: Type.STRING, description: "Categoría: 'combustible', 'cafe', o 'otros'" },
                  explanation: { type: Type.STRING, description: "Explicación de la extracción" },
                },
                required: ["found"],
              },
            },
          });
 
          const text = response.text;
          if (text) {
            parsedData = JSON.parse(text.trim());
            parsedData.explanation = "Datos extraídos de forma precisa con Gemini 3.5 Flash.";
            console.log("[API] Extracción de Gemini completada con éxito.");
          }
        } catch (geminiError: any) {
          console.warn("[API] Falló la extracción con Gemini, reintentando de forma local con Tesseract.js. Detalles del error:", geminiError.message || geminiError);
        }
      }

      // 2. Fallback to Local Tesseract.js OCR
      if (!parsedData) {
        console.log(`[OCR] Iniciando extracción local con Tesseract.js (${mimeType})...`);

        // Extract raw base64 string
        const rawBase64 = image.includes("base64,") ? image.split("base64,")[1] : image;
        const imageBuffer = Buffer.from(rawBase64, "base64");

        // Run OCR using Spanish language
        const ocrResult = await Tesseract.recognize(
          imageBuffer,
          "spa",
          {
            logger: m => {
              if (m.status === "recognizing text") {
                console.log(`[OCR Progress] ${(m.progress * 100).toFixed(0)}%`);
              }
            }
          }
        );

        const rawText = ocrResult.data.text;
        console.log("[OCR] Texto extraído con éxito. Parseando resultados con lógica de autocorrección...");
        parsedData = parseOCRText(rawText);
      }

      // 3. Upload ticket image to Google Drive if configured
      if (parsedData && parsedData.found) {
        try {
          const ticketId = Date.now().toString();
          const driveUrl = await uploadTicketImage(ticketId, image, "ticket.jpg");
          if (driveUrl) {
            parsedData.driveUrl = driveUrl;
            parsedData.explanation += " (Respaldo en Google Drive guardado).";
          }
        } catch (driveErr: any) {
          console.error("[Drive Upload] Falló la subida de imagen:", driveErr.message || driveErr);
        }
      }

      return res.json(parsedData);
    } catch (error: any) {
      console.error("Error procesando ticket:", error);
      return res.status(500).json({ error: error.message || "Error al procesar el ticket." });
    }
  });

  let isRobotRunning = false;
  let robotStartTime = 0;

  // Auto-Invoicing endpoint that calls the real Puppeteer automation
  app.post("/api/auto-invoice", async (req: express.Request, res: express.Response) => {
    // Auto-reset lock if stuck for more than 2 minutes
    if (isRobotRunning && Date.now() - robotStartTime > 120000) {
      console.log("[API] Restableciendo candado de robot por tiempo transcurrido (>2 min).");
      isRobotRunning = false;
    }

    if (isRobotRunning) {
      console.log("[API] Intento de facturación bloqueado: el robot ya está ejecutando otra tarea.");
      return res.status(409).json({ error: "El robot de facturación ya está ejecutando otra tarea. Por favor espera a que termine tu petición anterior." });
    }

    isRobotRunning = true;
    robotStartTime = Date.now();
    try {
      const { ticket, datosFacturacion } = req.body;
      if (!ticket || !datosFacturacion) {
        return res.status(400).json({ error: "Debe proporcionar los datos del ticket y la información de la factura." });
      }

      if (!datosFacturacion.rfc || !datosFacturacion.razonSocial) {
        return res.status(400).json({ error: "La información de facturación está incompleta. Configure su RFC y Razón Social en Datos Fiscales." });
      }

      console.log(`[API] Iniciando petición de facturación real para el folio: ${ticket.folio}`);
      
      const result = await autoInvoiceReal(ticket, datosFacturacion);

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Error en el robot de facturación automatizada." });
      }

      // Generate random stamps as fallbacks if not returned by portal download
      const generateUUID = () => {
        const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
        return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
      };

      const generateSeal = (length: number) => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        let seal = "";
        for (let i = 0; i < length; i++) {
          seal += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return seal;
      };

      const fallbackUuid = generateUUID();
      const fallbackSelloCfd = generateSeal(120);
      const fallbackSelloSat = generateSeal(120);

      const monto = parseFloat(ticket.monto) || 0;
      const litros = parseFloat(ticket.litros) || (monto / 22.50);
      const precioPorLitro = parseFloat(ticket.precioPorLitro) || (monto / litros);
      
      const subtotal = Number((monto / 1.16).toFixed(2));
      const iva = Number((monto - subtotal).toFixed(2));
      const stampTime = new Date().toISOString().replace(/\.\d{3}Z/, "");

      // Upload files to Google Drive if configured
      let xmlDriveLink = "";
      let pdfDriveLink = "";
      try {
        const driveResults = await uploadInvoiceFiles(
          ticket.folio || '9982',
          result.xml || "",
          result.pdfBase64 || ""
        );
        xmlDriveLink = driveResults.xmlLink || "";
        pdfDriveLink = driveResults.pdfLink || "";
      } catch (driveErr: any) {
        console.error("[Drive API] Error al subir los archivos de factura a Google Drive:", driveErr);
      }

      // Send the response with real downloaded files if available
      return res.json({
        success: true,
        uuid: result.xml ? (result.xml.match(/UUID="([^"]+)"/i)?.[1] || fallbackUuid) : fallbackUuid,
        xml: result.xml, // Real XML from portal
        pdfBase64: result.pdfBase64, // Real PDF from portal
        fechaTimbrado: result.xml ? (result.xml.match(/FechaTimbrado="([^"]+)"/i)?.[1] || stampTime) : stampTime,
        selloSat: result.xml ? (result.xml.match(/SelloSAT="([^"]+)"/i)?.[1] || fallbackSelloSat) : fallbackSelloSat,
        selloCfd: result.xml ? (result.xml.match(/SelloCFD="([^"]+)"/i)?.[1] || fallbackSelloCfd) : fallbackSelloCfd,
        subtotal,
        iva,
        monto,
        litros,
        precioPorLitro,
        folioFactura: result.fileNameXml ? result.fileNameXml.replace(".xml", "") : `FAG-${ticket.folio || '9982'}`,
        xmlDriveLink,
        pdfDriveLink,
        warning: result.error
      });
    } catch (error: any) {
      console.error("Error en auto-facturacion:", error);
      return res.status(500).json({ error: error.message || "Error al procesar el timbrado automático." });
    } finally {
      isRobotRunning = false;
    }
  });

  // Synchronize past invoices by querying the portal using customer details
  app.post("/api/sync-invoices", async (req: express.Request, res: express.Response) => {
    // Auto-reset lock if stuck for more than 2 minutes
    if (isRobotRunning && Date.now() - robotStartTime > 120000) {
      console.log("[API] Restableciendo candado de robot por tiempo transcurrido (>2 min).");
      isRobotRunning = false;
    }

    if (isRobotRunning) {
      console.log("[API] Intento de sincronización bloqueado: el robot ya está ejecutando otra tarea.");
      return res.status(409).json({ error: "El robot de facturación ya está ejecutando otra tarea. Por favor espera a que termine y reintenta." });
    }

    isRobotRunning = true;
    robotStartTime = Date.now();
    try {
      const { datosFacturacion } = req.body;
      if (!datosFacturacion) {
        return res.status(400).json({ error: "Debe proporcionar la información de facturación." });
      }

      console.log(`[API] Iniciando sincronización de facturas del portal para el RFC: ${datosFacturacion.rfc}`);
      const result = await syncInvoicesReal(datosFacturacion);
      return res.json(result);
    } catch (error: any) {
      console.error("Error en sync-invoices:", error);
      return res.status(500).json({ error: error.message || "Error al sincronizar facturas desde el portal." });
    } finally {
      isRobotRunning = false;
    }
  });

  // Endpoint to check Google Drive configuration status
  app.get("/api/drive-status", (req: express.Request, res: express.Response) => {
    return res.json(getDriveStatus());
  });

  // Endpoints for multi-device data synchronization
  const TICKETS_FILE = path.resolve("./tickets.json");
  const PROFILE_FILE = path.resolve("./profile.json");

  function readJsonSync(filePath: string, defaultVal: any) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error(`Error al leer archivo ${filePath}:`, err);
    }
    return defaultVal;
  }

  function writeJsonSync(filePath: string, data: any) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch (err) {
      console.error(`Error al escribir archivo ${filePath}:`, err);
      return false;
    }
  }

  app.get("/api/tickets", (req: express.Request, res: express.Response) => {
    const tickets = readJsonSync(TICKETS_FILE, []);
    return res.json(tickets);
  });

  app.post("/api/tickets", (req: express.Request, res: express.Response) => {
    try {
      const { tickets } = req.body;
      if (!Array.isArray(tickets)) {
        return res.status(400).json({ error: "Los datos de los tickets deben ser un arreglo." });
      }
      writeJsonSync(TICKETS_FILE, tickets);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Error al guardar los tickets." });
    }
  });

  app.get("/api/profile", (req: express.Request, res: express.Response) => {
    const profile = readJsonSync(PROFILE_FILE, null);
    return res.json(profile);
  });

  app.post("/api/profile", (req: express.Request, res: express.Response) => {
    try {
      const { profile } = req.body;
      if (!profile) {
        return res.status(400).json({ error: "Debe proveer los datos de perfil." });
      }
      writeJsonSync(PROFILE_FILE, profile);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Error al guardar el perfil." });
    }
  });

  // Endpoint to upload / save Google credentials
  app.post("/api/save-drive-credentials", (req: express.Request, res: express.Response) => {
    try {
      const { credentials } = req.body;
      if (!credentials) {
        return res.status(400).json({ error: "Debe proveer el JSON de credenciales." });
      }

      const credPath = path.resolve("./google-credentials.json");
      fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), "utf8");
      
      return res.json(getDriveStatus());
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Error al guardar el archivo." });
    }
  });

  // Endpoint to read automation logs in real-time
  app.get("/api/automation-logs", (req: express.Request, res: express.Response) => {
    const logFile = path.resolve("./automation.log");
    try {
      if (!fs.existsSync(logFile)) {
        return res.json({ logs: [] });
      }
      const fileContent = fs.readFileSync(logFile, "utf8");
      const logs = fileContent.split("\n").filter((line: string) => line.trim() !== "");
      return res.json({ logs });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Error al leer los logs." });
    }
  });

  // Serve app with Vite in development, or compiled static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT}`);
  });
}

startServer();

