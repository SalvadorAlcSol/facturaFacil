import fs from "fs";
import path from "path";

const file = path.resolve("./src/components/TicketDetail.tsx");
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  let foundIndex = -1;
  lines.forEach((line, index) => {
    if (line.includes("const handleStartAutoInvoice") || line.includes("handleStartAutoInvoice =")) {
      foundIndex = index;
    }
  });

  if (foundIndex !== -1) {
    console.log(`Found handleStartAutoInvoice definition around line ${foundIndex + 1}`);
    const start = Math.max(0, foundIndex - 5);
    const end = Math.min(lines.length - 1, foundIndex + 40);
    for (let i = start; i <= end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  } else {
    console.log("handleStartAutoInvoice definition not found");
  }
} else {
  console.log("File not found");
}
