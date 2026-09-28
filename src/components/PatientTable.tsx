import React, { useState } from 'react';
import { 
  Search, 
  Calendar, 
  Edit3, 
  Trash2, 
  Check, 
  Clock, 
  X, 
  AlertCircle, 
  Syringe, 
  Droplet, 
  ChevronDown, 
  Table as TableIcon,
  LayoutGrid,
  Layers,
  Sparkles,
  Info,
  Sun,
  Sunset,
  Moon,
  ClipboardPaste,
  Plus,
  Users,
  ArrowUpFromLine,
  RefreshCw
} from 'lucide-react';
import { PatientRecord, DoseStatus, HDDaySchedule, HDShift } from '../types/dialysis';
import { 
  getMonthDaysInfo, 
  isDateInHDDay, 
  isPrimaryHDDay, 
  isPatientHbCheckDay, 
  getHDSessionWeek,
  getPairedHDDate,
  getDateDoseDisplayInfo,
  DateDoseInfo
} from '../services/googleSheets';

interface PatientTableProps {
  patients: PatientRecord[];
  selectedMonth: string;
  onEditPatient: (patient: PatientRecord) => void;
  onDeletePatient: (patientId: string) => void;
  onUpdateWeekStatus: (
    patientId: string, 
    weekKey: 'week1' | 'week2' | 'week3' | 'week4', 
    newStatus: DoseStatus,
    nurseName?: string
  ) => void;
  onUpdateDateAction?: (
    patientId: string,
    dateNumber: number,
    newStatus: DoseStatus,
    nurseName?: string,
    notes?: string
  ) => void;
  onOpenBulkImportModal?: () => void;
  onOpenAddPatientModal?: () => void;
  onPushToSheet?: (targetSchedule?: HDDaySchedule) => Promise<void>;
  isSyncing?: boolean;
}

export const PatientTable: React.FC<PatientTableProps> = ({
  patients,
  selectedMonth,
  onEditPatient,
  onDeletePatient,
  onUpdateWeekStatus,
  onUpdateDateAction,
  onOpenBulkImportModal,
  onOpenAddPatientModal,
  onPushToSheet,
  isSyncing = false,
}) => {
  // Aktif Sheet Tab: 'Senin - Kamis' | 'Selasa - Jumat' | 'Rabu - Sabtu' | 'ALL'
  const [activeSheetTab, setActiveSheetTab] = useState<HDDaySchedule | 'ALL'>('Senin - Kamis');
  const [viewMode, setViewMode] = useState<'matrix' | 'weekly'>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');

  // Menu Popup Cepat saat Tombol Sel Diklik (Cukup klik tombol saja, tanpa halaman modal)
  const [quickMenuData, setQuickMenuData] = useState<{
    patient: PatientRecord;
    dateNumber: number;
    info: DateDoseInfo;
    x: number;
    y: number;
  } | null>(null);

  const handleCellClick = (
    patient: PatientRecord,
    dateNumber: number,
    info: DateDoseInfo,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popoverWidth = 230;
    let x = rect.left;
    if (x + popoverWidth > window.innerWidth - 16) {
      x = window.innerWidth - popoverWidth - 16;
    }
    if (x < 16) x = 16;
    let y = rect.bottom + 6;
    if (y + 160 > window.innerHeight) {
      y = Math.max(16, rect.top - 150);
    }
    setQuickMenuData({ patient, dateNumber, info, x, y });
  };

  // Helper untuk rendering badge status alokasi 4 minggu
  const renderWeekBadge = (week: { status: DoseStatus; administeredAt?: string; administeredBy?: string; notes?: string }) => {
    if (week.status === 'Diberikan') {
      return (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
          title={`✅ = EPO Diberikan${week.administeredAt ? ' (' + week.administeredAt + ')' : ''}${week.notes ? ' • ' + week.notes : ''}`}
        >
          <span>✅</span>
          <span>EPO Diberikan</span>
        </span>
      );
    }
    if (week.status === 'Tunda') {
      return (
        <span 
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700"
          title={week.notes || '❌ = Ditunda (Ke Hari Ke-2)'}
        >
          <span className="w-3.5 h-3.5 rounded bg-red-600 text-white flex items-center justify-center font-black text-[9px] leading-none border border-white">✕</span>
          <span>Ditunda (Ke Hari Ke-2)</span>
        </span>
      );
    }
    if (week.status === 'Batal') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-300">
          Batal
        </span>
      );
    }
    if (week.status === 'Belum') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          2000 (Terjadwal EPO)
        </span>
      );
    }
    return (
      <span className="text-[10px] text-slate-400 dark:text-slate-600">
        -
      </span>
    );
  };

  const monthInfo = getMonthDaysInfo(selectedMonth);

  // Filter Pasien (Hanya Shift 1 Pagi dan Shift 2 Siang)
  const filteredPatients = patients.filter((patient) => {
    const matchesSheet = activeSheetTab === 'ALL' || patient.scheduleDay === activeSheetTab;
    const matchesSearch = 
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.noRm.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesShift = selectedShiftFilter === 'ALL' || patient.scheduleShift === selectedShiftFilter;

    return matchesSheet && matchesSearch && matchesShift;
  });

  // Pisahkan Pasien Berdasarkan Shift (Hanya Shift 1 Pagi & Shift 2 Siang)
  const pagiPatients = filteredPatients.filter((p) => p.scheduleShift.includes('Pagi'));
  const siangPatients = filteredPatients.filter((p) => p.scheduleShift.includes('Siang'));

  // Pasien pada sheet aktif saat ini (untuk badge tombol pilihan shift)
  const currentSheetPatients = patients.filter((p) => activeSheetTab === 'ALL' || p.scheduleDay === activeSheetTab);
  const countCurrentSheetPagi = currentSheetPatients.filter((p) => p.scheduleShift.includes('Pagi')).length;
  const countCurrentSheetSiang = currentSheetPatients.filter((p) => p.scheduleShift.includes('Siang')).length;

  // Hitung jumlah pasien per sheet untuk badge tab
  const countSeninKamis = patients.filter((p) => p.scheduleDay === 'Senin - Kamis').length;
  const countSelasaJumat = patients.filter((p) => p.scheduleDay === 'Selasa - Jumat').length;
  const countRabuSabtu = patients.filter((p) => p.scheduleDay === 'Rabu - Sabtu').length;

  // Akumulator Baris Total Harian Bawah
  const dailyPagi = new Array(monthInfo.daysInMonth).fill(0);
  const dailySiang = new Array(monthInfo.daysInMonth).fill(0);
  const dailyEpoTerjadwal = new Array(monthInfo.daysInMonth).fill(0);
  const dailyEpoKeluar = new Array(monthInfo.daysInMonth).fill(0);
  const dailyPrc = new Array(monthInfo.daysInMonth).fill(0);
  const dailyTotal = new Array(monthInfo.daysInMonth).fill(0);

  filteredPatients.forEach((patient) => {
    for (let d = 1; d <= monthInfo.daysInMonth; d++) {
      const info = getDateDoseDisplayInfo(patient, d, monthInfo);
      if (info.isHD) {
        dailyTotal[d - 1]++;
        if (patient.scheduleShift.includes('Pagi')) dailyPagi[d - 1]++;
        else dailySiang[d - 1]++;

        if (info.cellCode === '2000') {
          dailyEpoTerjadwal[d - 1]++;
        } else if (info.cellCode === '✅') {
          dailyEpoKeluar[d - 1]++;
        }

        if (info.cellCode === 'PRC 2') {
          dailyPrc[d - 1] += 2;
        } else if (info.cellCode === 'PRC 1') {
          dailyPrc[d - 1] += 1;
        }
      }
    }
  });

  // Render satu baris pasien pada tampilan matriks kalender
  const renderPatientMatrixRow = (patient: PatientRecord, displayNo: number) => {
    const reco = patient.recommendation;
    let patientEpoGiven = 0;

    return (
      <tr
        key={patient.id}
        className="h-8 hover:bg-blue-50/50 dark:hover:bg-slate-800/40 divide-x divide-slate-200 dark:divide-slate-800 transition"
      >
        {/* No */}
        <td className="py-1 px-1.5 text-center font-mono text-[10px] text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900 w-[35px] min-w-[35px]">
          {displayNo}
        </td>

        {/* Nama Pasien */}
        <td className="py-1 px-2.5 font-bold text-slate-900 dark:text-white sticky left-[35px] z-10 bg-white dark:bg-slate-900 truncate max-w-[160px] min-w-[160px]">
          <span title={patient.name}>{patient.name}</span>
        </td>

        {/* No. RM */}
        <td className="py-1 px-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-400 sticky left-[195px] z-10 bg-white dark:bg-slate-900 min-w-[85px] text-center">
          {patient.noRm}
        </td>

        {/* Shift (Single-line inline badges to keep row height uniform) */}
        <td className="py-1 px-1 text-center font-semibold text-[9px] min-w-[70px] whitespace-nowrap">
          <div className="flex items-center justify-center gap-1">
            <span className={`px-1.5 py-0.5 rounded ${
              patient.scheduleShift.includes('Pagi')
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {patient.scheduleShift.includes('Pagi') ? 'Pagi (P)' : 'Siang (S)'}
            </span>
            {patient.hdFrequency === '1 kali dalam satu minggu' && (
              <span 
                className="px-1 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60" 
                title={`Frekuensi HD: 1 kali dalam satu minggu (Hari ${patient.singleDay || 'Rutin'})`}
              >
                1x
              </span>
            )}
          </div>
        </td>

        {/* Hb */}
        <td className="py-1 px-1 text-center font-mono font-bold text-[10px] min-w-[50px]">
          {patient.hbValue <= 0 ? (
            <span 
              className="inline-block px-1 py-0.5 rounded text-[8px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300"
              title="Kadar Hb belum diinputkan / belum diketahui (terdeteksi nilai Hb: 0)"
            >
              Hb: 0
            </span>
          ) : (
            <span className={patient.hbValue < 6.0 ? 'text-rose-600 font-extrabold' : 'text-slate-800 dark:text-slate-200'}>
              {patient.hbValue.toFixed(1)}
            </span>
          )}
        </td>

        {/* Alokasi Klinis */}
        <td className="py-1 px-2 text-[10px] min-w-[130px] max-w-[150px]">
          <span className="font-semibold line-clamp-1 text-slate-800 dark:text-slate-200" title={reco.title}>
            {reco.title}
          </span>
        </td>

        {/* Kolom Tanggal 1 s/d 30/31 (Ukuran Minimalis 28px) */}
        {monthInfo.days.map((day) => {
          const info = getDateDoseDisplayInfo(patient, day.dateNumber, monthInfo);

          if (!info.isHD) {
            return (
              <td
                key={day.dateNumber}
                className="py-1 px-0 text-center text-slate-300 dark:text-slate-700 bg-slate-50/40 dark:bg-slate-900/40 w-[28px] min-w-[28px] max-w-[28px] font-mono text-[9px]"
              >
                -
              </td>
            );
          }

          if (info.cellCode === 'PRC 2') {
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center bg-rose-50 dark:bg-rose-950/40 w-[28px] min-w-[28px] max-w-[28px]">
                <span 
                  className="inline-block w-full py-0.5 rounded text-[8px] font-black bg-rose-600 text-white shadow-2xs" 
                  title={info.title}
                >
                  PRC 2
                </span>
              </td>
            );
          }

          if (info.cellCode === 'PRC 1') {
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center bg-amber-50 dark:bg-amber-950/40 w-[28px] min-w-[28px] max-w-[28px]">
                <span 
                  className="inline-block w-full py-0.5 rounded text-[8px] font-black bg-amber-500 text-white shadow-2xs" 
                  title={info.title}
                >
                  PRC 1
                </span>
              </td>
            );
          }

          if (info.cellCode === 'Cek') {
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center bg-indigo-50/70 dark:bg-indigo-950/40 w-[28px] min-w-[28px] max-w-[28px]">
                <span 
                  className="inline-block w-full py-0.5 rounded text-[8px] font-black bg-indigo-600 text-white shadow-2xs" 
                  title={info.title}
                >
                  Cek
                </span>
              </td>
            );
          }

          if (info.cellCode === '✅') {
            patientEpoGiven++;
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center bg-emerald-50 dark:bg-emerald-950/30 w-[28px] min-w-[28px] max-w-[28px]">
                <button
                  type="button"
                  onClick={(e) => handleCellClick(patient, day.dateNumber, info, e)}
                  className="w-full py-0.5 rounded text-[9px] font-black bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition cursor-pointer flex flex-col items-center justify-center leading-none"
                  title={`${info.title} — Klik tombol untuk ubah status`}
                >
                  <span className="text-[10px] leading-none">✅</span>
                  {info.isCatchUp ? (
                    <span className="text-[6px] leading-tight text-emerald-100 font-bold">
                      Alih
                    </span>
                  ) : info.isHbCheck ? (
                    <span className="text-[6px] leading-tight text-emerald-100 font-bold" title="Sesi Cek Hb Awal Pertemuan">
                      Hb✓
                    </span>
                  ) : null}
                </button>
              </td>
            );
          }

          if (info.cellCode === '❌') {
            const destDate = info.postponedToDate || info.pairedDate;
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center bg-red-50 dark:bg-red-950/30 w-[28px] min-w-[28px] max-w-[28px]">
                <button
                  type="button"
                  onClick={(e) => handleCellClick(patient, day.dateNumber, info, e)}
                  className="w-full py-0.5 rounded text-[8px] font-black bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-2xs transition cursor-pointer flex flex-col items-center justify-center leading-none"
                  title={`${info.title} — Klik tombol untuk ubah status`}
                >
                  <div className="w-3.5 h-3.5 rounded bg-red-700 border border-white text-white flex items-center justify-center text-[9px] font-black leading-none">
                    ✕
                  </div>
                  {destDate && (
                    <span className="text-[6.5px] leading-tight text-white font-extrabold mt-0.5">
                      ➔{destDate}
                    </span>
                  )}
                </button>
              </td>
            );
          }

          if (info.cellCode === '2000') {
            if (info.isCatchUp) {
              const srcDate = info.postponedFromDate || info.pairedDate;
              return (
                <td key={day.dateNumber} className="py-0.5 px-0 text-center bg-amber-100/70 dark:bg-amber-950/40 w-[28px] min-w-[28px] max-w-[28px]">
                  <button
                    type="button"
                    onClick={(e) => handleCellClick(patient, day.dateNumber, info, e)}
                    className="w-full py-0.5 rounded text-[8px] font-black bg-amber-200 hover:bg-amber-300 active:bg-amber-400 text-amber-950 border border-amber-500 shadow-2xs transition cursor-pointer flex flex-col items-center justify-center leading-none"
                    title={`${info.title} — Klik tombol untuk ubah status`}
                  >
                    <span className="leading-tight text-[8px] font-black text-amber-950">2000</span>
                    <span className="text-[6.5px] leading-tight text-amber-800 dark:text-amber-300 font-bold">
                      {srcDate ? `↳Tgl ${srcDate}` : '↳Alih'}
                    </span>
                  </button>
                </td>
              );
            }
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center w-[28px] min-w-[28px] max-w-[28px]">
                <button
                  type="button"
                  onClick={(e) => handleCellClick(patient, day.dateNumber, info, e)}
                  className="w-full py-0.5 rounded text-[8px] font-black bg-sky-100 text-blue-900 border border-blue-300 hover:bg-sky-200 active:bg-sky-300 transition cursor-pointer flex flex-col items-center justify-center leading-none shadow-2xs"
                  title={`${info.title} — Klik tombol untuk ubah status`}
                >
                  <span className="text-[8px] font-black leading-tight">2000</span>
                  {info.isHbCheck && (
                    <span className="text-[6.5px] leading-tight text-indigo-700 dark:text-indigo-400 font-extrabold" title="Sesi Cek Hb Lab Awal Pertemuan">
                      Hb✓
                    </span>
                  )}
                </button>
              </td>
            );
          }

          if (info.cellCode === 'Hold') {
            return (
              <td key={day.dateNumber} className="py-0.5 px-0 text-center w-[28px] min-w-[28px] max-w-[28px]">
                <span className="inline-block w-full py-0.5 rounded text-[8px] text-purple-900 bg-purple-100 border border-purple-300 font-bold" title={info.title}>
                  Hold
                </span>
              </td>
            );
          }

          return (
            <td key={day.dateNumber} className="py-0.5 px-0 text-center w-[28px] min-w-[28px] max-w-[28px]">
              <span className="inline-block w-full py-0.5 rounded text-[8px] text-emerald-950 bg-[#d9ead3] border border-emerald-300 font-semibold" title={info.title}>
                HD
                {info.isHbCheck && (
                  <span className="block text-[6.5px] leading-tight text-indigo-700 font-extrabold" title="Sesi Cek Hb Lab Awal Pertemuan">
                    Hb✓
                  </span>
                )}
              </span>
            </td>
          );
        })}

        {/* Target EPO */}
        <td className="py-1 px-1.5 text-center font-bold text-blue-700 w-[55px] min-w-[55px] text-[10px]">
          {reco.totalEpoVials}
        </td>

        {/* Realisasi EPO */}
        <td className="py-1 px-1.5 text-center font-bold text-emerald-700 w-[55px] min-w-[55px] text-[10px]">
          {patientEpoGiven}
        </td>

        {/* Rasio */}
        <td className="py-1 px-1.5 text-center font-mono text-[9px] w-[55px] min-w-[55px]">
          {patientEpoGiven}:{reco.totalEpoVials}
        </td>

        {/* PRC */}
        <td className="py-1 px-1.5 text-center font-bold text-rose-600 w-[50px] min-w-[50px] text-[10px]">
          {reco.transfusionBags > 0 ? reco.transfusionBags : '-'}
        </td>

        {/* Status */}
        <td className="py-1 px-1 text-center w-[75px] min-w-[75px]">
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
            patient.overallStatus === 'Selesai'
              ? 'bg-emerald-100 text-emerald-800'
              : patient.overallStatus === 'Perlu Perhatian'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {patient.overallStatus}
          </span>
        </td>

        {/* Aksi */}
        <td className="py-1 px-1 text-center w-[55px] min-w-[55px]">
          <div className="flex items-center justify-center gap-0.5">
            <button
              onClick={() => onEditPatient(patient)}
              className="p-1 text-slate-400 hover:text-indigo-600 rounded"
              title="Edit Data Pasien"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDeletePatient(patient.id)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded"
              title="Hapus Pasien"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </td>

      </tr>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      
      {/* 3 DAFTAR SHEET TABS: SENIN-KAMIS, SELASA-JUMAT, RABU-SABTU */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-3 pt-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 mr-1 hidden sm:inline flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span>Sheet:</span>
          </span>

          {/* Sheet 1: Senin - Kamis */}
          <button
            onClick={() => setActiveSheetTab('Senin - Kamis')}
            className={`h-8.5 px-3 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 border-t-2 transition cursor-pointer shrink-0 ${
              activeSheetTab === 'Senin - Kamis'
                ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-600 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Senin - Kamis</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-extrabold">
              {countSeninKamis}
            </span>
          </button>

          {/* Sheet 2: Selasa - Jumat */}
          <button
            onClick={() => setActiveSheetTab('Selasa - Jumat')}
            className={`h-8.5 px-3 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 border-t-2 transition cursor-pointer shrink-0 ${
              activeSheetTab === 'Selasa - Jumat'
                ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-600 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Selasa - Jumat</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-extrabold">
              {countSelasaJumat}
            </span>
          </button>

          {/* Sheet 3: Rabu - Sabtu */}
          <button
            onClick={() => setActiveSheetTab('Rabu - Sabtu')}
            className={`h-8.5 px-3 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 border-t-2 transition cursor-pointer shrink-0 ${
              activeSheetTab === 'Rabu - Sabtu'
                ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-600 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Rabu - Sabtu</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-extrabold">
              {countRabuSabtu}
            </span>
          </button>

          {/* Semua Pasien */}
          <button
            onClick={() => setActiveSheetTab('ALL')}
            className={`h-8.5 px-3 rounded-t-lg font-medium text-xs border-t-2 transition cursor-pointer shrink-0 ${
              activeSheetTab === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-white border-rose-600 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            Semua ({patients.length})
          </button>
        </div>

        {/* Action Buttons & View Mode Switcher */}
        <div className="flex items-center gap-2 mb-1 sm:mb-0">
          {/* Tombol Kirim ke Sheet */}
          {onPushToSheet && (
            <button
              type="button"
              onClick={() => onPushToSheet(activeSheetTab === 'ALL' ? undefined : activeSheetTab)}
              disabled={isSyncing}
              className="h-7.5 px-2.5 sm:px-3 rounded-lg font-semibold text-xs text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 disabled:opacity-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
              title={
                activeSheetTab === 'ALL'
                  ? 'Kirim data seluruh pasien ke 3 sheet jadwal (Senin-Kamis, Selasa-Jumat, Rabu-Sabtu) di Google Sheet'
                  : `Kirim data yang diinputkan khusus sheet ${activeSheetTab} ke Google Sheet`
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isSyncing
                  ? 'Mengirim...'
                  : activeSheetTab === 'ALL'
                  ? 'Kirim ke Semua Sheet'
                  : `Kirim ke Sheet (${activeSheetTab.replace(' - ', '-')})`}
              </span>
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('matrix')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition cursor-pointer text-xs ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-700'
              }`}
              title="Matriks Kalender Harian Minimalis"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Matriks Kalender</span>
            </button>

            <button
              onClick={() => setViewMode('weekly')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition cursor-pointer text-xs ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-700'
              }`}
              title="Tampilan Alokasi 4 Minggu"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Alokasi 4 Minggu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Tombol Pilihan Shift */}
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative min-w-[160px] max-w-[220px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama / No. RM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50/60 dark:bg-slate-800/60 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* TOMBOL PILIHAN SHIFT (PAGI & SIANG) */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSelectedShiftFilter(selectedShiftFilter === 'Shift 1 (Pagi)' ? 'ALL' : 'Shift 1 (Pagi)')}
              className={`h-7 px-2.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                selectedShiftFilter === 'Shift 1 (Pagi)'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
              }`}
              title="Filter pasien Shift 1 (Pagi - 07:00 WIB)"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Shift 1 (Pagi)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedShiftFilter === 'Shift 1 (Pagi)'
                  ? 'bg-rose-900 text-white'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
              }`}>
                {countCurrentSheetPagi}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedShiftFilter(selectedShiftFilter === 'Shift 2 (Siang)' ? 'ALL' : 'Shift 2 (Siang)')}
              className={`h-7 px-2.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                selectedShiftFilter === 'Shift 2 (Siang)'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-750'
              }`}
              title="Filter pasien Shift 2 (Siang - 12:30 WIB)"
            >
              <Sunset className="w-3.5 h-3.5 text-amber-500" />
              <span>Shift 2 (Siang)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedShiftFilter === 'Shift 2 (Siang)'
                  ? 'bg-amber-800 text-white'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}>
                {countCurrentSheetSiang}
              </span>
            </button>
          </div>
        </div>

        {/* Legend Kode Minimalis Sesuai Permintaan */}
        <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300 flex-wrap">
          <span className="font-semibold text-slate-400 mr-0.5">Legenda:</span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-700 text-white font-bold" title="Cek HB Lab Awal Bulan (Tanpa EPO)">
            Cek = Cek HB
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-800 text-white font-bold" title="Transfusi Protokol 2">
            PRC 2 = Transfusi 2 Bag
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-600 text-white font-bold" title="Transfusi Protokol 1">
            PRC 1 = Transfusi 1 Bag
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-50 text-rose-800 font-bold border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" title="Terjadwal EPO">
            2000 = Jadwal EPO
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-600 text-white font-bold" title="EPO Diberikan">
            ✅ = Diberikan
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-600 text-white font-bold inline-flex items-center gap-1" title="Ditunda (Ke Hari Ke-2)">
            <span>✕ Ditunda</span>
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-50 text-emerald-900 font-bold border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" title="Sesi Rutin">
            HD = Rutin
          </span>
        </div>
      </div>

      {/* VIEW 1: TAMPILAN MATRIKS KALENDER DENGAN PEMISAHAN SHIFT PAGI & SIANG PADA BARIS TERPISAH */}
      {viewMode === 'matrix' ? (
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left border-collapse text-[10px] font-sans">
            {/* Header Kolom - Modern Medical Deep Ruby dengan ukuran kolom minimalis */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-rose-900 dark:bg-rose-950 text-white text-center font-bold tracking-wider divide-x divide-rose-800/80 text-[10px]">
                <th className="py-1.5 px-1.5 text-center sticky left-0 z-30 bg-rose-900 dark:bg-rose-950 w-[35px] min-w-[35px]">No</th>
                <th className="py-1.5 px-2.5 text-left sticky left-[35px] z-30 bg-rose-900 dark:bg-rose-950 min-w-[160px] max-w-[160px]">
                  Nama Pasien
                </th>
                <th className="py-1.5 px-1.5 text-center sticky left-[195px] z-30 bg-rose-900 dark:bg-rose-950 min-w-[85px]">
                  No. RM
                </th>
                <th className="py-1.5 px-1 text-center min-w-[70px]">Shift</th>
                <th className="py-1.5 px-1 text-center min-w-[45px]">Hb</th>
                <th className="py-1.5 px-2 text-left min-w-[130px]">Alokasi Dosis</th>

                {/* Kolom Tanggal Minimalis 1 s/d 30/31 (Lebar tetap 28px) */}
                {monthInfo.days.map((day) => {
                  const dayNames = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
                  const isDialysisDay = activeSheetTab !== 'ALL' && isDateInHDDay(day.dayOfWeek, activeSheetTab);

                  return (
                    <th
                      key={day.dateNumber}
                      className={`py-1 px-0 w-[28px] min-w-[28px] max-w-[28px] text-center ${
                        isDialysisDay ? 'bg-rose-800/90 text-amber-200 font-extrabold' : 'opacity-85'
                      }`}
                      title={`${day.dateString}`}
                    >
                      <div className="text-[10px] leading-none">{day.dateNumber}</div>
                      <div className="text-[7px] font-normal opacity-75">{dayNames[day.dayOfWeek]}</div>
                    </th>
                  );
                })}

                {/* Kolom Rekap Kanan Minimalis */}
                <th className="py-1.5 px-1 min-w-[55px] bg-rose-950 text-center">Target</th>
                <th className="py-1.5 px-1 min-w-[55px] bg-rose-950 text-center">Realisasi</th>
                <th className="py-1.5 px-1 min-w-[55px] bg-rose-950 text-center">Rasio</th>
                <th className="py-1.5 px-1 min-w-[50px] bg-rose-950 text-center">PRC</th>
                <th className="py-1.5 px-1 min-w-[75px] bg-rose-950 text-center">Status</th>
                <th className="py-1.5 px-1 min-w-[55px] bg-rose-950 text-center">Aksi</th>
              </tr>
            </thead>

            {/* Isi Baris Pasien: DIPISAHKAN BERDASARKAN SHIFT */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              
              {/* JIKA TIDAK ADA PASIEN */}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={monthInfo.daysInMonth + 12} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 mx-auto flex items-center justify-center shadow-xs">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          Belum Ada Pasien di Jadwal {activeSheetTab}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Anda dapat memasukkan banyak data pasien sekaligus dengan menyalin tabel dari Microsoft Excel atau mengunggah berkas CSV.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        {onOpenBulkImportModal && (
                          <button
                            onClick={onOpenBulkImportModal}
                            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            <ClipboardPaste className="w-4 h-4" />
                            <span>Input Massal dari Excel / CSV</span>
                          </button>
                        )}
                        {onOpenAddPatientModal && (
                          <button
                            onClick={onOpenAddPatientModal}
                            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Tambah 1 Pasien</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* SECTION 1: SHIFT PAGI (07:00 WIB) - BARIS TERPISAH (MERGE & CENTER) */}
              {pagiPatients.length > 0 && (
                <>
                  <tr className="bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 font-bold border-y border-rose-200 dark:border-rose-900/60">
                    <td 
                      colSpan={monthInfo.daysInMonth + 12} 
                      className="py-1 px-3 text-center bg-rose-50/90 dark:bg-rose-950/50"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                        <span>KELOMPOK SHIFT PAGI (07:00 WIB) — {pagiPatients.length} Pasien</span>
                      </div>
                    </td>
                  </tr>
                  {pagiPatients.map((patient, idx) => renderPatientMatrixRow(patient, idx + 1))}
                </>
              )}

              {/* SECTION 2: SHIFT SIANG (12:30 WIB) - BARIS TERPISAH (MERGE & CENTER) */}
              {siangPatients.length > 0 && (
                <>
                  <tr className="bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 font-bold border-y border-amber-200 dark:border-amber-900/60">
                    <td 
                      colSpan={monthInfo.daysInMonth + 12} 
                      className="py-1 px-3 text-center bg-amber-50/90 dark:bg-amber-950/50"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Sunset className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>KELOMPOK SHIFT SIANG (12:30 WIB) — {siangPatients.length} Pasien</span>
                      </div>
                    </td>
                  </tr>
                  {siangPatients.map((patient, idx) => renderPatientMatrixRow(patient, idx + 1))}
                </>
              )}

            </tbody>

            {/* BARIS TOTAL RINGKASAN BAWAH */}
            <tfoot className="divide-y divide-slate-200 dark:divide-slate-800 font-bold text-[9px]">
              {/* Row 1: Total Shift Pagi */}
              <tr className="bg-rose-50/60 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 divide-x divide-rose-200/70 dark:divide-rose-900/40">
                <td colSpan={6} className="py-1 px-3 text-left sticky left-0 z-10 bg-rose-50/90 dark:bg-rose-950/60 font-semibold">
                  Total Shift Pagi (P)
                </td>
                {dailyPagi.map((cnt, i) => (
                  <td key={i} className="py-1 px-0 text-center w-[28px] min-w-[28px]">
                    {cnt > 0 ? cnt : '-'}
                  </td>
                ))}
                <td colSpan={6} className="py-1 px-2 text-center bg-rose-100 dark:bg-rose-900/40 font-bold text-rose-900 dark:text-rose-200">
                  {dailyPagi.reduce((a, b) => a + b, 0)} Sesi Pagi
                </td>
              </tr>

              {/* Row 2: Total Shift Siang */}
              <tr className="bg-amber-50/60 dark:bg-amber-950/20 text-slate-800 dark:text-amber-200 divide-x divide-amber-200/70 dark:divide-amber-900/40">
                <td colSpan={6} className="py-1 px-3 text-left sticky left-0 z-10 bg-amber-50/90 dark:bg-amber-950/60 font-semibold">
                  Total Shift Siang (S)
                </td>
                {dailySiang.map((cnt, i) => (
                  <td key={i} className="py-1 px-0 text-center w-[28px] min-w-[28px]">
                    {cnt > 0 ? cnt : '-'}
                  </td>
                ))}
                <td colSpan={6} className="py-1 px-2 text-center bg-amber-100 dark:bg-amber-900/40 font-bold text-amber-950 dark:text-amber-200">
                  {dailySiang.reduce((a, b) => a + b, 0)} Sesi Siang
                </td>
              </tr>

              {/* Row 3: Total Kebutuhan Transfusi PRC (Sesi Cek Hb) */}
              <tr className="bg-rose-100/50 dark:bg-rose-900/20 text-rose-950 dark:text-rose-200 divide-x divide-rose-200/70 dark:divide-rose-900/40">
                <td colSpan={6} className="py-1 px-3 text-left sticky left-0 z-10 bg-rose-100/80 dark:bg-rose-900/50 font-semibold">
                  Kebutuhan Transfusi PRC (Kantong)
                </td>
                {dailyPrc.map((cnt, i) => (
                  <td key={i} className="py-1 px-0 text-center font-extrabold text-rose-700 dark:text-rose-400 w-[28px] min-w-[28px]">
                    {cnt > 0 ? cnt : '-'}
                  </td>
                ))}
                <td colSpan={6} className="py-1 px-2 text-center bg-rose-200/80 dark:bg-rose-800/60 font-extrabold text-rose-950 dark:text-rose-100">
                  {dailyPrc.reduce((a, b) => a + b, 0)} Kantong PRC
                </td>
              </tr>

              {/* Row 4: Total Kebutuhan Harian EPO (Ampul 2000 IU) */}
              <tr className="bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 divide-x divide-rose-200/70 dark:divide-rose-900/40">
                <td colSpan={6} className="py-1 px-3 text-left sticky left-0 z-10 bg-rose-50/90 dark:bg-rose-950/60 font-bold">
                  Kebutuhan Harian EPO (Ampul 2000 IU)
                </td>
                {dailyEpoTerjadwal.map((cnt, i) => (
                  <td key={i} className="py-1 px-0 text-center font-extrabold text-rose-700 dark:text-rose-300 w-[28px] min-w-[28px]">
                    {cnt > 0 ? cnt : '-'}
                  </td>
                ))}
                <td colSpan={6} className="py-1 px-2 text-center bg-rose-100 dark:bg-rose-900/50 font-extrabold text-rose-900 dark:text-rose-200">
                  {dailyEpoTerjadwal.reduce((a, b) => a + b, 0)} Ampul Terjadwal
                </td>
              </tr>

              {/* Row 5: Epo Keluar */}
              <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 divide-x divide-emerald-200/70 dark:divide-emerald-900/40">
                <td colSpan={6} className="py-1 px-3 text-left sticky left-0 z-10 bg-emerald-50/90 dark:bg-emerald-950/60 font-bold">
                  Epo Keluar
                </td>
                {dailyEpoKeluar.map((cnt, i) => (
                  <td key={i} className="py-1 px-0 text-center font-extrabold text-emerald-700 dark:text-emerald-300 w-[28px] min-w-[28px]">
                    {cnt > 0 ? cnt : '-'}
                  </td>
                ))}
                <td colSpan={6} className="py-1 px-2 text-center bg-emerald-100 dark:bg-emerald-900/50 font-extrabold text-emerald-950 dark:text-emerald-100">
                  {dailyEpoKeluar.reduce((a, b) => a + b, 0)} Ampul Diberikan
                </td>
              </tr>

              {/* Row 6: Total Pasien HD Harian */}
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white divide-x divide-slate-200 dark:divide-slate-700">
                <td colSpan={6} className="py-1 px-3 text-left sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 font-semibold">
                  Total Pasien HD per Hari
                </td>
                {dailyTotal.map((cnt, i) => (
                  <td key={i} className="py-1 px-0 text-center font-bold w-[28px] min-w-[28px]">
                    {cnt > 0 ? cnt : '-'}
                  </td>
                ))}
                <td colSpan={6} className="py-1 px-2 text-center bg-slate-200 dark:bg-slate-700 font-bold">
                  {filteredPatients.length} Pasien
                </td>
              </tr>
            </tfoot>

          </table>
        </div>
      ) : (
        /* VIEW 2: TAMPILAN TABEL 4 MINGGU */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-rose-900 dark:bg-rose-950 text-white font-semibold border-b border-rose-800">
                <th className="py-2.5 px-3 text-center w-10">No</th>
                <th className="py-2.5 px-3">Nama Pasien & No. RM</th>
                <th className="py-2.5 px-3">Jadwal HD</th>
                <th className="py-2.5 px-3">Hb Awal</th>
                <th className="py-2.5 px-3">Alokasi Klinis</th>
                <th className="py-2.5 px-2 text-center">Minggu 1</th>
                <th className="py-2.5 px-2 text-center">Minggu 2</th>
                <th className="py-2.5 px-2 text-center">Minggu 3</th>
                <th className="py-2.5 px-2 text-center">Minggu 4</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="text-xs">Tidak ada data pasien yang sesuai dengan filter sheet / shift ini.</p>
                      {onOpenBulkImportModal && (
                        <button
                          onClick={onOpenBulkImportModal}
                          className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 cursor-pointer"
                        >
                          Input Massal Pasien
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* SECTION 1: SHIFT PAGI PADA TABEL 4 MINGGU */}
              {pagiPatients.length > 0 && (
                <>
                  <tr className="bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 font-bold border-y border-rose-200 dark:border-rose-900/60">
                    <td colSpan={11} className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs">
                        <Sun className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                        <span>KELOMPOK SHIFT PAGI (07:00 WIB) — {pagiPatients.length} Pasien</span>
                      </div>
                    </td>
                  </tr>
                  {pagiPatients.map((patient, idx) => (
                    <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-xs">{patient.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{patient.noRm}</div>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{patient.scheduleDay}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold">{patient.scheduleShift}</span>
                          {patient.hdFrequency && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              patient.hdFrequency === '1 kali dalam satu minggu'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60'
                            }`}>
                              {patient.hdFrequency === '1 kali dalam satu minggu'
                                ? `1x/mgg (${patient.singleDay || 'Rutin'})`
                                : '2x/mgg'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-xs">
                        {patient.hbValue <= 0 ? (
                          <span 
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                            title="Hasil lab Hb belum diinputkan (terdeteksi nilai Hb: 0 / Menunggu Lab)"
                          >
                            Hb: 0 (Menunggu Lab)
                          </span>
                        ) : (
                          <span className={patient.hbValue < 6.0 ? 'text-rose-600 font-extrabold' : ''}>
                            {patient.hbValue.toFixed(1)} g/dL
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium text-xs text-blue-700 dark:text-blue-400">
                        {patient.recommendation.title}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week1)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week3)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week4)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          patient.overallStatus === 'Selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : patient.overallStatus === 'Perlu Perhatian'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {patient.overallStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onEditPatient(patient)} className="p-1 text-slate-400 hover:text-indigo-600">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDeletePatient(patient.id)} className="p-1 text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* SECTION 2: SHIFT SIANG PADA TABEL 4 MINGGU */}
              {siangPatients.length > 0 && (
                <>
                  <tr className="bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 font-bold border-y border-amber-200 dark:border-amber-900/60">
                    <td colSpan={11} className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs">
                        <Sunset className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>KELOMPOK SHIFT SIANG (12:30 WIB) — {siangPatients.length} Pasien</span>
                      </div>
                    </td>
                  </tr>
                  {siangPatients.map((patient, idx) => (
                    <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-xs">{patient.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{patient.noRm}</div>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{patient.scheduleDay}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">{patient.scheduleShift}</span>
                          {patient.hdFrequency && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              patient.hdFrequency === '1 kali dalam satu minggu'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60'
                            }`}>
                              {patient.hdFrequency === '1 kali dalam satu minggu'
                                ? `1x/mgg (${patient.singleDay || 'Rutin'})`
                                : '2x/mgg'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-xs">
                        {patient.hbValue <= 0 ? (
                          <span 
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                            title="Hasil lab Hb belum diinputkan (terdeteksi nilai Hb: 0 / Menunggu Lab)"
                          >
                            Hb: 0 (Menunggu Lab)
                          </span>
                        ) : (
                          <span className={patient.hbValue < 6.0 ? 'text-rose-600 font-extrabold' : ''}>
                            {patient.hbValue.toFixed(1)} g/dL
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium text-xs text-blue-700 dark:text-blue-400">
                        {patient.recommendation.title}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week1)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week3)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {renderWeekBadge(patient.weeks.week4)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          patient.overallStatus === 'Selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : patient.overallStatus === 'Perlu Perhatian'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {patient.overallStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onEditPatient(patient)} className="p-1 text-slate-400 hover:text-indigo-600">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDeletePatient(patient.id)} className="p-1 text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <div>
          Menampilkan <strong>{pagiPatients.length}</strong> Shift Pagi + <strong>{siangPatients.length}</strong> Shift Siang (Total <strong>{filteredPatients.length}</strong> pasien)
        </div>
        <div className="text-[11px] text-slate-400 hidden sm:block">
          Format kolom minimalis (28px) & terpisah per shift di Google Sheets
        </div>
      </div>

      {/* MENU AKSI CEPAT KLIK TOMBOL (Cukup klik tombol saja, tanpa halaman modal) */}
      {quickMenuData && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setQuickMenuData(null)} 
          />
          <div
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100 min-w-[215px] max-w-[245px]"
            style={{ top: quickMenuData.y, left: quickMenuData.x }}
          >
            {/* Header Mini Info */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate pr-1">
                {quickMenuData.patient.name.split(' ')[0]} • Tgl {quickMenuData.dateNumber}
              </div>
              <button
                type="button"
                onClick={() => setQuickMenuData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer leading-none text-xs"
              >
                ✕
              </button>
            </div>

            {/* Tombol 1: EPO Diberikan (✅) */}
            <button
              type="button"
              onClick={() => {
                if (onUpdateDateAction) {
                  onUpdateDateAction(
                    quickMenuData.patient.id,
                    quickMenuData.dateNumber,
                    'Diberikan',
                    'Ns. Maya',
                    quickMenuData.info.isCatchUp 
                      ? `Pengalihan dari tgl ${quickMenuData.info.postponedFromDate || quickMenuData.info.pairedDate}` 
                      : undefined
                  );
                } else {
                  const weekNum = getHDSessionWeek(quickMenuData.dateNumber, monthInfo.daysInMonth);
                  onUpdateWeekStatus(quickMenuData.patient.id, `week${weekNum}` as any, 'Diberikan');
                }
                setQuickMenuData(null);
              }}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-between shadow-2xs transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span>✅</span>
                <span>EPO Diberikan</span>
              </div>
              <span className="text-[10px] bg-emerald-800/60 px-1.5 py-0.5 rounded">2000</span>
            </button>

            {/* Tombol 2: Ditunda (❌) */}
            <button
              type="button"
              onClick={() => {
                const isOnceWeekly = quickMenuData.patient.hdFrequency === '1 kali dalam satu minggu';
                const destDate = quickMenuData.info.postponedToDate || quickMenuData.info.pairedDate;
                const defaultNote = isOnceWeekly
                  ? `Ditunda tgl ${quickMenuData.dateNumber}, dialihkan ke sesi HD berikutnya tgl ${destDate}`
                  : `Ditunda di Hari Awal, dialihkan ke Hari Ke-2 tgl ${destDate}`;

                if (onUpdateDateAction) {
                  onUpdateDateAction(
                    quickMenuData.patient.id,
                    quickMenuData.dateNumber,
                    'Tunda',
                    'Ns. Maya',
                    destDate ? defaultNote : 'Ditunda'
                  );
                } else {
                  const weekNum = getHDSessionWeek(quickMenuData.dateNumber, monthInfo.daysInMonth);
                  onUpdateWeekStatus(quickMenuData.patient.id, `week${weekNum}` as any, 'Tunda');
                }
                setQuickMenuData(null);
              }}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex items-center justify-between shadow-2xs transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-red-700 border border-white text-white flex items-center justify-center font-black text-[9px] leading-none">✕</span>
                <span>
                  {quickMenuData.patient.hdFrequency === '1 kali dalam satu minggu'
                    ? 'Ditunda (HD Berikutnya)'
                    : 'Ditunda (Ke Hari Ke-2)'}
                </span>
              </div>
              {quickMenuData.info.pairedDate && (
                <span className="text-[10px] bg-red-800/80 px-1 py-0.5 rounded">➔ {quickMenuData.info.pairedDate}</span>
              )}
            </button>

            {/* Tombol 3: Kembalikan ke Terjadwal 2000 (Belum) */}
            <button
              type="button"
              onClick={() => {
                if (onUpdateDateAction) {
                  onUpdateDateAction(quickMenuData.patient.id, quickMenuData.dateNumber, 'Belum');
                } else {
                  const weekNum = getHDSessionWeek(quickMenuData.dateNumber, monthInfo.daysInMonth);
                  onUpdateWeekStatus(quickMenuData.patient.id, `week${weekNum}` as any, 'Belum');
                }
                setQuickMenuData(null);
              }}
              className="w-full py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <span>🔄 Reset ke 2000 (Terjadwal EPO)</span>
            </button>
          </div>
        </>
      )}

    </div>
  );
};
