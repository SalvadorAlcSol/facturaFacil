async function main() {
  try {
    const url = "https://www.ferchegas.com.mx/facturacion/";
    console.log(`Haciendo fetch a: ${url}`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    console.log(`Respuesta status: ${res.status}`);
    console.log(`Largo de respuesta: ${html.length}`);
    
    // Find all links
    const hrefRegex = /href="([^"]+)"/g;
    let match;
    const links = [];
    while ((match = hrefRegex.exec(html)) !== null) {
      links.push(match[1]);
    }
    console.log("Enlaces encontrados en el HTML:");
    console.log(links.filter(l => l.includes("grupoferche") || l.includes("facturacion") || l.includes("12620")));
  } catch (err: any) {
    console.error("Error en fetch:", err);
  }
}
main();
