import { ClinicalRecommendation, PatientRecord, WeekScheduleItem } from '../types/dialysis';

/**
 * Menghitung dosis & rekomendasi klinis berdasarkan nilai Hb awal bulan:
 * 1. Hb < 5.9 g/dL: Transfusi 2 kantong via rawat inap
 * 2. Hb 6.0 - 6.9 g/dL: Transfusi 1 kantong
 * 3. Hb 7.0 - 8.9 g/dL: Terapi EPO 4 x 2000 IU dalam 1 bulan
 * 4. Hb 9.0 - 12.0 g/dL: Terapi EPO 1 x 2000 IU dalam 1 bulan
 * 5. HB diatas 12.00 mg/dl: Tidak mendapatkan terapi EPO
 */
export function calculateClinicalRecommendation(hbValue: number): ClinicalRecommendation {
  const hb = Number(hbValue);

  // 0. Jika belum mengetahui hasil HB (HB belum diinputkan) maka terdeteksi nilai HB: 0
  if (isNaN(hb) || hb === 0 || hb <= 0) {
    return {
      category: 'MENUNGGU_HASIL_LAB',
      title: 'Menunggu Hasil Lab Hb (Hb: 0)',
      badgeColor: 'text-amber-900 dark:text-amber-300',
      badgeBg: 'bg-amber-100 border-amber-300 dark:bg-amber-950/50 dark:border-amber-700',
      borderColor: 'border-amber-400',
      doseDescription: 'Hasil lab Hb awal bulan belum keluar / diinputkan (Hb: 0). Menunggu penetapan DPJP.',
      totalEpoIu: 0,
      totalEpoVials: 0,
      transfusionBags: 0,
      isInpatientNeeded: false,
      notes: 'Hasil pemeriksaan Hb awal bulan belum diinputkan (terdeteksi Hb: 0). Pemberian terapi EPO atau transfusi menunggu konfirmasi hasil lab.',
      protocolBadge: 'Menunggu Lab (Hb: 0)',
    };
  }

  // 1. HB dibawah 5.9 g/dL
  if (hb < 5.95) {
    return {
      category: 'TRANSFUSI_2_RAWAT_INAP',
      title: 'Transfusi 2 Kantong (Rawat Inap)',
      badgeColor: 'text-rose-700 dark:text-rose-400',
      badgeBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
      borderColor: 'border-rose-400',
      doseDescription: 'Transfusi PRC 2 Kantong via Rawat Inap Segera',
      totalEpoIu: 0,
      totalEpoVials: 0,
      transfusionBags: 2,
      isInpatientNeeded: true,
      notes: 'Anemia berat (Hb < 6.0). Indikasi mutlak transfusi 2 bag PRC dengan pemantauan ketat via Rawat Inap.',
      protocolBadge: 'Kritis: Rawat Inap + 2 Bag PRC',
    };
  }

  // 2. HB 6.0 g/dL sampai 6.9 g/dL
  if (hb >= 5.95 && hb < 6.95) {
    return {
      category: 'TRANSFUSI_1_KANTONG',
      title: 'Transfusi 1 Kantong',
      badgeColor: 'text-amber-800 dark:text-amber-300',
      badgeBg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
      borderColor: 'border-amber-400',
      doseDescription: 'Transfusi PRC 1 Kantong',
      totalEpoIu: 0,
      totalEpoVials: 0,
      transfusionBags: 1,
      isInpatientNeeded: false,
      notes: 'Hb 6.0 - 6.9 g/dL. Rencana transfusi 1 bag PRC saat sesi HD / observasi sebelum inisiasi dosis EPO reguler.',
      protocolBadge: 'Transfusi 1 Bag PRC',
    };
  }

  // 3. HB 7.0 g/dL sampai 8.9 g/dL
  if (hb >= 6.95 && hb < 8.95) {
    return {
      category: 'EPO_4X_2000',
      title: 'Terapi EPO 4 x 2000 IU (1x/Minggu)',
      badgeColor: 'text-blue-800 dark:text-blue-300',
      badgeBg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800',
      borderColor: 'border-blue-400',
      doseDescription: 'Eritropoietin 4x 2000 IU (total 8.000 IU/bulan)',
      totalEpoIu: 8000,
      totalEpoVials: 4,
      transfusionBags: 0,
      isInpatientNeeded: false,
      notes: 'Hb 7.0 - 8.9 g/dL. Diberikan 1 ampul (2000 IU) per minggu selama 4 minggu pasca dialisis.',
      protocolBadge: 'EPO Dosis Penuh: 4x 2000 IU',
    };
  }

  // 4. HB 9.0 g/dL sampai 12.00 g/dL
  if (hb >= 8.95 && hb <= 12.00) {
    return {
      category: 'EPO_1X_2000',
      title: 'Terapi EPO 1 x 2000 IU (Maintenance)',
      badgeColor: 'text-emerald-800 dark:text-emerald-300',
      badgeBg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
      borderColor: 'border-emerald-400',
      doseDescription: 'Eritropoietin 1x 2000 IU (dosis pemeliharaan)',
      totalEpoIu: 2000,
      totalEpoVials: 1,
      transfusionBags: 0,
      isInpatientNeeded: false,
      notes: 'Hb 9.0 - 12.00 g/dL dalam rentang target klinis hemodialisa. Diberikan dosis maintenance 1 ampul.',
      protocolBadge: 'EPO Maintenance: 1x 2000 IU',
    };
  }

  // 5. Protokol Klinis ke-5: HB diatas 12.00 mg/dl tidak mendapatkan terapi EPO
  return {
    category: 'HOLD_EVALUASI',
    title: 'Protokol 5: HB > 12.00 mg/dl — Tidak Mendapatkan Terapi EPO',
    badgeColor: 'text-purple-800 dark:text-purple-300',
    badgeBg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800',
    borderColor: 'border-purple-400',
    doseDescription: 'Kadar HB > 12.00 mg/dl (g/dL). Sesuai Protokol Klinis ke-5: Tidak mendapatkan terapi EPO (Hold / Evaluasi Klinis DPJP).',
    totalEpoIu: 0,
    totalEpoVials: 0,
    transfusionBags: 0,
    isInpatientNeeded: false,
    notes: 'Protokol Klinis ke-5: Pasien dengan kadar HB diatas 12.00 mg/dl tidak mendapatkan terapi EPO guna mencegah risiko kardiovaskular, hiperviskositas darah, hipertensi intradialisis, dan trombosis akses vaskular.',
    protocolBadge: 'Protokol 5: Tanpa Terapi EPO (Hb > 12.00)',
  };
}

/**
 * Menghasilkan jadwal 4 minggu default untuk pasien baru sesuai rekomendasi dosis
 */
export function generateDefaultWeeks(category: string, yearMonth: string): PatientRecord['weeks'] {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

  // Estimasi tanggal untuk 4 minggu (misal tanggal 4, 11, 18, 25)
  const formatDay = (day: number) => {
    const d = new Date(year, month - 1, day);
    return d.toISOString().split('T')[0];
  };

  const isEpo4x = category === 'EPO_4X_2000';
  const isEpo1x = category === 'EPO_1X_2000';

  return {
    week1: {
      weekNumber: 1,
      plannedDate: formatDay(4),
      status: (isEpo4x || isEpo1x) ? 'Belum' : 'Tidak Ada Jadwal',
      doseIU: (isEpo4x || isEpo1x) ? 2000 : 0,
    },
    week2: {
      weekNumber: 2,
      plannedDate: formatDay(11),
      status: isEpo4x ? 'Belum' : 'Tidak Ada Jadwal',
      doseIU: isEpo4x ? 2000 : 0,
    },
    week3: {
      weekNumber: 3,
      plannedDate: formatDay(18),
      status: isEpo4x ? 'Belum' : 'Tidak Ada Jadwal',
      doseIU: isEpo4x ? 2000 : 0,
    },
    week4: {
      weekNumber: 4,
      plannedDate: formatDay(25),
      status: isEpo4x ? 'Belum' : 'Tidak Ada Jadwal',
      doseIU: isEpo4x ? 2000 : 0,
    },
  };
}

/**
 * Daftar No. RM demo bawaan sistem yang dihapus
 */
export const DEMO_NO_RMS = new Set([
  'RM-01007',
  'RM-04821',
  'RM-08542',
  'RM-05112',
  'RM-09120',
  'RM-03991',
  'RM-06204',
  'RM-01002',
  'RM-02450',
  'RM-07133'
]);

/**
 * Memeriksa apakah data pasien merupakan pasien demo bawaan sistem
 */
export function isDemoPatient(patient?: { noRm?: string; name?: string }): boolean {
  if (!patient) return false;
  if (patient.noRm && DEMO_NO_RMS.has(patient.noRm.trim())) return true;
  const name = (patient.name || '').toLowerCase();
  return (
    name.includes('ahmad subarkah') ||
    name.includes('hendra wijaya') ||
    name.includes('mulyadi saputra') ||
    name.includes('siti aminah') ||
    name.includes('endang susilowati') ||
    name.includes('bambang sutrisno') ||
    name.includes('ratna dewi') ||
    name.includes('rahmat hidayat') ||
    name.includes('agus gunawan') ||
    name.includes('kartini rahayu')
  );
}

/**
 * Data awal pasien sistem (dikosongkan sesuai permintaan pengguna)
 */
export function getInitialDemoPatients(): PatientRecord[] {
  return [];
}
