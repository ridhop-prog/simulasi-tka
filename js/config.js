/* Config global — mudah ditambah mapel baru cukup tambah entri di sini + file data */
window.TKA_CONFIG = {
  appName: "SIMULASI TKA",
  questionCounts: [10, 20, 30, 40, 50, 100],
  defaultCount: 20,
  // default waktu (menit) per jumlah soal — bisa diubah user di pengaturan simulasi
  defaultTimeMap: { 10: 20, 20: 40, 30: 60, 40: 75, 50: 90, 100: 180 },
  subjects: [
    { id: "matematika", name: "Matematika", short: "MTK", desc: "Simulasi TKA Matematika", color: "#2563eb", icon: "∑" },
    { id: "bindo", name: "Bahasa Indonesia", short: "IND", desc: "Simulasi TKA Bahasa Indonesia", color: "#0d9488", icon: "ID" },
    { id: "binggris", name: "Bahasa Inggris", short: "ENG", desc: "Simulasi TKA Bahasa Inggris", color: "#7c3aed", icon: "EN" },
    { id: "produktif", name: "Produktif PPLG/RPL", short: "RPL", desc: "Simulasi TKA Produktif PPLG/RPL", color: "#ea580c", icon: "</>" },
    { id: "pkwu", name: "PKWU", short: "PKWU", desc: "Simulasi TKA PKWU", color: "#16a34a", icon: "Rp" }
  ],
  typeLabels: {
    multiple_choice: "Pilihan Ganda",
    multiple_select: "Pilihan Ganda Kompleks",
    true_false_table: "Benar / Salah"
  },
  finishReasons: {
    COMPLETED: "Selesai",
    TIMEOUT: "Waktu Habis",
    FULLSCREEN_EXIT: "Keluar dari Fullscreen"
  }
};
window.subjectName = function(id){
  if(id==="lengkap") return "TKA Lengkap";
  if(id==="campuran") return "Paket Campuran";
  var s = (window.TKA_CONFIG.subjects||[]).find(function(x){return x.id===id});
  return s ? s.name : id;
};
// Urutan blok resmi mode TKA Lengkap
window.LENGKAP_ORDER = ["matematika","bindo","binggris","produktif","pkwu"];
// Paket resmi TKA Lengkap (fix, otomatis — tanpa konfigurasi user):
// Wajib: Indo 30/75mnt, Inggris 30/75mnt, MTK 25/75mnt; Pilihan PPLG: 2×25 soal/60mnt
window.TKA_LENGKAP_PLAN = [
  {subject:"matematika", count:25, minutes:75},
  {subject:"bindo",      count:30, minutes:75},
  {subject:"binggris",   count:30, minutes:75},
  {subject:"produktif",  count:25, minutes:60},
  {subject:"pkwu",       count:25, minutes:60}
];

/* ===== Sistem Waktu Tantangan TKA — SATU konfigurasi terpusat =====
   Angka preset adalah alokasi LATIHAN (bukan klaim alokasi resmi TKA).
   Ubah nilai di sini (atau via override pengaturan) bila standar ujian
   yang dituju sudah diketahui. Tampilan hanya membaca dari sini. */
window.TKA_TIME = {
  modes: {
    normal:    { label: "Normal",    tag: "Santai & teliti",      desc: "Waktu relatif nyaman. Cocok untuk memahami materi dan berlatih dengan teliti." },
    tantangan: { label: "Tantangan", tag: "Rekomendasi latihan",  desc: "Waktu lebih singkat. Melatih kecepatan berpikir — direkomendasikan untuk latihan rutin." },
    intensif:  { label: "Intensif",  tag: "Paling ketat",         desc: "Waktu ketat bagi yang sudah terbiasa. Melatih pengelolaan waktu dalam kondisi menantang." }
  },
  defaultMode: "tantangan",
  // Preset menit per jumlah soal per mode (dapat dioverride user per "count|mode")
  presets: {
    10:  { normal: 20,  tantangan: 15,  intensif: 12  },
    20:  { normal: 40,  tantangan: 30,  intensif: 24  },
    30:  { normal: 60,  tantangan: 45,  intensif: 36  },
    40:  { normal: 80,  tantangan: 60,  intensif: 48  },
    50:  { normal: 100, tantangan: 75,  intensif: 60  },
    100: { normal: 200, tantangan: 150, intensif: 120 }
  },
  // Fallback bila jumlah soal tak ada di tabel: menit per soal
  perQuestionMin: { normal: 2, tantangan: 1.5, intensif: 1.2 },
  // Faktor karakteristik mapel (bacaan panjang / hitungan / analisis kasus).
  // Rekomendasi akhir = preset × faktor, dibulatkan ke menit.
  subjectFactors: { matematika: 1.1, bindo: 1.2, binggris: 1.2, produktif: 1.0, pkwu: 1.0 },
  subjectFactorNote: {
    matematika: "perhitungan langkah-demi-langkah",
    bindo: "teks bacaan panjang & analisis informasi",
    binggris: "bacaan, kosakata & pemahaman teks",
    produktif: "logika, kode, algoritma & analisis kasus",
    pkwu: "analisis kasus & perhitungan usaha"
  },
  warnAt: 0.25,    // sisa ≤25% → peringatan ringan
  dangerAt: 0.10,  // sisa ≤10% → peringatan jelas
  lastMinuteSec: 60
};
window.timeModeLabel = function(m){
  return (window.TKA_TIME.modes[m] && window.TKA_TIME.modes[m].label) || m || "Normal";
};
// Basis preset (termasuk override user dari pengaturan), SEBELUM faktor mapel
window.presetMinutes = function(count, mode){
  mode = window.TKA_TIME.modes[mode] ? mode : window.TKA_TIME.defaultMode;
  var ov = {};
  try{ ov = (window.TKAStore && window.TKAStore.getSettings().timeOverrides) || {}; }catch(e){}
  if(ov[count+"|"+mode]!=null) return Math.max(1, parseInt(ov[count+"|"+mode],10)||1);
  var row = window.TKA_TIME.presets[count];
  if(row && row[mode]!=null) return row[mode];
  var rate = window.TKA_TIME.perQuestionMin[mode] || 2;
  return Math.max(1, Math.round(count*rate));
};
// Rekomendasi akhir untuk mapel+jumlah+mode (dipakai setup & persiapan)
window.recommendedMinutes = function(subject, count, mode){
  var base = window.presetMinutes(count, mode);
  var f = window.TKA_TIME.subjectFactors[subject] || 1;
  return Math.max(1, Math.round(base*f));
};
