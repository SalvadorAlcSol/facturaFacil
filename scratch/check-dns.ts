import dns from "dns";

function resolveDomain(domain: string): Promise<string[]> {
  return new Promise((resolve) => {
    dns.resolve4(domain, (err, addresses) => {
      if (err) {
        resolve([]);
      } else {
        resolve(addresses);
      }
    });
  });
}

async function main() {
  const domains = [
    "facturacion.grupoferche.com.mx",
    "facturacion.grupoferche.com",
    "grupoferche.com.mx",
    "grupoferche.com",
    "www.ferchegas.com.mx",
    "ferchegas.com.mx",
    "www.ferchegas.com",
    "ferchegas.com",
  ];

  for (const domain of domains) {
    const ips = await resolveDomain(domain);
    console.log(`Domain: ${domain} -> IPs: ${ips.join(", ") || "No se resolvió (ERR_NAME_NOT_RESOLVED)"}`);
  }
}

main();
