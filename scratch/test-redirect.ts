import puppeteer from "puppeteer";

async function run() {
  console.log("Probando cargar la página raíz del puerto 12620...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();
  
  try {
    const url = "https://grupoferche.com:12620/";
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
    const title = await page.title();
    console.log("Título de la página:", title);
    const bodyText = await page.evaluate(() => document.body.textContent || "");
    console.log("Primeros 200 caracteres de texto en pantalla:", bodyText.trim().substring(0, 200));
  } catch (err: any) {
    console.error("Error:", err.message || err);
  } finally {
    await browser.close();
  }
}

run();
