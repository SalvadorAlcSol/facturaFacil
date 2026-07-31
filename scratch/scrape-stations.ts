import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function run() {
  console.log("Iniciando raspado de estaciones usando CHROME DEL SISTEMA en modo HEADLESS: FALSE...");
  
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chromePath)) {
    console.error("No se encontró Google Chrome en C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
    return;
  }
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false, // HEADLESS FALSE
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  
  try {
    const url = "https://ferchegas.com/facturacion";
    console.log(`Navegando a: ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    
    console.log("Esperando 6 segundos...");
    await new Promise(r => setTimeout(r, 6500));

    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("SafeLine WAF") || text.includes("Security Detection")) {
      console.log("WAF bloqueó el acceso.");
      return;
    }
    
    console.log("¡WAF SUPERADO CON ÉXITO!");
    
    // Expand Xalapa region or find "Direcciones"
    // Let's print all links and texts
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a, button, [onclick]")).map(el => {
        return {
          tag: el.tagName,
          text: el.textContent?.trim() || "",
          href: (el as HTMLAnchorElement).href || "",
          id: el.id,
          class: el.className
        };
      });
    });
    
    console.log("Elementos interactivos:");
    console.log(JSON.stringify(links, null, 2));
    
  } catch (err: any) {
    console.error("Error durante el raspado:", err);
  } finally {
    await browser.close();
  }
}

run();
