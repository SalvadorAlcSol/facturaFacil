import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Iniciando Puppeteer en modo NO-HEADLESS (se abrirá una ventana de Chrome)...");
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic viewport
    await page.setViewport({ width: 1280, height: 800 });

    const url = "https://www.ferchegas.com.mx/facturacion/";
    console.log(`Navegando a: ${url}`);
    
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    console.log("Página cargada. Esperando 5 segundos para que cargue todo el contenido dinámico...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const title = await page.title();
    console.log(`Título de la página: ${title}`);

    console.log("Extrayendo enlaces de la página...");
    const links = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("a"));
      return items.map((a) => ({
        text: a.textContent?.trim() || "",
        href: a.href || "",
      }));
    });

    console.log(`Se encontraron ${links.length} enlaces.`);
    
    // Save all links to a JSON file
    const outputPath = path.resolve("./scratch/extracted_links.json");
    fs.writeFileSync(outputPath, JSON.stringify(links, null, 2), "utf8");
    console.log(`Todos los enlaces se guardaron en: ${outputPath}`);

    // Print links matching 12620 or Arenales
    const relevant = links.filter(l => 
      l.text.includes("12620") || 
      l.href.includes("12620") || 
      l.text.toLowerCase().includes("arenal")
    );
    console.log("\n=== Enlaces que coinciden con 12620 o Arenales ===");
    console.log(relevant);
    console.log("==================================================\n");

  } catch (err: any) {
    console.error("Error durante la ejecución:", err);
  } finally {
    console.log("Cerrando navegador...");
    await browser.close();
  }
}

main();
