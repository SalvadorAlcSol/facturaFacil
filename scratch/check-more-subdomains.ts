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
    "factura.grupoferche.com.mx",
    "facturas.grupoferche.com.mx",
    "factura.ferchegas.com.mx",
    "facturas.ferchegas.com.mx",
    "portal.grupoferche.com.mx",
    "portal.ferchegas.com.mx",
    "clientes.grupoferche.com.mx",
    "clientes.ferchegas.com.mx",
  ];

  for (const domain of domains) {
    const ips = await resolveDomain(domain);
    console.log(`Domain: ${domain} -> IPs: ${ips.join(", ") || "No se resolvió"}`);
  }
}

main();
