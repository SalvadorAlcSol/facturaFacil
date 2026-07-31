// Helper function to extract metadata from OCR text using Regex
export interface ParsedTicketData {
  found: boolean;
  folio?: string;
  webId?: string;
  estacion?: string;
  monto?: number;
  fecha?: string;
  combustible?: string;
  litros?: number;
  precioPorLitro?: number;
  explanation?: string;
}

export interface ParsedTicketData {
  found: boolean;
  folio?: string;
  webId?: string;
  estacion?: string;
  monto?: number;
  iva?: number;
  fecha?: string;
  combustible?: string;
  litros?: number;
  precioPorLitro?: number;
  categoria?: 'combustible' | 'cafe' | 'otros';
  explanation?: string;
}

export function parseOCRText(text: string): ParsedTicketData {
  const lines = text.split('\n');
  const textLower = text.toLowerCase();
  
  // 0. Detect Categoria
  let categoria: 'combustible' | 'cafe' | 'otros' = 'combustible';
  if (
    textLower.includes('starbucks') ||
    textLower.includes('alsea') ||
    textLower.includes('cafe') ||
    textLower.includes('café') ||
    textLower.includes('coffe') ||
    textLower.includes('meridiano')
  ) {
    categoria = 'cafe';
  } else if (
    !(
      textLower.includes('ferche') ||
      textLower.includes('gasolin') ||
      textLower.includes('combustible') ||
      textLower.includes('magna') ||
      textLower.includes('premium') ||
      textLower.includes('vales') ||
      textLower.includes('dispensador') ||
      textLower.includes('litro') ||
      textLower.includes('estacion') ||
      textLower.includes('estación') ||
      textLower.includes('pemex') ||
      textLower.includes('oxxogas') ||
      textLower.includes('gasol')
    )
  ) {
    categoria = 'otros';
  }

  let folio = '';
  let webId = '';
  let estacion = '';
  let monto = 0;
  let fecha = '';
  let combustible = '';
  let litros = 0;
  let precioPorLitro = 0;

  // 1. Estacion (usually E followed by 4 or 5 digits/characters for Ferchegas)
  // Or store name for Starbucks
  if (categoria === 'cafe') {
    if (textLower.includes('starbucks')) {
      const sbMatch = text.match(/(starbucks\s+[a-z0-9\s]+)/i);
      estacion = sbMatch ? sbMatch[1].trim() : 'Starbucks Café';
    } else {
      estacion = 'Cafetería';
    }
  } else {
    const maxHeaderLines = Math.max(5, Math.floor(lines.length * 0.3));
    const estacionRegex = /\bE(?:STACION)?\s*[-_:#]?\s*([A-Z0-9]{4,5})\b/i;
    
    const normalizeStationCode = (code: string): string => {
      return code
        .toUpperCase()
        .replace(/O/g, '0')
        .replace(/Q/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/T/g, '2')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/G/g, '6')
        .replace(/B/g, '8');
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/(?:cre|permiso|exp|pl\/)/i.test(line)) {
        continue;
      }
      const match = line.match(estacionRegex);
      if (match) {
        const normalized = normalizeStationCode(match[1]);
        estacion = 'E' + normalized.padStart(5, '0');
        if (i < maxHeaderLines) {
          break;
        }
      }
    }

    if (!estacion) {
      const fallbackMatch = text.match(/(?:E|ESTACION)\s*[-_:#]?\s*([A-Z0-9]{4,5})/i);
      if (fallbackMatch) {
        const normalized = normalizeStationCode(fallbackMatch[1]);
        estacion = 'E' + normalized.padStart(5, '0');
      }
    }
  }

  // 2. Folio / Ticket number
  const folioRegex = /(?:folio(?: web)?|ticket|transacci[oó]n|venta|no\.?\s*ticket)(?:\s+n[oó]\.?)?\s*[:#-]?\s*(\d+)/i;
  const folioMatch = text.match(folioRegex);
  if (folioMatch) {
    folio = folioMatch[1];
  }

  // 3. Web ID / Clave de Facturacion
  // For Starbucks/Alsea, it's typically a 16-20 digit number
  if (categoria === 'cafe') {
    const alseaCodeMatch = text.match(/\b(\d{16,20})\b/);
    if (alseaCodeMatch) {
      webId = alseaCodeMatch[1];
    } else {
      const webIdRegex = /(?:web\s*[i1l|]d|web[i1l|]d|clave\s+internet|c[oó]digo\s+facturaci[oó]n|facturaci[oó]n\s+c[oó]digo|clave\s+de\s+facturacion)\s*[:#-]?\s*([A-Z0-9]{4,20})/i;
      const webIdMatch = text.match(webIdRegex);
      if (webIdMatch) {
        webId = webIdMatch[1].toUpperCase();
      }
    }
    
    if (!folio) {
      const sbFolioMatch = text.match(/(?:ticket|trans|transaccion|tienda|no\.?\s*tkt)\s*[:#-]?\s*(\d{2,8})/i);
      if (sbFolioMatch) {
        folio = sbFolioMatch[1];
      }
    }
  } else {
    const webIdRegex = /(?:web\s*[i1l|]d|web[i1l|]d|clave\s+internet|c[oó]digo\s+facturaci[oó]n|facturaci[oó]n\s+c[oó]digo|clave\s+de\s+facturacion)\s*[:#-]?\s*([A-Z0-9]{4,12})/i;
    const webIdMatch = text.match(webIdRegex);
    const excludePattern = /^(TOTAL|FECHA|FOLIO|VENTA|MAGNA|PREMIUM|LITRO|FERCHE|GASOLINA|CLIENTE|SERVICIO|PORTAL|IMPORTE|SUBTOTAL|DIESEL|DIÉSEL|FACTURA|EMISOR)$/i;
    if (webIdMatch && !excludePattern.test(webIdMatch[1])) {
      webId = webIdMatch[1].toUpperCase();
    } else {
      for (const line of lines) {
        const words = line.trim().split(/\s+/);
        for (const word of words) {
          if (/^[A-Z0-9]{6,8}$/.test(word) && !excludePattern.test(word) && !/^E[A-Z0-9]+$/i.test(word)) {
            webId = word;
            break;
          }
        }
        if (webId) break;
      }
    }
  }

  // 4. Monto / Total & IVA calculation
  let extractedSubtotal = 0;
  let extractedIva = 0;
  let extractedTotal = 0;

  for (const line of lines) {
    const cleanLine = line.replace(/[$,\s]/g, '');
    
    if (/(?:subtotal|sub-total|sub\s+total)/i.test(line)) {
      const match = cleanLine.match(/(?:subtotal|sub-total|subtotal)[:=]?(\d+(?:\.\d{2})?)/i) || line.match(/(\d+(?:\.\d{2})?)/);
      if (match) extractedSubtotal = parseFloat(match[1]);
    }
    else if (/\biva\b/i.test(line)) {
      const match = cleanLine.match(/iva[:=]?(\d+(?:\.\d{2})?)/i) || line.match(/(\d+(?:\.\d{2})?)/);
      if (match) extractedIva = parseFloat(match[1]);
    }
    else if (/\btotal\b/i.test(line)) {
      const match = cleanLine.match(/total[:=]?(\d+(?:\.\d{2})?)/i) || line.match(/(\d+(?:\.\d{2})?)/);
      if (match) extractedTotal = parseFloat(match[1]);
    }
  }

  const computedTotal = extractedSubtotal + extractedIva;
  
  if (computedTotal > 0) {
    if (extractedTotal > 0 && Math.abs(extractedTotal - computedTotal) < 1.5) {
      monto = extractedTotal;
    } else if (extractedTotal > 0 && Math.abs((extractedTotal / 100) - computedTotal) < 1.5) {
      monto = computedTotal;
    } else if (extractedIva > 0 && extractedSubtotal > 0 && Math.abs(extractedTotal - computedTotal) > 5) {
      monto = Number(computedTotal.toFixed(2));
    } else if (extractedTotal > 0) {
      monto = extractedTotal;
    } else {
      monto = Number(computedTotal.toFixed(2));
    }
  } else {
    monto = extractedTotal;
  }

  if (monto === 0) {
    const montoRegex = /(?:total|monto|importe|pago)(?:\s+total)?\s*[:$=-]?\s*(\d+(?:\.\d{2})?)/i;
    const montoMatch = text.match(montoRegex);
    if (montoMatch) {
      monto = parseFloat(montoMatch[1]);
    } else {
      const dollarMatches = text.match(/\$\s*(\d+(?:\.\d{2})?)/g);
      if (dollarMatches) {
        const amounts = dollarMatches.map(val => parseFloat(val.replace(/[$\s]/g, '')));
        monto = Math.max(...amounts);
      }
    }
  }

  // Calculate or assign IVA
  let iva = extractedIva;
  if (!iva && monto > 0) {
    // If not found in lines, compute 16% IVA by default (Mexico standard)
    const computedIva = monto - (monto / 1.16);
    iva = Number(computedIva.toFixed(2));
  }

  // 5. Litros / Volumen
  let litrosVal: number | undefined = undefined;
  if (categoria === 'combustible') {
    const litrosRegex = /(?:litros|volumen|cantidad|lts)\s*[:=-]?\s*(\d+(?:\.\d{2,3})?)/i;
    const litrosMatch = text.match(litrosRegex);
    if (litrosMatch) {
      litros = parseFloat(litrosMatch[1]);
      litrosVal = litros;
    }

    // 6. Combustible
    const combustibleRegex = /(magna|premium|d[ií]esel|regular|s[uú]per)/i;
    const combustibleMatch = text.match(combustibleRegex);
    if (combustibleMatch) {
      const matched = combustibleMatch[1].toLowerCase();
      if (matched.includes('magna') || matched.includes('regular')) combustible = 'Magna';
      else if (matched.includes('premium') || matched.includes('super') || matched.includes('súper')) combustible = 'Premium';
      else if (matched.includes('diesel') || matched.includes('diésel')) combustible = 'Diésel';
    } else {
      combustible = 'Magna';
    }

    if (monto && litros) {
      precioPorLitro = Number((monto / litros).toFixed(2));
    }
  }

  // 7. Fecha
  const fecha4DigitRegex = /(?:\b\d{2}[-\/]\d{2}[-\/]\d{4}\b|\b\d{4}[-\/]\d{2}[-\/]\d{2}\b)/;
  let fechaMatch = text.match(fecha4DigitRegex);
  
  if (!fechaMatch) {
    for (const line of lines) {
      if (/(?:tel|fax|phone|contacto|\b\d{10}\b|\(\d{3}\))/i.test(line)) {
        continue;
      }
      if ((line.match(/-/g) || []).length > 2) {
        continue;
      }
      const match = line.match(/\b\d{2}[-\/]\d{2}[-\/]\d{2}\b/);
      if (match) {
        fechaMatch = match;
        break;
      }
    }
  }

  if (fechaMatch) {
    const rawDate = fechaMatch[0].replace(/\//g, '-');
    const parts = rawDate.split('-');
    if (parts[0].length === 4) {
      fecha = rawDate;
    } else if (parts[2].length === 4) {
      fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (parts[2].length === 2) {
      fecha = `20${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  } else {
    fecha = new Date().toISOString().split('T')[0];
  }

  const found = !!(folio || webId || monto);

  let explanation = "";
  if (found) {
    if (categoria === 'cafe') {
      explanation = "Ticket de Starbucks/Alsea detectado correctamente. Se extrajo código de facturación.";
    } else {
      explanation = "Datos de ticket de combustible extraídos localmente usando OCR y análisis de patrones.";
    }
  } else {
    explanation = "No se pudieron identificar patrones de ticket en el texto extraído.";
  }

  return {
    found,
    folio,
    webId,
    estacion: estacion || (categoria === 'cafe' ? 'Starbucks' : 'E00000'),
    monto: monto || 0,
    iva: iva || 0,
    fecha,
    combustible: categoria === 'combustible' ? (combustible || 'Magna') : undefined,
    litros: litrosVal,
    precioPorLitro: precioPorLitro || undefined,
    categoria,
    explanation
  };
}
