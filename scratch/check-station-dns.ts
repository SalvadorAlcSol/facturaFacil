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
    "es12620.ddns.net",
    "es012620.ddns.net",
    "es-12620.ddns.net",
    "station12620.ddns.net",
  ];

  for (const domain of domains) {
    const ips = await resolveDomain(domain);
    console.log(`Domain: ${domain} -> IPs: ${ips.join(", ") || "No se resolvió"}`);
  }
}

main();
