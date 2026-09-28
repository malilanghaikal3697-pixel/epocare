import { PatientRecord, HDDaySchedule, HDShift, HDFrequency, SingleHDDay, DoseStatus } from '../types/dialysis';
import { calculateClinicalRecommendation, generateDefaultWeeks } from './clinicalRules';

export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxn0Iym9cWYr6fENri-ZMJx_oo5vS5LvN6UD5pU_mOiOrhjS8wXDn2hy6_51mjA4Ic7kg/exec';

export const OFFICIAL_SPREADSHEET_ID = '1O7mUzJoS19u4v4BYD5wI4xe2mjfBYn3wzNLmi11KlY8';
export const OFFICIAL_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1O7mUzJoS19u4v4BYD5wI4xe2mjfBYn3wzNLmi11KlY8/edit';

export const SCHEDULE_SHEETS: { title: HDDaySchedule; tabName: string }[] = [
  { title: 'Senin - Kamis', tabName: 'Senin-Kamis' },
  { title: 'Selasa - Jumat', tabName: 'Selasa-Jumat' },
  { title: 'Rabu - Sabtu', tabName: 'Rabu-Sabtu' },
];

/**
 * Mendapatkan indeks hari (1=Senin s/d 6=Sabtu) dari pilihan hari tunggal
 */
export function getDayOfWeekFromSingleDay(day: SingleHDDay): number {
  switch (day) {
    case 'Senin': return 1;
    case 'Selasa': return 2;
    case 'Rabu': return 3;
    case 'Kamis': return 4;
    case 'Jumat': return 5;
    case 'Sabtu': return 6;
    default: return 1;
  }
}

/**
 * Menentukan grup sheet HD ('Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu')
 * berdasarkan pilihan hari tunggal
 */
export function getScheduleDayFromSingleDay(day: SingleHDDay): HDDaySchedule {
  if (day === 'Senin' || day === 'Kamis') return 'Senin - Kamis';
  if (day === 'Selasa' || day === 'Jumat') return 'Selasa - Jumat';
  return 'Rabu - Sabtu';
}

/**
 * Mendapatkan jumlah hari dalam bulan tertentu dan daftar hari per tanggal
 */
export function getMonthDaysInfo(yearMonth: string) {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: { dateNumber: number; dayOfWeek: number; dateString: string }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    days.push({
      dateNumber: d,
      dayOfWeek: dateObj.getDay(), // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  return { year, month, daysInMonth, days };
}

/**
 * Mengecek apakah tanggal tertentu merupakan hari jadwal sesi HD pasien.
 * Mendukung pasien 1x/minggu (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu)
 * maupun pasien reguler 2x/minggu (Senin-Kamis, Selasa-Jumat, Rabu-Sabtu).
 */
export function isDateInHDDay(
  dayOfWeek: number, 
  scheduleDay: HDDaySchedule,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency
): boolean {
  if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
    return dayOfWeek === getDayOfWeekFromSingleDay(singleDay);
  }
  if (scheduleDay === 'Senin - Kamis') {
    return dayOfWeek === 1 || dayOfWeek === 4; // Senin (1), Kamis (4)
  }
  if (scheduleDay === 'Selasa - Jumat') {
    return dayOfWeek === 2 || dayOfWeek === 5; // Selasa (2), Jumat (5)
  }
  if (scheduleDay === 'Rabu - Sabtu') {
    return dayOfWeek === 3 || dayOfWeek === 6; // Rabu (3), Sabtu (6)
  }
  return false;
}

/**
 * Menemukan tanggal sesi HD pertama pasien di bulan berjalan (Awal Pertemuan saat jadwal HD dilaksanakan).
 * Digunakan sebagai acuan klinis utama tanggal pemeriksaan Hb lab awal bulan.
 */
export function getFirstHDDateOfMonth(
  yearMonth: string,
  scheduleDay: HDDaySchedule,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency
): { dateNumber: number; dateString: string } {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (isDateInHDDay(dayOfWeek, scheduleDay, singleDay, hdFrequency)) {
      const dateString = `${yearMonth}-${String(d).padStart(2, '0')}`;
      return { dateNumber: d, dateString };
    }
  }

  return { dateNumber: 1, dateString: `${yearMonth}-01` };
}

/**
 * Mengecek apakah hari/tanggal ini merupakan Hari Awal dari pasangan jadwal HD pasien:
 * - Senin - Kamis => Hari Awal = Senin (dayOfWeek === 1)
 * - Selasa - Jumat => Hari Awal = Selasa (dayOfWeek === 2)
 * - Rabu - Sabtu => Hari Awal = Rabu (dayOfWeek === 3)
 * Untuk pasien 1x/minggu, sesi tunggalnya selalu merupakan Hari Awal / Sesi Utama.
 */
export function isPrimaryHDDay(
  dayOfWeek: number, 
  scheduleDay: HDDaySchedule,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency
): boolean {
  if (hdFrequency === '1 kali dalam satu minggu') {
    return true;
  }
  if (scheduleDay === 'Senin - Kamis') return dayOfWeek === 1;
  if (scheduleDay === 'Selasa - Jumat') return dayOfWeek === 2;
  if (scheduleDay === 'Rabu - Sabtu') return dayOfWeek === 3;
  return false;
}

/**
 * Apakah tanggal tertentu merupakan sesi pengecekan Hb awal bulan bagi pasien ini?
 * Acuan klinis: Cek HB tetap dilaksanakan diawal pertemuan pada saat jadwal HD dilaksanakan,
 * baik untuk pasien dengan frekuensi HD 2 kali maupun 1 kali dalam satu minggu.
 */
export function isPatientHbCheckDay(
  dateNumber: number,
  days: { dateNumber: number; dayOfWeek: number; dateString: string }[],
  patient: PatientRecord
): boolean {
  const currentDay = days[dateNumber - 1];
  if (!currentDay || !isDateInHDDay(currentDay.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency)) {
    return false;
  }

  // Cari tanggal sesi HD pertama pasien di bulan berjalan (diawal pertemuan saat jadwal HD dilaksanakan)
  let firstHDDateNumber: number | null = null;
  for (let d = 1; d <= days.length; d++) {
    if (isDateInHDDay(days[d - 1].dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency)) {
      firstHDDateNumber = d;
      break;
    }
  }

  // Jika pasien memiliki hbDate spesifik yang valid pada salah satu hari jadwal HD pasien di bulan ini, gunakan tanggal tersebut
  if (patient.hbDate) {
    const targetDay = days.find((d) => d.dateString === patient.hbDate);
    if (targetDay && isDateInHDDay(targetDay.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency)) {
      return dateNumber === targetDay.dateNumber;
    }
  }

  // Default: Cek HB tetap dilaksanakan diawal pertemuan pada saat jadwal HD dilaksanakan
  return dateNumber === firstHDDateNumber;
}

/**
 * Menghitung sesi HD pasangan atau sesi HD berikutnya saat penundaan:
 * - Pasien 1x/minggu: Sesi berikutnya adalah 7 hari kemudian pada hari rutin yang sama (misal 2 Sept -> 9 Sept)
 * - Pasien 2x/minggu:
 *   Hari Awal (Senin/Selasa/Rabu) berpasangan dengan Hari Kedua (+3 hari, misal 7 Sept -> 10 Sept)
 *   Hari Kedua (Kamis/Jumat/Sabtu) merujuk ke Hari Awal (-3 hari)
 */
export function getPairedHDDate(
  dateNumber: number,
  dayOfWeek: number,
  scheduleDay: HDDaySchedule,
  daysInMonth: number,
  hdFrequency?: HDFrequency,
  singleDay?: SingleHDDay
): { isPrimary: boolean; pairedDate: number | null } {
  if (hdFrequency === '1 kali dalam satu minggu') {
    // Untuk pasien 1x/minggu: penundaan sesi dialihkan ke sesi HD berikutnya pada hari rutin yang sama (+7 hari)
    const paired = dateNumber + 7;
    return { 
      isPrimary: true, 
      pairedDate: paired <= daysInMonth ? paired : null 
    };
  }

  const isPrimary = isPrimaryHDDay(dayOfWeek, scheduleDay);
  if (isPrimary) {
    const paired = dateNumber + 3;
    return { isPrimary: true, pairedDate: paired <= daysInMonth ? paired : null };
  } else {
    const paired = dateNumber - 3;
    return { isPrimary: false, pairedDate: paired >= 1 ? paired : null };
  }
}

export interface DateDoseInfo {
  isHD: boolean;
  isHbCheck: boolean;
  isPrimary: boolean;
  pairedDate: number | null;
  cellCode: 'PRC 2' | 'PRC 1' | 'Cek' | '✅' | '❌' | '2000' | 'HD' | 'Hold' | 'Batal' | '-';
  title: string;
  isCatchUp: boolean;
  canTakeAction: boolean;
  currentStatus?: DoseStatus;
  postponedToDate?: number;
  postponedFromDate?: number;
}

export function getDateDoseDisplayInfo(
  patient: PatientRecord,
  dateNumber: number,
  monthInfo: { daysInMonth: number; days: { dateNumber: number; dayOfWeek: number; dateString: string }[] }
): DateDoseInfo {
  const dayInfo = monthInfo.days[dateNumber - 1];
  if (!dayInfo || !isDateInHDDay(dayInfo.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency)) {
    return {
      isHD: false,
      isHbCheck: false,
      isPrimary: false,
      pairedDate: null,
      cellCode: '-',
      title: 'Bukan Hari Hemodialisa',
      isCatchUp: false,
      canTakeAction: false,
    };
  }

  const isOnceWeekly = patient.hdFrequency === '1 kali dalam satu minggu';
  const isHbCheck = isPatientHbCheckDay(dateNumber, monthInfo.days, patient);
  const reco = patient.recommendation;
  const existingRecord = patient.dailyRecords?.[dateNumber];

  const { isPrimary, pairedDate } = getPairedHDDate(
    dateNumber,
    dayInfo.dayOfWeek,
    patient.scheduleDay,
    monthInfo.daysInMonth,
    patient.hdFrequency,
    patient.singleDay
  );

  // 1. Sesi Pengecekan HB Awal Bulan:
  // Cek HB tetap dilaksanakan diawal pertemuan pada saat jadwal HD dilaksanakan baik untuk pasien 2x/minggu maupun 1x/minggu
  if (isHbCheck && !existingRecord) {
    if (reco.category === 'TRANSFUSI_2_RAWAT_INAP') {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'PRC 2',
        title: `PRC 2 = Transfusi Protokol 2 (${patient.hbValue <= 0 ? 'Hb: 0' : patient.hbValue.toFixed(1) + ' g/dL'} — Transfusi 2 Bag Rawat Inap)`,
        isCatchUp: false,
        canTakeAction: false,
      };
    }
    if (reco.category === 'TRANSFUSI_1_KANTONG') {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'PRC 1',
        title: `PRC 1 = Transfusi Protokol 1 (${patient.hbValue.toFixed(1)} g/dL — Transfusi 1 Bag PRC)`,
        isCatchUp: false,
        canTakeAction: false,
      };
    }
    if (reco.category === 'MENUNGGU_HASIL_LAB' || patient.hbValue <= 0) {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'Cek',
        title: `Cek = Cek HB Lab Awal Bulan (Tanpa EPO) — Nilai: ${patient.hbValue <= 0 ? 'Hb: 0' : patient.hbValue.toFixed(1) + ' g/dL'}`,
        isCatchUp: false,
        canTakeAction: false,
      };
    }
  }

  // 2. Kategori Non-EPO (Transfusi, Hold, Menunggu Lab) pada sesi rutin
  if (reco.category === 'HOLD_EVALUASI') {
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: 'HD = Sesi Rutin (Protokol Klinis ke-5: HB > 12.00 mg/dl tidak mendapatkan terapi EPO)',
      isCatchUp: false,
      canTakeAction: false,
    };
  }
  if (reco.category === 'MENUNGGU_HASIL_LAB') {
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: 'HD = Sesi Rutin (Menunggu hasil lab Hb awal bulan)',
      isCatchUp: false,
      canTakeAction: false,
    };
  }
  if (reco.category === 'TRANSFUSI_2_RAWAT_INAP' || reco.category === 'TRANSFUSI_1_KANTONG') {
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: 'HD = Sesi Rutin',
      isCatchUp: false,
      canTakeAction: false,
    };
  }

  // 3. Kategori Terapi EPO (EPO 4x 2000 IU & EPO 1x 2000 IU Maintenance)
  // Check if date has incoming carryover postponement from an earlier date
  const incomingSourceDate = existingRecord?.postponedFromDate || (
    !isOnceWeekly && pairedDate ? (patient.dailyRecords?.[pairedDate]?.status === 'Tunda' ? pairedDate : null) : null
  );

  if (isPrimary) {
    // Sesi Utama (Senin/Selasa/Rabu untuk 2x/minggu, atau Setiap Sesi Mingguan untuk 1x/minggu)
    if (existingRecord) {
      if (existingRecord.status === 'Diberikan') {
        const catchUpText = existingRecord.postponedFromDate 
          ? ` (Pengalihan dari penundaan tgl ${existingRecord.postponedFromDate})` 
          : '';
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: '✅',
          title: `✅ = EPO Diberikan${catchUpText}${existingRecord.administeredAt ? ' (' + existingRecord.administeredAt + ')' : ''}`,
          isCatchUp: Boolean(existingRecord.postponedFromDate),
          canTakeAction: true,
          currentStatus: 'Diberikan',
          postponedFromDate: existingRecord.postponedFromDate,
        };
      }
      if (existingRecord.status === 'Tunda') {
        const dest = existingRecord.postponedToDate || pairedDate;
        const destDesc = isOnceWeekly 
          ? `Sesi HD Berikutnya tgl ${dest}` 
          : `Hari Ke-2 tgl ${dest}`;
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: '❌',
          title: `❌ = Ditunda (Ke ${destDesc})`,
          isCatchUp: false,
          canTakeAction: true,
          currentStatus: 'Tunda',
          postponedToDate: dest || undefined,
        };
      }
      if (existingRecord.status === 'Batal') {
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: 'Batal',
          title: 'Pemberian EPO Dibatalkan',
          isCatchUp: false,
          canTakeAction: true,
          currentStatus: 'Batal',
        };
      }
    }

    // Jika ada penundaan yang dialihkan ke tanggal ini
    if (incomingSourceDate) {
      return {
        isHD: true,
        isHbCheck,
        isPrimary,
        pairedDate,
        cellCode: '2000',
        title: `2000 = Terjadwal EPO (Pengalihan dari penundaan tgl ${incomingSourceDate})`,
        isCatchUp: true,
        canTakeAction: true,
        currentStatus: 'Belum',
        postponedFromDate: incomingSourceDate,
        postponedToDate: pairedDate || undefined,
      };
    }

    // Default: Terjadwal 2000 IU
    const destStr = pairedDate 
      ? (isOnceWeekly ? `(dialihkan ke tgl ${pairedDate} jika ditunda)` : `(dialihkan ke Hari Kedua tgl ${pairedDate} jika ditunda)`)
      : '';
    const checkNote = isHbCheck ? ' [Sesi Cek Hb Awal Pertemuan]' : '';
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: '2000',
      title: `2000 = Terjadwal EPO ${destStr}${checkNote}`.trim(),
      isCatchUp: false,
      canTakeAction: true,
      currentStatus: 'Belum',
      postponedToDate: pairedDate || undefined,
    };
  } else {
    // HARI KEDUA (Kamis / Jumat / Sabtu untuk pasien 2x/minggu)
    const isPairedPostponed = pairedDate ? patient.dailyRecords?.[pairedDate]?.status === 'Tunda' : false;
    const isPairedHbCheck = pairedDate ? isPatientHbCheckDay(pairedDate, monthInfo.days, patient) : false;
    const isCatchUpScheduled = isPairedPostponed || isPairedHbCheck || Boolean(incomingSourceDate);

    if (isCatchUpScheduled) {
      const sourceDate = incomingSourceDate || pairedDate;
      if (existingRecord) {
        if (existingRecord.status === 'Diberikan') {
          return {
            isHD: true,
            isHbCheck,
            isPrimary,
            pairedDate,
            cellCode: '✅',
            title: `✅ = EPO Diberikan pada Hari Kedua (Jadwal Pengalihan dari penundaan tgl ${sourceDate})`,
            isCatchUp: true,
            canTakeAction: true,
            currentStatus: 'Diberikan',
            postponedFromDate: sourceDate || undefined,
          };
        }
        if (existingRecord.status === 'Tunda') {
          return {
            isHD: true,
            isHbCheck,
            isPrimary,
            pairedDate,
            cellCode: '❌',
            title: `❌ = Ditunda pada Hari Kedua (tgl ${dateNumber})`,
            isCatchUp: true,
            canTakeAction: true,
            currentStatus: 'Tunda',
            postponedFromDate: sourceDate || undefined,
          };
        }
        if (existingRecord.status === 'Batal') {
          return {
            isHD: true,
            isHbCheck,
            isPrimary,
            pairedDate,
            cellCode: 'Batal',
            title: 'Jadwal Pengganti Dibatalkan',
            isCatchUp: true,
            canTakeAction: true,
            currentStatus: 'Batal',
            postponedFromDate: sourceDate || undefined,
          };
        }
      }

      // Jadwal Pengganti yang belum diberikan: Tampilkan 2000
      const reasonDesc = isPairedHbCheck
        ? `pengganti sesi Cek Hb tgl ${pairedDate}`
        : `dialihkan dari penundaan Hari Awal tgl ${sourceDate}`;
      return {
        isHD: true,
        isHbCheck,
        isPrimary,
        pairedDate,
        cellCode: '2000',
        title: `2000 = Terjadwal EPO (${reasonDesc})`,
        isCatchUp: true,
        canTakeAction: true,
        currentStatus: 'Belum',
        postponedFromDate: sourceDate || undefined,
      };
    }

    // Jika Hari Awal sudah diberikan atau terjadwal normal (tidak ditunda):
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: `HD = Sesi Rutin`,
      isCatchUp: false,
      canTakeAction: false,
    };
  }
}

/**
 * Menghitung sesi HD minggu ke berapa dalam bulan tersebut untuk pasien.
 * Menormalkan tanggal Hari Kedua (Kamis/Jumat/Sabtu) ke Hari Awal (Senin/Selasa/Rabu) pasangannya,
 * sehingga kedua sesi dalam satu minggu HD selalu berada di minggu yang sama!
 */
export function getHDSessionWeek(
  dateNumber: number,
  daysInMonth: number,
  scheduleDay?: HDDaySchedule,
  postponedFromDate?: number,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency
): 1 | 2 | 3 | 4 {
  // Jika ini adalah pengalihan dari penundaan hari lain, gunakan tanggal asal
  const targetDate = postponedFromDate || dateNumber;

  let normalizedDate = targetDate;
  if (hdFrequency !== '1 kali dalam satu minggu' && scheduleDay && normalizedDate > 3) {
    // Hari kedua (Kamis untuk Senin-Kamis, Jumat untuk Selasa-Jumat, Sabtu untuk Rabu-Sabtu)
    // berjarak 3 hari dari Hari Awalnya. Jika dinormalkan -3, selalu merujuk pada Hari Awal yang sama.
    const refDay = new Date(2026, 8, targetDate).getDay(); // Acuan Sept 2026
    if (!isPrimaryHDDay(refDay, scheduleDay) && normalizedDate - 3 >= 1) {
      normalizedDate = normalizedDate - 3;
    }
  }

  if (normalizedDate <= 7) return 1;
  if (normalizedDate <= 14) return 2;
  if (normalizedDate <= 21) return 3;
  return 4;
}

/**
 * Ekstraksi Spreadsheet ID dari input teks
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Mengambil detail spreadsheet
 */
export async function getSpreadsheetDetails(spreadsheetId: string, accessToken: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = 'Gagal mengakses Google Spreadsheet.';
    if (res.status === 404) message = 'Spreadsheet tidak ditemukan.';
    if (res.status === 403) message = 'Akses ditolak. Pastikan akun Google memiliki hak akses edit.';
    throw new Error(`${message} (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Membangun array baris matriks untuk Sheet Jadwal tertentu
 * DENGAN PEMISAHAN JELAS ANTARA SHIFT PAGI DAN SHIFT SIANG PADA BARIS TERPISAH
 * SERTA KODE MINIMALIS (P, 2000, PRC, HD) AGAR MUDAH DIBACA DI KOLOM BERUKURAN KECIL
 */
export function buildScheduleMatrixTable(
  patients: PatientRecord[],
  scheduleDay: HDDaySchedule,
  yearMonth: string
): string[][] {
  const { daysInMonth, days } = getMonthDaysInfo(yearMonth);
  const filteredPatients = patients.filter((p) => p.scheduleDay === scheduleDay);

  // Pisahkan pasien berdasarkan shift: Pagi dan Siang (Shift Sore dihapus sesuai kebijakan operasional HD)
  const pagiPatients = filteredPatients.filter((p) => p.scheduleShift.includes('Pagi'));
  const siangPatients = filteredPatients.filter((p) => p.scheduleShift.includes('Siang'));

  // Baris Header Kolom
  const header: string[] = [
    'No',
    'Nama Pasien',
    'No. RM',
    'Frekuensi HD',
    'Shift',
    'Hb',
    'Alokasi Klinis / Dosis',
  ];

  // Kolom tanggal 1 s/d 30/31
  for (let d = 1; d <= daysInMonth; d++) {
    header.push(String(d));
  }

  // Kolom ringkasan di sebelah kanan
  header.push(
    'Target EPO',
    'Realisasi',
    'Rasio',
    'PRC',
    'Status',
    'Catatan Klinis'
  );

  const rows: string[][] = [header];

  // Inisialisasi akumulator rekap harian
  const dailyPagiCount = new Array(daysInMonth).fill(0);
  const dailySiangCount = new Array(daysInMonth).fill(0);
  const dailyEpoScheduledCount = new Array(daysInMonth).fill(0);
  const dailyEpoGivenCount = new Array(daysInMonth).fill(0);
  const dailyPrcCount = new Array(daysInMonth).fill(0);
  const dailyTotalPatients = new Array(daysInMonth).fill(0);

  let grandTargetEpo = 0;
  let grandRealisasiEpo = 0;
  let grandTotalPrc = 0;

  // Helper untuk membuat baris pasien
  const renderPatientRow = (patient: PatientRecord, displayNo: number) => {
    const freqDisplay = patient.hdFrequency === '1 kali dalam satu minggu'
      ? (patient.singleDay ? `1x / mgg (${patient.singleDay})` : '1x / mgg')
      : '2x / mgg';
    const row: string[] = [
      String(displayNo),
      patient.name,
      patient.noRm,
      freqDisplay,
      patient.scheduleShift.includes('Pagi') ? 'Pagi (P)' : 'Siang (S)',
      patient.hbValue.toFixed(1),
      patient.recommendation.title,
    ];

    const reco = patient.recommendation;
    let patientEpoGiven = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const info = getDateDoseDisplayInfo(patient, d, { daysInMonth, days });
      if (!info.isHD) {
        row.push('-');
      } else {
        dailyTotalPatients[d - 1]++;
        if (patient.scheduleShift.includes('Pagi')) dailyPagiCount[d - 1]++;
        else dailySiangCount[d - 1]++;

        if (info.cellCode === '2000') {
          dailyEpoScheduledCount[d - 1]++;
        } else if (info.cellCode === '✅' || (info.cellCode as any) === 'P') {
          patientEpoGiven++;
          dailyEpoGivenCount[d - 1]++;
        }

        if (info.cellCode === 'PRC 2' || (info.cellCode as any) === 'PRC') {
          dailyPrcCount[d - 1] += 2;
        } else if (info.cellCode === 'PRC 1') {
          dailyPrcCount[d - 1] += 1;
        }

        row.push(info.cellCode);
      }
    }

    const targetEpo = reco.totalEpoVials;
    grandTargetEpo += targetEpo;
    grandRealisasiEpo += patientEpoGiven;
    grandTotalPrc += reco.transfusionBags;

    row.push(
      String(targetEpo),
      String(patientEpoGiven),
      `${patientEpoGiven} : ${targetEpo}`,
      String(reco.transfusionBags > 0 ? reco.transfusionBags : '-'),
      patient.overallStatus,
      patient.clinicalNotes || ''
    );

    return row;
  };

  // Helper untuk membuat baris pemisah kelompok shift (bebas dari tanda '=' atau '==' agar tidak memicu #ERROR! formula parse)
  const makeShiftBannerRow = (label: string, shiftTag: string) => {
    const banner = ['•', label, '', shiftTag, '', '', ''];
    for (let d = 1; d <= daysInMonth; d++) {
      banner.push('');
    }
    banner.push('', '', '', '', '', 'Sub Bagian Shift');
    return banner;
  };

  // 1. BAGIAN SHIFT 1: PAGI (DIPISAHKAN PADA BARIS SENDIRI)
  if (pagiPatients.length > 0) {
    rows.push(makeShiftBannerRow('KELOMPOK SHIFT PAGI (07:00 WIB)', 'Shift 1 (Pagi)'));
    pagiPatients.forEach((patient, idx) => {
      rows.push(renderPatientRow(patient, idx + 1));
    });
  }

  // Baris Pemisah / Spasi Antara Shift
  rows.push(new Array(header.length).fill(''));

  // 2. BAGIAN SHIFT 2: SIANG (DIPISAHKAN PADA BARIS SENDIRI)
  if (siangPatients.length > 0) {
    rows.push(makeShiftBannerRow('KELOMPOK SHIFT SIANG (12:30 WIB)', 'Shift 2 (Siang)'));
    siangPatients.forEach((patient, idx) => {
      rows.push(renderPatientRow(patient, idx + 1));
    });
  }

  // Spasi sebelum baris total ringkasan
  rows.push(new Array(header.length).fill(''));

  // BARIS TOTAL RINGKASAN BAWAH (PERSIS SEPERTI BARIS 19-24 PADA GOOGLE SHEETS HEMOSHIF)
  const prefixPagi = ['', 'Total Shift Pagi (P)', '-', '-', 'Sif Pagi', '-', '-'];
  const prefixSiang = ['', 'Total Shift Siang (S)', '-', '-', 'Sif Siang', '-', '-'];
  const prefixPrc = ['', 'Total Kebutuhan PRC (Kantong)', '-', '-', 'Bank Darah', '-', '-'];
  const prefixEpoTerjadwal = ['', 'Kebutuhan Harian EPO (Ampul 2000 IU)', '-', '-', 'Terjadwal', '-', '-'];
  const prefixEpoKeluar = ['', 'Epo Keluar', '-', '-', 'Diberikan', '-', '-'];
  const prefixTotal = ['', 'Total Pasien HD Harian', '-', '-', 'Total Sesi', '-', '-'];

  for (let d = 0; d < daysInMonth; d++) {
    prefixPagi.push(dailyPagiCount[d] > 0 ? String(dailyPagiCount[d]) : '-');
    prefixSiang.push(dailySiangCount[d] > 0 ? String(dailySiangCount[d]) : '-');
    prefixPrc.push(dailyPrcCount[d] > 0 ? String(dailyPrcCount[d]) : '-');
    prefixEpoTerjadwal.push(dailyEpoScheduledCount[d] > 0 ? String(dailyEpoScheduledCount[d]) : '-');
    prefixEpoKeluar.push(dailyEpoGivenCount[d] > 0 ? String(dailyEpoGivenCount[d]) : '-');
    prefixTotal.push(dailyTotalPatients[d] > 0 ? String(dailyTotalPatients[d]) : '-');
  }

  // Ringkasan Total Kanan
  prefixPagi.push('-', '-', '-', '-', '-', `${dailyPagiCount.reduce((a, b) => a + b, 0)} Sesi Pagi`);
  prefixSiang.push('-', '-', '-', '-', '-', `${dailySiangCount.reduce((a, b) => a + b, 0)} Sesi Siang`);
  prefixPrc.push('-', '-', '-', String(grandTotalPrc), '-', 'Total Kantong');
  prefixEpoTerjadwal.push(String(grandTargetEpo), '-', '-', '-', '-', `${dailyEpoScheduledCount.reduce((a, b) => a + b, 0)} Ampul Terjadwal`);
  prefixEpoKeluar.push('-', String(grandRealisasiEpo), `${grandRealisasiEpo} : ${grandTargetEpo}`, '-', '-', `${dailyEpoGivenCount.reduce((a, b) => a + b, 0)} Ampul Keluar`);
  prefixTotal.push('-', '-', '-', '-', `${filteredPatients.length} Pasien`, 'Grand Total');

  rows.push(prefixPagi);
  rows.push(prefixSiang);
  rows.push(prefixPrc);
  rows.push(prefixEpoTerjadwal);
  rows.push(prefixEpoKeluar);
  rows.push(prefixTotal);

  return rows;
}

/**
 * Membuat spreadsheet baru dengan 3 sheet jadwal:
 * 1. Senin-Kamis
 * 2. Selasa-Jumat
 * 3. Rabu-Sabtu
 */
export async function createNewSpreadsheet(title: string, accessToken: string) {
  const payload = {
    properties: {
      title: title || `Jadwal & Alokasi EPO HD - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
    },
    sheets: SCHEDULE_SHEETS.map((item) => ({
      properties: {
        title: item.tabName,
        gridProperties: {
          frozenRowCount: 1,
          frozenColumnCount: 5,
          rowCount: 120,
          columnCount: 46,
        },
      },
    })),
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal membuat spreadsheet baru: ${errorText}`);
  }

  return await res.json();
}

/**
 * Menyimpan seluruh data pasien ke 3 sheet Google Sheets:
 * - Tab 'Senin-Kamis'
 * - Tab 'Selasa-Jumat'
 * - Tab 'Rabu-Sabtu'
 * Serta menerapkan ukuran kolom minimalis dan pemisahan baris per shift
 */
export async function pushPatientsToSheet(
  spreadsheetId: string,
  patients: PatientRecord[],
  accessToken: string,
  yearMonth: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  targetSchedule?: HDDaySchedule
) {
  const metadata = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const existingSheets: string[] = (metadata.sheets || []).map((s: any) => s.properties?.title);

  const sheetsToUpdate = targetSchedule 
    ? SCHEDULE_SHEETS.filter((s) => s.title === targetSchedule)
    : SCHEDULE_SHEETS;

  // Buat tab yang belum ada
  for (const item of sheetsToUpdate) {
    if (!existingSheets.includes(item.tabName)) {
      await addSheetTab(spreadsheetId, item.tabName, accessToken);
    }
  }

  // Kirim data matriks ke masing-masing sheet jadwal
  for (const item of sheetsToUpdate) {
    const tableData = buildScheduleMatrixTable(patients, item.title, yearMonth);
    const range = `${item.tabName}!A1:${getColLetter(tableData[0]?.length || 40)}${tableData.length + 10}`;
    await updateSheetValues(spreadsheetId, range, tableData, accessToken);
  }

  // Terapkan styling visual & UKURAN KOLOM MINIMALIS
  try {
    await applyHeaderAndColumnStyling(spreadsheetId, accessToken);
  } catch (err) {
    console.warn('Gagal menerapkan styling conditional (data tetap tersimpan):', err);
  }

  return { success: true };
}

/**
 * Membaca data pasien dari 3 sheet jadwal: 'Senin-Kamis', 'Selasa-Jumat', 'Rabu-Sabtu'
 */
export async function readPatientsFromSheet(
  spreadsheetId: string,
  accessToken: string,
  currentMonth: string
): Promise<PatientRecord[]> {
  const metadata = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const existingSheets: string[] = (metadata.sheets || []).map((s: any) => s.properties?.title);

  const allPatients: PatientRecord[] = [];
  const targetTabs = SCHEDULE_SHEETS.filter((s) => existingSheets.includes(s.tabName));

  if (targetTabs.length === 0 && existingSheets.length > 0) {
    const singleData = await readSingleSheetData(spreadsheetId, existingSheets[0], 'Senin - Kamis', accessToken, currentMonth);
    return singleData;
  }

  for (const item of targetTabs) {
    const patientsInTab = await readSingleSheetData(
      spreadsheetId,
      item.tabName,
      item.title,
      accessToken,
      currentMonth
    );
    allPatients.push(...patientsInTab);
  }

  return allPatients;
}

/**
 * Mengecek apakah baris merupakan header, banner shift, atau baris total ringkasan
 * (Total Shift Pagi, Total Shift Siang, Kebutuhan PRC, Kebutuhan EPO, Epo Keluar, Total Pasien)
 * agar tidak salah terimpor sebagai data pasien.
 */
export function isSummaryOrHeaderRow(name: string, noRm: string = '', fullLine: string = ''): boolean {
  const n = (name || '').toLowerCase().trim();
  const rm = (noRm || '').toLowerCase().trim();
  const line = (fullLine || '').toLowerCase().trim();

  if (!n && !rm) return true;
  if (n.startsWith('==') || n.startsWith('•') || n.startsWith('#')) return true;
  if (n.includes('#error') || rm.includes('#error') || line.includes('#error')) return true;

  const summaryKeywords = [
    'total shift',
    'shift pagi',
    'shift siang',
    'sif pagi',
    'sif siang',
    'kebutuhan transfusi',
    'transfusi prc',
    'kantong prc',
    'kebutuhan harian epo',
    'kebutuhan epo',
    'kebutuhan harian',
    'epo keluar',
    'total kebutuhan',
    'total pasien',
    'pasien hd per hari',
    'pasien hd harian',
    'kelompok shift',
    'grand total',
    'bank darah',
    'target epo',
    'ampul terjadwal',
    'ampul diberikan',
    'ampul keluar',
  ];

  if (summaryKeywords.some((kw) => n.includes(kw) || rm.includes(kw) || line.includes(kw))) {
    return true;
  }

  // Cek kata kunci awalan
  if (n.startsWith('total') || n === 'epo keluar' || n.includes('kebutuhan') || n.startsWith('kelompok')) {
    return true;
  }

  return false;
}

async function readSingleSheetData(
  spreadsheetId: string,
  tabName: string,
  scheduleDay: HDDaySchedule,
  accessToken: string,
  currentMonth: string
): Promise<PatientRecord[]> {
  const range = `${tabName}!A1:AZ150`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) return [];

  const json = await res.json();
  const rows: string[][] = json.values || [];
  if (rows.length <= 1) return [];

  const dataRows = rows.slice(1);
  const patients: PatientRecord[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = (row[1] || '').trim();
    const noRm = (row[2] || '').trim();

    // Lewati baris kosong, header kelompok shift, baris total ringkasan, atau baris error
    if (!name || isSummaryOrHeaderRow(name, noRm, row.join(' '))) {
      continue;
    }

    const col3 = (row[3] || '').trim();
    const col3Lower = col3.toLowerCase();
    let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
    let singleDay: SingleHDDay | undefined = undefined;
    let scheduleShift: HDShift = 'Shift 1 (Pagi)';
    let rawHb = 0;

    if (col3Lower.includes('pagi') || col3Lower.includes('siang')) {
      // Format Lama (tanpa kolom Frekuensi HD)
      scheduleShift = col3Lower.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = parseFloat(String(row[4] || '0').replace(',', '.'));
    } else {
      // Format Baru (dengan kolom Frekuensi HD)
      hdFrequency = col3Lower.includes('1') ? '1 kali dalam satu minggu' : '2 kali dalam satu minggu';
      if (col3Lower.includes('senin')) singleDay = 'Senin';
      else if (col3Lower.includes('selasa')) singleDay = 'Selasa';
      else if (col3Lower.includes('rabu')) singleDay = 'Rabu';
      else if (col3Lower.includes('kamis')) singleDay = 'Kamis';
      else if (col3Lower.includes('jumat')) singleDay = 'Jumat';
      else if (col3Lower.includes('sabtu')) singleDay = 'Sabtu';

      if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
        scheduleDay = getScheduleDayFromSingleDay(singleDay);
      }

      const shiftStr = (row[4] || '').toLowerCase();
      scheduleShift = shiftStr.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = parseFloat(String(row[5] || '0').replace(',', '.'));
    }

    const hbValue = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;

    const reco = calculateClinicalRecommendation(hbValue);
    const defaultWeeks = generateDefaultWeeks(reco.category, currentMonth);

    const statusColIndex = row.length - 2;
    const overallStatusRaw = (row[statusColIndex] || '').trim();
    let overallStatus: PatientRecord['overallStatus'] = 'Berjalan';
    if (overallStatusRaw.includes('Selesai')) overallStatus = 'Selesai';
    else if (overallStatusRaw.includes('Perhatian') || reco.category === 'TRANSFUSI_2_RAWAT_INAP') overallStatus = 'Perlu Perhatian';

    const notes = row[row.length - 1] || '';

    patients.push({
      id: `sheet-${noRm || i}-${Date.now()}`,
      noRm: noRm || `RM-${1000 + i}`,
      name,
      hdFrequency,
      singleDay,
      scheduleDay,
      scheduleShift,
      hbValue,
      hbDate: `${currentMonth}-02`,
      monthPeriod: currentMonth,
      recommendation: reco,
      weeks: defaultWeeks,
      overallStatus,
      clinicalNotes: notes,
      updatedAt: new Date().toISOString(),
    });
  }

  return patients;
}

/**
 * Kode Google Apps Script dengan:
 * 1. Pemisahan Shift Pagi dan Shift Siang pada baris berbeda
 * 2. Ukuran kolom dibuat kecil & minimalis (kolom tanggal 28px)
 */
export const APPS_SCRIPT_SAMPLE_CODE = `function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ["Senin-Kamis", "Selasa-Jumat", "Rabu-Sabtu"];
  var result = {};
  
  sheets.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) {
      result[name] = sh.getDataRange().getValues();
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (body.action === "push" && body.scheduleData) {
      for (var tabName in body.scheduleData) {
        var rows = body.scheduleData[tabName];
        if (!rows || rows.length === 0) continue;
        
        var sheet = ss.getSheetByName(tabName);
        if (!sheet) {
          sheet = ss.insertSheet(tabName);
        }
        
        sheet.clearContents();
        sheet.clearFormats();
        
        var numRows = rows.length;
        var numCols = rows[0].length;
        var range = sheet.getRange(1, 1, numRows, numCols);
        range.setValues(rows);
        
        // 1. Format Header Kolom (Biru Tua #1c4587, Teks Putih Tebal)
        var headerRange = sheet.getRange(1, 1, 1, numCols);
        headerRange.setBackground("#1c4587")
                   .setFontColor("#ffffff")
                   .setFontWeight("bold")
                   .setHorizontalAlignment("center");
                   
        sheet.setFrozenRows(1);
        sheet.setFrozenColumns(4);
        
        // 2. UKURAN KOLOM MENYESUAIKAN PANJANG KALIMAT/KATA PADA CELL (AUTO-FIT):
        try {
          sheet.autoResizeColumns(1, numCols);
        } catch (errResize) {}

        for (var col = 1; col <= numCols; col++) {
          try {
            sheet.autoResizeColumn(col);
          } catch (e) {}

          var currentW = sheet.getColumnWidth(col);
          var optimalW = currentW + 16; // Beri ruang padding ekstra agar nyaman dibaca dan tidak mepet

          // Pastikan lebar minimal yang proporsional untuk tiap kolom utama
          if (col === 1 && optimalW < 45) optimalW = 45;       // No
          if (col === 2 && optimalW < 190) optimalW = 190;     // Nama Pasien (menyesuaikan nama lengkap)
          if (col === 3 && optimalW < 100) optimalW = 100;     // No. RM
          if (col === 4 && optimalW < 150) optimalW = 150;     // Frekuensi HD (tidak terpotong 'rekuensi H')
          if (col === 5 && optimalW < 85) optimalW = 85;       // Shift
          if (col === 6 && optimalW < 55) optimalW = 55;       // Hb
          if (col === 7 && optimalW < 165) optimalW = 165;     // Alokasi Klinis / Dosis
          if (col >= 8 && col <= numCols - 6 && optimalW < 36) optimalW = 36; // Kolom Tanggal 1..31
          if (col > numCols - 6 && optimalW < 75) optimalW = 75; // Kolom Rekapitulasi Kanan

          sheet.setColumnWidth(col, optimalW);
        }
        
        // 3. Format warna pada baris pemisah Shift Pagi dan Shift Siang serta Total Ringkasan
        for (var r = 2; r <= numRows; r++) {
          var valB = rows[r - 1][1] ? rows[r - 1][1].toString() : "";
          if (valB.indexOf("SHIFT PAGI") !== -1) {
            sheet.getRange(r, 1, 1, numCols).setBackground("#cfe2f3").setFontWeight("bold");
          } else if (valB.indexOf("SHIFT SIANG") !== -1) {
            sheet.getRange(r, 1, 1, numCols).setBackground("#fff2cc").setFontWeight("bold");
          } else if (valB.indexOf("Total Shift Pagi") !== -1) {
            sheet.getRange(r, 1, 1, numCols).setBackground("#cfe2f3").setFontWeight("bold");
          } else if (valB.indexOf("Total Shift Siang") !== -1) {
            sheet.getRange(r, 1, 1, numCols).setBackground("#fff2cc").setFontWeight("bold");
          } else if (valB.indexOf("Total Kebutuhan EPO") !== -1) {
            sheet.getRange(r, 1, 1, numCols).setBackground("#d9ead3").setFontWeight("bold");
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Berhasil menyimpan jadwal dengan kolom menyesuaikan panjang teks dan bebas formula error!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Aksi tidak dikenal" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Sinkronisasi via Google Apps Script untuk 3 tab jadwal
 */
export async function pullViaAppsScript(webAppUrl: string, currentMonth: string): Promise<PatientRecord[]> {
  const res = await fetch(webAppUrl.trim(), { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Gagal menghubungi Apps Script (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const allPatients: PatientRecord[] = [];

  const tabData = json.data || {};

  SCHEDULE_SHEETS.forEach(({ title, tabName }) => {
    const rows: string[][] = tabData[tabName] || [];
    if (rows.length <= 1) return;

    const dataRows = rows.slice(1);
    dataRows.forEach((row, i) => {
      const name = (row[1] || '').trim();
      const noRm = (row[2] || '').trim();

      if (!name || isSummaryOrHeaderRow(name, noRm, row.join(' '))) {
        return;
      }

      const col3 = (row[3] || '').trim();
      const col3Lower = col3.toLowerCase();
      let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
      let singleDay: SingleHDDay | undefined = undefined;
      let scheduleDay: HDDaySchedule = title;
      let scheduleShift: HDShift = 'Shift 1 (Pagi)';
      let rawHb = 0;

      if (col3Lower.includes('pagi') || col3Lower.includes('siang')) {
        // Format Lama (tanpa kolom Frekuensi HD)
        scheduleShift = col3Lower.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
        rawHb = parseFloat(String(row[4] || '0').replace(',', '.'));
      } else {
        // Format Baru (dengan kolom Frekuensi HD)
        hdFrequency = col3Lower.includes('1') ? '1 kali dalam satu minggu' : '2 kali dalam satu minggu';
        if (col3Lower.includes('senin')) singleDay = 'Senin';
        else if (col3Lower.includes('selasa')) singleDay = 'Selasa';
        else if (col3Lower.includes('rabu')) singleDay = 'Rabu';
        else if (col3Lower.includes('kamis')) singleDay = 'Kamis';
        else if (col3Lower.includes('jumat')) singleDay = 'Jumat';
        else if (col3Lower.includes('sabtu')) singleDay = 'Sabtu';

        if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
          scheduleDay = getScheduleDayFromSingleDay(singleDay);
        }

        const shiftStr = (row[4] || '').toLowerCase();
        scheduleShift = shiftStr.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
        rawHb = parseFloat(String(row[5] || '0').replace(',', '.'));
      }

      const hbValue = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;
      const reco = calculateClinicalRecommendation(hbValue);

      allPatients.push({
        id: `appsscript-${noRm || i}-${Date.now()}`,
        noRm: noRm || `RM-${1000 + i}`,
        name,
        hdFrequency,
        singleDay,
        scheduleDay,
        scheduleShift,
        hbValue,
        hbDate: `${currentMonth}-02`,
        monthPeriod: currentMonth,
        recommendation: reco,
        weeks: generateDefaultWeeks(reco.category, currentMonth),
        overallStatus: reco.category === 'TRANSFUSI_2_RAWAT_INAP' ? 'Perlu Perhatian' : 'Berjalan',
        clinicalNotes: row[row.length - 1] || '',
        updatedAt: new Date().toISOString(),
      });
    });
  });

  return allPatients;
}

export async function pushViaAppsScript(
  webAppUrl: string,
  patients: PatientRecord[],
  yearMonth: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  targetSchedule?: HDDaySchedule
) {
  const scheduleData: Record<string, string[][]> = {};

  const sheetsToPush = targetSchedule 
    ? SCHEDULE_SHEETS.filter((s) => s.title === targetSchedule)
    : SCHEDULE_SHEETS;

  sheetsToPush.forEach(({ title, tabName }) => {
    scheduleData[tabName] = buildScheduleMatrixTable(patients, title, yearMonth);
  });

  await fetch(webAppUrl.trim(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'push',
      scheduleData,
    }),
  });

  return { success: true };
}

/**
 * Ekspor Data ke Format CSV per Jadwal atau Seluruh Jadwal
 */
export function exportToCSV(patients: PatientRecord[], period: string, selectedSchedule?: HDDaySchedule) {
  const schedulesToExport: HDDaySchedule[] = selectedSchedule 
    ? [selectedSchedule] 
    : ['Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu'];

  schedulesToExport.forEach((sched) => {
    const tableData = buildScheduleMatrixTable(patients, sched, period);
    const csvContent = '\uFEFF' + tableData.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Jadwal_HD_${sched.replace(/\s+/g, '_')}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

/**
 * Impor data dari File CSV
 */
export function importFromCSV(csvText: string, currentMonth: string): PatientRecord[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const dataLines = lines.slice(1);
  const patients: PatientRecord[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const parts = splitCsvLine(dataLines[i]);
    const name = parts[1] || '';
    const noRm = parts[2] || '';
    if (!name || isSummaryOrHeaderRow(name, noRm, dataLines[i])) {
      continue;
    }

    const col3 = (parts[3] || '').trim();
    const col3Lower = col3.toLowerCase();
    let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
    let singleDay: SingleHDDay | undefined = undefined;
    let scheduleDay: HDDaySchedule = 'Senin - Kamis';
    let scheduleShift: HDShift = 'Shift 1 (Pagi)';
    let rawHb = 0;

    if (col3Lower.includes('pagi') || col3Lower.includes('siang')) {
      // Format CSV lama tanpa kolom Frekuensi HD
      scheduleShift = col3Lower.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = parseFloat(parts[4]?.replace(',', '.') || '0');
    } else {
      // Format CSV baru dengan kolom Frekuensi HD
      hdFrequency = col3Lower.includes('1') ? '1 kali dalam satu minggu' : '2 kali dalam satu minggu';
      if (col3Lower.includes('senin')) singleDay = 'Senin';
      else if (col3Lower.includes('selasa')) singleDay = 'Selasa';
      else if (col3Lower.includes('rabu')) singleDay = 'Rabu';
      else if (col3Lower.includes('kamis')) singleDay = 'Kamis';
      else if (col3Lower.includes('jumat')) singleDay = 'Jumat';
      else if (col3Lower.includes('sabtu')) singleDay = 'Sabtu';

      if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
        scheduleDay = getScheduleDayFromSingleDay(singleDay);
      }

      const shiftStr = (parts[4] || '').toLowerCase();
      scheduleShift = shiftStr.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = parseFloat(parts[5]?.replace(',', '.') || '0');
    }

    const hbValue = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;
    const reco = calculateClinicalRecommendation(hbValue);

    patients.push({
      id: `csv-${noRm || i}-${Date.now()}`,
      noRm: noRm || `RM-${1000 + i}`,
      name,
      hdFrequency,
      singleDay,
      scheduleDay,
      scheduleShift,
      hbDate: `${currentMonth}-02`,
      hbValue,
      monthPeriod: currentMonth,
      recommendation: reco,
      weeks: generateDefaultWeeks(reco.category, currentMonth),
      overallStatus: reco.category === 'TRANSFUSI_2_RAWAT_INAP' ? 'Perlu Perhatian' : 'Berjalan',
      clinicalNotes: parts[parts.length - 1] || '',
      updatedAt: new Date().toISOString(),
    });
  }

  return patients;
}

/**
 * Update data range pada spreadsheet
 */
async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: string[][],
  accessToken: string
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal menulis ke Google Sheet: ${errorText}`);
  }

  return await res.json();
}

/**
 * Menambahkan tab sheet baru jika belum ada
 */
async function addSheetTab(spreadsheetId: string, tabTitle: string, accessToken: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabTitle,
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 5,
              },
            },
          },
        },
      ],
    }),
  });
}

/**
 * Menerapkan warna latar header biru tua #1c4587 dan UKURAN KOLOM MINIMALIS
 */
async function applyHeaderAndColumnStyling(spreadsheetId: string, accessToken: string) {
  const metadata = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const sheets: any[] = metadata.sheets || [];

  const requests: any[] = [];

  sheets.forEach((s) => {
    const sheetId = s.properties.sheetId;

    // 1. Format Header Row 1 (Biru Tua #1c4587)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.11, green: 0.27, blue: 0.53 }, // #1c4587
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // 2. ATUR UKURAN KOLOM MENYESUAIKAN PANJANG KALIMAT/KATA PADA CELL (AUTO-FIT):
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 44,
        },
      },
    });
  });

  if (requests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }
}

function getColLetter(colIdx: number): string {
  let letter = '';
  while (colIdx > 0) {
    const mod = (colIdx - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colIdx = Math.floor((colIdx - mod) / 26);
  }
  return letter || 'A';
}
