async function main() {
  const url = "https://grupoferche.com:12620/arenales/";
  console.log(`Intentando conectar a: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log(`Status de respuesta: ${res.status}`);
    const html = await res.text();
    console.log(`Largo del HTML recibido: ${html.length}`);
    console.log("Primeros 500 caracteres de HTML:");
    console.log(html.substring(0, 500));
  } catch (err: any) {
    console.error("Error al conectar:", err.message || err);
  }
}
main();
