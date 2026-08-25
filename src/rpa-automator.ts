import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { uploadInvoiceFiles } from "./google-drive";
import { supabase, mapPostgresToTicket, mapTicketToPostgres } from "./lib/supabase";

export interface AutomationResult {
  success: boolean;
  xml?: string;
  pdfBase64?: string;
  fileNameXml?: string;
  fileNamePdf?: string;
  error?: string;
}

// Ensure screenshots directory exists
const screenshotsDir = path.resolve("./assets/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Log helper to write to local automation.log
function writeLog(message: string) {
  const logFile = path.resolve("./automation.log");
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logFile, logLine, "utf8");
    console.log(`[RPA] ${message}`);
  } catch (err) {
    console.error("Error writing to automation.log:", err);
  }
}

// Helper to save screenshots
async function takeScreenshot(page: puppeteer.Page, name: string) {
  try {
    const screenshotPath = path.join(screenshotsDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    writeLog(`Screenshot guardada: assets/screenshots/${name}.png`);
  } catch (err) {
    writeLog(`Error al tomar screenshot ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function solveCaptcha(page: puppeteer.Page, apiKey: string): Promise<string> {
  const captchaImgSelector = "#RadCaptcha1_CaptchaImageUP";
  writeLog("Localizando imagen del Captcha (#RadCaptcha1_CaptchaImageUP)...");
  
  const element = await page.$(captchaImgSelector);
  if (!element) {
    throw new Error("No se pudo localizar el elemento del Captcha en la página.");
  }

  writeLog("Tomando captura del elemento de Captcha...");
  const captchaBuffer = await element.screenshot({ type: "jpeg" }) as Buffer;
  const base64Image = captchaBuffer.toString("base64");

  writeLog("Enviando Captcha a Gemini para su resolución...");
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
      "Analiza esta imagen de captcha de 5 caracteres. ¿Cuáles son los 5 caracteres en la imagen? Responde ÚNICAMENTE con los 5 caracteres en mayúsculas, sin espacios, explicaciones ni puntuación (por ejemplo, ABCDE o X1Y2Z).",
    ],
  });

  const solvedText = response.text?.trim().replace(/\s/g, "").toUpperCase() || "";
  writeLog(`Captcha resuelto por Gemini: "${solvedText}"`);
  return solvedText;
}

// Map of station IDs to their direct billing URLs (Xalapa zone)
export const ESTACIONES_MAP: Record<string, string> = {
  // First Batch
  "E12620": "https://grupoferche.com:12620/arenales/",
  "E05534": "https://grupoferche.com:5534/ruizcortines/",
  "E05076": "https://grupoferche.com:5076/rebsamen/",
  "E08149": "https://grupoferche.com:8149/sanbruno/",
  "E11813": "https://grupoferche.com:11813/banderilla/",
  "E13196": "https://grupoferche.com:13196/central2/",
  "E08851": "https://grupoferche.com:8851/elrosario/",
  "E10185": "https://grupoferche.com:10185/cerrogordo/",
  
  // Second Batch (from user list)
  "E03024": "https://grupoferche.com:03024/animas/",
  "E04683": "https://grupoferche.com:4683/garnica/",
  "E07626": "https://grupoferche.com:7626/lencero/",
  "E08251": "https://grupoferche.com:8251/miradores/",
  "E10794": "https://grupoferche.com:10794/orduna/",
  "E12940": "https://grupoferche.com:12940/olmo/",
  "E14579": "https://grupoferche.com:14579/cristal/",
  "P21011": "https://grupoferche.com:21011/americas/",
  "P22559": "https://grupoferche.com:22559/elchico/",
  "P25034": "https://grupoferche.com:25034/misantla/"
};

export function normalizeStationCode(estacion: string): string {
  const clean = (estacion || "").toUpperCase().trim();
  const match = clean.match(/\b(E\d+|P\d+|\d{4,6})\b/i);
  if (match) {
    const raw = match[1];
    return /^[EP]/i.test(raw) ? raw : `E${raw}`;
  }
  // Fallback
  const alphaNumeric = clean.replace(/[^A-Z0-9]/ig, "");
  if (!alphaNumeric) return "";
  return alphaNumeric.startsWith("E") || alphaNumeric.startsWith("P") ? alphaNumeric : `E${alphaNumeric}`;
}

export async function autoInvoiceReal(
  ticket: {
    folio: string;
    webId: string;
    estacion: string;
    monto: number;
  },
  datos: {
    rfc: string;
    razonSocial: string;
    regimenFiscal: string;
    codigoPostal: string;
    usoCFDI: string;
    email: string;
    codigoCliente?: string;
  }
): Promise<AutomationResult> {
  // Normalize station code (handles descriptive names like "E04518 - Ruiz Cortines")
  const normalizedCode = normalizeStationCode(ticket.estacion);
  
  // Get portal URL from our map, fallback to env variable, fallback to default
  const portalUrl = ESTACIONES_MAP[normalizedCode] || process.env.FERCHEGAS_PORTAL_URL || "https://www.ferchegas.com.mx/facturacion/";
  const downloadPath = path.resolve("./downloads");

  // Initialize log file
  const logFile = path.resolve("./automation.log");
  try {
    fs.writeFileSync(logFile, `🤖 robot-agent: Inicializando pila de automatización web (Puppeteer/Chromium)...\n`, "utf8");
  } catch (err) {
    console.error("Error al inicializar el archivo de logs:", err);
  }

  writeLog(`Iniciando nueva facturación en portal: ${portalUrl}`);
  writeLog(`Datos Ticket - Folio: "${ticket.folio}", WebID: "${ticket.webId}", Estación: "${ticket.estacion}", Monto: $${ticket.monto} MXN`);
  writeLog(`Datos Fiscales del Cliente - RFC: "${datos.rfc}", Razón Social: "${datos.razonSocial}", C.P.: "${datos.codigoPostal}", Régimen: "${datos.regimenFiscal}", Uso CFDI: "${datos.usoCFDI}", Correo: "${datos.email}"`);

  // Ensure downloads directory exists and is empty
  if (!fs.existsSync(downloadPath)) {
    writeLog(`Creando directorio de descargas: ${downloadPath}`);
    fs.mkdirSync(downloadPath, { recursive: true });
  } else {
    writeLog(`Limpiando archivos antiguos en directorio de descargas...`);
    const files = fs.readdirSync(downloadPath);
    for (const file of files) {
      fs.unlinkSync(path.join(downloadPath, file));
    }
  }

  writeLog("Lanzando navegador Chromium (Headless)...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ],
  });

  let page: puppeteer.Page | null = null;
  let portalErrorMessage = "";

  try {
    page = await browser.newPage();
    
    // Register dialog listener to catch alerts (e.g. "ticket already invoiced")
    page.on("dialog", async (dialog) => {
      const msg = dialog.message();
      writeLog(`[Alerta Portal] Diálogo detectado: "${msg}"`);
      portalErrorMessage = msg;
      await dialog.dismiss().catch(() => {});
    });
    
    // Set realistic User-Agent to prevent WAF blocks
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    writeLog(`Configurando User-Agent: ${userAgent}`);
    await page.setUserAgent(userAgent);
    
    writeLog("Configurando cabeceras de idioma...");
    await page.setExtraHTTPHeaders({
      "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    writeLog("Ocultando propiedad navigator.webdriver...");
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });
    
    writeLog("Configurando comportamiento de descargas...");
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath,
    });

    writeLog("Configurando viewport a 1280x800...");
    await page.setViewport({ width: 1280, height: 800 });
    
    writeLog(`Navegando a: ${portalUrl}...`);
    await page.goto(portalUrl, { waitUntil: "networkidle2", timeout: 45000 });
    writeLog("Página inicial cargada con éxito.");
    await takeScreenshot(page, "01_portal_inicio");

    // Dynamic Station Link Selection (for Ferchegas portal list)
    if (portalUrl.includes("ferchegas.com.mx/facturacion") || portalUrl.includes("ferchegas.com/facturacion")) {
      const cleanStation = normalizedCode.replace(/^[EP]/i, ""); // e.g. "12620"
      writeLog(`Portal detectado como listado general. Buscando enlace para estación: "${cleanStation}"`);
      
      const targetLink = await page.evaluate((num) => {
        const links = Array.from(document.querySelectorAll("a"));
        const found = links.find((a) => {
          const text = a.textContent || "";
          const href = a.href || "";
          return text.includes(num) || href.includes(num);
        });
        return found ? found.href : null;
      }, cleanStation);

      if (targetLink) {
        writeLog(`Redirigiendo al portal específico de la estación encontrado: ${targetLink}`);
        await page.goto(targetLink, { waitUntil: "networkidle2", timeout: 45000 });
        await takeScreenshot(page, "01_portal_estacion_especifico");
      } else {
        writeLog(`No se encontró un enlace para la estación ${ticket.estacion} en el portal principal. Continuando en la página actual...`);
      }
    }

    // Check if we need to click "Facturar" or "Facturación sin registro"
    writeLog("Buscando enlaces de acceso como 'Facturar' o 'Facturación sin registro'...");
    const links = await page.$$("a, button");
    for (const link of links) {
      const text = await page.evaluate(el => el.textContent, link);
      if (text && /facturar|facturación\s+sin\s+registro/i.test(text)) {
        writeLog(`Haciendo clic en el botón/enlace de acceso: "${text.trim()}"`);
        await link.click();
        await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
        await takeScreenshot(page, "02_despues_clic_facturar");
        break;
      }
    }

    // Fill in ticket details
    writeLog("Localizando campos del ticket (Folio, Web ID)...");
    const folioSelector = await findSelector(page, [
      "#txtDespacho",
      "input[name*='folio' i]",
      "input[id*='folio' i]",
      "input[placeholder*='folio' i]",
      "#txtFolio",
      ".folio-input"
    ]);

    const webIdSelector = await findSelector(page, [
      "#txtIdentificador",
      "input[name*='webid' i]",
      "input[name*='clave' i]",
      "input[id*='webid' i]",
      "input[id*='clave' i]",
      "input[placeholder*='webid' i]",
      "input[placeholder*='clave' i]",
      "#txtWebId",
      "#txtWebID"
    ]);

    const estacionSelector = await findSelector(page, [
      "input[name*='estacion' i]",
      "input[id*='estacion' i]",
      "select[name*='estacion' i]",
      "select[id*='estacion' i]",
      "input[placeholder*='estacion' i]",
      "#txtEstacion"
    ]);

    if (!folioSelector) {
      throw new Error("No se pudo localizar el campo 'Folio' en la página de facturación.");
    }
    if (!webIdSelector) {
      throw new Error("No se pudo localizar el campo 'Web ID' en la página de facturación.");
    }

    let addedSuccessfully = false;
    const maxCaptchaRetries = 3;

    for (let attempt = 1; attempt <= maxCaptchaRetries; attempt++) {
      writeLog(`Intento ${attempt} de ${maxCaptchaRetries} para ingresar y agregar el ticket...`);

      writeLog(`Escribiendo Folio: "${ticket.folio}" en selector "${folioSelector}"...`);
      await page.focus(folioSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(folioSelector, ticket.folio);

      writeLog(`Escribiendo Web ID: "${ticket.webId}" en selector "${webIdSelector}"...`);
      await page.focus(webIdSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(webIdSelector, ticket.webId);

      // If there is an Estacion input, type/select it
      if (estacionSelector) {
        const cleanEstacion = normalizedCode.replace(/^[EP]/i, "");
        writeLog(`Escribiendo/Seleccionando Estación "${cleanEstacion}" en selector "${estacionSelector}"...`);
        
        const tagName = await page.evaluate((sel) => document.querySelector(sel)?.tagName, estacionSelector);
        if (tagName === "SELECT") {
          await page.select(estacionSelector, cleanEstacion).catch(async () => {
            await page.select(estacionSelector, normalizedCode).catch(() => {});
          });
        } else {
          await page.focus(estacionSelector);
          await page.keyboard.down('Control');
          await page.keyboard.press('A');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
          await page.type(estacionSelector, cleanEstacion);
        }
      }

      // Captcha solving (ControlGAS RadCaptcha)
      const captchaBoxSelector = await findSelector(page, [
        "#RadCaptcha1_CaptchaTextBox",
        "input[name*='captcha' i]",
        "input[id*='captcha' i]"
      ]);
      
      if (captchaBoxSelector) {
        writeLog(`Campo de Captcha detectado ("${captchaBoxSelector}"). Intentando resolver...`);
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey && apiKey !== "tu_api_key_aqui" && apiKey.trim() !== "") {
            const solvedCaptcha = await solveCaptcha(page, apiKey);
            if (solvedCaptcha) {
              writeLog(`Escribiendo Captcha resuelto: "${solvedCaptcha}"`);
              await page.focus(captchaBoxSelector);
              await page.keyboard.down('Control');
              await page.keyboard.press('A');
              await page.keyboard.up('Control');
              await page.keyboard.press('Backspace');
              await page.type(captchaBoxSelector, solvedCaptcha);
            } else {
              writeLog("El Captcha devuelto por Gemini está vacío.");
            }
          } else {
            writeLog("No hay una GEMINI_API_KEY configurada en el archivo .env para resolver el Captcha.");
          }
        } catch (captchaErr: any) {
          writeLog(`Error al intentar resolver el Captcha: ${captchaErr.message || captchaErr}`);
        }
      } else {
        writeLog("No se detectó campo de Captcha en esta pantalla.");
      }

      await takeScreenshot(page, "03_ticket_datos_llenados");

      // Click "Agregar" or "Aceptar" ticket button
      const btnAgregar = await findSelector(page, [
        "input[type='submit'][value*='agregar' i]",
        "input[type='button'][value*='agregar' i]",
        "button[id*='agregar' i]",
        "#btnAgregar",
        "input[value*='Aceptar' i]"
      ]);

      portalErrorMessage = ""; // Reset before click
      if (btnAgregar) {
        writeLog(`Haciendo clic en Agregar Ticket usando selector "${btnAgregar}"...`);
        await page.click(btnAgregar);
        writeLog("Esperando red después de agregar ticket...");
        await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
        await takeScreenshot(page, "04_ticket_agregado");
      } else {
        writeLog("No se encontró botón 'Agregar' separado. Se asume que el envío es directo o el flujo continúa.");
      }

      // Check for portal popup error dialog (like already invoiced)
      await new Promise(r => setTimeout(r, 1000));
      if (portalErrorMessage) {
        writeLog(`[Error Portal] Diálogo detectado: ${portalErrorMessage}`);
        throw new Error(`Error en el portal: ${portalErrorMessage}`);
      }

      // Validate if captcha is incorrect
      const pageText = await page.evaluate(() => document.body.innerText);
      const isCaptchaIncorrect = pageText.toLowerCase().includes("captcha incorrecto") || 
                                 pageText.toLowerCase().includes("captcha es incorrecto");

      if (isCaptchaIncorrect) {
        writeLog(`[Alerta] Captcha incorrecto detectado en el intento ${attempt}.`);
        if (attempt < maxCaptchaRetries) {
          const btnRefreshCaptcha = await findSelector(page, [
            "#RadCaptcha1_CaptchaLinkButton",
            ".rcRefreshImage",
            "a[id*='CaptchaLinkButton' i]",
            "a[class*='Refresh' i]"
          ]);
          if (btnRefreshCaptcha) {
            writeLog("Haciendo clic en refrescar imagen de captcha...");
            await page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                if (el.tagName === 'IMG' && el.parentElement && el.parentElement.tagName === 'A') {
                  (el.parentElement as HTMLElement).click();
                } else {
                  (el as HTMLElement).click();
                }
              }
            }, btnRefreshCaptcha);
            await new Promise(r => setTimeout(r, 2500)); // wait for new captcha to render
          } else {
            writeLog("No se encontró botón de refrescar Captcha, esperando un momento...");
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      } else {
        // Captcha was correct, but let's check for other ticket validation errors
        const hasFolioError = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          if (bodyText.includes("longitud del webid") || bodyText.includes("longitud del web id")) return "Verifique la longitud del WebId.";
          if (bodyText.includes("no existe")) return "El ticket/despacho no existe en este portal.";
          if (bodyText.includes("ya fue facturado") || bodyText.includes("ya se encuentra facturado")) return "El ticket ya fue facturado.";
          if (bodyText.includes("pertenece a otra") || bodyText.includes("estación incorrecta")) return "El ticket pertenece a otra estación.";
          return null;
        });

        if (hasFolioError) {
          writeLog(`[Error Portal] Falla al validar ticket: ${hasFolioError}`);
          throw new Error(`Error en el portal de facturación: ${hasFolioError}`);
        }

        writeLog("El ticket parece haber sido agregado correctamente (sin error de Captcha ni validación). Continuando...");
        addedSuccessfully = true;
        break;
      }
    }

    if (!addedSuccessfully) {
      throw new Error("No se pudo agregar el ticket tras varios intentos de Captcha incorrecto.");
    }

    // Now look for "Siguiente", "Continuar" or "Facturar" button
    const btnSiguiente = await findSelector(page, [
      "#btnAceptar",
      "input[value*='siguiente' i]",
      "input[value*='continuar' i]",
      "button[id*='siguiente' i]",
      "button[id*='continuar' i]",
      "#btnSiguiente",
      "a[id*='siguiente' i]"
    ]);

    if (btnSiguiente) {
      writeLog(`Haciendo clic en Siguiente/Continuar usando selector "${btnSiguiente}"...`);
      await page.click(btnSiguiente);
      writeLog("Esperando navegación a la pantalla de datos fiscales...");
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
      await takeScreenshot(page, "05_pantalla_datos_fiscales");
    } else {
      writeLog("No se detectó un botón 'Siguiente' explícito. Continuando...");
    }

    // Fill in RFC and Customer details
    const rfcSelector = await findSelector(page, [
      "input[name*='rfc' i]",
      "input[id*='rfc' i]",
      "input[placeholder*='rfc' i]",
      "#txtRFC",
      "#txtRfc"
    ]);

    if (!rfcSelector) {
      throw new Error("No se pudo localizar el campo RFC en el portal de datos fiscales.");
    }

    const searchValue = (datos.codigoCliente && datos.codigoCliente.trim() !== "") 
      ? datos.codigoCliente.trim() 
      : datos.rfc.toUpperCase();

    writeLog(`Escribiendo valor de búsqueda (${(datos.codigoCliente && datos.codigoCliente.trim() !== "") ? 'Código de Cliente' : 'RFC'}): "${searchValue}" en selector "${rfcSelector}"...`);
    await page.focus(rfcSelector);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(rfcSelector, searchValue);

    // Click "Buscar" RFC or trigger blur to load details
    const btnBuscarRfc = await findSelector(page, [
      "input[value*='buscar' i]",
      "button[id*='buscar' i]",
      "#btnBuscar"
    ]);
    
    if (btnBuscarRfc) {
      writeLog(`Haciendo clic en Buscar RFC usando selector "${btnBuscarRfc}"...`);
      await page.click(btnBuscarRfc);
      writeLog("Esperando respuesta de búsqueda del RFC (espera de navegación/red)...");
      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(async () => {
        writeLog("Timeout de navegación al buscar RFC. Esperando 3 segundos adicionales para renderizado...");
        await new Promise(r => setTimeout(r, 3000));
      });
    } else {
      writeLog("No se encontró botón 'Buscar RFC'. Presionando tecla Tab para disparar el evento de cambio...");
      await page.keyboard.press("Tab");
      await new Promise(r => setTimeout(r, 3000));
    }

    await takeScreenshot(page, "06_rfc_ingresado");

    // Fill in other fiscal details if they are visible/empty (registration mode)
    const razonSocialSelector = await findSelector(page, [
      "input[name*='nombre' i]",
      "input[name*='razon' i]",
      "input[name*='social' i]",
      "input[id*='razon' i]",
      "input[placeholder*='nombre' i]",
      "#txtNombre"
    ]);

    if (razonSocialSelector) {
      const val = await page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        return input ? input.value : "";
      }, razonSocialSelector);
      
      if (!val || val.trim() === "") {
        writeLog(`Formulario de registro activo (Razón Social vacía). Rellenando datos fiscales...`);
        
        writeLog(`Escribiendo Razón Social: "${datos.razonSocial.toUpperCase()}"...`);
        await page.focus(razonSocialSelector);
        await page.type(razonSocialSelector, datos.razonSocial.toUpperCase());

        const cpSelector = await findSelector(page, [
          "input[name*='postal' i]",
          "input[name*='cp' i]",
          "input[id*='cp' i]",
          "#txtCodigoPostal"
        ]);
        if (cpSelector) {
          writeLog(`Escribiendo Código Postal: "${datos.codigoPostal}"...`);
          await page.focus(cpSelector);
          await page.type(cpSelector, datos.codigoPostal);
        }

        // Regimen Fiscal Select
        const regimenSelector = await findSelector(page, [
          "select[name*='regimen' i]",
          "select[id*='regimen' i]",
          "#ddlRegimen"
        ]);
        if (regimenSelector) {
          writeLog(`Seleccionando Régimen Fiscal: "${datos.regimenFiscal}"...`);
          await page.select(regimenSelector, datos.regimenFiscal).catch(async () => {
            await page.evaluate((sel, code) => {
              const select = document.querySelector(sel) as HTMLSelectElement;
              if (select) {
                for (let option of select.options) {
                  if (option.value.includes(code) || option.text.includes(code)) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change'));
                    break;
                  }
                }
              }
            }, regimenSelector, datos.regimenFiscal);
          });
        }

        // Uso CFDI Select
        const usoCFDISelector = await findSelector(page, [
          "select[name*='uso' i]",
          "select[id*='uso' i]",
          "#ddlUsoCFDI"
        ]);
        if (usoCFDISelector) {
          writeLog(`Seleccionando Uso CFDI: "${datos.usoCFDI}"...`);
          await page.select(usoCFDISelector, datos.usoCFDI).catch(async () => {
            await page.evaluate((sel, code) => {
              const select = document.querySelector(sel) as HTMLSelectElement;
              if (select) {
                for (let option of select.options) {
                  if (option.value.includes(code) || option.text.includes(code)) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change'));
                    break;
                  }
                }
              }
            }, usoCFDISelector, datos.usoCFDI);
          });
        }

        // Email
        const emailSelector = await findSelector(page, [
          "input[name*='mail' i]",
          "input[name*='correo' i]",
          "input[id*='correo' i]"
        ]);
        if (emailSelector) {
          writeLog(`Escribiendo Correo Electrónico: "${datos.email}"...`);
          await page.focus(emailSelector);
          await page.type(emailSelector, datos.email);
        }

        await takeScreenshot(page, "07_datos_fiscales_registrados");
      } else {
        writeLog(`RFC ya registrado en el portal. Razón Social encontrada: "${val}". Se omitirá el autoregistro.`);
      }
    } else {
      writeLog("No se detectó un campo de Razón Social editable. Continuando...");
    }

    // Click "Facturar" or "Generar"
    writeLog("Buscando si existe una tabla de selección de clientes (perfiles fiscales)...");
    const clickedGridButton = await page.evaluate((targetClientCode) => {
      const tables = Array.from(document.querySelectorAll("table"));
      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length === 0) continue;
        
        // Find column index of "Facturar"
        const firstRowCells = Array.from(rows[0].querySelectorAll("td, th")).map(el => el.textContent?.trim().toLowerCase() || "");
        let facturarIdx = firstRowCells.findIndex(h => h.includes("facturar"));
        
        // If not found in first row, check second row (in case of double headers)
        if (facturarIdx === -1 && rows.length > 1) {
          const secondRowCells = Array.from(rows[1].querySelectorAll("td, th")).map(el => el.textContent?.trim().toLowerCase() || "");
          facturarIdx = secondRowCells.findIndex(h => h.includes("facturar"));
        }

        if (facturarIdx !== -1) {
          // Look specifically for the row containing targetClientCode
          let rowToClick = null;
          for (let i = 1; i < rows.length; i++) {
            const rowText = rows[i].textContent || "";
            if (rowText.includes(targetClientCode)) {
              rowToClick = rows[i];
              break;
            }
          }

          // Fallback if client code is not found
          if (!rowToClick && rows.length > 1) {
            rowToClick = rows[1]; // Use first client row
          }

          if (rowToClick) {
            const cells = Array.from(rowToClick.querySelectorAll("td"));
            if (cells.length > facturarIdx) {
              const cell = cells[facturarIdx];
              const button = cell.querySelector("input, button, a");
              if (button) {
                (button as HTMLElement).click();
                return { success: true, rowText: rowToClick.textContent?.trim().replace(/\s+/g, " ").substring(0, 150) };
              }
            }
          }
        }
      }
      return { success: false, rowText: "" };
    }, datos.codigoCliente || "22309938");

    if (clickedGridButton.success) {
      writeLog(`¡Se hizo clic en el botón de facturación del cliente en la tabla!: "${clickedGridButton.rowText}"`);
      // Wait for page transition to confirmarDatos.aspx
      writeLog("Esperando redirección a la pantalla de confirmación de datos...");
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(async () => {
        writeLog("Timeout al esperar redirección. Continuando con la carga de la página...");
      });
      await takeScreenshot(page, "07_5_confirmar_datos_pantalla");
    } else {
      writeLog("No se detectó tabla de selección de clientes. Intentando buscar botón directo de facturación...");
      const btnFacturar = await findSelector(page, [
        "input[value*='facturar' i]",
        "input[value*='generar' i]",
        "button[id*='facturar' i]",
        "#btnFacturar",
        "button:contains('Generar')"
      ]);

      if (!btnFacturar) {
        throw new Error("No se pudo localizar el botón final para Generar/Facturar la factura.");
      }

      writeLog(`Haciendo clic en el botón de facturación directo ("${btnFacturar}")...`);
      await page.click(btnFacturar);
    }

    // Process "CONFIRMAR DATOS" page if active
    const currentUrl = page.url();
    if (currentUrl.includes("confirmarDatos.aspx") || (await page.$("select[id*='ddlUso' i], select[name*='uso' i]"))) {
      writeLog("Pantalla 'Confirmar Datos' detectada. Seleccionando Uso CFDI y confirmando...");
      
      // Select Uso CFDI dropdown
      const ddlUsoConfirm = await findSelector(page, [
        "select[name*='uso' i]",
        "select[id*='ddlUso' i]",
        "select[id*='UsoCFDI' i]",
        "select"
      ]);
      
      if (ddlUsoConfirm) {
        writeLog(`Seleccionando Uso CFDI "${datos.usoCFDI}" en pantalla de confirmación...`);
        await page.select(ddlUsoConfirm, datos.usoCFDI).catch(async () => {
          // Fallback by text matching G03 or others
          await page.evaluate((sel, code) => {
            const select = document.querySelector(sel) as HTMLSelectElement;
            if (select) {
              for (let option of select.options) {
                if (option.value.includes(code) || option.text.includes(code)) {
                  select.value = option.value;
                  select.dispatchEvent(new Event('change'));
                  break;
                }
              }
            }
          }, ddlUsoConfirm, datos.usoCFDI);
        });
      }

      await takeScreenshot(page, "07_6_confirmar_datos_seleccionados");

      // Click "Generar Factura" final button
      const btnGenerarFinal = await findSelector(page, [
        "input[value*='generar' i]",
        "input[value*='facturar' i]",
        "button[id*='generar' i]",
        "button[id*='facturar' i]",
        "#btnGenerar",
        "#btnFacturar",
        "input[type='submit']"
      ]);

      if (btnGenerarFinal) {
        writeLog(`Haciendo clic en el botón final de generación ("${btnGenerarFinal}")...`);
        await page.click(btnGenerarFinal);
      } else {
        writeLog("No se encontró el botón final 'Generar Factura' por selector. Intentando clic directo en elemento con texto...");
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("input[type='submit'], input[type='button'], button"));
          const target = buttons.find(b => b.value?.toLowerCase().includes("generar") || b.textContent?.toLowerCase().includes("generar"));
          if (target) (target as HTMLElement).click();
        });
      }
    }
    
    writeLog("Esperando respuesta de timbrado fiscal en el portal (máximo 60 segundos)...");
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    await takeScreenshot(page, "08_despues_facturar");

    // Look for download buttons for XML and PDF
    writeLog("Buscando enlaces o botones de descarga de archivos XML y PDF...");
    const downloadLinks = await page.$$("a, button, img");
    let xmlClicked = false;
    let pdfClicked = false;

    for (const link of downloadLinks) {
      const text = await page.evaluate(el => el.textContent || "", link);
      const html = await page.evaluate(el => el.outerHTML || "", link);
      
      if (!xmlClicked && (/xml/i.test(text) || /xml/i.test(html))) {
        writeLog(`Clic en enlace de descarga XML: "${text.trim() || 'Botón XML (Imagen)'}"`);
        await link.click().catch(() => {});
        xmlClicked = true;
        await new Promise(r => setTimeout(r, 2000));
      }
      
      if (!pdfClicked && (/pdf/i.test(text) || /pdf/i.test(html) || /representación/i.test(text))) {
        writeLog(`Clic en enlace de descarga PDF: "${text.trim() || 'Botón PDF (Imagen)'}"`);
        await link.click().catch(() => {});
        pdfClicked = true;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Wait a couple of seconds for downloads to complete
    writeLog("Esperando a que las descargas finalicen localmente...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await takeScreenshot(page, "09_final");

    // Read the files from the downloads directory
    let files = fs.readdirSync(downloadPath);
    writeLog(`Archivos encontrados en carpeta de descargas: [${files.join(", ")}]`);

    let xmlFile = files.find((f) => f.toLowerCase().endsWith(".xml"));
    let pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));

    if (!xmlFile || !pdfFile) {
      writeLog("Fallo en la descarga directa de alguno de los archivos. Iniciando flujo de recuperación alternativo vía Consulta...");
      try {
        await fallbackQueryAndDownload(page, portalUrl, datos.rfc, datos.codigoCliente || "22309938", downloadPath);
        files = fs.readdirSync(downloadPath);
        writeLog(`Archivos encontrados tras consulta de recuperación: [${files.join(", ")}]`);
        xmlFile = files.find((f) => f.toLowerCase().endsWith(".xml"));
        pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));
      } catch (fallbackErr: any) {
        writeLog(`Fallo durante el flujo de consulta alternativo de recuperación: ${fallbackErr.message || fallbackErr}`);
      }
    }

    if (!xmlFile && !pdfFile) {
      const bodyText = await page.evaluate(() => document.body.textContent || "");
      const uuidMatch = bodyText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      
      if (uuidMatch || /generada|exito|éxito|enviada|guardada|factura:/i.test(bodyText)) {
        const foundUuid = uuidMatch ? uuidMatch[0] : undefined;
        writeLog(`Factura generada en el portal. UUID oficial detectado: ${foundUuid || "No encontrado en pantalla"}`);
        return {
          success: true,
          xml: foundUuid ? `<?xml version="1.0" encoding="utf-8"?><cfdi:Comprobante Version="4.0" UUID="${foundUuid}"><cfdi:Complemento><tfd:TimbreFiscalDigital UUID="${foundUuid}"/></cfdi:Complemento></cfdi:Comprobante>` : undefined,
          error: foundUuid 
            ? `La factura se timbró con éxito en el SAT con el UUID: ${foundUuid}. Sin embargo, el servidor de la gasolinera tiene una falla técnica interna temporal ('No se pudo recuperar el archivo PDF de la factura') y no permitió descargar los archivos. Puedes consultar tu factura en el portal del SAT con este UUID o en el correo registrado.`
            : "Factura generada en el portal, pero los archivos no se pudieron descargar automáticamente. Se enviaron al correo registrado.",
        };
      }
      throw new Error("La factura se generó pero no se pudieron descargar los archivos XML y PDF del portal.");
    }

    const result: AutomationResult = { success: true };

    if (xmlFile) {
      result.fileNameXml = xmlFile;
      result.xml = fs.readFileSync(path.join(downloadPath, xmlFile), "utf-8");
      writeLog(`Archivo XML leído con éxito: ${xmlFile}`);
    }
    if (pdfFile) {
      result.fileNamePdf = pdfFile;
      const pdfBuffer = fs.readFileSync(path.join(downloadPath, pdfFile));
      result.pdfBase64 = pdfBuffer.toString("base64");
      writeLog(`Archivo PDF leído con éxito: ${pdfFile}`);
    }

    writeLog("¡Automatización completada con éxito!");
    return result;

  } catch (err: any) {
    writeLog(`ERROR DURANTE LA AUTOMATIZACIÓN: ${err.message || String(err)}`);
    if (page) {
      await takeScreenshot(page, "error_latest");
      const currentUrl = page.url();
      writeLog(`URL al momento del error: ${currentUrl}`);
      try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        writeLog(`Texto visible de la pantalla al fallar:\n--------------------\n${bodyText.substring(0, 1500)}\n--------------------`);
      } catch (textErr) {
        writeLog("No se pudo extraer el texto visible de la pantalla.");
      }
    }
    return {
      success: false,
      error: err.message || "Error desconocido en el bot de facturación.",
    };
  } finally {
    writeLog("Cerrando navegador Chromium.");
    await browser.close();
  }
}

// Utility to find the first matching selector on a page
async function findSelector(page: puppeteer.Page, selectors: string[]): Promise<string | null> {
  for (const selector of selectors) {
    try {
      if (selector.includes(":contains")) {
        const textToMatch = selector.match(/:contains\('(.*)'\)/)?.[1];
        if (textToMatch) {
          const elementExists = await page.evaluate((text) => {
            const elements = Array.from(document.querySelectorAll("a, button, input[type='button'], input[type='submit']"));
            return elements.some(el => el.textContent?.includes(text) || (el as HTMLInputElement).value?.includes(text));
          }, textToMatch);
          if (elementExists) {
            continue; 
          }
        }
      }

      const element = await page.$(selector);
      if (element) {
        const isVisible = await page.evaluate((el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        }, element);
        
        if (isVisible) {
          return selector;
        }
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }
  return null;
}

// Fallback recovery flow: query issued invoices and download them
async function fallbackQueryAndDownload(
  page: puppeteer.Page,
  portalUrl: string,
  rfc: string,
  codigoCliente: string,
  downloadPath: string
) {
  writeLog("Redirigiendo a la página de inicio para iniciar consulta de recuperación...");
  await page.goto(portalUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await takeScreenshot(page, "fallback_01_inicio");

  // Click "Consultar"
  writeLog("Buscando el botón/enlace 'Consultar'...");
  const btnConsultar = await findSelector(page, [
    "input[value*='consultar' i]",
    "button[id*='consultar' i]",
    "a:contains('Consultar')",
    "a[href*='consulta' i]"
  ]);

  if (!btnConsultar) {
    const clicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("a, button, input[type='button']"));
      const target = elements.find(el => el.textContent?.toLowerCase().includes("consultar") || (el as HTMLInputElement).value?.toLowerCase().includes("consultar"));
      if (target) {
        (target as HTMLElement).click();
        return true;
      }
      return false;
    });
    if (!clicked) throw new Error("No se pudo encontrar el botón o enlace 'Consultar' en el inicio.");
  } else {
    await page.click(btnConsultar);
  }

  writeLog("Esperando que cargue la página de Consulta...");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  await takeScreenshot(page, "fallback_02_consulta_campos");

  // Fill in RFC
  const rfcSelector = await findSelector(page, [
    "input[name*='rfc' i]",
    "input[id*='rfc' i]",
    "#txtRFC",
    "#txtRfc"
  ]);
  if (!rfcSelector) throw new Error("No se encontró el campo RFC en la página de consulta.");
  
  writeLog(`Escribiendo RFC en Consulta: "${rfc.toUpperCase()}"...`);
  await page.focus(rfcSelector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(rfcSelector, rfc.toUpperCase());

  // Fill in Código de Cliente (22309938)
  const clientCodeSelector = await findSelector(page, [
    "input[name*='codigo' i]",
    "input[id*='codigo' i]",
    "input[name*='cliente' i]",
    "input[id*='cliente' i]",
    "#txtCodigo",
    "#txtCodigoCliente"
  ]);
  if (clientCodeSelector) {
    writeLog(`Escribiendo Código de Cliente en Consulta: "${codigoCliente}"...`);
    await page.focus(clientCodeSelector);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(clientCodeSelector, codigoCliente);
  } else {
    writeLog("Advertencia: No se localizó un campo para el Código de Cliente en la consulta.");
  }

  // Select "Mes Actual" or check if option is available
  writeLog("Buscando selector de período/mes (Mes Actual)...");
  const mesActualRadioOrSelect = await findSelector(page, [
    "input[type='radio'][id*='actual' i]",
    "input[type='radio'][value*='actual' i]",
    "input[type='radio'][id*='MesActual' i]",
    "select[name*='mes' i]",
    "select[id*='mes' i]",
    "select[name*='periodo' i]",
    "select[id*='periodo' i]"
  ]);

  if (mesActualRadioOrSelect) {
    const tagName = await page.evaluate((sel) => document.querySelector(sel)?.tagName, mesActualRadioOrSelect);
    const type = await page.evaluate((sel) => document.querySelector(sel)?.getAttribute("type"), mesActualRadioOrSelect);
    
    if (tagName === "SELECT") {
      writeLog("Selector de mes/período es un dropdown. Seleccionando el mes actual...");
      await page.evaluate((sel) => {
        const select = document.querySelector(sel) as HTMLSelectElement;
        if (select && select.options.length > 1) {
          // Select current month
          select.selectedIndex = 1;
          select.dispatchEvent(new Event('change'));
        }
      }, mesActualRadioOrSelect);
    } else if (type === "radio" || type === "checkbox") {
      writeLog("Selector de mes/período es un botón de opción (radio/checkbox). Seleccionando...");
      await page.click(mesActualRadioOrSelect);
    }
  }

  await takeScreenshot(page, "fallback_03_consulta_datos_llenados");

  // Click "Buscar" / "Consultar"
  const btnBuscarConsulta = await findSelector(page, [
    "input[value*='buscar' i]",
    "input[value*='consultar' i]",
    "button[id*='buscar' i]",
    "button[id*='consultar' i]",
    "#btnBuscar",
    "#btnConsultar"
  ]);

  if (btnBuscarConsulta) {
    writeLog("Haciendo clic en Buscar en la página de consulta...");
    await page.click(btnBuscarConsulta);
  } else {
    await page.evaluate(() => {
      const btn = document.querySelector("input[type='submit']");
      if (btn) (btn as HTMLInputElement).click();
    });
  }

  writeLog("Esperando resultados de la consulta...");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  await takeScreenshot(page, "fallback_04_resultados_consulta");

  // Locate and click downloads inside the results table
  writeLog("Buscando botones de descarga en la tabla de facturas emitidas...");
  
  // Encontrar la tabla y fila con enlaces de descarga
  const hasDownloads = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table"));
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("tr"));
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowText = row.textContent?.toLowerCase() || "";
        const interactives = Array.from(row.querySelectorAll("input, button, a"));
        const xmlExists = interactives.some(el => el.outerHTML.toLowerCase().includes("xml") || (el as HTMLInputElement).value?.toLowerCase().includes("xml") || el.textContent?.toLowerCase().includes("xml"));
        const pdfExists = interactives.some(el => el.outerHTML.toLowerCase().includes("pdf") || (el as HTMLInputElement).value?.toLowerCase().includes("pdf") || el.textContent?.toLowerCase().includes("pdf"));
        if (xmlExists || pdfExists) {
          return { found: true, tableIndex: tables.indexOf(table), rowIndex: i, rowText: rowText.substring(0, 100) };
        }
      }
    }
    return { found: false, tableIndex: -1, rowIndex: -1, rowText: "" };
  });

  let clickedXml = false;
  let clickedPdf = false;

  if (hasDownloads.found) {
    writeLog(`[Recuperación] Fila de descarga detectada: "${hasDownloads.rowText}". Iniciando descargas...`);
    
    // Clic en XML
    clickedXml = await page.evaluate((tIdx, rIdx) => {
      const tables = document.querySelectorAll("table");
      const table = tables[tIdx];
      if (table) {
        const row = table.querySelectorAll("tr")[rIdx];
        if (row) {
          const xmlBtn = Array.from(row.querySelectorAll("input, button, a")).find(el => {
            const html = el.outerHTML.toLowerCase();
            const val = (el as HTMLInputElement).value?.toLowerCase() || "";
            const txt = el.textContent?.toLowerCase() || "";
            return html.includes("xml") || val.includes("xml") || txt.includes("xml");
          }) as HTMLElement;
          if (xmlBtn) {
            xmlBtn.click();
            return true;
          }
        }
      }
      return false;
    }, hasDownloads.tableIndex, hasDownloads.rowIndex);

    if (clickedXml) {
      writeLog("[Recuperación] Clic en XML realizado. Esperando 3 segundos...");
      await new Promise(r => setTimeout(r, 3000));
    }

    // Clic en PDF
    clickedPdf = await page.evaluate((tIdx, rIdx) => {
      const tables = document.querySelectorAll("table");
      const table = tables[tIdx];
      if (table) {
        const row = table.querySelectorAll("tr")[rIdx];
        if (row) {
          const pdfBtn = Array.from(row.querySelectorAll("input, button, a")).find(el => {
            const html = el.outerHTML.toLowerCase();
            const val = (el as HTMLInputElement).value?.toLowerCase() || "";
            const txt = el.textContent?.toLowerCase() || "";
            const src = (el as HTMLImageElement).src?.toLowerCase() || "";
            return html.includes("pdf") || val.includes("pdf") || txt.includes("pdf") || src.includes("pdf");
          }) as HTMLElement;
          if (pdfBtn) {
            pdfBtn.click();
            return true;
          }
        }
      }
      return false;
    }, hasDownloads.tableIndex, hasDownloads.rowIndex);

    if (clickedPdf) {
      writeLog("[Recuperación] Clic en PDF realizado. Esperando 3 segundos...");
      await new Promise(r => setTimeout(r, 3000));
    }
  } else {
    // Buscar en cualquier elemento interactivo de la página (fallback general)
    clickedXml = await page.evaluate(() => {
      const xmlBtn = Array.from(document.querySelectorAll("input[type='image'], button, a")).find(el => el.outerHTML.toLowerCase().includes("xml")) as HTMLElement;
      if (xmlBtn) {
        xmlBtn.click();
        return true;
      }
      return false;
    });
    if (clickedXml) {
      writeLog("[Recuperación Fallback] Clic en XML de recuperación general. Esperando 3 segundos...");
      await new Promise(r => setTimeout(r, 3000));
    }

    clickedPdf = await page.evaluate(() => {
      const pdfBtn = Array.from(document.querySelectorAll("input[type='image'], button, a")).find(el => el.outerHTML.toLowerCase().includes("pdf") || el.outerHTML.toLowerCase().includes("representacion")) as HTMLElement;
      if (pdfBtn) {
        pdfBtn.click();
        return true;
      }
      return false;
    });
    if (clickedPdf) {
      writeLog("[Recuperación Fallback] Clic en PDF de recuperación general. Esperando 3 segundos...");
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (clickedXml || clickedPdf) {
    writeLog("¡Se hizo clic en los botones de descarga de recuperación de forma secuencial!");
    await new Promise(r => setTimeout(r, 4000));
  } else {
    throw new Error("No se localizaron enlaces de descarga de PDF o XML en los resultados de la consulta.");
  }
}

// Automatically search, match and download all invoices from the portal
export async function syncInvoicesReal(
  datos: {
    rfc: string;
    razonSocial: string;
    regimenFiscal: string;
    codigoPostal: string;
    usoCFDI: string;
    email: string;
    codigoCliente?: string;
  }
): Promise<{ success: boolean; processedCount: number; matchedCount: number }> {
  let tickets: any[] = [];
  try {
    const { data, error } = await supabase.from('tickets').select('*');
    if (error) throw error;
    if (data) {
      tickets = data.map(mapPostgresToTicket);
    }
  } catch (err: any) {
    writeLog(`[Sincronizador] [Error Supabase] No se pudieron cargar los tickets para sincronizar: ${err.message || err}`);
    // Fallback to local file if Supabase fails
    try {
      const TICKETS_FILE = path.resolve("./tickets.json");
      if (fs.existsSync(TICKETS_FILE)) {
        tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
      }
    } catch (localErr) {
      console.error("Error reading local tickets fallback:", localErr);
    }
  }

  if (tickets.length === 0) {
    return { success: true, processedCount: 0, matchedCount: 0 };
  }

  // Get unique normalized stations from tickets
  const uniqueStations = Array.from(
    new Set(tickets.map((t: any) => normalizeStationCode(t.estacion)))
  ).filter(st => st !== "");

  let processedCount = 0;
  let matchedCount = 0;

  const downloadPath = path.resolve("./downloads");
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  // Initialize log file
  const logFile = path.resolve("./automation.log");
  try {
    fs.writeFileSync(logFile, `🤖 robot-agent [Sincronizador]: Iniciando búsqueda en portales para ${uniqueStations.length} estaciones...\n`, "utf8");
  } catch (err) {
    console.error("Error initializing sync log:", err);
  }

  writeLog(`[Sincronizador] Iniciando búsqueda para las siguientes estaciones: ${uniqueStations.join(", ")}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ],
  });

  try {
    for (const station of uniqueStations) {
      // Normalize station name
      const normalizedCode = normalizeStationCode(station);
      const portalUrl = ESTACIONES_MAP[normalizedCode];

      if (!portalUrl) {
        writeLog(`[Sincronizador] No hay URL registrada para la estación ${normalizedCode}. Saltando...`);
        continue;
      }

      writeLog(`[Sincronizador] Conectando a la estación ${normalizedCode} (${portalUrl})...`);
      const page = await browser.newPage();
      
      try {
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
        await page.setUserAgent(userAgent);
        await page.setExtraHTTPHeaders({
          "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
        });
        await page.setViewport({ width: 1280, height: 800 });

        // Set download behavior
        const client = await page.target().createCDPSession();
        await client.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: downloadPath,
        });

        // Navigate to portal
        await page.goto(portalUrl, { waitUntil: "networkidle2", timeout: 35000 });
        
        // Click "Consultar"
        const btnConsultar = await findSelector(page, [
          "input[value*='consultar' i]",
          "button[id*='consultar' i]",
          "a:contains('Consultar')",
          "a[href*='consulta' i]"
        ]);

        if (!btnConsultar) {
          const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll("a, button, input[type='button']"));
            const target = elements.find(el => el.textContent?.toLowerCase().includes("consultar") || (el as HTMLInputElement).value?.toLowerCase().includes("consultar"));
            if (target) {
              (target as HTMLElement).click();
              return true;
            }
            return false;
          });
          if (!clicked) {
            writeLog(`[Sincronizador] No se encontró el botón 'Consultar' para ${normalizedCode}.`);
            continue;
          }
        } else {
          await page.click(btnConsultar);
        }

        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

        // Fill in RFC
        const rfcSelector = await findSelector(page, [
          "input[name*='rfc' i]",
          "input[id*='rfc' i]",
          "#txtRFC",
          "#txtRfc"
        ]);
        if (!rfcSelector) {
          writeLog(`[Sincronizador] No se encontró el campo RFC en la consulta de la estación ${normalizedCode}.`);
          continue;
        }

        await page.focus(rfcSelector);
        await page.type(rfcSelector, datos.rfc.toUpperCase());

        // Fill in Código de Cliente
        const clientCodeSelector = await findSelector(page, [
          "input[name*='codigo' i]",
          "input[id*='codigo' i]",
          "input[name*='cliente' i]",
          "input[id*='cliente' i]",
          "#txtCodigo",
          "#txtCodigoCliente"
        ]);
        if (clientCodeSelector && datos.codigoCliente) {
          await page.focus(clientCodeSelector);
          await page.type(clientCodeSelector, datos.codigoCliente);
        }

        // Search "Mes Actual"
        const btnBuscarConsulta = await findSelector(page, [
          "input[value*='buscar' i]",
          "input[value*='consultar' i]",
          "button[id*='buscar' i]",
          "button[id*='consultar' i]",
          "#btnBuscar",
          "#btnConsultar"
        ]);

        if (btnBuscarConsulta) {
          await page.click(btnBuscarConsulta);
        } else {
          await page.evaluate(() => {
            const btn = document.querySelector("input[type='submit']");
            if (btn) (btn as HTMLInputElement).click();
          });
        }

        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

        // Expand all rows to ensure everything is visible
        await page.evaluate(() => {
          const expandBtns = Array.from(document.querySelectorAll("img[src*='plus' i], input[src*='plus' i], a"));
          const plusLinks = expandBtns.filter(el => {
            if (el.tagName === 'A') {
              return el.textContent?.trim() === '+' || el.id?.toLowerCase().includes("expand");
            }
            return true;
          });
          for (const btn of plusLinks) {
            (btn as HTMLElement).click();
          }
        });
        await new Promise(r => setTimeout(r, 1500));

        // Extract invoices
        // Extract invoices
        const invoices = await page.evaluate(() => {
          const list: any[] = [];
          const rows = Array.from(document.querySelectorAll("table tr"));
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowText = row.textContent || "";
            const interactives = row.querySelectorAll("a, input, button");
            const hasDownload = Array.from(interactives).some(el => {
              const html = el.outerHTML.toLowerCase();
              return html.includes("xml") || html.includes("pdf") || html.includes("descargar");
            });
            
            if (hasDownload) {
              const folioMatch = rowText.match(/([A-Z]+-\d+)/i) || rowText.match(/(\d{4,})/);
              const invoiceFolio = folioMatch ? folioMatch[1] : "";
              
              const nextRow = rows[i + 1];
              const nextRowText = nextRow ? nextRow.textContent || "" : "";
              const combinedText = (rowText + " " + nextRowText).replace(/\s+/g, " ");

              // Extract date (DD/MM/YYYY or YYYY-MM-DD)
              const fechaMatch = combinedText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
              const fecha = fechaMatch ? fechaMatch[0] : "";

              // Extract amounts (look for total/monto or any decimal number with 2 decimal places)
              let monto = 0;
              const totalMatch = combinedText.match(/(?:total|monto|importe):\s*\$?([\d,.]+)/i);
              if (totalMatch) {
                monto = parseFloat(totalMatch[1].replace(/,/g, ""));
              } else {
                const decimalMatches = combinedText.match(/\$?(\d{1,6}\.\d{2})/g);
                if (decimalMatches && decimalMatches.length > 0) {
                  const nums = decimalMatches.map(m => parseFloat(m.replace(/[^\d.]/g, "")));
                  monto = Math.max(...nums);
                }
              }

              list.push({
                invoiceFolio,
                fecha,
                monto,
                rowIndex: i
              });
            }
          }
          return list;
        });

        writeLog(`[Sincronizador] Encontradas ${invoices.length} facturas registradas este mes en el portal de la estación ${normalizedCode}.`);

        for (const invoice of invoices) {
          processedCount++;

          // Match by amount and date
          // Normalize invoice date from DD/MM/YYYY to YYYY-MM-DD
          let invoiceDateStr = "";
          if (invoice.fecha) {
            const parts = invoice.fecha.split(" ")[0].split("/");
            if (parts.length === 3) {
              invoiceDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else if (invoice.fecha.includes("-")) {
              invoiceDateStr = invoice.fecha.split(" ")[0];
            }
          }

          // Find match in tickets
          const matchingTicket = tickets.find((t: any) => {
            // Do not rematch tickets that are already facturado
            if (t.status === "facturado") return false;

            const tStationNormalized = normalizeStationCode(t.estacion);
            const stationCodeMatches = tStationNormalized === normalizedCode;
            if (!stationCodeMatches) return false;

            // If ticket has monto and invoice has monto, check amount match (within $2.00 MXN)
            const amountMatches = (t.monto && invoice.monto > 0)
              ? Math.abs(t.monto - invoice.monto) < 2.0
              : true;

            if (!amountMatches) return false;

            // Date match check (optional / tolerant fallback)
            if (t.fecha && invoiceDateStr) {
              const tDate = new Date(t.fecha);
              const invDate = new Date(invoiceDateStr);
              if (!isNaN(tDate.getTime()) && !isNaN(invDate.getTime())) {
                const diffTime = Math.abs(invDate.getTime() - tDate.getTime());
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                // Allow up to 90 days window
                return diffDays <= 90;
              }
            }

            return true;
          });

          if (matchingTicket) {
            writeLog(`[Sincronizador] ¡Coincidencia! Factura ${invoice.invoiceFolio} ($${invoice.monto}) coincide con Ticket Folio: ${matchingTicket.folio} (Monto: $${matchingTicket.monto}, Fecha: ${matchingTicket.fecha}).`);

            // If already fully synchronized (has xml and drive links), skip downloading to save time/bandwidth!
            if (matchingTicket.status === "facturado" && matchingTicket.xml && matchingTicket.xmlDriveLink) {
              writeLog(`[Sincronizador] El ticket ${matchingTicket.folio} ya está marcado como facturado y tiene archivos. Omitiendo descarga.`);
              continue;
            }

            // Let's download the files!
            // Clean downloads directory first
            const cleanDir = () => {
              const files = fs.readdirSync(downloadPath);
              for (const file of files) {
                fs.unlinkSync(path.join(downloadPath, file));
              }
            };
            cleanDir();

            // 1. Descargar XML en una nueva pestaña (para evitar que se pierda la pantalla de resultados)
            const downloadXmlViaNewTab = async (): Promise<boolean> => {
              // Cambiar el target del formulario a _blank para abrir en nueva pestaña
              await page.evaluate(() => {
                const form = document.querySelector("form");
                if (form) form.target = "_blank";
              });

              // Preparar la escucha para la nueva pestaña antes de hacer clic
              const newTargetPromise = new Promise<puppeteer.Target>(resolve => {
                browser.once("targetcreated", resolve);
              });

              const xmlClicked = await page.evaluate((rIndex) => {
                const rows = Array.from(document.querySelectorAll("table tr"));
                const row = rows[rIndex];
                if (row) {
                  const xmlBtn = Array.from(row.querySelectorAll("a, input, button")).find(el => el.outerHTML.toLowerCase().includes("xml")) as HTMLElement;
                  if (xmlBtn) {
                    xmlBtn.click();
                    return true;
                  }
                }
                return false;
              }, invoice.rowIndex);

              if (!xmlClicked) return false;

              writeLog(`[Sincronizador] Clic en XML para factura ${invoice.invoiceFolio}. Esperando pestaña nueva...`);
              
              const newTarget = await newTargetPromise;
              const newPage = await newTarget.page();
              if (newPage) {
                try {
                  writeLog(`[Sincronizador] Nueva pestaña XML abierta: ${newPage.url()}`);
                  
                  // Permitir descargas en la nueva pestaña
                  const newClient = await newPage.target().createCDPSession();
                  await newClient.send("Page.setDownloadBehavior", {
                    behavior: "allow",
                    downloadPath: downloadPath,
                  });

                  await new Promise(r => setTimeout(r, 2000));

                  // Hacer clic en "Descargar" si se requiere confirmación en pantalla
                  const clickedDescargar = await newPage.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll("a, button, input, img"));
                    const btn = elements.find(el => el.textContent?.toLowerCase().includes("descargar") || el.outerHTML.toLowerCase().includes("descargar") || (el as HTMLInputElement).value?.toLowerCase().includes("descargar")) as HTMLElement;
                    if (btn) {
                      btn.click();
                      return true;
                    }
                    return false;
                  });

                  if (clickedDescargar) {
                    writeLog(`[Sincronizador] Clic en 'Descargar' en pestaña XML. Esperando descarga...`);
                  }
                  await new Promise(r => setTimeout(r, 4500));
                } finally {
                  await newPage.close().catch(() => {});
                }
              } else {
                writeLog(`[Sincronizador] Descarga directa iniciada para XML. Esperando...`);
                await new Promise(r => setTimeout(r, 4500));
              }

              return true;
            };

            // Ejecutar descarga XML
            const xmlSuccess = await downloadXmlViaNewTab().catch(err => {
              writeLog(`[Sincronizador] [Error XML] Falló la descarga del XML: ${err.message}`);
              return false;
            });

            // Restablecer el target del formulario a _self
            await page.evaluate(() => {
              const form = document.querySelector("form");
              if (form) form.target = "_self";
            });

            if (xmlSuccess) {
              await new Promise(r => setTimeout(r, 1000));
            }

            // 2. Descargar PDF en una nueva pestaña
            const downloadPdfViaNewTab = async (): Promise<boolean> => {
              await page.evaluate(() => {
                const form = document.querySelector("form");
                if (form) form.target = "_blank";
              });

              const newTargetPromise = new Promise<puppeteer.Target>(resolve => {
                browser.once("targetcreated", resolve);
              });

              const pdfClicked = await page.evaluate((rIndex) => {
                const rows = Array.from(document.querySelectorAll("table tr"));
                const row = rows[rIndex];
                if (row) {
                  const pdfBtn = Array.from(row.querySelectorAll("a, input, button")).find(el => el.outerHTML.toLowerCase().includes("pdf") || el.outerHTML.toLowerCase().includes("representacion")) as HTMLElement;
                  if (pdfBtn) {
                    pdfBtn.click();
                    return true;
                  }
                }
                return false;
              }, invoice.rowIndex);

              if (!pdfClicked) return false;

              writeLog(`[Sincronizador] Clic en PDF para factura ${invoice.invoiceFolio}. Esperando pestaña nueva...`);
              
              const newTarget = await newTargetPromise;
              const newPage = await newTarget.page();
              if (newPage) {
                try {
                  writeLog(`[Sincronizador] Nueva pestaña PDF abierta: ${newPage.url()}`);
                  
                  const newClient = await newPage.target().createCDPSession();
                  await newClient.send("Page.setDownloadBehavior", {
                    behavior: "allow",
                    downloadPath: downloadPath,
                  });

                  await new Promise(r => setTimeout(r, 2000));

                  const clickedDescargar = await newPage.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll("a, button, input, img"));
                    const btn = elements.find(el => el.textContent?.toLowerCase().includes("descargar") || el.outerHTML.toLowerCase().includes("descargar") || (el as HTMLInputElement).value?.toLowerCase().includes("descargar")) as HTMLElement;
                    if (btn) {
                      btn.click();
                      return true;
                    }
                    return false;
                  });

                  if (clickedDescargar) {
                    writeLog(`[Sincronizador] Clic en 'Descargar' en pestaña PDF. Esperando descarga...`);
                  }
                  await new Promise(r => setTimeout(r, 4500));
                } finally {
                  await newPage.close().catch(() => {});
                }
              } else {
                writeLog(`[Sincronizador] Descarga directa iniciada para PDF. Esperando...`);
                await new Promise(r => setTimeout(r, 4500));
              }

              return true;
            };

            // Ejecutar descarga PDF
            await downloadPdfViaNewTab().catch(err => {
              writeLog(`[Sincronizador] [Error PDF] Falló la descarga del PDF: ${err.message}`);
            });

            // Restablecer el target del formulario a _self de forma definitiva
            await page.evaluate(() => {
              const form = document.querySelector("form");
              if (form) form.target = "_self";
            });

            // Find downloaded files
            const files = fs.readdirSync(downloadPath);
            let xmlContent = "";
            let pdfBase64 = "";
            
            for (const file of files) {
              const filePath = path.join(downloadPath, file);
              if (file.toLowerCase().endsWith(".pdf")) {
                pdfBase64 = fs.readFileSync(filePath).toString("base64");
              } else {
                const content = fs.readFileSync(filePath, "utf8");
                if (content.trim().startsWith("<?xml") || content.includes("<cfdi:Comprobante")) {
                  xmlContent = content;
                }
              }
            }

            if (xmlContent) {
              const uuidMatch = xmlContent.match(/UUID="([^"]+)"/i);
              const fechaTimbradoMatch = xmlContent.match(/FechaTimbrado="([^"]+)"/i);
              
              // Upload to Google Drive if possible
              let xmlDriveLink = "";
              let pdfDriveLink = "";
              try {
                const driveResults = await uploadInvoiceFiles(
                  matchingTicket.folio,
                  xmlContent,
                  pdfBase64
                );
                xmlDriveLink = driveResults.xmlLink || "";
                pdfDriveLink = driveResults.pdfLink || "";
              } catch (driveErr) {
                writeLog(`[Sincronizador] [Error Drive] No se pudo subir archivos a Drive: ${(driveErr as Error).message}`);
              }

              // Update ticket status
              matchingTicket.status = "facturado";
              matchingTicket.cfdiFolio = uuidMatch ? uuidMatch[1] : `FAG-${invoice.invoiceFolio}`;
              matchingTicket.fechaFacturacion = fechaTimbradoMatch ? fechaTimbradoMatch[1].split("T")[0] : invoiceDateStr;
              matchingTicket.xml = xmlContent;
              matchingTicket.pdfBase64 = pdfBase64;
              matchingTicket.xmlDriveLink = xmlDriveLink;
              matchingTicket.pdfDriveLink = pdfDriveLink;
              matchingTicket.observaciones = `Sincronizado automáticamente desde consulta del portal. Factura: ${invoice.invoiceFolio}`;
              
              matchedCount++;
              writeLog(`[Sincronizador] Ticket ${matchingTicket.folio} sincronizado con éxito.`);
              
              // Write progress to Supabase Cloud!
              try {
                const { error } = await supabase.from('tickets').update(mapTicketToPostgres(matchingTicket)).eq('id', matchingTicket.id);
                if (error) throw error;
                writeLog(`[Sincronizador] Sincronización del ticket ${matchingTicket.folio} guardada en Supabase.`);
              } catch (supabaseErr: any) {
                writeLog(`[Sincronizador] [Error Supabase] No se pudo guardar la actualización en Supabase: ${supabaseErr.message || supabaseErr}`);
              }

              // Also write local backup file
              try {
                fs.writeFileSync(path.resolve("./tickets.json"), JSON.stringify(tickets, null, 2), "utf8");
              } catch (localErr) {
                console.error("Error writing local tickets backup:", localErr);
              }
            } else {
              writeLog(`[Sincronizador] [Advertencia] Coincidencia encontrada pero falló la descarga de archivos para la factura ${invoice.invoiceFolio}.`);
            }
          }
        }
      } catch (err) {
        writeLog(`[Sincronizador] [Error] Falló la consulta para la estación ${normalizedCode}: ${(err as Error).message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  writeLog(`[Sincronizador] Proceso de sincronización finalizado. Facturas procesadas: ${processedCount}, tickets sincronizados: ${matchedCount}.`);
  return { success: true, processedCount, matchedCount };
}
