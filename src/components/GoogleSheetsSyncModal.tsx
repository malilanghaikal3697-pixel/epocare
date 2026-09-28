import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  X, 
  FileSpreadsheet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Zap,
  ExternalLink,
  Link2
} from 'lucide-react';
import { PatientRecord, SpreadsheetConfig } from '../types/dialysis';
import { APPS_SCRIPT_SAMPLE_CODE, DEFAULT_APPS_SCRIPT_URL, OFFICIAL_SPREADSHEET_URL, OFFICIAL_SPREADSHEET_ID } from '../services/googleSheets';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  spreadsheetConfig: SpreadsheetConfig | null;
  onSaveSpreadsheetConfig: (config: SpreadsheetConfig) => void;
  patients: PatientRecord[];
  onPullFromSheet?: (spreadsheetId: string) => Promise<void>;
  onPushToSheet?: (spreadsheetId: string) => Promise<void>;
  onPullViaAppsScript: (url: string) => Promise<void>;
  onPushViaAppsScript: (url: string) => Promise<void>;
  onImportCsv?: (csvText: string) => void;
  onSignIn?: () => void;
  selectedMonth: string;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  spreadsheetConfig,
  onSaveSpreadsheetConfig,
  patients,
  onPullViaAppsScript,
  onPushViaAppsScript,
}) => {
  // Input states - Default to target official Web App URL
  const [appsScriptUrl, setAppsScriptUrl] = useState(
    spreadsheetConfig?.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL
  );
  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(
    spreadsheetConfig?.spreadsheetUrl || OFFICIAL_SPREADSHEET_URL
  );

  // Operation states
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (!isOpen) return null;

  // Salin Kode Apps Script
  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_SAMPLE_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Simpan URL Apps Script
  const handleSaveAppsScriptUrl = () => {
    const targetUrl = appsScriptUrl.trim() || DEFAULT_APPS_SCRIPT_URL;
    if (!targetUrl.startsWith('http')) {
      setStatusMessage({ 
        type: 'error', 
        text: 'Masukkan Web App URL Apps Script yang valid (diawali https://script.google.com/...)' 
      });
      return;
    }
    const updated: SpreadsheetConfig = {
      spreadsheetId: spreadsheetConfig?.spreadsheetId || 'appsscript-connected',
      sheetName: 'Senin-Kamis, Selasa-Jumat, Rabu-Sabtu',
      appsScriptUrl: targetUrl,
      syncMode: 'appsscript',
      lastSyncedAt: new Date().toISOString(),
    };
    onSaveSpreadsheetConfig(updated);
    setStatusMessage({ type: 'success', text: 'Web App URL Apps Script berhasil disimpan!' });
  };

  // Simpan URL Spreadsheet
  const handleSaveSpreadsheetUrl = () => {
    const cleanUrl = spreadsheetUrlInput.trim();
    let extractedId = spreadsheetConfig?.spreadsheetId || 'appsscript-connected';
    if (cleanUrl) {
      const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        extractedId = match[1];
      }
    }
    const updated: SpreadsheetConfig = {
      spreadsheetId: extractedId,
      sheetName: spreadsheetConfig?.sheetName || 'Senin-Kamis, Selasa-Jumat, Rabu-Sabtu',
      spreadsheetUrl: cleanUrl,
      appsScriptUrl: appsScriptUrl.trim() || spreadsheetConfig?.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL,
      syncMode: 'appsscript',
      lastSyncedAt: new Date().toISOString(),
    };
    onSaveSpreadsheetConfig(updated);
    setStatusMessage({ type: 'success', text: 'URL Google Sheets berhasil disimpan!' });
  };

  // Tarik via Apps Script (Tanpa Login)
  const handlePullAppsScript = async () => {
    const url = appsScriptUrl.trim() || spreadsheetConfig?.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
    if (!url) {
      setStatusMessage({ type: 'error', text: 'Masukkan Web App URL Apps Script terlebih dahulu.' });
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage({ type: 'info', text: 'Menghubungi Apps Script dan membaca data...' });
      await onPullViaAppsScript(url);
      handleSaveAppsScriptUrl();
      setStatusMessage({ type: 'success', text: 'Berhasil membaca data alokasi dari Google Sheet tanpa login!' });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Gagal terhubung dengan Apps Script.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Kirim via Apps Script (Tanpa Login)
  const handlePushAppsScript = async () => {
    const url = appsScriptUrl.trim() || spreadsheetConfig?.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
    if (!url) {
      setStatusMessage({ type: 'error', text: 'Masukkan Web App URL Apps Script terlebih dahulu.' });
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage({ type: 'info', text: 'Mengirimkan data alokasi pasien ke Google Sheet...' });
      await onPushViaAppsScript(url);
      handleSaveAppsScriptUrl();
      setStatusMessage({ type: 'success', text: `Sukses menyimpan ${patients.length} data pasien ke Google Sheet via Apps Script!` });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengirim ke Apps Script.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md sm:max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Sinkronisasi Google Sheets
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Alokasi 2 arah via Apps Script (Bebas Login Akun)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content (Compact) */}
        <div className="p-3 space-y-2.5 text-xs overflow-y-auto flex-1">
          
          {/* Notification Message */}
          {statusMessage && (
            <div className={`p-2 rounded-lg flex items-start gap-1.5 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
            }`}>
              {statusMessage.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              {statusMessage.type === 'info' && <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />}
              <span className="text-[10px] sm:text-[11px] font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Web App URL Panel */}
          <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px] flex items-center gap-1">
                <Link2 className="w-3 h-3 text-emerald-600" />
                <span>Web App URL Google Apps Script:</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setAppsScriptUrl(DEFAULT_APPS_SCRIPT_URL);
                  handleSaveAppsScriptUrl();
                }}
                className="text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                title="Gunakan Web App URL Resmi"
              >
                Gunakan URL Resmi
              </button>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                className="flex-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[10px] sm:text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleSaveAppsScriptUrl}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                Simpan
              </button>
            </div>

            <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span className="truncate">Tersambung otomatis ke 3 sheet: <em>Senin-Kamis, Selasa-Jumat, Rabu-Sabtu</em></span>
            </div>
          </div>

          {/* Direct Spreadsheet URL Panel */}
          <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px] flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                <span>Tautan Dokumen Google Sheets:</span>
              </label>
              {spreadsheetUrlInput && (
                <a
                  href={spreadsheetUrlInput}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-0.5"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                value={spreadsheetUrlInput}
                onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
                className="flex-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[10px] sm:text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleSaveSpreadsheetUrl}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                Simpan
              </button>
            </div>
          </div>

          {/* Action Buttons: Tarik & Kirim */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePullAppsScript}
              disabled={isProcessing || !appsScriptUrl.trim()}
              className="h-8.5 px-3 rounded-lg font-semibold text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
              <span>Tarik Data (Pull)</span>
            </button>
            <button
              type="button"
              onClick={handlePushAppsScript}
              disabled={isProcessing || !appsScriptUrl.trim()}
              className="h-8.5 px-3 rounded-lg font-semibold text-xs bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0" />
              <span>Kirim ke Sheet (Push)</span>
            </button>
          </div>

          {/* Collapsible Script Guide & Code */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{showGuide ? 'Sembunyikan Petunjuk Script' : 'Petunjuk Pasang Script & Salin Kode (Opsional)'}</span>
              </span>
              <span className="text-slate-400 text-[10px]">{showGuide ? '▲' : '▼'}</span>
            </button>

            {showGuide && (
              <div className="mt-1.5 space-y-1.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Kode Apps Script:</span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
                  </button>
                </div>
                <pre className="p-2 bg-slate-900 text-slate-300 rounded-md text-[10px] font-mono overflow-x-auto max-h-24">
                  {APPS_SCRIPT_SAMPLE_CODE}
                </pre>
                <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                  Buka Spreadsheet &gt; Ekstensi &gt; Apps Script. Tempel kode, klik Terapkan &gt; Web app (Akses: Siapa Saja).
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer (Pinned) */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 truncate">
            {spreadsheetConfig?.lastSyncedAt 
              ? `Sinkron: ${new Date(spreadsheetConfig.lastSyncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` 
              : 'Siap sinkronisasi'}
          </span>
          <button
            onClick={onClose}
            className="h-8.5 px-3.5 rounded-lg font-medium text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
