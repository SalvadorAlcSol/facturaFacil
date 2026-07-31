import puppeteer from "puppeteer";

async function main() {
  console.log("Iniciando Puppeteer con configuración de sigilo para diagnóstico...");
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
    
    // Set realistic User-Agent
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    
    // Set Accept-Language
    await page.setExtraHTTPHeaders({
      "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    // Override webdriver configuration
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    const url = "https://www.ferchegas.com.mx/facturacion/";
    console.log(`Navegando a: ${url}`);
    
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    console.log(`Status de respuesta: ${response?.status()}`);
    console.log(`Título de la página: ${await page.title()}`);

    const links = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("a"));
      return items.map((a) => ({
        text: a.textContent?.trim() || "",
        href: a.href || "",
      }));
    });

    console.log(`Se encontraron ${links.length} enlaces.`);
    
    // Log links containing "12620" or "arenales" or "grupoferche"
    const matchedLinks = links.filter(l => 
      l.text.includes("12620") || 
      l.href.includes("12620") || 
      l.text.toLowerCase().includes("arenal") || 
      l.href.includes("grupoferche")
    );

    console.log("Enlaces que coinciden:");
    console.log(matchedLinks);

  } catch (err: any) {
    console.error("Error durante el diagnóstico:", err);
  } finally {
    await browser.close();
  }
}

main();
