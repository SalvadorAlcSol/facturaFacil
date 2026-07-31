async function main() {
  const url = "https://facturacion.grupoferche.com";
  try {
    console.log(`Haciendo fetch a: ${url}`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log(`Respuesta status: ${res.status}`);
    console.log(`Respuesta cabeceras:`, [...res.headers.entries()]);
  } catch (err: any) {
    console.error(`Error en fetch a ${url}:`, err.message || err);
  }
}
main();
