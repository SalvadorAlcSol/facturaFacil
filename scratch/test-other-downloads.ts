import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const mockDatos = {
  rfc: "AASS900714FG9",
  razonSocial: "SALVADOR ALCANTARA SOLORZANO",
  regimenFiscal: "626",
  codigoPostal: "91500",
  usoCFDI: "G03",
  email: "s.alcantara@live.com.mx",
  codigoCliente: "22309938"
};

const downloadPath = path.resolve("./downloads");
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath, { recursive: true });
}

async function testOthers() {
  console.log("Starting test for other invoices...");
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
      const input = document.querySelector("input[name*='rfc' i], #txtRFC") as HTMLInputElement;
      if (input) input.value = rfc;
    }, mockDatos.rfc);
    
    // Fill client code
    await page.evaluate((code) => {
      const input = document.querySelector("input[name*='codigo' i], #txtCodigo") as HTMLInputElement;
      if (input) input.value = code;
    }, mockDatos.codigoCliente);

    // Click Buscar
    await page.evaluate(() => {
      const btn = document.querySelector("input[value*='buscar' i], #btnBuscar, input[type='submit']") as HTMLButtonElement;
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Expand
    await page.evaluate(() => {
      const expandBtns = Array.from(document.querySelectorAll("img[src*='plus' i], a"));
      const plusLinks = expandBtns.filter(el => el.tagName === 'A' && el.textContent?.trim() === '+' || el.id?.toLowerCase().includes("expand"));
      for (const btn of plusLinks) {
        (btn as HTMLElement).click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Get rows and check indices
    const invoices = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      const list: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const txt = rows[i].textContent || "";
        if (txt.includes("AREW-75269")) list.push({ folio: "AREW-75269", rowIndex: i });
        if (txt.includes("AREW-75307")) list.push({ folio: "AREW-75307", rowIndex: i });
      }
      return list;
    });

    console.log("Found other invoices in rows:", invoices);

    for (const inv of invoices) {
      console.log(`\n--- Testing downloads for ${inv.folio} (row index ${inv.rowIndex}) ---`);
      
      // Clean downloads
      const filesBefore = fs.readdirSync(downloadPath);
      for (const file of filesBefore) {
        fs.unlinkSync(path.join(downloadPath, file));
      }

      // Set target to _blank
      await page.evaluate(() => {
        const form = document.querySelector("form");
        if (form) form.target = "_blank";
      });

      const newTargetPromise = new Promise<puppeteer.Target>(resolve => {
        browser.once("targetcreated", resolve);
      });

      // Click XML
      await page.evaluate((idx) => {
        const rows = document.querySelectorAll("table tr");
        const row = rows[idx];
        if (row) {
          const xmlBtn = Array.from(row.querySelectorAll("input, button, a")).find(el => el.outerHTML.toLowerCase().includes("xml")) as HTMLElement;
          if (xmlBtn) xmlBtn.click();
        }
      }, inv.rowIndex);

      const newTarget = await newTargetPromise;
      const newPage = await newTarget.page();
      if (newPage) {
        // Set download behavior
        const newClient = await newPage.target().createCDPSession();
        await newClient.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: downloadPath,
        });

        await new Promise(r => setTimeout(r, 2000));

        // Click Descargar
        await newPage.evaluate(() => {
          const elements = Array.from(document.querySelectorAll("a, button, input, img"));
          const btn = elements.find(el => el.textContent?.toLowerCase().includes("descargar") || el.outerHTML.toLowerCase().includes("descargar") || (el as HTMLInputElement).value?.toLowerCase().includes("descargar")) as HTMLElement;
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 2000));
        
        const files = fs.readdirSync(downloadPath);
        console.log(`Files downloaded for ${inv.folio} XML:`, files);
        if (files.length > 0) {
          const content = fs.readFileSync(path.join(downloadPath, files[0]), "utf8");
          console.log(`Is valid XML?`, content.trim().startsWith("<?xml") || content.includes("<cfdi:Comprobante"));
          if (!(content.trim().startsWith("<?xml") || content.includes("<cfdi:Comprobante"))) {
            console.log(`Content:`, content.substring(0, 150));
          }
        }

        await newPage.close();
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

testOthers();
