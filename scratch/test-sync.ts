import { syncInvoicesReal } from "../src/rpa-automator";

const mockDatos = {
  rfc: "AASS900714FG9",
  razonSocial: "SALVADOR ALCANTARA SOLORZANO",
  regimenFiscal: "626",
  codigoPostal: "91500",
  usoCFDI: "G03",
  email: "s.alcantara@live.com.mx",
  codigoCliente: "22309938"
};

async function test() {
  console.log("Starting syncInvoicesReal test...");
  try {
    const result = await syncInvoicesReal(mockDatos);
    console.log("Result:", result);
  } catch (err: any) {
    console.error("Error during sync:", err.stack || err);
  }
}

test();
