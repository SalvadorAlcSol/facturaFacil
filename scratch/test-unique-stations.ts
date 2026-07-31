import fs from "fs";
import path from "path";

const TICKETS_FILE = path.resolve("./tickets.json");
if (fs.existsSync(TICKETS_FILE)) {
  try {
    const tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
    console.log("Loaded tickets:", tickets.length);
    
    // Test the unique stations code
    const uniqueStations = Array.from(
      new Set(tickets.map((t: any) => t.estacion ? t.estacion.toUpperCase().trim() : ""))
    ).filter(st => st !== "");
    
    console.log("Unique stations:", uniqueStations);
  } catch (err: any) {
    console.error("Crash during test:", err.message || err);
  }
} else {
  console.log("tickets.json not found");
}
