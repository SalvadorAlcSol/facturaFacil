import puppeteer from "puppeteer";

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to landing and click Facturar
    const url = "https://grupoferche.com:12620/arenales/";
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    
    const btnFacturar = await page.$("#facturar");
    if (btnFacturar) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
        btnFacturar.click()
      ]);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log("=== IMÁGENES DETECTADAS EN LA PÁGINA ===");
    const images = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("img"));
      return items.map((img) => ({
        id: img.id || "",
        src: img.src || "",
        className: img.className || "",
        alt: img.alt || "",
      }));
    });

    for (const img of images) {
      console.log(`Image -> ID: "${img.id}" | Src: "${img.src.substring(0, 100)}" | Class: "${img.className}" | Alt: "${img.alt}"`);
    }

  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
