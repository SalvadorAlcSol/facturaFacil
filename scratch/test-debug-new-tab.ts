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

async function debugNewTab() {
  console.log("Starting debug new tab sync...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set download behavior for main page
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath,
    });

    const portalUrl = "https://grupoferche.com:12620/arenales/";
    await page.goto(portalUrl, { waitUntil: "networkidle2" });

    // Click Consultar
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("a, button, input[type='button']"));
      const target = elements.find(el => el.textContent?.toLowerCase().includes("consultar") || (el as HTMLInputElement).value?.toLowerCase().includes("consultar"));
      if (target) (target as HTMLElement).click();
    });
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Fill fields
    await page.evaluate((rfc) => {
      const input = document.querySelector("input[name*='rfc' i], #txtRFC") as HTMLInputElement;
      if (input) input.value = rfc;
    }, mockDatos.rfc);
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

    // Expand rows
    await page.evaluate(() => {
      const expandBtns = Array.from(document.querySelectorAll("img[src*='plus' i], a"));
      const plusLinks = expandBtns.filter(el => el.tagName === 'A' && el.textContent?.trim() === '+' || el.id?.toLowerCase().includes("expand"));
      for (const btn of plusLinks) {
        (btn as HTMLElement).click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Get matching row index
    const rIndex = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].textContent?.includes("AREW-74725")) return i;
      }
      return -1;
    });

    console.log("Row index for AREW-74725:", rIndex);

    if (rIndex !== -1) {
      // 1. Set form target to _blank
      console.log("Setting form target to _blank...");
      await page.evaluate(() => {
        const form = document.querySelector("form");
        if (form) form.target = "_blank";
      });

      // Prepare target listener
      const newTargetPromise = new Promise<puppeteer.Target>(resolve => {
        browser.once("targetcreated", resolve);
      });

      console.log("Clicking XML button...");
      await page.evaluate((idx) => {
        const rows = document.querySelectorAll("table tr");
        const row = rows[idx];
        if (row) {
          const xmlBtn = Array.from(row.querySelectorAll("input, button, a")).find(el => el.outerHTML.toLowerCase().includes("xml")) as HTMLElement;
          if (xmlBtn) xmlBtn.click();
        }
      }, rIndex);

      console.log("Waiting for new target tab...");
      const newTarget = await newTargetPromise;
      const newPage = await newTarget.page();
      
      if (newPage) {
        console.log("New tab opened! URL:", newPage.url());
        
        // Set download behavior for new page
        const newClient = await newPage.target().createCDPSession();
        await newClient.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: downloadPath,
        });

        await new Promise(r => setTimeout(r, 4000));
        await newPage.screenshot({ path: "scratch/debug_new_tab_xml.png" });

        // Check if there is a download button on this new page
        const downloadBtnExists = await newPage.evaluate(() => {
          const elements = Array.from(document.querySelectorAll("a, button, input, img"));
          const btn = elements.find(el => el.textContent?.toLowerCase().includes("descargar") || el.outerHTML.toLowerCase().includes("descargar") || (el as HTMLInputElement).value?.toLowerCase().includes("descargar"));
          return btn ? true : false;
        });

        console.log("Download button exists on new page:", downloadBtnExists);

        if (downloadBtnExists) {
          console.log("Clicking download button on new page...");
          await newPage.evaluate(() => {
            const elements = Array.from(document.querySelectorAll("a, button, input, img"));
            const btn = elements.find(el => el.textContent?.toLowerCase().includes("descargar") || el.outerHTML.toLowerCase().includes("descargar") || (el as HTMLInputElement).value?.toLowerCase().includes("descargar")) as HTMLElement;
            if (btn) btn.click();
          });
          await new Promise(r => setTimeout(r, 3000));
          console.log("Files in downloads after clicking Descargar:", fs.readdirSync(downloadPath));
        }

        await newPage.close();
      } else {
        console.log("New target is not a page (might be a direct download).");
        await new Promise(r => setTimeout(r, 4000));
        console.log("Files in downloads:", fs.readdirSync(downloadPath));
      }

      // Check if original page is still intact
      console.log("Original page URL:", page.url());
      await page.screenshot({ path: "scratch/debug_original_tab_after.png" });
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

debugNewTab();
