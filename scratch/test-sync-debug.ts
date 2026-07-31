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

async function debugSync() {
  console.log("Starting debug sync...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set download behavior
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath,
    });

    const portalUrl = "https://grupoferche.com:12620/arenales/";
    console.log("Navigating to portal...");
    await page.goto(portalUrl, { waitUntil: "networkidle2" });
    await page.screenshot({ path: "scratch/debug_01_portal_home.png" });

    // Click Consultar
    console.log("Clicking Consultar...");
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("a, button, input[type='button']"));
      const target = elements.find(el => el.textContent?.toLowerCase().includes("consultar") || (el as HTMLInputElement).value?.toLowerCase().includes("consultar"));
      if (target) (target as HTMLElement).click();
    });
    
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: "scratch/debug_02_consulta_form.png" });

    // Fill RFC
    console.log("Filling RFC...");
    await page.evaluate((rfc) => {
      const input = document.querySelector("input[name*='rfc' i], input[id*='rfc' i], #txtRFC, #txtRfc") as HTMLInputElement;
      if (input) {
        input.value = rfc;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, mockDatos.rfc);
    
    // Fill client code
    console.log("Filling Client Code...");
    await page.evaluate((code) => {
      const input = document.querySelector("input[name*='codigo' i], input[id*='codigo' i], input[name*='cliente' i], #txtCodigo") as HTMLInputElement;
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, mockDatos.codigoCliente);
    
    // Click Buscar
    console.log("Clicking Buscar...");
    await page.evaluate(() => {
      const btn = document.querySelector("input[value*='buscar' i], input[value*='consultar' i], button[id*='buscar' i], #btnBuscar, #btnConsultar, input[type='submit']") as HTMLButtonElement;
      if (btn) btn.click();
    });
    
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: "scratch/debug_03_results_collapsed.png" });

    // Expand rows
    console.log("Expanding rows...");
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
    await page.screenshot({ path: "scratch/debug_04_results_expanded.png" });

    // Get XML and PDF element row index
    const invoiceRowInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      for (let i = 0; i < rows.length; i++) {
        const rowText = rows[i].textContent || "";
        const interactives = rows[i].querySelectorAll("a, input, button");
        const hasDownload = Array.from(interactives).some(el => el.outerHTML.toLowerCase().includes("xml") || el.outerHTML.toLowerCase().includes("pdf"));
        if (hasDownload && rowText.includes("AREW-74725")) {
          return { rowIndex: i, text: rowText.substring(0, 100) };
        }
      }
      return null;
    });

    console.log("Found matching invoice row:", invoiceRowInfo);

    if (invoiceRowInfo) {
      const rIndex = invoiceRowInfo.rowIndex;
      
      // Clean download folder
      const filesBefore = fs.readdirSync(downloadPath);
      for (const file of filesBefore) {
        fs.unlinkSync(path.join(downloadPath, file));
      }

      // Helper local para reintentar page.evaluate si el contexto es inestable o destruido por postback
      const safeEvaluate = async (fn: any, ...args: any[]) => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await page.evaluate(fn, ...args);
          } catch (e: any) {
            const msg = e.message.toLowerCase();
            if (msg.includes("destroyed") || msg.includes("navigation") || msg.includes("detached")) {
              console.log(`[Sincronizador] Contexto inestable (intento ${attempt}/3). Esperando re-estabilización...`);
              await new Promise(r => setTimeout(r, 2500));
            } else {
              throw e;
            }
          }
        }
        throw new Error("No se pudo restablecer el contexto de ejecución de Puppeteer.");
      };

      console.log("Clicking XML button...");
      const xmlClicked = await safeEvaluate((idx) => {
        const rows = document.querySelectorAll("table tr");
        const row = rows[idx];
        if (row) {
          const xmlBtn = Array.from(row.querySelectorAll("a, input, button")).find(el => el.outerHTML.toLowerCase().includes("xml")) as HTMLElement;
          if (xmlBtn) {
            xmlBtn.click();
            return true;
          }
        }
        return false;
      }, rIndex);
      console.log("xmlClicked result:", xmlClicked);

      // Screenshot immediately after click
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: "scratch/debug_05_after_xml_click.png" });

      // Wait 4.5 seconds and check files & screenshot
      await new Promise(r => setTimeout(r, 4000));
      console.log("Files in downloads after 4.5s:", fs.readdirSync(downloadPath));
      await page.screenshot({ path: "scratch/debug_06_4s_after_xml.png" });

      // Click PDF
      console.log("Clicking PDF button...");
      const pdfClicked = await safeEvaluate((idx) => {
        const rows = document.querySelectorAll("table tr");
        const row = rows[idx];
        if (row) {
          const pdfBtn = Array.from(row.querySelectorAll("a, input, button")).find(el => el.outerHTML.toLowerCase().includes("pdf") || el.outerHTML.toLowerCase().includes("representacion")) as HTMLElement;
          if (pdfBtn) {
            pdfBtn.click();
            return true;
          }
        }
        return false;
      }, rIndex);
      console.log("pdfClicked result:", pdfClicked);

      await new Promise(r => setTimeout(r, 4500));
      console.log("Files in downloads after PDF click:", fs.readdirSync(downloadPath));
      await page.screenshot({ path: "scratch/debug_07_final.png" });
    }

  } catch (err: any) {
    console.error("Error during debug sync:", err);
  } finally {
    await browser.close();
  }
}

debugSync();
