import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.resolve("./google-credentials.json");
console.log("Credentials path:", CREDENTIALS_PATH);
console.log("Exists:", fs.existsSync(CREDENTIALS_PATH));

if (fs.existsSync(CREDENTIALS_PATH)) {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    console.log("Raw length:", raw.length);
    const parsed = JSON.parse(raw);
    console.log("Parsed keys:", Object.keys(parsed));
    console.log("client_email:", parsed.client_email);
    console.log("private_key exists:", !!parsed.private_key);
  } catch (e) {
    console.error("Error parsing JSON:", e);
  }
}
