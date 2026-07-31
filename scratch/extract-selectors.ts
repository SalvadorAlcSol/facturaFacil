async function main() {
  const url = "https://grupoferche.com:12620/arenales/";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    
    console.log("=== ELEMENTOS DE ENTRADA DETECTADOS ===");
    // Simple regex to find input elements
    const inputRegex = /<input[^>]+>/gi;
    let match;
    while ((match = inputRegex.exec(html)) !== null) {
      const el = match[0];
      const id = el.match(/id="([^"]+)"/i)?.[1] || "";
      const name = el.match(/name="([^"]+)"/i)?.[1] || "";
      const type = el.match(/type="([^"]+)"/i)?.[1] || "";
      const value = el.match(/value="([^"]+)"/i)?.[1] || "";
      console.log(`Input -> ID: "${id}" | Name: "${name}" | Type: "${type}" | Value: "${value}"`);
    }

    console.log("\n=== BOTONES DETECTADOS ===");
    const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
    while ((match = buttonRegex.exec(html)) !== null) {
      console.log(`Button tag: ${match[0].substring(0, 150)}`);
    }

    console.log("\n=== SELECTS DETECTADOS ===");
    const selectRegex = /<select[^>]*>([\s\S]*?)<\/select>/gi;
    while ((match = selectRegex.exec(html)) !== null) {
      console.log(`Select tag: ${match[0].substring(0, 150)}`);
    }
  } catch (err: any) {
    console.error("Error:", err.message || err);
  }
}
main();
