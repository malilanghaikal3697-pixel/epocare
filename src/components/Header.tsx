import React from 'react';
import { User } from 'firebase/auth';
import { 
  Activity, 
  FileSpreadsheet, 
  Calculator, 
  Printer, 
  Plus, 
  RefreshCw, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste,
  Droplet,
  ExternalLink
} from 'lucide-react';
import { SpreadsheetConfig } from '../types/dialysis';
import { OFFICIAL_SPREADSHEET_URL } from '../services/googleSheets';

interface HeaderProps {
  user: User | null;
  spreadsheetConfig: SpreadsheetConfig | null;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onOpenSyncModal: () => void;
  onOpenMonthlyHbModal: () => void;
  onOpenCalculatorModal: () => void;
  onOpenPrintModal: () => void;
  onOpenAddPatientModal: () => void;
  onOpenBulkImportModal: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  isSyncing: boolean;
  isLoggingIn: boolean;
  pendingHbCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  spreadsheetConfig,
  selectedMonth,
  onMonthChange,
  onOpenSyncModal,
  onOpenMonthlyHbModal,
  onOpenCalculatorModal,
  onOpenPrintModal,
  onOpenAddPatientModal,
  onOpenBulkImportModal,
  onSignIn,
  onSignOut,
  isSyncing,
  isLoggingIn,
  pendingHbCount,
}) => {
  const isConnected = Boolean(
    spreadsheetConfig?.appsScriptUrl || 
    (spreadsheetConfig?.spreadsheetId && spreadsheetConfig.spreadsheetId !== 'appsscript-connected')
  );

  // URL Google Sheets untuk tombol "Buka Sheet"
  const googleSheetUrl =
    spreadsheetConfig?.spreadsheetUrl ||
    (spreadsheetConfig?.spreadsheetId && spreadsheetConfig.spreadsheetId !== 'appsscript-connected'
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.spreadsheetId}/edit`
      : OFFICIAL_SPREADSHEET_URL);

  return (
    <header className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white border-b border-rose-700/50 sticky top-0 z-30 shadow-md backdrop-blur-md">
      <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Brand & Subtitle (Proportional Logo & Text) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-rose-700/80 border border-rose-500/50 text-white flex items-center justify-center shadow-xs shrink-0">
              <Activity className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                  EPOCARE
                </h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-950/60 text-rose-200 border border-rose-700/60">
                  Dialisis
                </span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-tight">
                RS Happy Land Medical Centre Yogyakarta
              </p>
            </div>
          </div>

          {/* Controls & Action Buttons Bar */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Periode Bulan Selector */}
            <div className="h-8.5 flex items-center gap-1.5 bg-rose-950/50 hover:bg-rose-950/70 px-2.5 rounded-lg border border-rose-700/50 text-xs text-white backdrop-blur-xs transition">
              <Calendar className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span className="text-[11px] font-medium text-rose-200/80">Periode:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-transparent font-semibold text-white focus:outline-hidden cursor-pointer text-xs [color-scheme:dark]"
              />
            </div>

            {/* Quick Calculator Tool */}
            <button
              onClick={onOpenCalculatorModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-lg text-white bg-rose-950/40 hover:bg-rose-950/70 border border-rose-700/50 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Kalkulator klinis cepat untuk dosis Hb"
            >
              <Calculator className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>Kalkulator</span>
            </button>

            {/* Print / Export Report Tool */}
            <button
              onClick={onOpenPrintModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-lg text-white bg-rose-950/40 hover:bg-rose-950/70 border border-rose-700/50 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Cetak format rekapitulasi untuk Depo Farmasi & DPJP"
            >
              <Printer className="w-3.5 h-3.5 text-rose-200 shrink-0" />
              <span>Cetak Rekap</span>
            </button>

            {/* Google Sheets Sync Button */}
            <button
              onClick={onOpenSyncModal}
              disabled={isSyncing}
              className={`h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-lg border transition cursor-pointer shadow-2xs backdrop-blur-xs ${
                isConnected
                  ? 'bg-emerald-950/70 text-emerald-200 border-emerald-600/60 hover:bg-emerald-900/80'
                  : 'bg-rose-950/50 text-rose-200 border-rose-700/60 hover:bg-rose-950/80'
              }`}
              title="Status sinkronisasi Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {spreadsheetConfig?.appsScriptUrl
                  ? 'Sheets Aktif'
                  : isConnected
                  ? 'Sheets Terhubung'
                  : 'Koneksi Sheets'}
              </span>
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
              ) : isConnected ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </button>

            {/* Tombol Buka Sheet */}
            <a
              href={googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border border-emerald-400/80 transition cursor-pointer shadow-xs shrink-0"
              title="Buka dokumen Google Sheets di tab browser baru"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Buka Sheet</span>
              <ExternalLink className="w-3 h-3 text-emerald-100 shrink-0" />
            </a>

            {/* Separator */}
            <div className="hidden sm:block h-5 w-px bg-rose-700/60 mx-0.5" />

            {/* Input Massal / Import Excel */}
            <button
              onClick={onOpenBulkImportModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-lg text-white bg-rose-950/40 hover:bg-rose-950/70 border border-rose-700/50 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Input banyak pasien sekaligus dengan Copy-Paste dari Excel atau file CSV"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>Import Excel</span>
            </button>

            {/* Tombol Input Nilai HB Bulanan (Highlight Action) */}
            <button
              onClick={onOpenMonthlyHbModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg text-white bg-rose-700 hover:bg-rose-600 active:bg-rose-800 border border-rose-500/60 shadow-xs transition cursor-pointer"
              title="Input / Perbarui Nilai Hb Laboratorium Awal Bulan Seluruh Pasien"
            >
              <Droplet className="w-3.5 h-3.5 fill-white text-white shrink-0" />
              <span>Input Nilai HB</span>
              {pendingHbCount !== undefined && pendingHbCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-300 text-amber-950" title={`${pendingHbCount} pasien belum memiliki hasil Hb (Hb: 0)`}>
                  {pendingHbCount}
                </span>
              )}
            </button>

            {/* Tambah Pasien Baru (Primary CTA) */}
            <button
              onClick={onOpenAddPatientModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg text-rose-950 bg-white hover:bg-rose-50 active:bg-rose-100 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-rose-900 shrink-0" />
              <span>Tambah Pasien</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
