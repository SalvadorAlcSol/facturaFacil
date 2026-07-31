import React, { useState, useRef } from 'react';
import { Upload, Camera, FileImage, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Ticket } from '../types';

interface TicketScannerProps {
  onTicketScanned: (ticket: Ticket) => void;
}

// 4 sets of demo data for tickets so they can simulate or pre-load
export const DEMO_TICKETS = [
  {
    name: 'Ticket Ferchegas Xalapa (Magna - $500.00)',
    data: {
      found: true,
      folio: 'FCX-9281729',
      webId: '8XHGJ7A',
      estacion: 'E04518 - Ferchegas Xalapa Centro',
      monto: 500.00,
      iva: 68.97,
      fecha: new Date().toISOString().split('T')[0],
      combustible: 'Magna',
      litros: 21.36,
      precioPorLitro: 23.40,
      categoria: 'combustible' as const,
      explanation: 'Ticket escaneado de prueba con combustible Magna. ID de internet detectado con éxito.',
    }
  },
  {
    name: 'Ticket Ferchegas Coatepec (Premium - $950.00)',
    data: {
      found: true,
      folio: 'FC-1182740-A',
      webId: '3PTY92Q',
      estacion: 'E05280 - Ferchegas Coatepec',
      monto: 950.00,
      iva: 131.03,
      fecha: new Date().toISOString().split('T')[0],
      combustible: 'Premium',
      litros: 38.30,
      precioPorLitro: 24.80,
      categoria: 'combustible' as const,
      explanation: 'Factura Premium simulada. Lectura correcta de la estación Coatepec.',
    }
  },
  {
    name: 'Ticket Estación El Tronconal (Diésel - $1,200.00)',
    data: {
      found: true,
      folio: 'FT-309192',
      webId: 'K9W2ML1',
      estacion: 'E02540 - Ferchegas El Tronconal',
      monto: 1200.00,
      iva: 165.52,
      fecha: new Date().toISOString().split('T')[0],
      combustible: 'Diésel',
      litros: 48.78,
      precioPorLitro: 24.60,
      categoria: 'combustible' as const,
      explanation: 'Carga de Diésel en estación Tronconal. Web ID verificado.',
    }
  },
  {
    name: 'Ticket Starbucks Xalapa (Café - $154.00)',
    data: {
      found: true,
      folio: '30491',
      webId: '3948102938475612', // 16-digit Alsea billing code
      estacion: 'Starbucks Xalapa Centro',
      monto: 154.00,
      iva: 21.24,
      fecha: new Date().toISOString().split('T')[0],
      combustible: '',
      litros: undefined,
      precioPorLitro: undefined,
      categoria: 'cafe' as const,
      explanation: 'Ticket de Starbucks (Alsea) detectado correctamente. Se extrajo el código de facturación de 16 dígitos para facturar en el portal de Alsea.',
    }
  }
];

export default function TicketScanner({ onTicketScanned }: TicketScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor carga únicamente imágenes de tickets (PNG o JPG).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result as string;

        try {
          const response = await fetch('/api/analyze-ticket', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image,
              mimeType: file.type,
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'No se pudo procesar la imagen.');
          }

          const parsed = await response.json();

          if (!parsed.found) {
            setError(
              parsed.explanation || 'No pudimos reconocer un ticket de gasolina en esta foto. Intenta con otra imagen más clara o usa una de nuestras demos.'
            );
            setLoading(false);
            return;
          }

          const newTicket: Ticket = {
            id: Date.now().toString(),
            fileName: file.name,
            fileData: base64Image,
            folio: parsed.folio || '',
            webId: parsed.webId || '',
            estacion: parsed.estacion || '',
            monto: Number(parsed.monto) || 0,
            iva: parsed.iva !== undefined ? Number(parsed.iva) : undefined,
            fecha: parsed.fecha || new Date().toISOString().split('T')[0],
            combustible: parsed.combustible || 'Magna',
            litros: parsed.litros ? Number(parsed.litros) : undefined,
            precioPorLitro: parsed.precioPorLitro ? Number(parsed.precioPorLitro) : undefined,
            explanation: parsed.explanation || '',
            status: 'pendiente',
            categoria: parsed.categoria || 'combustible',
            driveUrl: parsed.driveUrl,
          };

          onTicketScanned(newTicket);
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Error en el servidor de análisis de imagen de Gemini.');
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        throw new Error('Error de lectura de archivo local.');
      };
    } catch (err: any) {
      setError(err.message || 'No se pudo preparar la imagen.');
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const triggerDemo = (demo: typeof DEMO_TICKETS[0]) => {
    const fakeTicket: Ticket = {
      id: `demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fileName: `demo_${demo.data.categoria}_${(demo.data.combustible || 'starbucks').toLowerCase()}.png`,
      folio: demo.data.folio,
      webId: demo.data.webId,
      estacion: demo.data.estacion,
      monto: demo.data.monto,
      iva: demo.data.iva,
      fecha: demo.data.fecha,
      combustible: demo.data.combustible,
      litros: demo.data.litros,
      precioPorLitro: demo.data.precioPorLitro,
      categoria: demo.data.categoria,
      explanation: `${demo.data.explanation} (Muestra simulada, puedes usarla para probar el flujo de copiado y simulación de facturación).`,
      status: 'pendiente',
    };
    onTicketScanned(fakeTicket);
  };

  return (
    <div className="space-y-5">
      <div
        id="ticket-dropzone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-200 overflow-hidden ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50/40 scale-[0.99] shadow-inner'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />

        {loading ? (
          <div className="my-6 flex flex-col items-center text-center space-y-4">
            <div className="z-10 bg-white p-4 rounded-xl shadow-md border border-slate-100 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-800 text-sm">Procesando Ticket con IA...</p>
              <p className="text-xs text-slate-400 max-w-sm font-sans">
                Extrayendo Folio, Web ID de Ferchegas & Montos en tiempo real.
              </p>
            </div>
            {/* Elegant active progress line from design instructions */}
            <div className="absolute bottom-0 left-0 h-1 bg-indigo-600 w-full animate-pulse"></div>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center space-y-3 p-2">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-1">
              <Upload className="w-8 h-8 text-slate-400" />
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={onButtonClick}
                className="font-bold text-slate-800 hover:text-indigo-600 transition text-sm focus:outline-none cursor-pointer"
              >
                Subir fotografía de ticket
              </button>
              <span className="text-slate-400 text-xs font-medium"> o arrastrar y soltar archivo</span>
              <p className="text-[11px] text-slate-400 font-sans">Soporta formatos JPG o PNG de cualquier ticket de carga</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onButtonClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200/60 border border-slate-250 rounded-lg text-xs font-bold text-slate-700 transition shadow-sm cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-slate-400" /> Capturar Foto
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-150 flex items-start gap-2 max-w-md">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="font-semibold text-left leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            ¿Sin ticket físico? Haz clic para simular carga:
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEMO_TICKETS.map((demo, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => triggerDemo(demo)}
              disabled={loading}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100/80 active:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 text-left transition cursor-pointer truncate"
            >
              <FileImage className="w-3.5 h-3.5 text-slate-400 inline-block mr-1.5 shrink-0" />
              {demo.data.combustible} (${demo.data.monto})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
