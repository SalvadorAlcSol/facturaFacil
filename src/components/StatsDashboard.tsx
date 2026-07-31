import React, { useState } from 'react';
import { Ticket } from '../types';
import { CreditCard, TrendingUp, CheckCircle, Clock, Calendar, Percent, ShieldCheck } from 'lucide-react';

interface StatsDashboardProps {
  tickets: Ticket[];
}

type Category = 'todas' | 'combustible' | 'cafe' | 'otros';

const CATEGORIES: { id: Category; label: string; emoji: string; color: string; activeColor: string; textColor: string }[] = [
  { id: 'todas',       label: 'Todas las Categorías', emoji: '💼', color: 'bg-slate-100 text-slate-600 border-slate-200', activeColor: 'bg-indigo-600 border-indigo-600', textColor: 'text-white' },
  { id: 'combustible', label: 'Combustible',           emoji: '⛽', color: 'bg-slate-100 text-slate-600 border-slate-200', activeColor: 'bg-orange-500 border-orange-500', textColor: 'text-white' },
  { id: 'cafe',        label: 'Café',                  emoji: '☕', color: 'bg-slate-100 text-slate-600 border-slate-200', activeColor: 'bg-amber-700 border-amber-700', textColor: 'text-white' },
  { id: 'otros',       label: 'Otros',                 emoji: '📦', color: 'bg-slate-100 text-slate-600 border-slate-200', activeColor: 'bg-slate-700 border-slate-700', textColor: 'text-white' },
];

type PeriodType = 'todos' | 'actual' | 'anterior' | 'otro';

export default function StatsDashboard({ tickets }: StatsDashboardProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('todas');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('todos');
  
  // Get date keys for current and previous month
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Extract all unique months from tickets (excluding current and previous)
  const uniqueMonths = Array.from(
    new Set(
      tickets.map(t => (t.fecha ? t.fecha.substring(0, 7) : ''))
    )
  )
    .filter(m => m !== '' && m !== currentMonthKey && m !== previousMonthKey)
    .sort((a, b) => b.localeCompare(a));

  const [customMonth, setCustomMonth] = useState<string>('');
  const activeCustomMonth = customMonth || uniqueMonths[0] || '';

  // Helper to extract or calculate IVA for a ticket
  const getTicketIva = (t: Ticket): number => {
    if (t.iva !== undefined && t.iva > 0) return t.iva;
    return Number((t.monto - (t.monto / 1.16)).toFixed(2));
  };

  const formatMonthName = (yearMonth: string) => {
    if (!yearMonth) return '';
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase());
  };

  // Filter tickets by Period
  const periodFilteredTickets = tickets.filter(t => {
    const tMonth = t.fecha ? t.fecha.substring(0, 7) : '';
    if (selectedPeriod === 'todos') return true;
    if (selectedPeriod === 'actual') return tMonth === currentMonthKey;
    if (selectedPeriod === 'anterior') return tMonth === previousMonthKey;
    if (selectedPeriod === 'otro') return tMonth === activeCustomMonth;
    return true;
  });

  // Filter tickets by active category
  const filteredTickets = activeCategory === 'todas'
    ? periodFilteredTickets
    : periodFilteredTickets.filter(t => (t.categoria || 'combustible') === activeCategory);

  // Core metrics derived from filtered tickets
  const totalSpent     = filteredTickets.reduce((acc, t) => acc + t.monto, 0);
  const totalIva       = filteredTickets.reduce((acc, t) => acc + getTicketIva(t), 0);

  const invoicedTickets = filteredTickets.filter(t => t.status === 'facturado');
  const pendingTickets  = filteredTickets.filter(t => t.status === 'pendiente');

  const invoicedAmount  = invoicedTickets.reduce((acc, t) => acc + t.monto, 0);
  const pendingAmount   = pendingTickets.reduce((acc, t) => acc + t.monto, 0);

  // IVA Acreditable: only from invoiced tickets in the selected category
  const totalIvaAcreditable = invoicedTickets.reduce((acc, t) => acc + getTicketIva(t), 0);

  // Group filtered tickets by month (for the breakdown at the bottom)
  const monthlyData = filteredTickets.reduce((acc, t) => {
    const monthKey = t.fecha ? t.fecha.substring(0, 7) : new Date().toISOString().substring(0, 7);

    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, total: 0, iva: 0, ticketCount: 0 };
    }

    acc[monthKey].total += t.monto;
    acc[monthKey].iva   += getTicketIva(t);
    acc[monthKey].ticketCount += 1;

    return acc;
  }, {} as Record<string, { month: string; total: number; iva: number; ticketCount: number }>);

  const sortedMonths = Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month));

  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activeCat = CATEGORIES.find(c => c.id === activeCategory)!;

  return (
    <div className="space-y-5">

      {/* ─── Unified Filters Card (Period & Category) ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        
        {/* Row 1: Period Selection */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4.5 h-4.5 text-indigo-650" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Período de Facturación
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedPeriod('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                selectedPeriod === 'todos'
                  ? 'bg-indigo-650 text-white shadow-md scale-[1.02]'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 hover:border-slate-300 border border-slate-200'
              }`}
            >
              Histórico (Todo)
            </button>
            <button
              onClick={() => setSelectedPeriod('actual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                selectedPeriod === 'actual'
                  ? 'bg-indigo-650 text-white shadow-md scale-[1.02]'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 hover:border-slate-300 border border-slate-200'
              }`}
            >
              Mes Actual
            </button>
            <button
              onClick={() => setSelectedPeriod('anterior')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                selectedPeriod === 'anterior'
                  ? 'bg-indigo-650 text-white shadow-md scale-[1.02]'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 hover:border-slate-300 border border-slate-200'
              }`}
            >
              Mes Anterior
            </button>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedPeriod('otro');
                  if (uniqueMonths.length > 0 && !customMonth) {
                    setCustomMonth(uniqueMonths[0]);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                  selectedPeriod === 'otro'
                    ? 'bg-indigo-650 text-white shadow-md scale-[1.02]'
                    : 'bg-slate-50 text-slate-650 hover:bg-slate-100 hover:border-slate-300 border border-slate-200'
                }`}
              >
                Otro Mes
              </button>
              
              {selectedPeriod === 'otro' && (
                <select
                  value={activeCustomMonth}
                  onChange={(e) => setCustomMonth(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-250 text-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm transition"
                >
                  {uniqueMonths.length > 0 ? (
                    uniqueMonths.map(m => (
                      <option key={m} value={m}>
                        {formatMonthName(m)}
                      </option>
                    ))
                  ) : (
                    <option value="">No hay otros meses</option>
                  )}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 my-1"></div>

        {/* Row 2: Category Filter */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
            Categoría del Gasto
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer select-none ${
                    isActive
                      ? `${cat.activeColor} ${cat.textColor} shadow-md scale-[1.02]`
                      : `${cat.color} hover:border-slate-300 hover:bg-slate-100`
                  }`}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── IVA Acreditable Hero Card ─── */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-2xl text-white shadow-md border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-white" />
            </span>
            <span className="text-xs uppercase font-black tracking-widest text-emerald-100">
              IVA Acreditable — {activeCat.emoji} {activeCat.label}
            </span>
          </div>
          <p className="text-xs text-emerald-100/80 font-sans max-w-xl">
            Suma del IVA de los tickets <strong>facturados</strong> en la categoría seleccionada, con XML oficial.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <h2 className="text-3xl font-black tracking-tight font-sans">
            ${fmt(totalIvaAcreditable)}
          </h2>
          <span className="text-[10px] uppercase font-bold text-emerald-200/90 font-mono tracking-wider">
            De {invoicedTickets.length} facturas registradas
          </span>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1.5 hover:border-slate-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gasto Total Acumulado</span>
            <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-extrabold text-slate-800 tracking-tight">${fmt(totalSpent)}</h4>
            <p className="text-[10px] text-slate-500 font-medium">Subtotal: ${fmt(totalSpent - totalIva)}</p>
          </div>
        </div>

        {/* IVA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1.5 hover:border-slate-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total IVA Pagado</span>
            <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-extrabold text-blue-700 tracking-tight">${fmt(totalIva)}</h4>
            <p className="text-[10px] text-slate-500 font-medium">Histórico (facturado + pendiente)</p>
          </div>
        </div>

        {/* Facturado */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1.5 hover:border-slate-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Monto Facturado</span>
            <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-extrabold text-emerald-700 tracking-tight">${fmt(invoicedAmount)}</h4>
            <p className="text-[10px] text-slate-500 font-medium">{invoicedTickets.length} tickets facturados</p>
          </div>
        </div>

        {/* Pendiente */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1.5 hover:border-slate-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Por Facturar</span>
            <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-extrabold text-amber-700 tracking-tight">${fmt(pendingAmount)}</h4>
            <p className="text-[10px] text-slate-500 font-medium">{pendingTickets.length} tickets pendientes</p>
          </div>
        </div>
      </div>

      {/* ─── Monthly Breakdown ─── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-none">Control de Gastos por Mes</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Desglose mensual · {activeCat.emoji} {activeCat.label}
            </p>
          </div>
        </div>

        {sortedMonths.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedMonths.map(m => {
              const subtotal = m.total - m.iva;
              return (
                <div key={m.month} className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/60 flex flex-col justify-between space-y-4 hover:border-indigo-200 transition">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-extrabold text-xs text-slate-800">{formatMonthName(m.month)}</span>
                    <span className="bg-indigo-50 text-indigo-700 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                      {m.ticketCount} {m.ticketCount === 1 ? 'ticket' : 'tickets'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Categoría</span>
                      <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                        {activeCat.emoji} {activeCat.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono">
                      <div className="bg-white p-2 rounded-lg border border-slate-150 text-center">
                        <span className="text-slate-400 block font-bold uppercase text-[7.5px] font-sans">Subtotal (Base)</span>
                        <strong className="text-slate-700 text-xs">${subtotal.toFixed(2)}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-150 text-center">
                        <span className="text-slate-400 block font-bold uppercase text-[7.5px] font-sans">IVA Traslado</span>
                        <strong className="text-blue-600 text-xs">${m.iva.toFixed(2)}</strong>
                      </div>
                      <div className="bg-indigo-900 p-2 rounded-lg text-center flex flex-col justify-center">
                        <span className="text-indigo-200 block font-bold uppercase text-[7.5px] font-sans">Total</span>
                        <strong className="text-white text-xs">${m.total.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 text-xs italic">
            No hay consumos registrados en esta categoría.
          </div>
        )}
      </div>
    </div>
  );
}
