import dns from "dns";

dns.resolve4("app.facturagas.net", (err, addresses) => {
  if (err) {
    console.error("No se resolvió app.facturagas.net:", err);
  } else {
    console.log("app.facturagas.net se resolvió a:", addresses);
  }
});
