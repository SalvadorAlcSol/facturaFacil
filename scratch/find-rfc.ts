import fs from "fs";
import path from "path";

const file = path.resolve("./src/rpa-automator.ts");
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes("rfc") || line.toLowerCase().includes("datos fiscales") || line.toLowerCase().includes("txtrfc") || line.toLowerCase().includes("buscar")) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log("File not found");
}
