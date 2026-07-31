import puppeteer from "puppeteer";

async function main() {
  console.log("Iniciando Puppeteer para ferchegas.com...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const url = "https://www.ferchegas.com/facturacion/";
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

    console.log(`Se encontraron ${links.length} enlaces:`);
    for (const link of links) {
      if (link.text.includes("12620") || link.href.includes("12620") || link.href.includes("facturacion") || link.href.includes("grupoferche")) {
        console.log(`- Texto: "${link.text}" | Href: "${link.href}"`);
      }
    }
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
