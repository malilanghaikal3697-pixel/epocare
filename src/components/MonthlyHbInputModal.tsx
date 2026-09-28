import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  Search, 
  Calendar, 
  Check, 
  AlertCircle, 
  Droplet, 
  Syringe, 
  AlertTriangle,
  Sparkles,
  Save,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { PatientRecord, HDDaySchedule, HDShift } from '../types/dialysis';
import { calculateClinicalRecommendation } from '../services/clinicalRules';
import { getFirstHDDateOfMonth } from '../services/googleSheets';

interface MonthlyHbInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  selectedMonth: string;
  onSaveBatchHb: (updatedHbList: { id: string; hbValue: number; hbDate: string }[]) => void;
}

export const MonthlyHbInputModal: React.FC<MonthlyHbInputModalProps> = ({
  isOpen,
  onClose,
  patients,
  selectedMonth,
  onSaveBatchHb,
}) => {
  // Local state for all patients' Hb and date
  const [formData, setFormData] = useState<Record<string, { hbValue: string; hbDate: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<string>('ALL');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [onlyPending, setOnlyPending] = useState(false);
  const [bulkDate, setBulkDate] = useState(`${selectedMonth}-02`);

  // Initialize or reset form data whenever patients or modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, { hbValue: string; hbDate: string }> = {};
      patients.forEach((p) => {
        const defaultDate = getFirstHDDateOfMonth(selectedMonth, p.scheduleDay, p.singleDay, p.hdFrequency).dateString;
        initial[p.id] = {
          hbValue: p.hbValue ? String(p.hbValue) : '0',
          hbDate: p.hbDate || defaultDate,
        };
      });
      setFormData(initial);
      setBulkDate(`${selectedMonth}-02`);
    }
  }, [isOpen, patients, selectedMonth]);

  if (!isOpen) return null;

  const handleHbChange = (id: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        hbValue: value,
      },
    }));
  };

  const handleDateChange = (id: string, date: string) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        hbDate: date,
      },
    }));
  };

  const handleApplyBulkDate = () => {
    if (!bulkDate) return;
    setFormData((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[id] = {
          ...updated[id],
          hbDate: bulkDate,
        };
      });
      return updated;
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updateList: { id: string; hbValue: number; hbDate: string }[] = [];

    patients.forEach((p) => {
      const item = formData[p.id];
      if (item) {
        const rawHb = parseFloat(item.hbValue.replace(',', '.'));
        const validHb = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;
        const fallbackDate = getFirstHDDateOfMonth(selectedMonth, p.scheduleDay, p.singleDay, p.hdFrequency).dateString;
        updateList.push({
          id: p.id,
          hbValue: validHb,
          hbDate: item.hbDate || fallbackDate,
        });
      }
    });

    onSaveBatchHb(updateList);
    onClose();
  };

  // Filtered patients for editing view
  const filteredPatients = patients.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.noRm.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchedule = scheduleFilter === 'ALL' || p.scheduleDay === scheduleFilter;
    const matchesShift = shiftFilter === 'ALL' || p.scheduleShift === shiftFilter;
    
    const curVal = parseFloat(formData[p.id]?.hbValue?.replace(',', '.') || '0');
    const matchesPending = !onlyPending || (curVal <= 0 || isNaN(curVal));

    return matchesSearch && matchesSchedule && matchesShift && matchesPending;
  });

  // Calculate statistics
  let countFilled = 0;
  let countPending = 0;
  patients.forEach((p) => {
    const val = parseFloat(formData[p.id]?.hbValue?.replace(',', '.') || '0');
    if (val > 0) countFilled++;
    else countPending++;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-1 flex flex-col max-h-[85vh]">
        
        {/* Header (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Activity className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Input Nilai Hb Bulanan
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  {selectedMonth}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pembaruan terpusat hasil pemeriksaan Hb awal bulan seluruh pasien HD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Toolbar & Stats (Compact) */}
        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 space-y-2 text-xs shrink-0">
          
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative min-w-[170px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama pasien / RM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Bulk Set Date */}
            <div className="h-8 flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
              <span className="text-slate-500 font-medium text-[11px]">Tgl Serentak:</span>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer text-xs"
              />
              <button
                type="button"
                onClick={handleApplyBulkDate}
                className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 cursor-pointer transition text-[11px]"
                title="Terapkan tanggal ini ke seluruh pasien"
              >
                Terapkan
              </button>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-300/80 dark:border-emerald-800">
                ✅ Sudah: <strong>{countFilled}</strong>
              </span>
              <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold text-[10px] border border-amber-300/80 dark:border-amber-800">
                ⚠️ Belum: <strong>{countPending}</strong>
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 mr-0.5 flex items-center gap-1">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter:</span>
              </span>

              {/* Schedule Filter */}
              {(['ALL', 'Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu'] as const).map((sched) => (
                <button
                  key={sched}
                  type="button"
                  onClick={() => setScheduleFilter(sched)}
                  className={`h-7 px-2 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    scheduleFilter === sched
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sched === 'ALL' ? 'Semua Jadwal' : sched}
                </button>
              ))}

              <span className="mx-0.5 text-slate-300 dark:text-slate-700">|</span>

              {/* Shift Filter */}
              {(['ALL', 'Shift 1 (Pagi)', 'Shift 2 (Siang)'] as const).map((sh) => (
                <button
                  key={sh}
                  type="button"
                  onClick={() => setShiftFilter(sh)}
                  className={`h-7 px-2 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    shiftFilter === sh
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sh === 'ALL' ? 'Semua Shift' : sh.replace('Shift ', 'S')}
                </button>
              ))}
            </div>

            {/* Toggle Only Pending */}
            <label className="flex items-center gap-1 cursor-pointer text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-3 h-3"
              />
              <span>Belum Ada Hasil (Hb: 0)</span>
            </label>
          </div>

        </div>

        {/* 5 Panduan Protokol Klinis Berdasarkan Nilai Hb Awal Bulan (Compact Single Row) */}
        <div className="px-3 py-1 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px] shrink-0">
          <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Referensi:</span>
          </span>
          <span className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
            <strong>&lt;5.9:</strong> Ranap 2 Bag
          </span>
          <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
            <strong>6.0–6.9:</strong> 1 Bag PRC
          </span>
          <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300">
            <strong>7.0–8.9:</strong> EPO 4x
          </span>
          <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300">
            <strong>9.0–12.0:</strong> EPO 1x
          </span>
          <span className="px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-purple-800 dark:text-purple-300 font-semibold">
            <strong>&gt;12.0:</strong> Tanpa EPO
          </span>
        </div>

        {/* Form Body - Table of Patients (Compact rows) */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10 text-[11px]">
              <tr>
                <th className="py-1.5 px-2 text-center w-8">No</th>
                <th className="py-1.5 px-2">Nama Pasien & No. RM</th>
                <th className="py-1.5 px-2 w-28">Jadwal & Shift</th>
                <th className="py-1.5 px-2 w-36">Nilai Hb (g/dL)</th>
                <th className="py-1.5 px-2 w-32">Tgl Ambil Darah</th>
                <th className="py-1.5 px-2">Protokol Klinis Otomatis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <p className="text-xs font-medium">Tidak ada pasien yang sesuai filter.</p>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient, idx) => {
                  const currentHbStr = formData[patient.id]?.hbValue ?? String(patient.hbValue);
                  const currentDate = formData[patient.id]?.hbDate ?? patient.hbDate;
                  const parsedHb = parseFloat(currentHbStr.replace(',', '.'));
                  const numericHb = isNaN(parsedHb) || parsedHb < 0 ? 0 : parsedHb;
                  const reco = calculateClinicalRecommendation(numericHb);

                  return (
                    <tr 
                      key={patient.id} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                        numericHb <= 0 ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* No */}
                      <td className="py-1 px-2 text-center text-slate-400 font-mono text-[10px]">
                        {idx + 1}
                      </td>

                      {/* Nama Pasien & RM */}
                      <td className="py-1 px-2">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {patient.name}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          {patient.noRm}
                        </div>
                      </td>

                      {/* Jadwal & Shift */}
                      <td className="py-1 px-2 text-[10px]">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {patient.scheduleDay}
                        </div>
                        <div className={`font-bold ${
                          patient.scheduleShift.includes('Pagi') 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {patient.scheduleShift}
                        </div>
                      </td>

                      {/* Input Nilai Hb */}
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-1">
                          <div className="relative w-20">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="24"
                              value={currentHbStr}
                              onChange={(e) => handleHbChange(patient.id, e.target.value)}
                              placeholder="0.0"
                              className={`w-full pl-2 pr-6 py-0.5 rounded border font-mono font-bold text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-rose-500 ${
                                numericHb <= 0 
                                  ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200' 
                                  : numericHb < 6.0 
                                  ? 'border-rose-400 text-rose-700 dark:text-rose-400' 
                                  : numericHb > 12.0 
                                  ? 'border-purple-400 text-purple-700 dark:text-purple-300' 
                                  : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-400">
                              g/dL
                            </span>
                          </div>

                          {/* Quick 0 button */}
                          <button
                            type="button"
                            onClick={() => handleHbChange(patient.id, '0')}
                            className="px-1 py-0.5 text-[9px] font-bold text-slate-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition cursor-pointer"
                            title="Set nilai Hb: 0"
                          >
                            Set 0
                          </button>
                        </div>
                      </td>

                      {/* Tanggal Ambil Darah */}
                      <td className="py-1 px-2">
                        <input
                          type="date"
                          value={currentDate}
                          onChange={(e) => handleDateChange(patient.id, e.target.value)}
                          className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>

                      {/* Live Clinical Recommendation Badge */}
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${reco.badgeBg} ${reco.badgeColor} ${reco.borderColor}`}>
                            {reco.transfusionBags > 0 ? (
                              <Droplet className="w-3 h-3 fill-rose-600 text-rose-600 shrink-0" />
                            ) : reco.totalEpoVials > 0 ? (
                              <Syringe className="w-3 h-3 text-blue-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-purple-600 shrink-0" />
                            )}
                            <span className="truncate max-w-[200px]" title={reco.title}>
                              {reco.title}
                            </span>
                          </span>

                          <span className="text-[9px] text-slate-400 hidden xl:inline truncate max-w-[140px]">
                            {reco.doseDescription}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </form>

        {/* Footer Actions (Pinned) */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
            * Dosis & alokasi EPO dihitung otomatis dari nilai Hb awal bulan.
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8.5 px-3 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 font-medium text-xs transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="h-8.5 inline-flex items-center gap-1.5 px-4 rounded-lg text-white font-semibold text-xs bg-rose-700 hover:bg-rose-800 active:bg-rose-900 shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Nilai Hb ({patients.length} Pasien)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
