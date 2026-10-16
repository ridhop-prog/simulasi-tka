/* TKAGames — logika murni untuk mode TTS & Tebak-tebakan.
   Tidak menyentuh DOM. UI ada di app.js (vTTS, vKuis). */
(function(){
"use strict";

/* ---------- util ---------- */
function mulberry32(seed){
  var a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith(arr, rnd){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(rnd()*(i+1));
    var t=a[i];a[i]=a[j];a[j]=t;
  }
  return a;
}
function cleanWord(w){
  return String(w||"").toUpperCase().replace(/[^A-Z]/g,"");
}

/* ---------- ikon SVG garis (tajam di semua device, tanpa emoji) ----------
   Semua memakai currentColor agar warna diatur dari CSS di tiap konteks. */
window.ICO = {
  clipboard: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 13l2 2 4-4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  hash: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20v-8M12 20V5M19 20v-6"/></svg>',
  target: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a2 2 0 0 0 2 5h1M17 6h3a2 2 0 0 1-2 5h-1"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-4 10c.8.8 1 1.6 1 3h6c0-1.4.2-2.2 1-3a6 6 0 0 0-4-10zM9.5 19h5M10.5 21.5h3"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2.5l2.95 6.36 6.95.82-5.2 4.73 1.4 6.86L12 17.9l-6.1 3.37 1.4-6.86-5.2-4.73 6.95-.82z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  speakerOff: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16 9l6 6M22 9l-6 6"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5v-1a5 5 0 0 1 5-5z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.8" cy="14" r=".9" fill="currentColor"/></svg>',
  medal: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.8 13.4 7 21l5-2.6L17 21l-1.8-7.6"/></svg>',
  doc: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h8l4 4v16H6zM14 2v4h4M9 12h6M9 16h6"/></svg>',
  checkBadge: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>'
};

/* ---------- label mode belajar ---------- */
var LEARN_MODES = {
  ujian: { title: "Ujian TKA Standar", icon: "clipboard", color: "#1f6feb",
           desc: "Latihan ujian dengan sistem simulasi TKA, lengkap dengan timer, navigasi soal, penilaian, dan pembahasan." },
  tts:   { title: "TTS Algoritma & Logika", icon: "hash", color: "#0e8a4d",
           desc: "Asah pemahaman materi melalui permainan teka-teki silang dengan petunjuk dan kotak jawaban." },
  kuis:  { title: "Quick Quiz / Tebak-tebakan", icon: "bolt", color: "#0e7490",
           desc: "Uji pengetahuan melalui kuis interaktif dengan pertanyaan, pilihan jawaban, skor, dan timer." }
};
window.LEARN_MODES = LEARN_MODES;
window.learnModeLabel = function(m){
  if(LEARN_MODES[m]) return LEARN_MODES[m].title;
  if(window.TKA_TIME && window.TKA_TIME.modes[m]) return window.TKA_TIME.modes[m].label;
  return m || "—";
};
// Label untuk riwayat: dukung mode waktu lama + mode permainan baru
window.historyModeLabel = function(m){
  if(m==="kuis") return "Tebak-tebakan";
  if(m==="tts") return "TTS";
  if(m==="lengkap") return "TKA Lengkap";
  return window.timeModeLabel(m||"normal");
};

/* ---------- suara (WebAudio, bisa dimatikan) ---------- */
var SND_KEY = "tka_sound";
function soundOn(){
  try{ return localStorage.getItem(SND_KEY) !== "0"; }catch(e){ return true; }
}
function setSound(on){
  try{ localStorage.setItem(SND_KEY, on?"1":"0"); }catch(e){}
}
var ctx = null;
function tone(freq, dur, delay){
  if(!soundOn()) return;
  try{
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    ctx = ctx || new AC();
    if(ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime + (delay||0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.start(t); o.stop(t+dur+0.05);
  }catch(e){}
}
window.TKASound = {
  on: soundOn, set: setSound,
  click: function(){ tone(520, 0.07, 0); },
  correct: function(){ tone(660, 0.12, 0); tone(880, 0.16, 0.1); },
  wrong: function(){ tone(220, 0.2, 0); tone(160, 0.22, 0.12); },
  finish: function(){ tone(523, 0.14, 0); tone(659, 0.14, 0.13); tone(784, 0.2, 0.26); }
};

/* ---------- generator crossword ---------- */
// entries: [{word, clue, dir:'H'|'V', row, col}]
function tryLayout(words, rnd){
  var occ = {}; // "r,c" -> huruf
  var entries = [];
  function key(r,c){ return r+","+c; }
  function place(w, clue, r, c, dir){
    entries.push({ word:w, clue:clue, dir:dir, row:r, col:c });
    for(var k=0;k<w.length;k++){
      var rr = dir==="H" ? r : r+k, cc = dir==="H" ? c+k : c;
      occ[key(rr,cc)] = w[k];
    }
  }
  // validasi: minHits interseksi minimum
  function valid(w, r, c, dir, minHits){
    var hits = 0;
    for(var k=0;k<w.length;k++){
      var rr = dir==="H" ? r : r+k, cc = dir==="H" ? c+k : c;
      var ex = occ[key(rr,cc)];
      if(ex){
        if(ex !== w[k]) return -1;
        hits++;
      } else {
        // sel baru: tetangga samping (tegak lurus arah kata) harus kosong
        var s1 = dir==="H" ? occ[key(rr-1,cc)] : occ[key(rr,cc-1)];
        var s2 = dir==="H" ? occ[key(rr+1,cc)] : occ[key(rr,cc+1)];
        if(s1 || s2) return -1;
      }
    }
    // sel tepat sebelum & sesudah kata harus kosong
    var br = dir==="H" ? r : r-1, bc = dir==="H" ? c-1 : c;
    var ar = dir==="H" ? r : r+w.length, ac = dir==="H" ? c+w.length : c;
    if(occ[key(br,bc)] || occ[key(ar,ac)]) return -1;
    if(hits < minHits) return -1;
    return hits;
  }
  if(!words.length) return null;
  place(words[0].w, words[0].c, 0, 0, "H");
  for(var wi=1; wi<words.length; wi++){
    var w = words[wi].w, clue = words[wi].c;
    var best = null;
    for(var e=0; e<entries.length; e++){
      var en = entries[e];
      for(var i=0;i<en.word.length;i++){
        for(var j=0;j<w.length;j++){
          if(en.word[i] !== w[j]) continue;
          var dir = en.dir==="H" ? "V" : "H";
          // mulai agar huruf ke-j kata baru tepat di persimpangan
          var rr = dir==="H" ? en.row : en.row + i - j;
          var cc = dir==="H" ? en.col + i - j : en.col;
          var score = valid(w, rr, cc, dir, 1);
          if(score > 0 && (!best || score > best.score)){
            best = { r:rr, c:cc, dir:dir, score:score };
          }
        }
      }
    }
    if(best){
      place(w, clue, best.r, best.c, best.dir);
      continue;
    }
    // fallback: posisi acak dekat area terisi (kata terisolasi, tetap valid)
    var placed = false;
    var bounds = getBounds(entries);
    for(var t=0;t<60 && !placed;t++){
      var dir2 = rnd() < 0.5 ? "H" : "V";
      var rr2 = Math.floor(rnd()*((bounds.maxR-bounds.minR)+7)) + bounds.minR - 3;
      var cc2 = Math.floor(rnd()*((bounds.maxC-bounds.minC)+7)) + bounds.minC - 3;
      if(valid(w, rr2, cc2, dir2, 0) >= 0){ place(w, clue, rr2, cc2, dir2); placed = true; }
    }
    // gagal → kata dilewati
  }
  return { entries: entries, occ: occ };
}
function getBounds(entries){
  var minR=1e9,maxR=-1e9,minC=1e9,maxC=-1e9;
  entries.forEach(function(e){
    var r2 = e.dir==="H" ? e.row : e.row + e.word.length - 1;
    var c2 = e.dir==="H" ? e.col + e.word.length - 1 : e.col;
    if(e.row<minR)minR=e.row; if(r2>maxR)maxR=r2;
    if(e.col<minC)minC=e.col; if(c2>maxC)maxC=c2;
  });
  if(entries.length===0){ minR=maxR=minC=maxC=0; }
  return { minR:minR, maxR:maxR, minC:minC, maxC:maxC };
}
// API utama: hasil {entries(with num,cells), rows, cols, sol[r][c], nums[r][c], totalCells}
function buildCrossword(rawList, opts){
  opts = opts || {};
  var maxWords = opts.maxWords || 10;
  var seed = opts.seed!=null ? opts.seed : ((Date.now()%100000) + Math.floor(Math.random()*1e9));
  var pool = [];
  (rawList||[]).forEach(function(it){
    var w = cleanWord(it.w);
    if(w.length>=3 && w.length<=12) pool.push({ w:w, c:it.c });
  });
  // dedupe
  var seen = {}, uniq = [];
  pool.forEach(function(it){ if(!seen[it.w]){ seen[it.w]=1; uniq.push(it); } });
  var best = null, bestScore = -1;
  for(var att=0; att<8; att++){
    var rnd = mulberry32(seed + att*7919);
    var words = shuffleWith(uniq, rnd).slice(0, Math.min(maxWords, uniq.length));
    var lay = tryLayout(words, rnd);
    if(!lay) continue;
    // skor: utamakan jumlah entri, lalu interseksi
    var inter = 0;
    var cnt = {};
    lay.entries.forEach(function(e){
      for(var k=0;k<e.word.length;k++){
        var rr = e.dir==="H"?e.row:e.row+k, cc = e.dir==="H"?e.col+k:e.col;
        var kk = rr+","+cc;
        cnt[kk] = (cnt[kk]||0)+1;
      }
    });
    Object.keys(cnt).forEach(function(kk){ if(cnt[kk]>1) inter++; });
    var score = lay.entries.length*100 + inter;
    if(score > bestScore){ bestScore = score; best = lay; }
    if(lay.entries.length >= Math.min(maxWords, uniq.length)) break;
  }
  if(!best || best.entries.length < 3) return null;
  var b = getBounds(best.entries);
  var rows = b.maxR-b.minR+1, cols = b.maxC-b.minC+1;
  // penomoran: urut baca (baris, kolom), start sama = nomor sama
  var starts = best.entries.map(function(e){ return { r:e.row, c:e.col }; });
  starts.sort(function(a,c){ return (a.r-c.r) || (a.c-c.c); });
  var numOf = {}, n = 0;
  starts.forEach(function(s){
    var k = s.r+","+s.c;
    if(!numOf[k]) numOf[k] = ++n;
  });
  best.entries.forEach(function(e){
    e.num = numOf[e.row+","+e.col];
    e.cells = [];
    for(var k=0;k<e.word.length;k++){
      e.cells.push({ r:e.row-b.minR + (e.dir==="V"?k:0), c:e.col-b.minC + (e.dir==="H"?k:0), ch:e.word[k] });
    }
  });
  var sol = [], nums = [];
  for(var r=0;r<rows;r++){ sol.push([]); nums.push([]); for(var c=0;c<cols;c++){ sol[r].push(null); nums[r].push(null); } }
  best.entries.forEach(function(e){
    e.cells.forEach(function(cell, k){
      sol[cell.r][cell.c] = cell.ch;
      if(k===0) nums[cell.r][cell.c] = e.num;
    });
  });
  var totalCells = 0;
  sol.forEach(function(row){ row.forEach(function(ch){ if(ch) totalCells++; }); });
  return { entries: best.entries, rows: rows, cols: cols, sol: sol, nums: nums, totalCells: totalCells, seed: seed };
}

/* ---------- picker kuis dari bank ujian ---------- */
// Kuis memakai pilihan ganda + tiap pernyataan benar/salah (interaktif 1-ketuk).
// Kompleks butuh multi-pilih + tombol kunci — belum didukung kuis.
function quizItemCount(subject){
  var bank = window.TKAStore ? window.TKAStore.getBank(subject) : [];
  var n = 0;
  bank.forEach(function(q){
    if(q.type==="multiple_choice") n++;
    else if(q.type==="true_false_table") n += (q.statements||[]).length;
  });
  return n;
}
// items: [{kind:'mc',q} | {kind:'tf',q,text,answer,expl}] — opsi MC sudah diacak
function quizPickItems(subject, count){
  var bank = window.TKAStore ? window.TKAStore.getBank(subject) : [];
  var items = [];
  bank.forEach(function(q){
    if(q.type==="multiple_choice") items.push({ kind:"mc", q:q });
    else if(q.type==="true_false_table"){
      (q.statements||[]).forEach(function(st){
        items.push({ kind:"tf", q:q, text:st.text, answer:st.answer });
      });
    }
  });
  var sh = window.TKAEngine ? window.TKAEngine.shuffle(items) : items.slice();
  var picked = sh.slice(0, Math.min(count, sh.length));
  if(window.TKAEngine) picked.forEach(function(it){ if(it.kind==="mc") it.q = window.TKAEngine.shuffleOptions(it.q); });
  return picked;
}

window.TKAGames = {
  buildCrossword: buildCrossword,
  cleanWord: cleanWord,
  quizItemCount: quizItemCount,
  quizPickItems: quizPickItems
};
})();
