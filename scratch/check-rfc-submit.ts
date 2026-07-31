import puppeteer from "puppeteer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

async function solveCaptcha(page: puppeteer.Page, apiKey: string): Promise<string> {
  const captchaImgSelector = "#RadCaptcha1_CaptchaImageUP";
  const element = await page.$(captchaImgSelector);
  if (!element) throw new Error("No captcha img");
  const captchaBuffer = await element.screenshot({ type: "jpeg" }) as Buffer;
  const base64Image = captchaBuffer.toString("base64");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
      "Responde UNICAMENTE con los 5 caracteres en mayusculas del captcha sin espacios.",
    ],
  });
  return response.text?.trim().toUpperCase() || "";
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }

  console.log("Iniciando Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to landing
    const url = "https://grupoferche.com:12620/arenales/";
    await page.goto(url, { waitUntil: "networkidle2" });
    
    // Step 1: Click Facturar
    const btnFacturar = await page.$("#facturar");
    if (btnFacturar) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        btnFacturar.click()
      ]);
    }
    
    // Step 2: Fill Form
    await page.type("#txtDespacho", "5907278");
    await page.type("#txtIdentificador", "76574062");
    
    const captchaText = await solveCaptcha(page, apiKey);
    console.log("Captcha resuelto:", captchaText);
    await page.type("#RadCaptcha1_CaptchaTextBox", captchaText);
    
    // Click Agregar
    await page.click("#btnAgregar");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Click Siguiente
    await page.click("#btnAceptar");
    
    console.log("Esperando que aparezca el campo RFC...");
    await page.waitForSelector("#txtRFC", { visible: true, timeout: 15000 });
    
    // Step 3: Enter RFC
    console.log("Ingresando RFC...");
    await page.type("#txtRFC", "AASS900714FG9");
    
    // Click Buscar
    console.log("Haciendo clic en Buscar...");
    const btnBuscar = await page.$("#buscar");
    if (btnBuscar) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {
          console.log("waitForNavigation en Buscar expiró. Continuando...");
        }),
        btnBuscar.click()
      ]);
    } else {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.log("Esperando 5 segundos adicionales para renderizado completo...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Save screenshot
    const scratchDir = path.resolve("./scratch");
    const screenshotPath = path.join(scratchDir, "07_after_rfc_search.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot guardado en: ${screenshotPath}`);

    console.log("Extrayendo elementos de la página...");
    const elements = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("input, button, select, span, div, h1, h2, h3, h4"));
      return items.map(el => ({
        tag: el.tagName,
        id: el.id || "",
        name: (el as HTMLInputElement).name || "",
        type: (el as HTMLInputElement).type || "",
        val: (el as HTMLInputElement).value || "",
        text: el.textContent?.trim() || "",
        className: el.className || "",
      }));
    });
    
    console.log("=== ELEMENTOS DETECTADOS EN LA PÁGINA ===");
    for (const item of elements) {
      if (item.type !== "hidden" && item.id && item.tag !== "DIV" && item.tag !== "SPAN") {
        console.log(`${item.tag} -> ID: "${item.id}" | Name: "${item.name}" | Type: "${item.type}" | Val: "${item.val}" | Text: "${item.text.substring(0, 50)}" | Class: "${item.className}"`);
      }
    }

    // Let's print any text content on the page
    const pageText = await page.evaluate(() => document.body.textContent || "");
    console.log("\n=== TEXTO DE LA PÁGINA ===");
    console.log(pageText.substring(0, 1000).replace(/\s+/g, " "));

  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
