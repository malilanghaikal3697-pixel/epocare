export type ActionCategory = 
  | 'TRANSFUSI_2_RAWAT_INAP' 
  | 'TRANSFUSI_1_KANTONG' 
  | 'EPO_4X_2000' 
  | 'EPO_1X_2000' 
  | 'HOLD_EVALUASI'
  | 'MENUNGGU_HASIL_LAB';

export interface ClinicalRecommendation {
  category: ActionCategory;
  title: string;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
  doseDescription: string;
  totalEpoIu: number;
  totalEpoVials: number;
  transfusionBags: number;
  isInpatientNeeded: boolean;
  notes: string;
  protocolBadge: string;
}

export type HDDaySchedule = 'Senin - Kamis' | 'Selasa - Jumat' | 'Rabu - Sabtu';
export type HDShift = 'Shift 1 (Pagi)' | 'Shift 2 (Siang)';
export type HDFrequency = '1 kali dalam satu minggu' | '2 kali dalam satu minggu';
export type SingleHDDay = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export type DoseStatus = 'Belum' | 'Diberikan' | 'Tunda' | 'Batal' | 'Tidak Ada Jadwal';

export interface WeekScheduleItem {
  weekNumber: 1 | 2 | 3 | 4;
  plannedDate?: string;
  status: DoseStatus;
  doseIU: number;
  administeredAt?: string;
  administeredBy?: string; // Paraf / Nama perawat
  notes?: string;
}

export interface DailyActionRecord {
  status: DoseStatus; // 'Belum' | 'Diberikan' | 'Tunda' | 'Batal'
  postponedToDate?: number; // e.g. 7 ditunda ke 10
  postponedFromDate?: number; // e.g. 10 menerima penundaan dari 7
  administeredAt?: string;
  administeredBy?: string;
  notes?: string;
}

export interface PatientRecord {
  id: string; // RM or generated UUID
  noRm: string;
  name: string;
  age?: number;
  gender?: 'L' | 'P';
  hdFrequency?: HDFrequency; // '1 kali dalam satu minggu' | '2 kali dalam satu minggu'
  singleDay?: SingleHDDay; // 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu'
  scheduleDay: HDDaySchedule;
  scheduleShift: HDShift;
  hbValue: number; // in g/dL, e.g. 7.8
  hbDate: string; // YYYY-MM-DD
  monthPeriod: string; // e.g. '2026-09'
  recommendation: ClinicalRecommendation;
  weeks: {
    week1: WeekScheduleItem;
    week2: WeekScheduleItem;
    week3: WeekScheduleItem;
    week4: WeekScheduleItem;
  };
  dailyRecords?: Record<number, DailyActionRecord>;
  overallStatus: 'Menunggu' | 'Berjalan' | 'Selesai' | 'Perlu Perhatian';
  clinicalNotes?: string;
  doctorInCharge?: string; // DPJP
  updatedAt: string;
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  sheetName: string;
  lastSyncedAt?: string;
  appsScriptUrl?: string;
  syncMode?: 'oauth' | 'appsscript' | 'csv';
}

export interface SheetRowData {
  noRm: string;
  name: string;
  schedule: string;
  hbDate: string;
  hbValue: string;
  rekomendasi: string;
  week1: string;
  week2: string;
  week3: string;
  week4: string;
  status: string;
  catatan: string;
  terakhirUpdate: string;
}
