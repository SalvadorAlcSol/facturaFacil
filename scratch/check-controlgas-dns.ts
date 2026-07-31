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
    "grupoferche.controlgas.com.mx",
    "ferchegas.controlgas.com.mx",
    "controlgas.grupoferche.com.mx",
    "controlgas.ferchegas.com.mx",
  ];

  for (const domain of domains) {
    const ips = await resolveDomain(domain);
    console.log(`Domain: ${domain} -> IPs: ${ips.join(", ") || "No se resolvió"}`);
  }
}

main();
