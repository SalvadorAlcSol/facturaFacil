import puppeteer from "puppeteer";

async function main() {
  console.log("Iniciando Puppeteer con configuración de sigilo...");
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
    
    // Set realistic user agent
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    });

    // Pass webdriver evaluation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    const url = "https://www.ferchegas.com.mx/facturacion/";
    console.log(`Navegando a: ${url}`);
    
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    console.log(`Status de respuesta: ${response?.status()}`);
    
    // Save screenshot of what loaded
    const fs = require("fs");
    const path = require("path");
    const screenshotPath = path.resolve("./scratch/portal_page.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot guardado en: ${screenshotPath}`);

    console.log("Buscando enlaces...");
    const links = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("a"));
      return items.map((a) => ({
        text: a.textContent?.trim() || "",
        href: a.href || "",
      }));
    });

    console.log(`Se encontraron ${links.length} enlaces:`);
    const relevant = links.filter(link => 
      link.text.includes("12620") || 
      link.href.includes("12620") || 
      link.text.toLowerCase().includes("arenal") ||
      link.href.includes("grupoferche") ||
      link.href.includes("facturacion")
    );

    console.log("Enlaces relevantes:");
    console.log(relevant);

    // Let's print the first 20 links to see what they look like
    console.log("Primeros 30 enlaces del portal:");
    console.log(links.slice(0, 30));

  } catch (err: any) {
    console.error("Error durante la ejecución:", err);
  } finally {
    await browser.close();
  }
}

main();
