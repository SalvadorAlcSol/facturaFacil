import fs from "fs";
import path from "path";

const files = [
  "./src/components/TicketDetail.tsx",
  "./src/components/TicketScanner.tsx",
  "./src/components/DatosProfile.tsx",
  "./src/components/StatsDashboard.tsx",
  "./src/App.tsx"
];

const regex = /-(?:[a-z]+-)?(?:50|150|250|350|450|550|650|750|850|950)\b/g;

files.forEach(filePath => {
  const absPath = path.resolve(filePath);
  if (fs.existsSync(absPath)) {
    const content = fs.readFileSync(absPath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      const matches = line.match(regex);
      if (matches) {
        console.log(`${filePath}:${index + 1} (${matches.join(", ")}): ${line.trim()}`);
      }
    });
  }
});
