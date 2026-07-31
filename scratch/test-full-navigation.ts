import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Iniciando simulación de navegación...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Stealth config
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({
      "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    const url = "https://grupoferche.com:12620/arenales/";
    console.log(`Paso 1: Navegando a ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    
    // Create scratch dir if it doesn't exist
    const scratchDir = path.resolve("./scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    await page.screenshot({ path: path.join(scratchDir, "01_landing.png") });
    console.log("Screenshot de la landing page guardado.");

    console.log("Paso 2: Buscando botón 'Facturar'...");
    // Find button with id="facturar" or text containing "Facturar"
    const btnFacturar = await page.$("#facturar");
    if (!btnFacturar) {
      throw new Error("No se encontró el botón de Facturar con ID 'facturar'.");
    }

    console.log("Haciendo clic en el botón...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {
        console.log("waitForNavigation expiró, pero puede ser una actualización AJAX. Continuando...");
      }),
      btnFacturar.click()
    ]);

    console.log("Esperando 3 segundos adicionales...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await page.screenshot({ path: path.join(scratchDir, "02_form.png") });
    console.log("Screenshot después del clic guardado.");

    console.log("\n=== NUEVOS ELEMENTOS DE ENTRADA DETECTADOS ===");
    const inputs = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("input, select, button"));
      return items.map((el) => {
        const tag = el.tagName;
        const id = el.id || "";
        const name = (el as HTMLInputElement).name || "";
        const type = (el as HTMLInputElement).type || "";
        const val = (el as HTMLInputElement).value || "";
        const text = el.textContent?.trim() || "";
        return { tag, id, name, type, val, text };
      });
    });

    for (const item of inputs) {
      if (item.type !== "hidden") {
        console.log(`${item.tag} -> ID: "${item.id}" | Name: "${item.name}" | Type: "${item.type}" | Val: "${item.val}" | Text: "${item.text.substring(0, 50)}"`);
      }
    }

  } catch (err: any) {
    console.error("Error durante la navegación:", err);
  } finally {
    await browser.close();
  }
}

main();
