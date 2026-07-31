import fs from "fs";
import path from "path";

const TICKETS_FILE = path.resolve("./tickets.json");
if (fs.existsSync(TICKETS_FILE)) {
  const tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
  console.log(JSON.stringify(tickets, null, 2));
} else {
  console.log("tickets.json not found");
}
