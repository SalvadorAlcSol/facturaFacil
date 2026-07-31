import fs from 'fs';
import path from 'path';

function searchDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('FacturaGas') || content.includes('facturagas') || content.includes('Factura Gas')) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

searchDir('./src');
searchDir('.');
