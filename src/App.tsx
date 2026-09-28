/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { PatientTable } from './components/PatientTable';
import { PatientModal } from './components/PatientModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { ClinicalCalculatorModal } from './components/ClinicalCalculatorModal';
import { PrintReportModal } from './components/PrintReportModal';
import { BulkImportModal } from './components/BulkImportModal';
import { MonthlyHbInputModal } from './components/MonthlyHbInputModal';
import { PatientRecord, SpreadsheetConfig, DoseStatus, HDDaySchedule } from './types/dialysis';
import { getInitialDemoPatients, calculateClinicalRecommendation, generateDefaultWeeks, isDemoPatient } from './services/clinicalRules';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from './services/firebaseAuth';
import { 
  readPatientsFromSheet, 
  pushPatientsToSheet,
  pullViaAppsScript,
  pushViaAppsScript,
  importFromCSV,
  getPairedHDDate,
  getDateDoseDisplayInfo,
  getMonthDaysInfo,
  getHDSessionWeek,
  getFirstHDDateOfMonth,
  DEFAULT_APPS_SCRIPT_URL,
  OFFICIAL_SPREADSHEET_ID,
  OFFICIAL_SPREADSHEET_URL,
  isSummaryOrHeaderRow
} from './services/googleSheets';
import { 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  ArrowRight
} from 'lucide-react';

const isRemovedDemoNote = (note?: string): boolean => {
  if (!note) return false;
  const lower = note.toLowerCase().trim();
  return (
    lower.includes('penjadwalan epo hari awal: pemberian epo tgl 7 september 2026 ditunda') ||
    lower.includes('pasien mengeluh lemas, konjungtiva anemis berat') ||
    lower.includes('hasil lab hb awal bulan belum diinputkan') ||
    lower.includes('transfusi 1 bag saat hd running') ||
    lower.includes('rutin epo 4x sebulan di hari awal (senin)') ||
    lower.includes('rutin epo 4x sebulan, periksa saturasi transferin') ||
    lower.includes('target hb tercapai stabil, maintenance 1 ampul di m1') ||
    lower.includes('hb di atas target 12 g/dl, tunda injeksi epo bulan ini') ||
    lower.includes('hb diatas 12.00 mg/dl')
  );
};

export default function App() {
  // Current Month: format YYYY-MM
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Patient Records State (Dikosongkan dari data bawaan sistem dan baris rekapitulasi)
  const [patients, setPatients] = useState<PatientRecord[]>(() => {
    try {
      const saved = localStorage.getItem('dialysis_patients_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Bersihkan secara otomatis pasien demo bawaan sistem serta baris total/rekapitulasi
          const cleaned = parsed
            .filter((p: PatientRecord) => !isSummaryOrHeaderRow(p.name, p.noRm) && !isDemoPatient(p))
            .map((p: PatientRecord) => ({
              ...p,
              clinicalNotes: isRemovedDemoNote(p.clinicalNotes) ? '' : p.clinicalNotes,
            }));
          localStorage.setItem('dialysis_patients_data', JSON.stringify(cleaned));
          return cleaned;
        }
      }
    } catch (e) {
      console.error('Error loading saved patients:', e);
    }
    return [];
  });

  // Bersihkan data pasien dari baris total/rekapitulasi dan data demo bawaan sistem
  useEffect(() => {
    setPatients((prev) => {
      let changed = false;
      const filtered = prev
        .filter((p) => {
          if (isSummaryOrHeaderRow(p.name, p.noRm) || isDemoPatient(p)) {
            changed = true;
            return false;
          }
          return true;
        })
        .map((p) => {
          if (isRemovedDemoNote(p.clinicalNotes)) {
            changed = true;
            return { ...p, clinicalNotes: '' };
          }
          return p;
        });
      if (changed || filtered.length !== prev.length) {
        try {
          localStorage.setItem('dialysis_patients_data', JSON.stringify(filtered));
        } catch (e) {
          // ignore
        }
        return filtered;
      }
      return prev;
    });
  }, []);

  // Spreadsheet Config State - Tetapkan URL resmi Google Sheet & Apps Script
  const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetConfig>(() => {
    const DEFAULT_CONFIG: SpreadsheetConfig = {
      spreadsheetId: OFFICIAL_SPREADSHEET_ID,
      spreadsheetUrl: OFFICIAL_SPREADSHEET_URL,
      sheetName: 'Senin-Kamis, Selasa-Jumat, Rabu-Sabtu',
      appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
      syncMode: 'appsscript',
      lastSyncedAt: new Date().toISOString(),
    };
    try {
      const saved = localStorage.getItem('dialysis_spreadsheet_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          spreadsheetId: OFFICIAL_SPREADSHEET_ID,
          spreadsheetUrl: OFFICIAL_SPREADSHEET_URL,
          appsScriptUrl: parsed.appsScriptUrl || DEFAULT_CONFIG.appsScriptUrl,
        };
      }
    } catch (e) {
      console.error('Error loading saved spreadsheet config:', e);
    }
    return DEFAULT_CONFIG;
  });

  // Modals state
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isMonthlyHbModalOpen, setIsMonthlyHbModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Syncing status & notifications
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Auto-hide toast notification
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Save patients to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('dialysis_patients_data', JSON.stringify(patients));
    } catch (e) {
      console.error('Failed to save patients to localStorage', e);
    }
  }, [patients]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => {
        setUser(currentUser);
      },
      () => {
        setUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Google Sign In Handler
  const handleSignIn = async () => {
    try {
      setIsLoggingIn(true);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToastNotification({
          type: 'success',
          message: `Berhasil masuk dengan akun Google: ${res.user.displayName || res.user.email}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setToastNotification({
        type: 'error',
        message: err.message || 'Gagal masuk dengan akun Google. Periksa koneksi atau izin popup.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google Sign Out Handler
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToastNotification({
      type: 'info',
      message: 'Anda telah keluar dari akun Google.',
    });
  };

  // Save Spreadsheet Config
  const handleSaveSpreadsheetConfig = (config: SpreadsheetConfig) => {
    setSpreadsheetConfig(config);
    try {
      localStorage.setItem('dialysis_spreadsheet_config', JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save spreadsheet config', e);
    }
  };

  // Pull data from Google Sheet
  const handlePullFromSheet = async (spreadsheetId: string) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Silakan masuk dengan akun Google terlebih dahulu untuk menarik data.');
    }

    setIsSyncing(true);
    try {
      const importedPatients = await readPatientsFromSheet(spreadsheetId, token, selectedMonth);
      if (importedPatients.length === 0) {
        setToastNotification({
          type: 'info',
          message: 'Sheet terhubung, namun belum ada baris pasien yang ditemukan pada spreadsheet.',
        });
      } else {
        setPatients(importedPatients);
        setToastNotification({
          type: 'success',
          message: `Berhasil mengimpor ${importedPatients.length} pasien dari Google Sheet!`,
        });
      }

      handleSaveSpreadsheetConfig({
        spreadsheetId,
        sheetName: 'Alokasi_EPO_HD',
        lastSyncedAt: new Date().toISOString(),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Push data to Google Sheet
  const handlePushToSheet = async (spreadsheetId: string) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Silakan masuk dengan akun Google terlebih dahulu untuk menyimpan ke Sheet.');
    }

    setIsSyncing(true);
    try {
      await pushPatientsToSheet(spreadsheetId, patients, token, selectedMonth);
      handleSaveSpreadsheetConfig({
        spreadsheetId,
        sheetName: 'Senin-Kamis, Selasa-Jumat, Rabu-Sabtu',
        lastSyncedAt: new Date().toISOString(),
      });
      setToastNotification({
        type: 'success',
        message: `Berhasil menyimpan & mensinkronisasikan ${patients.length} pasien ke 3 sheet jadwal di Google Sheet!`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Pull via Apps Script (Tanpa Login Google)
  const handlePullViaAppsScript = async (url: string) => {
    setIsSyncing(true);
    try {
      const imported = await pullViaAppsScript(url, selectedMonth);
      if (imported.length === 0) {
        setToastNotification({
          type: 'info',
          message: 'Terhubung ke Apps Script, namun belum ada baris data pasien.',
        });
      } else {
        setPatients(imported);
        setToastNotification({
          type: 'success',
          message: `Berhasil membaca ${imported.length} data pasien via Apps Script tanpa login!`,
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Push via Apps Script (Tanpa Login Google)
  const handlePushViaAppsScript = async (url: string) => {
    setIsSyncing(true);
    try {
      await pushViaAppsScript(url, patients, selectedMonth);
      setToastNotification({
        type: 'success',
        message: `Berhasil mengirim ${patients.length} data pasien ke 3 sheet jadwal via Apps Script!`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Quick Push to Google Sheets (Per Sheet / Semua Sheet) langsung dari tombol tabel
  const handleQuickPushToSheet = async (targetSchedule?: HDDaySchedule) => {
    const url = spreadsheetConfig?.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
    setIsSyncing(true);
    try {
      if (url) {
        await pushViaAppsScript(url, patients, selectedMonth, targetSchedule);
        setToastNotification({
          type: 'success',
          message: targetSchedule
            ? `Berhasil mengirim data yang diinputkan (${targetSchedule}) ke sheet di Google Sheets!`
            : `Berhasil mengirim seluruh data pasien ke 3 sheet jadwal di Google Sheets!`,
        });
      } else if (spreadsheetConfig?.spreadsheetId) {
        const token = await getAccessToken();
        if (token) {
          await pushPatientsToSheet(spreadsheetConfig.spreadsheetId, patients, token, selectedMonth, targetSchedule);
          setToastNotification({
            type: 'success',
            message: targetSchedule
              ? `Berhasil mengirim data ${targetSchedule} ke tab spreadsheet!`
              : `Berhasil mengirim seluruh data pasien ke spreadsheet!`,
          });
        } else {
          setIsSyncModalOpen(true);
        }
      } else {
        setIsSyncModalOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      setToastNotification({
        type: 'error',
        message: 'Gagal mengirim data ke Google Sheet. Periksa koneksi internet atau URL Apps Script.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Import from CSV (Tanpa Login Google)
  const handleImportCsv = (csvText: string) => {
    const imported = importFromCSV(csvText, selectedMonth);
    if (imported.length > 0) {
      setPatients(imported);
      setToastNotification({
        type: 'success',
        message: `Berhasil memuat ${imported.length} data pasien dari file CSV!`,
      });
    } else {
      setToastNotification({
        type: 'error',
        message: 'File CSV tidak berisi data pasien yang valid.',
      });
    }
  };

  // Add or Edit Patient
  const handleSavePatient = (patientData: Partial<PatientRecord>) => {
    if (editingPatient) {
      // Update existing
      setPatients((prev) =>
        prev.map((p) =>
          p.id === editingPatient.id ? ({ ...p, ...patientData } as PatientRecord) : p
        )
      );
      setToastNotification({
        type: 'success',
        message: `Data pasien ${patientData.name || ''} berhasil diperbarui.`,
      });
    } else {
      // Create new
      const newPatient: PatientRecord = {
        id: `pat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        noRm: patientData.noRm || `RM-${Math.floor(10000 + Math.random() * 90000)}`,
        name: patientData.name || 'Pasien Baru',
        age: patientData.age,
        gender: patientData.gender || 'L',
        hdFrequency: patientData.hdFrequency || '2 kali dalam satu minggu',
        singleDay: patientData.singleDay,
        scheduleDay: patientData.scheduleDay || 'Senin - Kamis',
        scheduleShift: patientData.scheduleShift || 'Shift 1 (Pagi)',
        hbValue: typeof patientData.hbValue === 'number' ? patientData.hbValue : 0,
        hbDate: patientData.hbDate || getFirstHDDateOfMonth(selectedMonth, patientData.scheduleDay || 'Senin - Kamis', patientData.singleDay, patientData.hdFrequency).dateString,
        monthPeriod: selectedMonth,
        recommendation: patientData.recommendation!,
        weeks: patientData.weeks!,
        overallStatus: patientData.overallStatus || 'Berjalan',
        clinicalNotes: patientData.clinicalNotes,
        doctorInCharge: patientData.doctorInCharge || 'dr. Sp.PD-KGH',
        updatedAt: new Date().toISOString(),
      };
      setPatients((prev) => [newPatient, ...prev]);
      setToastNotification({
        type: 'success',
        message: `Pasien baru ${newPatient.name} ditambahkan ke alokasi bulan ini.`,
      });
    }
    setEditingPatient(null);
  };

  // Delete Patient
  const handleDeletePatient = (patientId: string) => {
    const target = patients.find((p) => p.id === patientId);
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus data pasien ${target?.name || 'ini'} dari jadwal alokasi?`
    );
    if (!confirmed) return;

    setPatients((prev) => prev.filter((p) => p.id !== patientId));
    setToastNotification({
      type: 'info',
      message: `Pasien ${target?.name || ''} telah dihapus dari daftar.`,
    });
  };

  // Update Week Status (M1, M2, M3, M4)
  const handleUpdateWeekStatus = (
    patientId: string,
    weekKey: 'week1' | 'week2' | 'week3' | 'week4',
    newStatus: DoseStatus,
    nurseName?: string
  ) => {
    setPatients((prev) =>
      prev.map((patient) => {
        if (patient.id !== patientId) return patient;

        const currentWeek = patient.weeks[weekKey];
        const updatedWeek = {
          ...currentWeek,
          status: newStatus,
          administeredAt: newStatus === 'Diberikan' 
            ? new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
            : undefined,
          administeredBy: newStatus === 'Diberikan' ? (nurseName || 'Perawat HD') : undefined,
        };

        const updatedWeeks = {
          ...patient.weeks,
          [weekKey]: updatedWeek,
        };

        // Recalculate overall status
        const allActiveWeeks = ['week1', 'week2', 'week3', 'week4'].filter(
          (k) => (updatedWeeks as any)[k].status !== 'Tidak Ada Jadwal'
        );
        const allDone = allActiveWeeks.every(
          (k) => (updatedWeeks as any)[k].status === 'Diberikan'
        );

        let overallStatus = patient.overallStatus;
        if (patient.recommendation.category === 'TRANSFUSI_2_RAWAT_INAP') {
          overallStatus = 'Perlu Perhatian';
        } else if (allDone && allActiveWeeks.length > 0) {
          overallStatus = 'Selesai';
        } else {
          overallStatus = 'Berjalan';
        }

        return {
          ...patient,
          weeks: updatedWeeks,
          overallStatus,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  // Update Date-level action (Injeksi Diberikan, Tunda ke Hari Kedua, Reset, dll)
  const handleUpdateDateAction = (
    patientId: string,
    dateNumber: number,
    newStatus: DoseStatus,
    nurseName?: string,
    notes?: string
  ) => {
    setPatients((prev) =>
      prev.map((patient) => {
        if (patient.id !== patientId) return patient;

        const monthInfo = getMonthDaysInfo(selectedMonth);
        const dayInfo = monthInfo.days[dateNumber - 1];
        if (!dayInfo) return patient;

        const isOnceWeekly = patient.hdFrequency === '1 kali dalam satu minggu';
        const { isPrimary, pairedDate } = getPairedHDDate(
          dateNumber,
          dayInfo.dayOfWeek,
          patient.scheduleDay,
          monthInfo.daysInMonth,
          patient.hdFrequency,
          patient.singleDay
        );

        const currentRecords = { ...(patient.dailyRecords || {}) };

        if (newStatus === 'Tunda') {
          // Jika ditunda di Hari Awal (misal Senin 7 Sept untuk 2x/mgg, atau Rabu 2 Sept untuk 1x/mgg):
          if (isPrimary && pairedDate) {
            const defaultNote = isOnceWeekly
              ? `Ditunda tgl ${dateNumber}, dialihkan ke sesi HD berikutnya tgl ${pairedDate}`
              : 'Ditunda di Hari Awal, dialihkan ke Hari Kedua';
            currentRecords[dateNumber] = {
              status: 'Tunda',
              postponedToDate: pairedDate,
              notes: notes || defaultNote,
            };
            currentRecords[pairedDate] = {
              status: 'Belum',
              postponedFromDate: dateNumber,
              notes: `Jadwal Pengganti dari penundaan tgl ${dateNumber}`,
            };
            setToastNotification({
              type: 'info',
              message: isOnceWeekly
                ? `Pemberian EPO tgl ${dateNumber} Ditunda (❌) dan otomatis dialihkan ke sesi berikutnya tgl ${pairedDate}.`
                : `Pemberian EPO tgl ${dateNumber} Ditunda (❌) dan otomatis dialihkan ke Hari Ke-2 tgl ${pairedDate}.`,
            });
          } else {
            currentRecords[dateNumber] = {
              status: 'Tunda',
              notes: notes || 'Pemberian ditunda',
            };
            setToastNotification({
              type: 'info',
              message: `Pemberian EPO tgl ${dateNumber} Ditunda (❌).`,
            });
          }
        } else if (newStatus === 'Diberikan') {
          const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
          currentRecords[dateNumber] = {
            ...(currentRecords[dateNumber] || {}),
            status: 'Diberikan',
            administeredAt: nowStr,
            administeredBy: nurseName || 'Ns. Maya',
            notes: notes || undefined,
          };
          setToastNotification({
            type: 'success',
            message: `EPO Diberikan (✅) 2000 IU pada tanggal ${dateNumber}.`,
          });
        } else if (newStatus === 'Batal') {
          currentRecords[dateNumber] = {
            ...(currentRecords[dateNumber] || {}),
            status: 'Batal',
            notes: notes || 'Dibatalkan',
          };
          setToastNotification({
            type: 'info',
            message: `Pemberian EPO tgl ${dateNumber} dibatalkan.`,
          });
        } else if (newStatus === 'Belum') {
          // Reset status tanggal
          const existing = currentRecords[dateNumber];
          if (existing?.postponedToDate) {
            delete currentRecords[existing.postponedToDate];
          }
          if (existing?.postponedFromDate) {
            delete currentRecords[existing.postponedFromDate];
          }
          delete currentRecords[dateNumber];
          setToastNotification({
            type: 'info',
            message: `Status tanggal ${dateNumber} di-reset ke 2000 (Terjadwal EPO).`,
          });
        }

        // Hitung total dosis diberikan dan sinkronkan dengan status overall
        let totalGiven = 0;
        for (let d = 1; d <= monthInfo.daysInMonth; d++) {
          const info = getDateDoseDisplayInfo({ ...patient, dailyRecords: currentRecords }, d, monthInfo);
          if (info.cellCode === '✅' || (info.cellCode as any) === 'P') totalGiven++;
        }

        let overallStatus = patient.overallStatus;
        if (patient.recommendation.category === 'TRANSFUSI_2_RAWAT_INAP') {
          overallStatus = 'Perlu Perhatian';
        } else if (totalGiven >= patient.recommendation.totalEpoVials && patient.recommendation.totalEpoVials > 0) {
          overallStatus = 'Selesai';
        } else if (totalGiven > 0) {
          overallStatus = 'Berjalan';
        }

        // Sinkronkan ke alokasi minggu (weeks) secara akurat
        const updatedWeeks = { ...patient.weeks };
        const originalSourceDate = currentRecords[dateNumber]?.postponedFromDate || dateNumber;
        const weekNum = getHDSessionWeek(originalSourceDate, monthInfo.daysInMonth, patient.scheduleDay, currentRecords[dateNumber]?.postponedFromDate);
        const weekKey = `week${weekNum}` as 'week1' | 'week2' | 'week3' | 'week4';
        if (updatedWeeks[weekKey]) {
          if (newStatus === 'Diberikan') {
            updatedWeeks[weekKey] = {
              ...updatedWeeks[weekKey],
              status: 'Diberikan',
              administeredAt: currentRecords[dateNumber]?.administeredAt,
              administeredBy: currentRecords[dateNumber]?.administeredBy,
              notes: currentRecords[dateNumber]?.postponedFromDate 
                ? `Diberikan pada Hari Kedua (tgl ${dateNumber}) pengalihan dari penundaan tgl ${currentRecords[dateNumber].postponedFromDate}`
                : undefined,
            };
          } else if (newStatus === 'Tunda') {
            updatedWeeks[weekKey] = {
              ...updatedWeeks[weekKey],
              status: 'Tunda',
              notes: pairedDate ? `Ditunda di Hari Awal (tgl ${dateNumber}), dialihkan ke Hari Kedua (tgl ${pairedDate})` : 'Ditunda',
            };
          } else if (newStatus === 'Belum') {
            updatedWeeks[weekKey] = {
              ...updatedWeeks[weekKey],
              status: 'Belum',
              notes: undefined,
              administeredAt: undefined,
              administeredBy: undefined,
            };
          }
        }

        return {
          ...patient,
          dailyRecords: currentRecords,
          weeks: updatedWeeks,
          overallStatus,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  // Bulk Import Patients Handler
  const handleImportPatients = (newPatients: PatientRecord[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setPatients(newPatients);
      setToastNotification({
        type: 'success',
        message: `Berhasil mengganti seluruh data dengan ${newPatients.length} pasien baru.`,
      });
    } else {
      // Append mode: update if same RM exists, or add new
      const incomingRmMap = new Map(newPatients.map((p) => [p.noRm.toLowerCase(), p]));
      const updatedExisting = patients.map((p) => {
        const match = incomingRmMap.get(p.noRm.toLowerCase());
        if (match) {
          incomingRmMap.delete(p.noRm.toLowerCase());
          return match;
        }
        return p;
      });
      const remainingNew = Array.from(incomingRmMap.values());
      const combined = [...remainingNew, ...updatedExisting];
      setPatients(combined);
      setToastNotification({
        type: 'success',
        message: `Berhasil memasukkan ${newPatients.length} pasien (${remainingNew.length} pasien baru, ${newPatients.length - remainingNew.length} data diperbarui).`,
      });
    }
  };

  // Batch Update Hb Awal Bulan
  const handleSaveBatchHb = (updatedHbList: { id: string; hbValue: number; hbDate: string }[]) => {
    const updateMap = new Map(updatedHbList.map((item) => [item.id, item]));

    setPatients((prev) =>
      prev.map((patient) => {
        const update = updateMap.get(patient.id);
        if (!update) return patient;

        const validHb = update.hbValue;
        const reco = calculateClinicalRecommendation(validHb);
        const isCategoryChanged = reco.category !== patient.recommendation.category;
        const weeks = isCategoryChanged
          ? generateDefaultWeeks(reco.category, selectedMonth)
          : patient.weeks;

        return {
          ...patient,
          hbValue: validHb,
          hbDate: update.hbDate || patient.hbDate,
          recommendation: reco,
          weeks,
          overallStatus: validHb === 0 
            ? 'Menunggu' 
            : reco.category === 'TRANSFUSI_2_RAWAT_INAP' 
            ? 'Perlu Perhatian' 
            : patient.overallStatus,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setToastNotification({
      type: 'success',
      message: `Berhasil memperbarui nilai Hb untuk ${updatedHbList.length} pasien! Rekomendasi klinis & alokasi telah diperbarui.`,
    });
  };

  const pendingHbCount = patients.filter((p) => p.hbValue <= 0).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      
      {/* Toast Notification Banner */}
      {toastNotification && (
        <div className="print:hidden fixed top-20 right-4 z-50 max-w-md animate-in slide-in-from-top-4 duration-200">
          <div className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 text-xs ${
            toastNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-700'
              : toastNotification.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-700'
              : 'bg-indigo-50 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-700'
          }`}>
            {toastNotification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {toastNotification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {toastNotification.type === 'info' && <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />}
            <div className="flex-1 font-medium">{toastNotification.message}</div>
            <button
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-slate-600 ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main App Header */}
      <div className="print:hidden">
        <Header
          user={user}
          spreadsheetConfig={spreadsheetConfig}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenMonthlyHbModal={() => setIsMonthlyHbModalOpen(true)}
          onOpenCalculatorModal={() => setIsCalculatorModalOpen(true)}
          onOpenPrintModal={() => setIsPrintModalOpen(true)}
          onOpenAddPatientModal={() => {
            setEditingPatient(null);
            setIsPatientModalOpen(true);
          }}
          onOpenBulkImportModal={() => setIsBulkImportModalOpen(true)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          isSyncing={isSyncing}
          isLoggingIn={isLoggingIn}
          pendingHbCount={pendingHbCount}
        />
      </div>

      {/* Main Content Area */}
      <main className="print:hidden flex-1 max-w-[1600px] 2xl:max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        
        {/* Google Sheets Sync Banner Indicator if Not Connected */}
        {!spreadsheetConfig?.spreadsheetId && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-xs shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm">Sinkronisasikan dengan Google Sheets (2 Arah)</h3>
                <p className="text-[11px] text-emerald-100">
                  Hubungkan dengan spreadsheet tim HD atau buat file spreadsheet baru otomatis di Google Drive Anda.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="h-8.5 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-semibold rounded-lg bg-white text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 shadow-xs transition cursor-pointer shrink-0"
            >
              <span>Setup Google Sheets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Clinical Protocol & Key Statistics */}
        <DashboardStats patients={patients} />

        {/* Patient Table & Schedule Management */}
        <PatientTable
          patients={patients}
          selectedMonth={selectedMonth}
          onEditPatient={(patient) => {
            setEditingPatient(patient);
            setIsPatientModalOpen(true);
          }}
          onDeletePatient={handleDeletePatient}
          onUpdateWeekStatus={handleUpdateWeekStatus}
          onUpdateDateAction={handleUpdateDateAction}
          onOpenBulkImportModal={() => setIsBulkImportModalOpen(true)}
          onOpenAddPatientModal={() => {
            setEditingPatient(null);
            setIsPatientModalOpen(true);
          }}
          onPushToSheet={handleQuickPushToSheet}
          isSyncing={isSyncing}
        />

      </main>

      {/* Footer */}
      <footer className="print:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 text-[11px] text-slate-500 dark:text-slate-400 text-center">
        <p className="flex items-center justify-center gap-1.5 flex-wrap">
          <strong className="text-rose-700 dark:text-rose-400 font-bold">EPOCARE</strong>
          <span>•</span>
          <span>Sistem Alokasi Terapi Eritropoietin & Transfusi Pasien Hemodialisa RS Happy Land Medical Centre</span>
        </p>
      </footer>

      {/* Modals */}
      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false);
          setEditingPatient(null);
        }}
        onSave={handleSavePatient}
        initialPatient={editingPatient}
        currentMonth={selectedMonth}
      />

      <GoogleSheetsSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        user={user}
        spreadsheetConfig={spreadsheetConfig}
        onSaveSpreadsheetConfig={handleSaveSpreadsheetConfig}
        patients={patients}
        onPullFromSheet={handlePullFromSheet}
        onPushToSheet={handlePushToSheet}
        onPullViaAppsScript={handlePullViaAppsScript}
        onPushViaAppsScript={handlePushViaAppsScript}
        onImportCsv={handleImportCsv}
        onSignIn={handleSignIn}
        selectedMonth={selectedMonth}
      />

      <ClinicalCalculatorModal
        isOpen={isCalculatorModalOpen}
        onClose={() => setIsCalculatorModalOpen(false)}
        onApplyToNewPatient={(hb) => {
          setEditingPatient(null);
          setIsPatientModalOpen(true);
        }}
      />

      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        patients={patients}
        selectedMonth={selectedMonth}
      />

      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onImportPatients={handleImportPatients}
        selectedMonth={selectedMonth}
      />

      <MonthlyHbInputModal
        isOpen={isMonthlyHbModalOpen}
        onClose={() => setIsMonthlyHbModalOpen(false)}
        patients={patients}
        selectedMonth={selectedMonth}
        onSaveBatchHb={handleSaveBatchHb}
      />

    </div>
  );
}
