import fs from "fs";
import path from "path";

const file = path.resolve("./src/components/TicketDetail.tsx");
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes("iniciar auto-facturado") || line.toLowerCase().includes("inteligente") || line.toLowerCase().includes("auto-facturado")) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log("File not found");
}
