import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Activity, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Droplets,
  Syringe,
  Info,
  Repeat
} from 'lucide-react';
import { PatientRecord, HDDaySchedule, HDShift, HDFrequency, SingleHDDay } from '../types/dialysis';
import { calculateClinicalRecommendation, generateDefaultWeeks } from '../services/clinicalRules';
import { getScheduleDayFromSingleDay, getFirstHDDateOfMonth } from '../services/googleSheets';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patientData: Partial<PatientRecord>) => void;
  initialPatient?: PatientRecord | null;
  currentMonth: string;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPatient,
  currentMonth,
}) => {
  const [noRm, setNoRm] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [hdFrequency, setHdFrequency] = useState<HDFrequency>('2 kali dalam satu minggu');
  const [singleDay, setSingleDay] = useState<SingleHDDay>('Senin');
  const [scheduleDay, setScheduleDay] = useState<HDDaySchedule>('Senin - Kamis');
  const [scheduleShift, setScheduleShift] = useState<HDShift>('Shift 1 (Pagi)');
  const [hbValue, setHbValue] = useState<string>('0');
  const [hbDate, setHbDate] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [doctorInCharge, setDoctorInCharge] = useState<string>('dr. Sp.PD-KGH');

  useEffect(() => {
    if (initialPatient) {
      setNoRm(initialPatient.noRm);
      setName(initialPatient.name);
      setAge(initialPatient.age ? String(initialPatient.age) : '');
      setGender(initialPatient.gender || 'L');
      setHdFrequency(initialPatient.hdFrequency || '2 kali dalam satu minggu');
      const detectedSingleDay = initialPatient.singleDay || (
        initialPatient.scheduleDay === 'Selasa - Jumat' ? 'Selasa' :
        initialPatient.scheduleDay === 'Rabu - Sabtu' ? 'Rabu' : 'Senin'
      );
      setSingleDay(detectedSingleDay);
      setScheduleDay(initialPatient.scheduleDay);
      setScheduleShift(initialPatient.scheduleShift);
      setHbValue(String(initialPatient.hbValue));
      setHbDate(initialPatient.hbDate);
      setClinicalNotes(initialPatient.clinicalNotes || '');
      setDoctorInCharge(initialPatient.doctorInCharge || 'dr. Sp.PD-KGH');
    } else {
      // Form baru
      setNoRm(`RM-${Math.floor(10000 + Math.random() * 90000)}`);
      setName('');
      setAge('');
      setGender('L');
      setHdFrequency('2 kali dalam satu minggu');
      setSingleDay('Senin');
      setScheduleDay('Senin - Kamis');
      setScheduleShift('Shift 1 (Pagi)');
      setHbValue('0');
      const defaultInitialDate = getFirstHDDateOfMonth(currentMonth, 'Senin - Kamis').dateString;
      setHbDate(defaultInitialDate);
      setClinicalNotes('');
      setDoctorInCharge('dr. Sp.PD-KGH');
    }
  }, [initialPatient, currentMonth, isOpen]);

  if (!isOpen) return null;

  const parsedHb = parseFloat(hbValue.replace(',', '.'));
  const validHb = isNaN(parsedHb) || parsedHb <= 0 ? 0 : parsedHb;
  const recommendation = calculateClinicalRecommendation(validHb);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !noRm.trim()) {
      alert('Mohon isi No. RM dan Nama Pasien.');
      return;
    }

    const reco = calculateClinicalRecommendation(validHb);
    const weeks = initialPatient 
      ? initialPatient.weeks 
      : generateDefaultWeeks(reco.category, currentMonth);

    const finalScheduleDay = hdFrequency === '1 kali dalam satu minggu' 
      ? getScheduleDayFromSingleDay(singleDay) 
      : scheduleDay;

    const defaultHbDate = getFirstHDDateOfMonth(
      currentMonth, 
      finalScheduleDay, 
      hdFrequency === '1 kali dalam satu minggu' ? singleDay : undefined, 
      hdFrequency
    ).dateString;

    onSave({
      noRm: noRm.trim(),
      name: name.trim(),
      age: age ? parseInt(age, 10) : undefined,
      gender,
      hdFrequency,
      singleDay: hdFrequency === '1 kali dalam satu minggu' ? singleDay : undefined,
      scheduleDay: finalScheduleDay,
      scheduleShift,
      hbValue: validHb,
      hbDate: hbDate || defaultHbDate,
      monthPeriod: currentMonth,
      recommendation: reco,
      weeks,
      clinicalNotes: clinicalNotes.trim(),
      doctorInCharge: doctorInCharge.trim(),
      overallStatus: validHb === 0 ? 'Menunggu' : reco.category === 'TRANSFUSI_2_RAWAT_INAP' ? 'Perlu Perhatian' : 'Berjalan',
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Modal Header (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center font-bold shrink-0">
              <User className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {initialPatient ? 'Ubah Data Pasien HD' : 'Tambah Pasien Hemodialisa'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Alokasi otomatis dosis terapi berbasis hasil Hb awal bulan
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Body (Compact & Minimalist) */}
          <div className="p-3 space-y-2 text-xs overflow-y-auto flex-1">
            
            {/* Identitas Pasien: No. RM & Nama */}
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                  No. RM *
                </label>
                <input
                  type="text"
                  required
                  value={noRm}
                  onChange={(e) => setNoRm(e.target.value)}
                  placeholder="RM-04821"
                  className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-semibold focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                  Nama Pasien *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama pasien..."
                  className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Usia, JK, Shift & DPJP */}
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Usia
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="54"
                  className="w-full px-1.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                  className="w-full px-1 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden"
                >
                  <option value="L">L</option>
                  <option value="P">P</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Shift
                </label>
                <select
                  value={scheduleShift}
                  onChange={(e) => setScheduleShift(e.target.value as HDShift)}
                  className="w-full px-1 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] focus:outline-hidden"
                >
                  <option value="Shift 1 (Pagi)">Pagi</option>
                  <option value="Shift 2 (Siang)">Siang</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5 truncate">
                  DPJP
                </label>
                <input
                  type="text"
                  value={doctorInCharge}
                  onChange={(e) => setDoctorInCharge(e.target.value)}
                  placeholder="dr. Sp.PD"
                  className="w-full px-1.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Frekuensi & Hari Rutin HD */}
            <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Repeat className="w-3 h-3 text-rose-600" />
                  <span>Frekuensi HD:</span>
                </span>
                
                {/* Segmented control for frequency */}
                <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-md text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setHdFrequency('1 kali dalam satu minggu');
                      if (!initialPatient) {
                        const sDay = getScheduleDayFromSingleDay(singleDay);
                        setHbDate(getFirstHDDateOfMonth(currentMonth, sDay, singleDay, '1 kali dalam satu minggu').dateString);
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      hdFrequency === '1 kali dalam satu minggu'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    1x / Minggu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHdFrequency('2 kali dalam satu minggu');
                      if (!initialPatient) {
                        setHbDate(getFirstHDDateOfMonth(currentMonth, scheduleDay, undefined, '2 kali dalam satu minggu').dateString);
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      hdFrequency === '2 kali dalam satu minggu'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    2x / Minggu
                  </button>
                </div>
              </div>

              {/* Pilihan Hari */}
              {hdFrequency === '1 kali dalam satu minggu' ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>Pilih 1 Hari HD (EPO tunda +7 hari):</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">Hari {singleDay}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as SingleHDDay[]).map((day) => {
                      const isSel = singleDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setSingleDay(day);
                            const newSchedule = getScheduleDayFromSingleDay(day);
                            setScheduleDay(newSchedule);
                            if (!initialPatient) {
                              setHbDate(getFirstHDDateOfMonth(currentMonth, newSchedule, day, '1 kali dalam satu minggu').dateString);
                            }
                          }}
                          className={`py-0.5 text-center rounded font-bold text-[10px] transition cursor-pointer border ${
                            isSel
                              ? 'bg-amber-500 text-white border-amber-600 ring-1 ring-amber-400 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50/50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>Pilih Pasangan 2 Hari HD:</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">{scheduleDay}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu'] as HDDaySchedule[]).map((sched) => {
                      const isSel = scheduleDay === sched;
                      return (
                        <button
                          key={sched}
                          type="button"
                          onClick={() => setScheduleDay(sched)}
                          className={`py-0.5 text-center rounded font-bold text-[10px] transition cursor-pointer border ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-700 ring-1 ring-blue-400 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50/50'
                          }`}
                        >
                          {sched}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Hasil Cek Hemoglobin & Rekomendasi Klinis */}
            <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      Nilai Hb (g/dL) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setHbValue('0')}
                      className="text-[9px] text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Set 0
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="22"
                    value={hbValue}
                    onChange={(e) => setHbValue(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-2 py-1 text-xs font-bold font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                    Tanggal Lab
                  </label>
                  <input
                    type="date"
                    value={hbDate}
                    onChange={(e) => setHbDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Compact Live Recommendation Preview */}
              <div className={`p-1.5 rounded-md border flex items-center justify-between gap-1.5 ${recommendation.badgeBg} ${recommendation.borderColor}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {recommendation.transfusionBags > 0 ? (
                    <Droplets className="w-3 h-3 text-rose-600 fill-rose-600 shrink-0" />
                  ) : recommendation.totalEpoVials > 0 ? (
                    <Syringe className="w-3 h-3 text-blue-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-purple-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className={`text-[10px] font-bold ${recommendation.badgeColor}`}>
                      {recommendation.title}
                    </span>
                    <span className="text-[9px] text-slate-600 dark:text-slate-300 ml-1">
                      • {recommendation.doseDescription}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-white/80 dark:bg-slate-900/80 shrink-0">
                  {recommendation.protocolBadge}
                </span>
              </div>
            </div>

            {/* Catatan Tambahan (Kompak) */}
            <div>
              <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                Catatan Khusus (Opsional)
              </label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Contoh: lemas, riwayat alergi obat..."
                className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

          </div>

          {/* Action Buttons (Pinned Footer) */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8.5 px-3.5 rounded-lg font-medium text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="h-8.5 px-4 rounded-lg font-semibold text-xs text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 shadow-xs transition cursor-pointer"
            >
              {initialPatient ? 'Simpan Perubahan' : 'Tambah Pasien'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

