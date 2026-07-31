import React, { useState, useEffect } from 'react';
import { Ticket, DatosFacturacion } from './types';
import TicketScanner from './components/TicketScanner';
import { 
  supabase, 
  mapPostgresToTicket, 
  mapTicketToPostgres, 
  mapPostgresToProfile, 
  mapProfileToPostgres 
} from './lib/supabase';
import TicketDetail from './components/TicketDetail';
import StatsDashboard from './components/StatsDashboard';
import DatosProfile from './components/DatosProfile';
import { 
  Fuel, 
  Receipt, 
  PlusCircle, 
  FileText, 
  User, 
  Settings, 
  Sparkles, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter, 
  Maximize2,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  RefreshCw,
  Loader2
} from 'lucide-react';

const INITIAL_MOCK_TICKETS: Ticket[] = [
  {
    id: 'demo-1',
    fileName: 'ticket_magna_1.jpg',
    folio: 'FCX-4819283',
    webId: '9WJK8TR',
    estacion: 'E04518 - Ferchegas Xalapa Centro',
    monto: 450.00,
    iva: 62.07,
    fecha: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
    combustible: 'Magna',
    litros: 19.23,
    precioPorLitro: 23.40,
    explanation: 'Ticket escaneado correctamente. Magna de la sucursal Centro de Xalapa.',
    status: 'pendiente',
    categoria: 'combustible',
  },
  {
    id: 'demo-2',
    fileName: 'ticket_premium_2.jpg',
    folio: 'FC-9918230',
    webId: '3PLM9A4',
    estacion: 'E05280 - Ferchegas Coatepec',
    monto: 850.50,
    iva: 117.31,
    fecha: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 12 days ago
    combustible: 'Premium',
    litros: 34.30,
    precioPorLitro: 24.80,
    explanation: 'Lectura correcta del ticket de Coatepec. Combustible de tipo Premium.',
    status: 'facturado',
    cfdiFolio: 'A-9818A-COA',
    fechaFacturacion: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    categoria: 'combustible',
  }
];

const DEFAULT_DATOS_FISCALES: DatosFacturacion = {
  rfc: 'ALSF900508MX9',
  razonSocial: 'FRANCISCO ALCANTARA SOSA',
  regimenFiscal: '612', // Personas Físicas con Actividades Empresariales
  codigoPostal: '91000',
  usoCFDI: 'G03', // Gastos en general
  email: 's.alcantara90@gmail.com',
  codigoCliente: '184920',
};

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [datosFacturacion, setDatosFacturacion] = useState<DatosFacturacion>(DEFAULT_DATOS_FISCALES);
  
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tickets' | 'perfil'>('tickets');
  
  // Filtering and searching keys
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'facturado'>('todos');
  const [driveStatus, setDriveStatus] = useState<{ configured: boolean; serviceAccountEmail?: string; error?: string }>({ configured: false });
  const [isSyncingInvoices, setIsSyncingInvoices] = useState(false);

  // Helper to save tickets to localStorage without heavy base64 image data (fileData)
  const saveTicketsToLocalStorage = (ticketsList: Ticket[]) => {
    try {
      const sanitized = ticketsList.map(({ fileData, ...rest }) => rest);
      localStorage.setItem('asistente_gas_tickets', JSON.stringify(sanitized));
    } catch (err) {
      console.error("Error writing tickets to localStorage:", err);
    }
  };

  // Load state from Supabase Cloud on mount
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Load Profile from Supabase
      let profileLoaded = false;
      try {
        const { data, error } = await supabase.from('profile').select('*').eq('id', 'default').maybeSingle();
        if (data && !error) {
          const profile = mapPostgresToProfile(data);
          setDatosFacturacion(profile);
          profileLoaded = true;
          // Sync profile to local server backup (optional, just in case)
          fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile })
          }).catch(e => console.error("Error syncing profile to local server", e));
        }
      } catch (err) {
        console.warn("Could not load profile from Supabase, using cache:", err);
      }

      if (!profileLoaded) {
        const cachedProfile = localStorage.getItem('asistente_gas_profile');
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            setDatosFacturacion(parsed);
            // Sync back to server
            fetch("/api/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profile: parsed })
            }).catch(e => console.error("Error syncing profile to server", e));
          } catch (e) {
            console.error("Error parsing stored profile", e);
          }
        } else {
          // Sync default profile to server
          fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: DEFAULT_DATOS_FISCALES })
          }).catch(e => console.error("Error syncing default profile to server", e));
        }
      }

      // 2. Load Tickets from Supabase
      let ticketsLoaded = false;
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false });
        if (data && !error) {
          const parsedTickets = data.map(mapPostgresToTicket);
          setTickets(parsedTickets);
          ticketsLoaded = true;
          // Overwrite cache with sanitized tickets to free up any exceeded localStorage quota
          saveTicketsToLocalStorage(parsedTickets);
          // Sync tickets to local server backup
          fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickets: parsedTickets })
          }).catch(e => console.error("Error syncing tickets to local server", e));
        }
      } catch (err) {
        console.warn("Could not load tickets from Supabase, using cache:", err);
      }

      if (!ticketsLoaded) {
        const cachedTickets = localStorage.getItem('asistente_gas_tickets');
        if (cachedTickets) {
          try {
            const parsed = JSON.parse(cachedTickets);
            setTickets(parsed);
            // Sync to server
            fetch("/api/tickets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tickets: parsed })
            }).catch(e => console.error("Error syncing cached tickets to server", e));
          } catch (e) {
            console.error("Error parsing stored tickets", e);
            setTickets(INITIAL_MOCK_TICKETS);
          }
        } else {
          setTickets(INITIAL_MOCK_TICKETS);
          saveTicketsToLocalStorage(INITIAL_MOCK_TICKETS);
          // Sync default tickets to server
          fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickets: INITIAL_MOCK_TICKETS })
          }).catch(e => console.error("Error syncing initial tickets to server", e));
        }
      }
    };

    loadInitialData();
  }, []);

  // Poll Google Drive status
  useEffect(() => {
    const checkDriveStatus = async () => {
      try {
        const res = await fetch("/api/drive-status");
        if (res.ok) {
          const data = await res.json();
          setDriveStatus(data);
        }
      } catch (err) {
        console.error("Error fetching Google Drive status:", err);
      }
    };
    checkDriveStatus();
  }, [activeTab]);

  const handleSaveTickets = (updatedTickets: Ticket[]) => {
    setTickets(updatedTickets);
    saveTicketsToLocalStorage(updatedTickets);
    
    // Save to server
    fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickets: updatedTickets })
    }).catch(err => console.error("Error saving tickets to server:", err));
  };

  const handleTicketScanned = async (newTicket: Ticket) => {
    const updated = [newTicket, ...tickets];
    setTickets(updated);
    saveTicketsToLocalStorage(updated);
    setSelectedTicketId(newTicket.id);

    // Sync to local server backup
    fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickets: updated })
    }).catch(err => console.error("Error saving tickets to local server:", err));

    // Save to Supabase Cloud
    try {
      const { error } = await supabase.from('tickets').insert(mapTicketToPostgres(newTicket));
      if (error) throw error;
    } catch (e) {
      console.error("Error saving ticket to Supabase:", e);
    }
  };

  const handleUpdateTicket = async (updatedTicket: Ticket) => {
    const updated = tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t));
    setTickets(updated);
    saveTicketsToLocalStorage(updated);

    // Sync to local server backup
    fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickets: updated })
    }).catch(err => console.error("Error saving tickets to local server:", err));

    // Update in Supabase Cloud
    try {
      const { error } = await supabase
        .from('tickets')
        .update(mapTicketToPostgres(updatedTicket))
        .eq('id', updatedTicket.id);
      if (error) throw error;
    } catch (e) {
      console.error("Error updating ticket in Supabase:", e);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const updated = tickets.filter((t) => t.id !== ticketId);
    setTickets(updated);
    saveTicketsToLocalStorage(updated);
    setSelectedTicketId(null);

    // Sync to local server backup
    fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickets: updated })
    }).catch(err => console.error("Error saving tickets to local server:", err));

    // Delete from Supabase Cloud
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
      if (error) throw error;
    } catch (e) {
      console.error("Error deleting ticket from Supabase:", e);
    }
  };

  const handleSaveProfile = async (newProfile: DatosFacturacion) => {
    setDatosFacturacion(newProfile);
    localStorage.setItem('asistente_gas_profile', JSON.stringify(newProfile));

    // Save to local server
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: newProfile })
    }).catch(err => console.error("Error saving profile to server:", err));

    // Save to Supabase Cloud (upsert)
    try {
      const { error } = await supabase.from('profile').upsert(mapProfileToPostgres(newProfile));
      if (error) throw error;
    } catch (e) {
      console.error("Error saving profile to Supabase:", e);
    }
  };

  const handleSyncInvoices = async () => {
    setIsSyncingInvoices(true);
    try {
      const response = await fetch("/api/sync-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datosFacturacion })
      });
      if (!response.ok) {
        let errorMsg = "Falla en la sincronización.";
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch (parseErr) {
          try {
            const textText = await response.text();
            if (textText) errorMsg = textText;
          } catch (textErr) {}
        }
        throw new Error(errorMsg);
      }
      const result = await response.json();
      alert(`Sincronización completada.\nFacturas procesadas: ${result.processedCount}\nFacturas emparejadas con éxito: ${result.matchedCount}`);
      
      // Reload tickets from Supabase Cloud
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (data && !error) {
        const parsedTickets = data.map(mapPostgresToTicket);
        setTickets(parsedTickets);
        saveTicketsToLocalStorage(parsedTickets);
        
        // Also sync local backup
        fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickets: parsedTickets })
        }).catch(e => console.error("Error syncing tickets local copy", e));
      }
    } catch (err: any) {
      alert(`Error en la sincronización: ${err.message || err}`);
    } finally {
      setIsSyncingInvoices(false);
    }
  };

  // Filtered ticket listing
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch = 
      t.estacion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.webId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  return (
    <div id="gas-facturacion-app" className="min-h-screen lg:h-screen lg:overflow-hidden bg-slate-50 text-slate-800 flex flex-col lg:flex-row font-sans selection:bg-slate-900 selection:text-white">
      
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800 select-none">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-indigo-900/40">
            F
          </div>
          <div>
            <span className="text-base font-bold tracking-tight block text-white leading-tight">Facturamatic</span>
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Asistente Inteligente</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          <button
            onClick={() => { setActiveTab('tickets'); setSelectedTicketId(null); }}
            className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            Mis Tickets
          </button>
          
          <button
            onClick={() => setActiveTab('perfil')}
            className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'perfil'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            Datos Fiscales
          </button>
        </nav>

        {/* Sidebar Footer Account Details */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/20 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs select-none">
              {(datosFacturacion.rfc || 'U').substring(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-xs text-slate-200 truncate">{datosFacturacion.razonSocial || 'Usuario Pro'}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">{datosFacturacion.rfc || 'Sin RFC'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-extrabold text-white text-sm">F</div>
          <span className="font-bold text-sm tracking-tight text-white leading-none">Facturamatic</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('tickets'); setSelectedTicketId(null); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'tickets' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            } cursor-pointer`}
          >
            Tickets
          </button>
          <button
            onClick={() => setActiveTab('perfil')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'perfil' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            } cursor-pointer`}
          >
            Fiscal
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-full lg:overflow-hidden bg-slate-50">
        {/* Workspace dynamic header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:px-8 border-b border-slate-200/60 bg-white shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">
              {activeTab === 'tickets' ? 'Proceso de Facturación' : 'Configuración de Datos Fiscales'}
            </h1>
            <p className="text-xs text-slate-500 font-sans">
              {activeTab === 'tickets' 
                ? 'Identifica datos clave mediante Inteligencia Artificial y asiste en su facturación.'
                : 'Configura tus credenciales del SAT para rellenar con un solo toque los formularios oficiales.'
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {driveStatus.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-750 border border-indigo-200 rounded-full text-xs font-semibold" title={`Conectado como: ${driveStatus.serviceAccountEmail}`}>
                <span className="w-2 h-2 bg-indigo-650 rounded-full animate-pulse"></span>
                Drive Conectado 🟢
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-250 rounded-full text-xs font-semibold" title="Drive requiere configuración en la pestaña Datos Fiscales">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Drive Desconectado 🟡
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Portal FercheGas Activo
            </span>

            <button
              onClick={handleSyncInvoices}
              disabled={isSyncingInvoices}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full text-xs font-bold transition shadow-sm cursor-pointer select-none border border-indigo-550"
            >
              {isSyncingInvoices ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Obtener Facturas
                </>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable scroll space */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {activeTab === 'perfil' ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center sm:text-left space-y-1">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Tus Datos Fiscales de Facturación</h2>
                <p className="text-sm text-slate-500">Configura tus credenciales del SAT para agilizar el llenado en formularios externos de Ferchegas.</p>
              </div>
              <DatosProfile initialDatos={datosFacturacion} onSave={handleSaveProfile} />
            </div>
          ) : (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Stats dashboard */}
              <StatsDashboard tickets={tickets} />

              {/* Main content grid flow */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Area: Upload module & ticket log lists */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Upload box */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Carga Inteligente de Ticket</h3>
                      <p className="text-xs text-slate-500 font-sans">Sube tu fotografía y Gemini 3.5-flash identificará de manera inmediata: Folio, Web ID de seguridad de Ferchegas, Estación y Monto.</p>
                    </div>
                    <TicketScanner onTicketScanned={handleTicketScanned} />
                  </div>

                  {/* List search and box */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Historial de Combustibles</h3>
                        <p className="text-xs text-slate-500 font-sans">Busca y pulsa en cualquier ticket para iniciar el copiado inteligente.</p>
                      </div>

                      {/* Filter switches */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                        <button
                          onClick={() => setStatusFilter('todos')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-200 cursor-pointer ${
                            statusFilter === 'todos' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => setStatusFilter('pendiente')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-200 cursor-pointer ${
                            statusFilter === 'pendiente' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Pendientes
                        </button>
                        <button
                          onClick={() => setStatusFilter('facturado')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-200 cursor-pointer ${
                            statusFilter === 'facturado' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Facturados
                        </button>
                      </div>
                    </div>

                    {/* Search box overlay */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Buscar estación, folio, Web ID o monto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50/50 border border-slate-200 focus:outline-none focus:border-slate-800 hover:border-slate-350 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    {/* List listing with clean lines */}
                    {filteredTickets.length > 0 ? (
                      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                        {filteredTickets.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTicketId(t.id)}
                            className={`w-full py-3 px-3.5 rounded-xl flex items-center justify-between text-left transition duration-200 gap-3 border ${
                              selectedTicketId === t.id
                                ? 'bg-indigo-600 text-white border-transparent shadow shadow-indigo-650/30'
                                : 'hover:bg-slate-50 border-transparent text-slate-700'
                            } cursor-pointer`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5 font-sans">
                                {t.categoria === 'cafe' ? (
                                  <span className={`text-[8.5px] uppercase font-extrabold px-1.5 py-0.5 rounded leading-none ${
                                    selectedTicketId === t.id
                                      ? 'bg-amber-800 text-amber-100 border border-amber-700'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    ☕ Café
                                  </span>
                                ) : t.categoria === 'otros' ? (
                                  <span className={`text-[8.5px] uppercase font-extrabold px-1.5 py-0.5 rounded leading-none ${
                                    selectedTicketId === t.id
                                      ? 'bg-slate-700 text-slate-100 border border-slate-600'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}>
                                    📦 Otros
                                  </span>
                                ) : (
                                  <span className={`text-[8.5px] uppercase font-extrabold px-1.5 py-0.5 rounded leading-none ${
                                    selectedTicketId === t.id
                                      ? 'bg-indigo-750 text-indigo-100'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-150'
                                  }`}>
                                    ⛽ {t.combustible || 'Magna'}
                                  </span>
                                )}
                                <span className={`text-[10px] font-mono truncate font-medium ${selectedTicketId === t.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  Folio: <strong>{t.folio || 'N/D'}</strong>
                                </span>
                              </div>
                              <h4 className={`text-xs font-bold truncate ${selectedTicketId === t.id ? 'text-white' : 'text-slate-900'}`}>
                                {t.estacion || 'Estación no especificada'}
                              </h4>
                              <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-400 font-mono">
                                <span className={selectedTicketId === t.id ? 'text-indigo-200' : 'text-slate-400'}>{t.fecha}</span>
                                {t.webId && (
                                  <span className={selectedTicketId === t.id ? 'text-white font-bold' : 'text-indigo-600 font-bold uppercase'}>
                                    ID: {t.webId}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                              <span className={`text-xs font-extrabold ${selectedTicketId === t.id ? 'text-white' : 'text-slate-950 font-mono'}`}>
                                ${t.monto.toFixed(2)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider ${
                                t.status === 'facturado'
                                  ? (selectedTicketId === t.id ? 'bg-white/15 text-white border border-white/20' : 'bg-green-50 text-green-700 border border-green-150')
                                  : (selectedTicketId === t.id ? 'bg-white/10 text-white' : 'bg-amber-50 text-amber-700 border border-amber-150')
                              }`}>
                                {t.status === 'facturado' ? 'Facturado' : 'Pendiente'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-xs font-bold text-slate-700">Sin tickets coincidentes</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Intenta otra consulta o borra filtros.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Area: Dynamic Panel or Ticket guide */}
                <div className="lg:col-span-5 lg:sticky lg:top-6">
                  {selectedTicket ? (
                    <TicketDetail
                      ticket={selectedTicket}
                      datosFacturacion={datosFacturacion}
                      onUpdateTicket={handleUpdateTicket}
                      onDeleteTicket={handleDeleteTicket}
                      onClose={() => setSelectedTicketId(null)}
                    />
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Interactive welcome instruction screen */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
                        <div className="space-y-1.5">
                          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 inline-block text-indigo-600">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">GasoFact - Portal de Llenado Rápido</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-sans">
                            Saca o arrastra una foto de tu boleto físico. Analizaremos tu archivo mediante IA de Gemini en milisegundos para darte botones de copia instantánea.
                          </p>
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-4 text-xs">
                          <div className="flex gap-3">
                            <Clock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-slate-700 font-sans">Elimina capturas manuales</p>
                              <p className="text-slate-500 text-[11px]">Extraemos los códigos y las combinaciones de Web ID e ID de Internet de Ferchegas.</p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-slate-700 font-sans">Canchero y ágil (1-Click)</p>
                              <p className="text-slate-500 text-[11px]">Un panel flotante te proporciona accesos de copiado a un solo toque para acelerar tu declaración mensual.</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-250 flex items-start gap-2 text-[11px] text-slate-600 font-medium">
                          <Info className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          <span>¡Tus documentos se resguardan de forma 100% segura y local en tu navegador! Sin bases remotas públicas.</span>
                        </div>
                      </div>

                      {/* Small Quick Profile panel reference */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Perfil Fiscal Activo</span>
                          <button 
                            onClick={() => setActiveTab('perfil')}
                            className="text-indigo-600 hover:text-indigo-700 text-xs font-bold tracking-tight cursor-pointer inline-flex items-center gap-1"
                          >
                            <Settings className="w-3 h-3" /> Configurar
                          </button>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-xs">
                            <span className="text-slate-500 font-sans font-medium">Clave SAT RFC</span>
                            <span className="font-bold tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded text-[11px]">
                              {datosFacturacion.rfc || 'XAX010101000'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Razón Social</span>
                            <span className="font-bold text-slate-700 truncate max-w-[180px]">{datosFacturacion.razonSocial || 'No asignada'}</span>
                          </div>
                          {datosFacturacion.codigoCliente && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Código Cliente</span>
                              <span className="font-bold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded text-[10px]">{datosFacturacion.codigoCliente}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">C. Postal de Domicilio</span>
                            <span className="font-semibold text-slate-755 font-mono">{datosFacturacion.codigoPostal || '91000'}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>

              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
