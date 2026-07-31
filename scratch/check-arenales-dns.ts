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
    "arenales.ferchegas.com.mx",
    "arenales.ferchegas.com",
    "arenales.controlgas.com.mx",
    "arenales.controlgas.com",
    "e12620.ferchegas.com.mx",
    "e12620.ferchegas.com",
    "e12620.grupoferche.com.mx",
    "e12620.grupoferche.com",
  ];

  for (const domain of domains) {
    const ips = await resolveDomain(domain);
    console.log(`Domain: ${domain} -> IPs: ${ips.join(", ") || "No se resolvió"}`);
  }
}

main();
