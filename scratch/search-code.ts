import fs from "fs";
import path from "path";

function searchInDir(dir: string, pattern: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== ".venv" && file !== "dist") {
        searchInDir(fullPath, pattern);
      }
    } else {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes(pattern)) {
        console.log(`Encontrado patrón "${pattern}" en el archivo: ${fullPath}`);
      }
    }
  }
}

console.log("Iniciando búsqueda de subdominio...");
searchInDir(".", "facturacion.grupoferche.com.mx");
searchInDir(".", "FERCHEGAS_PORTAL_URL");
console.log("Búsqueda completada.");
