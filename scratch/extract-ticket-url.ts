import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No se encontró la GEMINI_API_KEY en el archivo .env.");
    return;
  }

  const imagePath = "C:\\Users\\salca\\.gemini\\antigravity\\brain\\3f8808bf-d44d-47ec-9e07-dec7a1b8914f\\media__1780429156084.jpg";
  if (!fs.existsSync(imagePath)) {
    console.error(`La imagen no existe en la ruta: ${imagePath}`);
    return;
  }

  console.log("Inicializando cliente de Gemini...");
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  console.log("Leyendo archivo de imagen y convirtiendo a base64...");
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const prompt = `Analiza detalladamente esta imagen de ticket de gasolina.
Lee y extrae TODO el texto impreso en él.
Presta especial atención a:
1. Cualquier enlace web (URL), dirección IP, o dominio (ejemplo: .com, .com.mx, .ddns.net).
2. Instrucciones de facturación o frases como "Facturar en:", "Web para facturar", "Portal:", etc.
3. El número de estación, folio, y WebID para confirmar que coincidan.
Escribe el texto completo extraído y luego haz un resumen de los enlaces o sitios web detectados.`;

  try {
    console.log("Enviando petición a Gemini 3.5 Flash...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        },
        prompt,
      ],
    });

    console.log("\n=== RESPUESTA DE GEMINI ===");
    console.log(response.text);
    console.log("===========================");
  } catch (error: any) {
    console.error("Error al llamar a la API de Gemini:", error.message || error);
  }
}

main();
