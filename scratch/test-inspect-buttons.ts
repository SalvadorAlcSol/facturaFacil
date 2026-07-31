import puppeteer from "puppeteer";

const mockDatos = {
  rfc: "AASS900714FG9",
  razonSocial: "SALVADOR ALCANTARA SOLORZANO",
  regimenFiscal: "626",
  codigoPostal: "91500",
  usoCFDI: "G03",
  email: "s.alcantara@live.com.mx",
  codigoCliente: "22309938"
};

async function inspectButtons() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    const portalUrl = "https://grupoferche.com:12620/arenales/";
    await page.goto(portalUrl, { waitUntil: "networkidle2" });
    
    // Click Consultar
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("a, button, input[type='button']"));
      const target = elements.find(el => el.textContent?.toLowerCase().includes("consultar") || (el as HTMLInputElement).value?.toLowerCase().includes("consultar"));
      if (target) (target as HTMLElement).click();
    });
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Fill RFC
    await page.evaluate((rfc) => {
      const input = document.querySelector("input[name*='rfc' i], input[id*='rfc' i], #txtRFC, #txtRfc") as HTMLInputElement;
      if (input) {
        input.value = rfc;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, mockDatos.rfc);
    
    // Fill client code
    await page.evaluate((code) => {
      const input = document.querySelector("input[name*='codigo' i], input[id*='codigo' i], input[name*='cliente' i], #txtCodigo") as HTMLInputElement;
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, mockDatos.codigoCliente);
    
    // Click Buscar
    await page.evaluate(() => {
      const btn = document.querySelector("input[value*='buscar' i], input[value*='consultar' i], button[id*='buscar' i], #btnBuscar, #btnConsultar, input[type='submit']") as HTMLButtonElement;
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Expand rows
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
    await new Promise(r => setTimeout(r, 2000));

    // Inspect row interactives
    const buttonHtmls = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      for (const row of rows) {
        if (row.textContent?.includes("AREW-74725")) {
          const interactives = Array.from(row.querySelectorAll("a, input, button"));
          return interactives.map(el => ({
            tagName: el.tagName,
            outerHTML: el.outerHTML,
            href: (el as HTMLAnchorElement).href || null,
            onclick: el.getAttribute("onclick") || null
          }));
        }
      }
      return [];
    });

    console.log("Button HTMLs in row:", JSON.stringify(buttonHtmls, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

inspectButtons();
