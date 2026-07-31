import React, { useState, useEffect } from 'react';
import { DatosFacturacion, REGIMENES_FISCALES, USOS_CFDI } from '../types';
import { Save, Check, Award, Shield, Cloud, Copy, FileJson, AlertTriangle } from 'lucide-react';

interface DatosProfileProps {
  onSave: (datos: DatosFacturacion) => void;
  initialDatos?: DatosFacturacion;
}

export default function DatosProfile({ onSave, initialDatos }: DatosProfileProps) {
  const defaultDatos: DatosFacturacion = {
    rfc: '',
    razonSocial: '',
    regimenFiscal: '601',
    codigoPostal: '',
    usoCFDI: 'G03',
    email: '',
    codigoCliente: '',
  };

  const [datos, setDatos] = useState<DatosFacturacion>(initialDatos || defaultDatos);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initialDatos) {
      setDatos(initialDatos);
    }
  }, [initialDatos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Auto capitalize RFC
    const finalValue = name === 'rfc' ? value.toUpperCase() : value;
    setDatos((prev) => ({ ...prev, [name]: finalValue }));
    setSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!datos.rfc) return;
    onSave(datos);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div id="p-datos-fiscales" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-lg text-slate-800">Datos Fiscales Predeterminados</h3>
          <p className="text-sm text-slate-500">Se usarán para facilitar el copiado al facturar tus tickets.</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg">
          <Shield className="w-5 h-5 text-slate-600" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              RFC (12 o 13 caracteres)
            </label>
            <input
              type="text"
              name="rfc"
              maxLength={13}
              value={datos.rfc}
              onChange={handleChange}
              placeholder="XAXX010101000"
              required
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition uppercase font-mono font-bold tracking-wider"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              Nombre o Razón Social
            </label>
            <input
              type="text"
              name="razonSocial"
              value={datos.razonSocial}
              onChange={handleChange}
              placeholder="Juan Pérez Domínguez o Empresa S.A."
              required
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              Régimen Fiscal (SAT)
            </label>
            <select
              name="regimenFiscal"
              value={datos.regimenFiscal}
              onChange={handleChange}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition"
            >
              {REGIMENES_FISCALES.map((reg) => (
                <option key={reg.code} value={reg.code}>
                  {reg.code} - {reg.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              Uso del CFDI (SAT)
            </label>
            <select
              name="usoCFDI"
              value={datos.usoCFDI}
              onChange={handleChange}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition"
            >
              {USOS_CFDI.map((uso) => (
                <option key={uso.code} value={uso.code}>
                  {uso.code} - {uso.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              Código Postal
            </label>
            <input
              type="text"
              name="codigoPostal"
              maxLength={5}
              value={datos.codigoPostal}
              onChange={handleChange}
              placeholder="91000"
              required
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition font-mono font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              Código de Cliente Ferchegas (Opcional)
            </label>
            <input
              type="text"
              name="codigoCliente"
              value={datos.codigoCliente || ''}
              onChange={handleChange}
              placeholder="Ej. FC-48293 o 184920"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition font-mono font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              Email para recibir factura
            </label>
            <input
              type="email"
              name="email"
              value={datos.email}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              required
              className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-800 transition"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              saved
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-900 border border-transparent text-white hover:bg-slate-800 active:bg-slate-950 cursor-pointer'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" /> Guardado Correctamente
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>

      {/* Google Drive Configuration Card */}
      <GoogleDriveSettings />
    </div>
  );
}

function GoogleDriveSettings() {
  const [driveStatus, setDriveStatus] = useState<{ configured: boolean; serviceAccountEmail?: string; error?: string }>({ configured: false });
  const [jsonInput, setJsonInput] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/drive-status');
      if (res.ok) {
        const data = await res.json();
        setDriveStatus(data);
      }
    } catch (e) {
      console.error('Error querying drive status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyEmail = () => {
    if (!driveStatus.serviceAccountEmail) return;
    navigator.clipboard.writeText(driveStatus.serviceAccountEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonInput.trim()) return;

    setSavingStatus('saving');
    setErrorMessage('');

    try {
      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonInput);
      } catch (jsonErr) {
        throw new Error('El texto ingresado no es un JSON válido. Asegúrate de copiar el archivo completo.');
      }

      const res = await fetch('/api/save-drive-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: parsedJson }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar las credenciales en el servidor.');
      }

      const data = await res.json();
      setDriveStatus(data);
      setSavingStatus('success');
      setJsonInput('');
      setTimeout(() => setSavingStatus('idle'), 3000);
    } catch (err: any) {
      setSavingStatus('error');
      setErrorMessage(err.message || 'Error desconocido.');
    }
  };

  return (
    <div id="drive-integration-settings" className="mt-8 pt-6 border-t border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base text-slate-800 flex items-center gap-1.5">
            <Cloud className="w-5 h-5 text-indigo-650" />
            Integración Automática con Google Drive
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Sincroniza tus tickets escaneados y facturas XML/PDF automáticamente.</p>
        </div>
        <div>
          {driveStatus.configured ? (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 text-[10px] font-bold rounded-full uppercase">
              Conectado 🟢
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-250 text-[10px] font-bold rounded-full uppercase">
              Opcional 🟡
            </span>
          )}
        </div>
      </div>

      {driveStatus.configured ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-sans">
          <div className="text-xs text-slate-700 space-y-1.5">
            <p className="font-bold text-slate-800">¡Conexión establecida exitosamente!</p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Las facturas emitidas y las fotos de los tickets se guardarán automáticamente en la carpeta compartida:<br />
              <a 
                href="https://drive.google.com/drive/folders/1V56mnluC7pcuZDzJUvV_gRrqWjFVmKGX" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline font-semibold break-all"
              >
                https://drive.google.com/drive/folders/1V56mnluC7pcuZDzJUvV_gRrqWjFVmKGX ↗
              </a>
            </p>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2.5">
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Correo de la Cuenta de Servicio</span>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="text"
                  readOnly
                  value={driveStatus.serviceAccountEmail || ''}
                  className="flex-1 px-3 py-1.5 border border-slate-200 bg-white font-mono text-[11px] font-medium text-slate-700 rounded-lg focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    copiedEmail ? 'bg-emerald-50 text-emerald-600 border border-emerald-250' : 'bg-slate-200 hover:bg-slate-350 text-slate-700'
                  }`}
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedEmail ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-lg text-[10.5px] text-indigo-750 leading-relaxed">
              <strong>Importante:</strong> Asegúrate de invitar al correo de arriba como <strong>"Editor"</strong> a la carpeta compartida en tu Google Drive para que el bot tenga permisos de subir los archivos.
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4.5 space-y-4">
          <div className="text-xs text-slate-650 space-y-2 leading-relaxed font-sans">
            <p className="font-bold text-slate-800">¿Cómo conectar Google Drive?</p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-550">
              <li>Entra a la consola de Google Cloud (IAM & Admin) y crea un proyecto.</li>
              <li>Habilita la API de Google Drive para ese proyecto.</li>
              <li>Crea una cuenta de servicio (Service Account), genera una nueva clave en formato **JSON** y descárgala.</li>
              <li>Pega el contenido completo del archivo JSON descargado en el cuadro de abajo.</li>
            </ol>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-3">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Contenido del JSON de Credenciales (google-credentials.json)
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", ... }'
                className="w-full h-32 px-3 py-2 border border-slate-200 bg-white font-mono text-[10px] text-slate-700 rounded-lg focus:outline-none focus:border-indigo-600 transition"
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold leading-normal flex items-start gap-1.5 select-none">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingStatus === 'saving'}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                  savingStatus === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-250'
                    : 'bg-indigo-650 hover:bg-indigo-700 text-white'
                }`}
              >
                <FileJson className="w-4 h-4 shrink-0" />
                {savingStatus === 'saving' ? 'Guardando...' : savingStatus === 'success' ? 'Credenciales Configuradas' : 'Guardar y Vincular Drive'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
