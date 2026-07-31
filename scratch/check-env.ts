console.log("Environment variables matching FERCHEGAS or PORTAL:");
for (const key of Object.keys(process.env)) {
  if (key.includes("FERCHEGAS") || key.includes("PORTAL") || key.includes("URL")) {
    console.log(`${key}: ${process.env[key]}`);
  }
}
