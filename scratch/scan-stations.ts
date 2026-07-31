import puppeteer from "puppeteer";

interface Candidate {
  id: string;
  url: string;
}

const candidates: Candidate[] = [
  // E03024 LAS ANIMAS
  { id: "E03024", url: "https://grupoferche.com:03024/lasanimas/" },
  { id: "E03024", url: "https://grupoferche.com:3024/lasanimas/" },
  { id: "E03024", url: "https://grupoferche.com:03024/animas/" },

  // E04683 GARNICA
  { id: "E04683", url: "https://grupoferche.com:04683/garnica/" },
  { id: "E04683", url: "https://grupoferche.com:4683/garnica/" },

  // E07626 EL LENCERO
  { id: "E07626", url: "https://grupoferche.com:07626/lencero/" },
  { id: "E07626", url: "https://grupoferche.com:7626/lencero/" },
  { id: "E07626", url: "https://grupoferche.com:07626/ellencero/" },

  // E08251 MIRADORES
  { id: "E08251", url: "https://grupoferche.com:08251/miradores/" },
  { id: "E08251", url: "https://grupoferche.com:8251/miradores/" },

  // E10794 LA ORDUÑA
  { id: "E10794", url: "https://grupoferche.com:10794/laorduna/" },
  { id: "E10794", url: "https://grupoferche.com:10794/orduna/" },

  // E11856 CENTRAL 1
  { id: "E11856", url: "https://grupoferche.com:11856/central/" },
  { id: "E11856", url: "https://grupoferche.com:11856/central1/" },
  { id: "E11856", url: "https://grupoferche.com:11856/xalapa/" },

  // E12940 EL OLMO
  { id: "E12940", url: "https://grupoferche.com:12940/elolmo/" },
  { id: "E12940", url: "https://grupoferche.com:12940/olmo/" },

  // E14579 CRISTAL
  { id: "E14579", url: "https://grupoferche.com:14579/cristal/" },

  // P21011 AMÉRICAS
  { id: "P21011", url: "https://grupoferche.com:21011/americas/" },
  { id: "P21011", url: "https://grupoferche.com:21011/lasamericas/" },

  // P22559 EL CHICO
  { id: "P22559", url: "https://grupoferche.com:22559/elchico/" },
  { id: "P22559", url: "https://grupoferche.com:22559/chico/" },

  // P25034 MISANTLA
  { id: "P25034", url: "https://grupoferche.com:25034/misantla/" }
];

async function run() {
  console.log("Iniciando escaneo ampliado...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();
  
  const results: Record<string, string> = {};

  for (const c of candidates) {
    console.log(`Probando ${c.id}: ${c.url}...`);
    try {
      const response = await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 8000 });
      const title = await page.title().catch(() => "");
      const status = response ? response.status() : 0;
      
      console.log(`[Resultado] Status: ${status}, Title: "${title}"`);
      if (status === 200 && (title.includes("Factur") || title.includes("Control") || title.includes("Bienvenido"))) {
        console.log(`>> ¡Encontrado válido para ${c.id}!`);
        results[c.id] = c.url;
      }
    } catch (err: any) {
      console.log(`[Fallo] ${err.message || err}`);
    }
  }

  console.log("\n=== NUEVO MAPA DE ESTACIONES DE XALAPA ===");
  console.log(JSON.stringify(results, null, 2));
  
  await browser.close();
}

run();
