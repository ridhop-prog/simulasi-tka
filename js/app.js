/* App — SPA router + seluruh halaman SIMULASI TKA */
(function(){
"use strict";
var view = document.getElementById("view");
var modalRoot = document.getElementById("modalRoot");
var toastRoot = document.getElementById("toastRoot");
var topnav = document.getElementById("topnav");

var S = {
  pendingSetup: null,   // {subject,count,mode,minutes}
  session: null,         // sesi berjalan
  lastResult: null,      // hasil terakhir (untuk halaman hasil/review)
  timerId: null,
  fullscreenExpected: false,
  suppressFullscreenEvent: false,
  bankFilter: {subject:"all", type:"all", diff:"all", q:""},
  importPreview: null,
  manualType: "multiple_choice",
  navPanelOpen: false,
  quiz: null,          // {phase, subject, questions, idx, score, streak, bestStreak, answers, perQ, qEnd, timerId, sound, locked}
  tts: null,           // {subject, grid, entryIdx, locked, started, done}
  leaveGuard: null     // {route, message, onQuit} — cegah keluar tak sengaja dari permainan aktif
};

/* ---------- helpers ---------- */
function esc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function toast(msg){
  var d=document.createElement("div"); d.className="toast"; d.textContent=msg;
  toastRoot.appendChild(d); setTimeout(function(){d.remove()},2600);
}
function modal(html){
  modalRoot.innerHTML = '<div class="modal-back"><div class="modal">'+html+'</div></div>';
  modalRoot.querySelector(".modal-back").addEventListener("click", function(e){
    if(e.target.classList.contains("modal-back")) closeModal();
  });
}
function closeModal(){ modalRoot.innerHTML=""; }
function fmtTime(ms){
  if(ms<0)ms=0;
  var s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60;
  function p(n){return (n<10?"0":"")+n}
  return p(h)+":"+p(m)+":"+p(ss);
}
function fmtDur(ms){
  var s=Math.round(ms/1000), m=Math.floor(s/60); s=s%60;
  if(m===0) return s+" detik";
  return m+" menit "+s+" detik";
}
function fmtAvgSec(sec){
  sec=Math.round(sec);
  if(sec<60) return sec+" detik";
  var m=Math.floor(sec/60), s=sec%60;
  return s? m+" mnt "+s+" dtk" : m+" menit";
}
function fmtDate(ts){
  try{ return new Date(ts).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch(e){ return new Date(ts).toString(); }
}
function typeLabel(t){ return (window.TKA_CONFIG.typeLabels||{})[t]||t; }
function diffLabel(d){ return d==="easy"?"Mudah":d==="hard"?"Sulit":"Sedang"; }
function subjOf(id){ return window.TKA_CONFIG.subjects.find(function(s){return s.id===id}); }

/* ---------- global guards: fullscreen exit, refresh, back ---------- */
document.addEventListener("fullscreenchange", function(){
  if(S.suppressFullscreenEvent) return;
  if(S.session && S.session.status==="RUNNING" && S.fullscreenExpected && !document.fullscreenElement){
    terminateFullscreenExit();
  }
});
// Deteksi pindah aplikasi/tab (Alt+Tab, Win+Tab, klik taskbar, minimize):
// browser tidak boleh MENCEGAH-nya, tetapi kita mendeteksi + menghentikan ujian.
document.addEventListener("visibilitychange", function(){
  if(document.hidden && S.session && S.session.status==="RUNNING"){
    terminateTabSwitch();
  }
});
// Klik kanan dimatikan selama ujian (mengurangi Inspect/view-source iseng)
document.addEventListener("contextmenu", function(e){
  if(S.session && S.session.status==="RUNNING") e.preventDefault();
});
window.addEventListener("beforeunload", function(e){
  if(S.session && S.session.status==="RUNNING"){
    window.TKAStore.setActive(S.session);
    e.preventDefault(); e.returnValue="";
  } else if(S.leaveGuard){
    e.preventDefault(); e.returnValue="";
  }
});
// Tangani tombol back: dorong state agar tidak langsung keluar dari permainan aktif
window.addEventListener("popstate", function(){
  if(S.session && S.session.status==="RUNNING"){
    history.pushState(null,"",location.href);
    toast("Simulasi sedang berjalan — selesaikan atau gunakan tombol Selesai.");
  } else if(S.leaveGuard){
    history.pushState(null,"",location.href);
    toast("Permainan sedang berjalan — selesaikan dulu atau keluar lewat tombol.");
  }
});

function terminateTabSwitch(){
  if(!S.session || S.session.status!=="RUNNING") return;
  window.TKAEngine.playAlarm();
  finishSession("TAB_SWITCH", true);
  modal('<h3>SIMULASI DIHENTIKAN</h3>'
    +'<div class="err-box">Terdeteksi beralih aplikasi/tab/desktop lain.<br>Simulasi telah dihentikan secara otomatis.<br><br>Alasan:<br><b>Beralih Aplikasi</b></div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" id="mGoResult">Lihat Hasil</button></div>');
  var b=document.getElementById("mGoResult");
  if(b) b.onclick=function(){closeModal(); location.hash="#/hasil";};
}

function terminateFullscreenExit(){
  if(!S.session || S.session.status!=="RUNNING") return;
  window.TKAEngine.playAlarm();
  // simpan jawaban terakhir (sudah tersimpan live), hentikan
  finishSession("FULLSCREEN_EXIT", true);
  modal('<h3>SIMULASI DIHENTIKAN</h3>'
    +'<div class="err-box">Anda keluar dari mode fullscreen.<br>Simulasi telah dihentikan secara otomatis.<br><br>Alasan:<br><b>Keluar dari Fullscreen</b></div>'
    +'<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-primary" id="mGoResult">Lihat Hasil</button></div>');
  var b=document.getElementById("mGoResult");
  if(b) b.onclick=function(){closeModal(); location.hash="#/hasil";};
}

/* ---------- session core ---------- */
function persistActive(){
  if(S.session && S.session.status==="RUNNING") window.TKAStore.setActive(S.session);
}
function startTimer(){
  stopTimer();
  S.timerId=setInterval(function(){
    if(!S.session || S.session.onBreak) return;
    var ses=S.session;
    var deadline = ses.blockEnd || ses.endTime;
    var remain = deadline - Date.now();
    var total = (ses.blocks ? (ses.blocks[ses.blockIdx||0]||{}).durationMs : null) || ses.totalMs || ses.durationMs || 1;
    var frac = remain/total;
    var warnAt = window.TKA_TIME.warnAt, dangerAt = window.TKA_TIME.dangerAt;
    var el=document.getElementById("simTimer");
    if(el){
      el.textContent=fmtTime(remain);
      el.classList.toggle("warn", frac<=warnAt && frac>dangerAt);
      el.classList.toggle("danger", frac<=dangerAt);
    }
    // Notifikasi singkat sekali per bagian saat sisa 1 menit
    var bi = ses.blockIdx||0;
    if(remain<=window.TKA_TIME.lastMinuteSec*1000 && remain>0 && ses.oneMinBlock!==bi){
      ses.oneMinBlock=bi; persistActive();
      toast("Sisa waktu 1 menit — manfaatkan untuk meninjau jawaban.");
    }
    if(remain<=0){
      if(ses.blocks && bi<ses.blocks.length-1){ blockTimeout(); }
      else finishSession("TIMEOUT");
    }
  },1000);
}
function stopTimer(){ if(S.timerId){clearInterval(S.timerId); S.timerId=null;} }

function finishSession(reason, fromFullscreen){
  if(!S.session || S.session.status!=="RUNNING") return;
  stopTimer();
  if(typeof closeNavPanel==="function") closeNavPanel();
  S.leaveGuard=null;
  var ses=S.session;
  ses.status = reason==="COMPLETED" ? "COMPLETED" : reason==="TIMEOUT" ? "TIMEOUT" : reason==="TAB_SWITCH" ? "TERMINATED_TAB_SWITCH" : "TERMINATED_FULLSCREEN_EXIT";
  ses.endTime=Date.now();
  ses.finishReason=reason;
  var sc=window.TKAEngine.score(ses);
  var dur=ses.endTime-ses.startTime;
  var totalMs = ses.totalMs || ses.durationMs || dur;
  var rec={
    id: ses.simulationId, simulationId: ses.simulationId,
    subject: ses.subject, date: ses.endTime,
    total: sc.total, nilai: sc.nilai, correct: sc.correct, wrong: sc.wrong, empty: sc.empty,
    durationMs: dur, status: ses.status, finishReason: reason,
    mode: ses.mode || "normal",
    totalMs: totalMs,
    avgSecPerQ: sc.total? dur/1000/sc.total : 0,
    budgetSecPerQ: sc.total? totalMs/1000/sc.total : 0,
    questions: ses.questions, answers: ses.answers
  };
  if(ses.blocks) rec.breakdown = window.TKAEngine.scoreBlocks(ses);
  window.TKAStore.pushHistory(rec);
  window.TKAStore.markUsed(ses.subject, ses.questionIds.filter(function(id){ return id.indexOf("@")<0; }));
  window.TKAStore.setActive(null);
  S.lastResult=rec;
  S.fullscreenExpected=false;
  if(!fromFullscreen){
    S.suppressFullscreenEvent=true;
    window.TKAEngine.exitFullscreen().then(function(){
      setTimeout(function(){S.suppressFullscreenEvent=false},300);
    });
    setTimeout(function(){S.suppressFullscreenEvent=false},600);
  }
  S.session=null;
  if(reason==="TIMEOUT"){ toast("Waktu habis — jawaban otomatis disimpan."); }
  if(location.hash!=="#/hasil") location.hash="#/hasil";
  else render();
}

/* ---------- router ---------- */
var routes = ["dashboard","mapel","setup","setup-lengkap","instruksi","simulasi","hasil","review","riwayat","bank","import","generator","tambah","tts","kuis"];
function parseHash(){
  var h=(location.hash||"#/").replace(/^#\/?/,"");
  var parts=h.split("?");
  var path=parts[0]||"";
  var q={};
  if(parts[1]) parts[1].split("&").forEach(function(kv){
    var a=kv.split("="); q[decodeURIComponent(a[0])]=decodeURIComponent(a[1]||"");
  });
  return {path:path, q:q};
}
function setNav(path){
  var map={"":"dashboard","bank":"bank","import":"import","generator":"generator","tambah":"tambah","riwayat":"riwayat"};
  var cur=map[path]||"";
  topnav.querySelectorAll("a").forEach(function(a){
    a.classList.toggle("active", a.getAttribute("data-nav")===cur);
  });
  document.getElementById("topbar").style.display = (path==="simulasi") ? "none" : "";
}
function render(){
  var r=parseHash(), path=r.path;
  if(typeof closeNavPanel==="function" && path!=="simulasi") closeNavPanel();
  // cegah navigasi tak sengaja dari permainan aktif (ujian / TTS / kuis)
  if(S.leaveGuard && ["","mapel","setup","setup-lengkap","instruksi","bank","import","generator","tambah","riwayat","hasil","review"].indexOf(path)!==-1){
    // kembalikan ke rute permainan + tawarkan konfirmasi keluar
    location.hash=S.leaveGuard.route;
    confirmLeaveGame();
    return;
  }
  setNav(path);
  window.scrollTo(0,0);
  if(path==="" ) return vDashboard();
  if(path==="mapel") return vMapel(r.q.mode);
  if(path==="setup-lengkap") return vSetupLengkap();
  if(path==="tts") return vTTS(r.q.subject);
  if(path==="kuis") return vKuis(r.q.subject);
  if(path==="setup") return vSetup(r.q.subject);
  if(path==="instruksi") return vInstruksi();
  if(path==="simulasi") return vSimulasi();
  if(path==="hasil") return vHasil();
  if(path==="review") return vReview(r.q.id);
  if(path==="riwayat") return vRiwayat();
  if(path==="bank") return vBank();
  if(path==="import") return vImport();
  if(path==="generator") return vGenerator();
  if(path==="tambah") return vTambah();
  return vDashboard();
}
window.addEventListener("hashchange", render);
function confirmLeaveGame(){
  var g=S.leaveGuard;
  if(!g) return;
  modal('<h3>Keluar dari permainan?</h3><p class="hint">'+esc(g.message||"Progres permainan yang sedang berjalan akan hilang.")+'</p>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" id="cStay">Tetap Main</button><button class="btn btn-danger" id="cOut">Ya, Keluar</button></div>');
  document.getElementById("cStay").onclick=function(){closeModal()};
  document.getElementById("cOut").onclick=function(){closeModal(); var f=g.onQuit; S.leaveGuard=null; if(f) f();};
}
// Kompatibilitas: nama lama dipakai alur ujian
function confirmLeaveSimulation(){ confirmLeaveGame(); }
document.getElementById("hamburger").onclick=function(){ topnav.classList.toggle("open"); };
document.getElementById("brandLink").onclick=function(){ topnav.classList.remove("open"); };
topnav.addEventListener("click", function(){ topnav.classList.remove("open"); });

/* ================= DASHBOARD — PILIH MODE BELAJAR ================= */
function vDashboard(){
  var hist=window.TKAStore.getHistory();
  var totalSim=hist.length;
  var avg = totalSim? Math.round(hist.reduce(function(a,h){return a+h.nilai},0)/totalSim):0;
  var best = totalSim? Math.max.apply(null,hist.map(function(h){return h.nilai})):0;
  var totalSoal = window.TKAStore.getAllBank().length;
  var modes=["ujian","tts","kuis"].map(function(m){
    var d=window.LEARN_MODES[m];
    return '<div class="card mode-card-lg">'
      +'<div class="mode-ico" style="background:'+d.color+'">'+d.icon+'</div>'
      +'<h3>'+esc(d.title)+'</h3><p>'+esc(d.desc)+'</p>'
      +'<button class="btn btn-primary" data-mode="'+m+'">Pilih Mode Ini</button></div>';
  }).join("");
  var recent = hist.slice(0,5).map(histItem).join("") || '<div class="card pad hint">Belum ada riwayat simulasi. Mulai dari salah satu mode belajar!</div>';
  view.innerHTML =
    '<div class="hero"><div><h1>SIMULASI TKA</h1>'
    +'<p>Latihan Tes Kemampuan Akademik untuk siswa SMK jurusan PPLG/RPL lewat ujian simulasi, teka-teki silang, dan kuis interaktif — semua tersimpan lokal di perangkatmu.</p></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#/bank">Bank Soal</a><a class="btn" href="#/import">Import Soal</a><a class="btn" href="#/generator">Buat Prompt AI</a></div></div>'
    +'<div class="stats">'
    +'<div class="card stat"><b>'+totalSim+'</b><span>Total permainan</span></div>'
    +'<div class="card stat"><b>'+avg+'</b><span>Rata-rata nilai</span></div>'
    +'<div class="card stat"><b>'+best+'</b><span>Nilai terbaik</span></div>'
    +'<div class="card stat"><b>'+totalSoal+'</b><span>Total soal di bank</span></div></div>'
    +'<div class="section-title">Pilih Mode Belajar</div>'
    +'<p class="hint" style="margin-top:-6px">Pilih cara belajar yang sesuai dengan keinginanmu.</p>'
    +'<div class="grid-modes">'+modes+'</div>'
    +'<div class="section-title">Riwayat Terakhir <a href="#/riwayat" style="font-size:12px;color:var(--accent)">Lihat semua →</a></div>'
    +'<div class="hist-list">'+recent+'</div>';
  view.querySelectorAll("[data-mode]").forEach(function(b){
    b.onclick=function(){ location.hash="#/mapel?mode="+b.getAttribute("data-mode"); };
  });
}

/* ================= PILIH MATA PELAJARAN PER MODE ================= */
function vMapel(mode){
  mode = window.LEARN_MODES[mode] ? mode : "ujian";
  var d = window.LEARN_MODES[mode];
  var cards = window.TKA_CONFIG.subjects.map(function(s){
    var nBank=window.TKAStore.getBank(s.id).length;
    var extra="", go="", btn="Pilih";
    if(mode==="tts"){
      var nW=(window.BANK_TTS&&window.BANK_TTS[s.id])?window.BANK_TTS[s.id].length:0;
      extra = nW? nW+' kata TTS tersedia' : 'Belum ada kata TTS';
      go = nW? '#/tts?subject='+s.id : '';
    } else if(mode==="kuis"){
      var avail=window.TKAGames.quizItemCount(s.id);
      extra = avail? avail+' soal kuis tersedia' : 'Belum ada soal kuis';
      go = avail? '#/kuis?subject='+s.id : '';
    } else {
      extra = nBank+' soal di bank';
      go = '#/setup?subject='+s.id;
    }
    return '<div class="card subj-card">'
      +'<div class="subj-top"><span class="subj-icon" style="background:'+s.color+'">'+esc(s.icon)+'</span>'
      +'<div><h3>'+esc(s.name)+'</h3><div style="font-size:12px;color:var(--muted)">'+extra+'</div></div></div>'
      +'<p>'+esc(s.desc)+'.</p>'
      +(go? '<a class="btn btn-primary" href="'+go+'">'+btn+'</a>'
          : '<div class="warn-box">Data belum tersedia untuk mode ini. Kelola soal lewat <a href="#/bank" style="text-decoration:underline">Bank Soal</a>.</div>')
      +'</div>';
  }).join("");
  view.innerHTML='<a href="#/" class="btn btn-sm">← Pilih Mode</a>'
    +'<div class="section-title">Pilih Mata Pelajaran — '+esc(d.title)+'</div>'
    +'<p class="hint" style="margin-top:-6px">'+esc(d.desc)+'</p>'
    +(mode==="ujian"
      ? '<div class="card pad lengkap-card" style="margin-bottom:14px"><div class="subj-top"><span class="subj-icon" style="background:#0f172a">5in1</span>'
        +'<div><h3>TKA Lengkap — Semua Mapel Berurutan</h3><div style="font-size:12px;color:var(--muted)">135 soal • ±5 jam 45 mnt • paket resmi otomatis</div></div></div>'
        +'<p>Ujian seperti TKA sebenarnya: 5 bagian berurutan dengan timer tiap mapel, jeda antar-bagian, nilai per mapel + nilai gabungan.</p>'
        +'<a class="btn btn-primary" href="#/setup-lengkap">Atur TKA Lengkap</a></div>'
      : "")
    +'<div class="grid-subjects">'+cards+'</div>';
}
function histItem(h){
  var cls = h.nilai>=80?"":h.nilai>=60?"mid":"low";
  var st = h.status==="COMPLETED"?'<span class="badge ok">Selesai</span>':h.status==="TIMEOUT"?'<span class="badge warn">Waktu Habis</span>':'<span class="badge err">Dihentikan</span>';
  return '<div class="card hist-item"><div class="hist-score '+cls+'">'+h.nilai+'</div>'
    +'<div class="hist-main"><b>'+esc(window.subjectName(h.subject))+'</b><div>'+h.correct+'/'+h.total+' benar • '+fmtDate(h.date)+' • '+esc(fmtDur(h.durationMs))+' • '+esc(window.historyModeLabel(h.mode||"normal"))+'</div></div>'
    +st+'</div>';
}

/* ================= SETUP TKA LENGKAP (5 mapel berurutan) ================= */
/* ============ SETUP TKA LENGKAP — paket resmi otomatis ============ */
function vSetupLengkap(){
  var plan=window.TKA_LENGKAP_PLAN;
  var totalSoal=plan.reduce(function(a,p){return a+p.count;},0);
  var totalMin=plan.reduce(function(a,p){return a+p.minutes;},0);
  var rows=plan.map(function(p,i){
    var s=subjOf(p.subject);
    var avail=window.TKAStore.getBank(p.subject).length+(window.dynamicCap?window.dynamicCap(p.subject):0);
    var use=Math.min(p.count,avail);
    var short=use<p.count?' <span class="badge warn">bank '+use+'</span>':'';
    return '<tr><td>Bagian '+(i+1)+'<br><b>'+esc(s.name)+'</b></td><td>'+use+' soal'+short+'</td><td>'+p.minutes+' mnt</td><td>± '+Math.round(p.minutes*60/use)+' dtk/soal</td></tr>';
  }).join("");
  view.innerHTML='<a href="#/mapel?mode=ujian" class="btn btn-sm">← Pilih Mapel</a>'
    +'<div class="section-title">TKA Lengkap — Paket Resmi Otomatis</div>'
    +'<div class="two-col"><div class="card pad">'
    +'<table class="mini"><tr><th>Bagian</th><th>Soal</th><th>Waktu</th><th>Rata-rata</th></tr>'+rows
    +'<tr><th>Total</th><th>'+totalSoal+' soal</th><th>'+totalMin+' mnt</th><th></th></tr></table>'
    +'<div class="ok-box" style="margin-top:12px">Paket resmi: 3 mapel wajib + 2 pilihan PPLG (Produktif, PKWU). Jumlah soal dan waktu <b>otomatis</b> — tidak perlu diatur.</div>'
    +'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" id="lcGo">Lanjut ke Peraturan →</button></div>'
    +'</div><div class="card pad"><b>Alur TKA Lengkap</b><p class="hint">Matematika (25/75mnt) → B. Indonesia (30/75) → B. Inggris (30/75) → Produktif (25/60) → PKWU (25/60) dalam satu sesi fullscreen. Tiap bagian punya timer sendiri; antar-bagian ada jeda + tombol mulai mapel berikutnya.</p></div></div>';
  document.getElementById("lcGo").onclick=function(){
    S.pendingSetup={lengkap:true};
    location.hash="#/instruksi";
  };
}

/* ================= SETUP ================= */
function vSetup(subjectId){
  subjectId = subjectId || (S.pendingSetup&&S.pendingSetup.subject) || "matematika";
  var s=subjOf(subjectId)||subjOf("matematika");
  var bank=window.TKAStore.getBank(s.id), bankN=bank.length;
  var counts=window.TKA_CONFIG.questionCounts;
  var settings=window.TKAStore.getSettings();
  var selCount = S.pendingSetup&&S.pendingSetup.subject===s.id ? S.pendingSetup.count : window.TKA_CONFIG.defaultCount;
  var selMode = S.pendingSetup&&S.pendingSetup.subject===s.id && window.TKA_TIME.modes[S.pendingSetup.mode]
    ? S.pendingSetup.mode : (settings.lastMode||window.TKA_TIME.defaultMode);
  var dynCap0 = window.dynamicCap ? window.dynamicCap(s.id) : 0;
  var effCount = Math.min(selCount, (bankN+dynCap0)||selCount);
  var suggested = window.recommendedMinutes(s.id, effCount||selCount, selMode);
  var selMin = S.pendingSetup&&S.pendingSetup.subject===s.id ? S.pendingSetup.minutes : suggested;
  var pills=counts.map(function(c){
    return '<button class="radio-pill'+(c===selCount?" sel":"")+'" data-count="'+c+'">'+c+' soal</button>';
  }).join("");
  var modeCards=Object.keys(window.TKA_TIME.modes).map(function(m){
    var md=window.TKA_TIME.modes[m];
    var rec=window.recommendedMinutes(s.id, effCount||selCount, m);
    return '<button class="mode-card'+(m===selMode?" sel":"")+(m==="tantangan"?" recom":"")+'" data-mode="'+m+'">'
      +'<b>Mode '+md.label+'</b>'+(m==="tantangan"?'<span class="pill">Rekomendasi</span>':'')
      +'<span class="mode-time">'+rec+' mnt / '+effCount+' soal</span>'
      +'<span class="hint">'+esc(md.desc)+'</span></button>';
  }).join("");
  var comp={easy:0,medium:0,hard:0};
  bank.forEach(function(q){ if(comp[q.difficulty]!=null) comp[q.difficulty]++; });
  var avgSec = effCount? Math.round(selMin*60/effCount) : 0;
  var dynCap = window.dynamicCap ? window.dynamicCap(s.id) : 0;
  var totalAvail = bankN + dynCap;
  var dynNote = dynCap? ' Termasuk <b>±'+dynCap+' soal angka-acak</b> yang angkanya selalu berbeda di tiap simulasi.' : '';
  var warn = totalAvail<selCount
    ? '<div class="warn-box" style="margin-top:12px">Bank soal '+esc(s.name)+' memiliki <b>'+bankN+'</b> soal + <b>'+dynCap+'</b> angka-acak, sedangkan kamu memilih <b>'+selCount+'</b> soal. Simulasi akan menggunakan <b>'+totalAvail+'</b> soal tanpa duplikasi; saran waktu dihitung dari '+totalAvail+' soal aktual.</div>'
    : '<div class="ok-box" style="margin-top:12px">Bank soal mencukupi: <b>'+bankN+'</b> soal tersedia.'+dynNote+'</div>';
  view.innerHTML='<a href="#/" class="btn btn-sm">← Kembali</a>'
    +'<div class="section-title">Pengaturan Simulasi — '+esc(s.name)+'</div>'
    +'<div class="two-col"><div class="card pad">'
    +'<label class="lbl">Mata Pelajaran</label><select id="fSubj">'
    + window.TKA_CONFIG.subjects.map(function(x){return '<option value="'+x.id+'"'+(x.id===s.id?" selected":"")+'>'+esc(x.name)+' ('+window.TKAStore.getBank(x.id).length+' soal)</option>'}).join("")
    +'</select>'
    +'<label class="lbl">Jumlah Soal</label><div class="radio-row" id="countRow">'+pills+'</div>'
    +'<label class="lbl">Mode Waktu</label><div class="mode-grid" id="modeRow">'+modeCards+'</div>'
    +'<p class="hint">Rekomendasi mempertimbangkan karakteristik '+esc(s.name)+' ('+esc(window.TKA_TIME.subjectFactorNote[s.id]||"soal campuran")+'). Komposisi bank: '+comp.easy+' mudah • '+comp.medium+' sedang • '+comp.hard+' sulit.</p>'
    +'<label class="lbl">Waktu Pengerjaan (menit) — dapat diubah</label><input type="number" id="fMin" min="1" max="600" value="'+selMin+'">'
    +'<p class="hint" id="avgHint">Rata-rata: <b>'+fmtAvgSec(avgSec)+'</b> per soal ('+selMin+' menit / '+effCount+' soal). Timer berjalan global dan tidak reset saat pindah soal atau membuka Daftar Soal.</p>'
    + warn
    +'<div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-primary" id="toInstr">Lanjut ke Persiapan →</button></div>'
    +'</div><div class="card pad"><b>Alur Simulasi</b><p class="hint">Menu → Pengaturan → Persiapan → Fullscreen → Kerjakan (bebas pindah soal) → Selesai/Waktu habis/Keluar fullscreen → Nilai + evaluasi waktu → Pembahasan → Riwayat.</p>'
    +'<p class="hint">Setiap simulasi memakai <b>simulationId</b> baru, kombinasi soal berbeda (diacak dari pool yang belum dipakai), dan urutan pilihan jawaban diacak.</p>'
    +'<p class="hint">Preset latihan (menit) — Normal/Tantangan/Intensif:<br>10→20/15/12 • 20→40/30/24 • 30→60/45/36 • 40→80/60/48 • 50→100/75/60. Disesuaikan per mapel via faktor karakteristik.</p></div></div>';
  document.getElementById("fSubj").onchange=function(e){
    S.pendingSetup=null;
    location.hash="#/setup?subject="+e.target.value;
  };
  var curCount=selCount, curMode=selMode;
  function refreshSuggestion(){
    var eff=Math.min(curCount, (window.TKAStore.getBank(s.id).length+(window.dynamicCap?window.dynamicCap(s.id):0))||curCount);
    var sug=window.recommendedMinutes(s.id, eff, curMode);
    document.getElementById("fMin").value=sug;
    var a=Math.round(sug*60/(eff||1));
    document.getElementById("avgHint").innerHTML='Rata-rata: <b>'+fmtAvgSec(a)+'</b> per soal ('+sug+' menit / '+eff+' soal). Timer berjalan global dan tidak reset saat pindah soal atau membuka Daftar Soal.';
    S.pendingSetup={subject:s.id,count:curCount,mode:curMode,minutes:sug};
    vSetup(s.id);
  }
  document.querySelectorAll("#countRow [data-count]").forEach(function(b){
    b.onclick=function(){ curCount=parseInt(b.getAttribute("data-count"),10); refreshSuggestion(); };
  });
  document.querySelectorAll("#modeRow [data-mode]").forEach(function(b){
    b.onclick=function(){ curMode=b.getAttribute("data-mode"); refreshSuggestion(); };
  });
  document.getElementById("fMin").oninput=function(e){
    var m=Math.max(1,Math.min(600,parseInt(e.target.value,10)||selMin));
    var eff=Math.min(curCount, (bankN+(window.dynamicCap?window.dynamicCap(s.id):0))||curCount);
    var a=Math.round(m*60/(eff||1));
    document.getElementById("avgHint").innerHTML='Rata-rata: <b>'+fmtAvgSec(a)+'</b> per soal ('+m+' menit / '+eff+' soal). Timer berjalan global dan tidak reset saat pindah soal atau membuka Daftar Soal.';
  };
  document.getElementById("toInstr").onclick=function(){
    var m=Math.max(1,Math.min(600,parseInt(document.getElementById("fMin").value,10)||suggested));
    S.pendingSetup={subject:s.id,count:curCount,mode:curMode,minutes:m};
    // simpan preferensi waktu user per mode agar mudah dipakai ulang
    var st=window.TKAStore.getSettings(); st.timeOverrides=st.timeOverrides||{};
    st.timeOverrides[curCount+"|"+curMode]=m; st.lastMode=curMode;
    window.TKAStore.saveSettings(st);
    location.hash="#/instruksi";
  };
}

/* ================= PERSIAPAN (ringkasan sebelum simulasi) ================= */
function vInstruksi(){
  if(!S.pendingSetup){ location.hash="#/"; return; }
  if(S.pendingSetup.lengkap) return vInstruksiLengkap();
  var p=S.pendingSetup, s=subjOf(p.subject);
  var mode=p.mode&&window.TKA_TIME.modes[p.mode]?p.mode:window.TKA_TIME.defaultMode;
  p.mode=mode;
  var bankN=window.TKAStore.getBank(p.subject).length;
  var dynCapI = window.dynamicCap ? window.dynamicCap(p.subject) : 0;
  var realN=Math.min(p.count,bankN+dynCapI);
  var avgSec=realN? Math.round(p.minutes*60/realN) : 0;
  var md=window.TKA_TIME.modes[mode];
  view.innerHTML='<a href="#/setup?subject='+p.subject+'" class="btn btn-sm">← Pengaturan</a>'
    +'<div class="card pad" style="margin-top:14px;max-width:760px">'
    +'<div class="q-meta"><span class="q-num">PERSIAPAN SIMULASI</span><span class="badge">'+esc(s.name)+'</span><span class="badge">Mode '+esc(md.label)+'</span></div>'
    +'<h2 style="margin:6px 0">Simulasi TKA '+esc(s.name)+'</h2>'
    +'<table class="mini">'
    +'<tr><th>Mata Pelajaran</th><td>'+esc(s.name)+'</td></tr>'
    +'<tr><th>Jumlah Soal</th><td>'+realN+'</td></tr>'
    +'<tr><th>Mode</th><td>'+esc(md.label)+' — '+esc(md.desc)+'</td></tr>'
    +'<tr><th>Waktu Tersedia</th><td>'+p.minutes+' menit ('+fmtTime(p.minutes*60*1000)+')</td></tr>'
    +'<tr><th>Rata-rata Waktu per Soal</th><td>'+fmtAvgSec(avgSec)+' (indikator kecepatan, bukan batas paksa)</td></tr>'
    +'<tr><th>Tipe soal</th><td>Pilihan ganda (1 jawaban) • Kompleks (checkbox, harus tepat semua) • Benar/Salah tabel (✓ per baris)</td></tr></table>'
    +'<div class="warn-box" style="margin-top:12px">Waktu <b>terus berjalan</b> ketika kamu berpindah soal, membuka panel Daftar Soal, mengubah jawaban, atau menandai soal. Atur kecepatan dari awal.</div>'
    +'<ol style="font-size:14px;line-height:1.8;color:#334155"><li>Jawaban tersimpan otomatis. Kamu <b>bebas pindah soal</b> lewat tombol <b>Daftar Soal</b>.</li>'
    +'<li>Nomor <b>[ ]</b>=belum dijawab, <b>[✓]</b>=sudah dijawab, <b>[★]</b>=ditandai, kotak bergaris biru=sedang dibuka.</li>'
    +'<li>Gunakan <b>★ Tandai</b> untuk meninjau kembali soal ragu-ragu.</li>'
    +'<li>Simulasi berjalan dalam <b>fullscreen</b>. <b>Keluar fullscreen = simulasi dihentikan otomatis</b> (alarm + nilai dihitung).</li>'
    +'<li>Jangan refresh/menutup halaman selama ujian; state disimpan dan ada peringatan browser.</li>'
    +'<li>Dilarang beralih aplikasi/tab/desktop lain (Alt+Tab dsb.) — terdeteksi = simulasi dihentikan otomatis.</li>'
    +'<li>Klik <b>Selesai</b> pada soal terakhir bila yakin. Waktu habis juga otomatis selesai.</li></ol>'
    +(bankN+dynCapI<p.count?'<div class="warn-box">Bank soal hanya '+bankN+'+'+dynCapI+' angka-acak soal — simulasi memakai '+realN+' soal tanpa duplikasi.</div>':"")
    +'<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:12px"><input type="checkbox" id="agree" style="width:18px;height:18px;margin-top:2px"> Saya memahami instruksi dan siap masuk mode fullscreen untuk memulai simulasi.</label>'
    +'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" id="beginBtn" disabled>Mulai Simulasi</button></div></div>';
  var ag=document.getElementById("agree"), bb=document.getElementById("beginBtn");
  ag.onchange=function(){bb.disabled=!ag.checked};
  bb.onclick=function(){ beginSimulation(); };
}
/* ---- Persiapan TKA Lengkap: ringkasan 5 bagian ---- */
function vInstruksiLengkap(){
  var p=S.pendingSetup;
  var plan=window.TKA_LENGKAP_PLAN;
  var totalSoal=plan.reduce(function(a,x){return a+x.count;},0);
  var totalMin=plan.reduce(function(a,x){return a+x.minutes;},0);
  var rows=plan.map(function(x,i){
    var avail=window.TKAStore.getBank(x.subject).length+(window.dynamicCap?window.dynamicCap(x.subject):0);
    var use=Math.min(x.count,avail);
    return '<tr><td>'+(i+1)+'. '+esc(window.subjectName(x.subject))+'</td><td>'+use+' soal</td><td>'+x.minutes+' mnt</td></tr>';
  }).join("");
  view.innerHTML='<a href="#/setup-lengkap" class="btn btn-sm">← Paket</a>'
    +'<div class="card pad" style="margin-top:14px;max-width:760px">'
    +'<div class="q-meta"><span class="q-num">PERATURAN TKA LENGKAP</span><span class="badge">Paket Resmi</span></div>'
    +'<h2 style="margin:6px 0">TKA Lengkap — 5 Mapel Berurutan</h2>'
    +'<table class="mini"><tr><th>Bagian</th><th>Soal</th><th>Waktu</th></tr>'+rows
    +'<tr><th>Total</th><th>'+totalSoal+' soal</th><th>'+totalMin+' menit ('+fmtTime(totalMin*60*1000)+')</th></tr></table>'
    +'<ol style="font-size:14px;line-height:1.8;color:#334155">'
    +'<li>Kerjakan 5 bagian berurutan: Matematika → B. Indonesia → B. Inggris → Produktif → PKWU.</li>'
    +'<li>Tiap bagian punya <b>timer sendiri</b> yang tampil di atas. Waktu bagian habis = bagian otomatis selesai.</li>'
    +'<li>Daftar Soal hanya menampilkan <b>mapel yang sedang dikerjakan</b>.</li>'
    +'<li>Antar-bagian ada <b>jeda</b>: timer berhenti. Tekan “Mulai” untuk mapel berikutnya.</li>'
    +'<li>Jawaban tersimpan otomatis. Nomor <b>[ ]</b>=belum, <b>[✓]</b>=sudah, <b>[★]</b>=ditandai.</li>'
    +'<li>Simulasi berjalan dalam <b>fullscreen</b>. <b>Keluar fullscreen = simulasi dihentikan otomatis</b> (alarm + nilai dihitung).</li>'
    +'<li>Dilarang beralih aplikasi/tab/desktop lain (Alt+Tab dsb.) — terdeteksi = simulasi dihentikan otomatis.</li>'
    +'<li>Klik <b>Selesai</b> di soal terakhir bagian 5. Hasil berisi nilai gabungan + nilai tiap mapel.</li></ol>'
    +'<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:12px"><input type="checkbox" id="agree" style="width:18px;height:18px;margin-top:2px"> Saya memahami peraturan dan siap masuk mode fullscreen untuk memulai TKA.</label>'
    +'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" id="beginBtn" disabled>Mulai TKA</button></div></div>';
  var ag=document.getElementById("agree"), bb=document.getElementById("beginBtn");
  ag.onchange=function(){bb.disabled=!ag.checked};
  bb.onclick=function(){ beginSimulation(); };
}
function beginSimulation(){
  var p=S.pendingSetup;
  if(!p) return;
  if(p.lengkap) return beginSimulationLengkap();
  var built=window.TKAEngine.buildSession(p.subject, p.count);
  if(built.error){ toast(built.error); return; }
  var ses=built.session;
  ses.durationMs=p.minutes*60*1000;
  ses.totalMs=ses.durationMs; // patokan ambang timer & target kecepatan
  ses.mode=(p.mode&&window.TKA_TIME.modes[p.mode])?p.mode:window.TKA_TIME.defaultMode;
  ses.oneMinNotified=false;
  ses.endTime=Date.now()+ses.durationMs;
  ses.requestedCount=p.count;
  S.session=ses;
  S.leaveGuard={ route:"#/simulasi",
    message:"Jika keluar sekarang, jawaban yang sudah diisi akan disimpan dan simulasi dianggap selesai.",
    onQuit:function(){ finishSession("COMPLETED"); } };
  persistActive();
  history.pushState(null,"",location.href);
  // masuk fullscreen (resmi, aman) lalu ke halaman simulasi
  window.TKAEngine.enterFullscreen().then(function(){
    S.fullscreenExpected = !!document.fullscreenElement;
    if(!S.fullscreenExpected) toast("Fullscreen tidak diizinkan browser — simulasi tetap berjalan.");
    location.hash="#/simulasi";
  }).catch(function(){
    S.fullscreenExpected=false;
    location.hash="#/simulasi";
  });
  setTimeout(function(){ if(S.session&&location.hash!=="#/simulasi") location.hash="#/simulasi"; },800);
}

function beginSimulationLengkap(){
  var specs=window.TKA_LENGKAP_PLAN.map(function(p){ return {subject:p.subject, count:p.count, minutes:p.minutes}; });
  // Bangun 5 blok mapel sekaligus; pesan error menyebut mapel yang bermasalah
  var built=window.TKAEngine.buildSessionLengkap(specs);
  if(built.error){ toast(built.error); return; }
  var ses=built.session;
  var totalMs=ses.blocks.reduce(function(a,b){return a+b.durationMs;},0);
  ses.durationMs=totalMs;
  ses.totalMs=totalMs;
  ses.mode="lengkap";
  ses.blockIdx=0;
  ses.currentIndex=0;
  ses.blockEnd=Date.now()+ses.blocks[0].durationMs;
  ses.endTime=ses.blockEnd;
  ses.requestedCount=specs.reduce(function(a,s){return a+s.count;},0);
  S.session=ses;
  S.leaveGuard={ route:"#/simulasi",
    message:"Jika keluar sekarang, jawaban yang sudah diisi akan disimpan dan simulasi dianggap selesai.",
    onQuit:function(){ finishSession("COMPLETED"); } };
  persistActive();
  history.pushState(null,"",location.href);
  window.TKAEngine.enterFullscreen().then(function(){
    S.fullscreenExpected = !!document.fullscreenElement;
    if(!S.fullscreenExpected) toast("Fullscreen tidak diizinkan browser — simulasi tetap berjalan.");
    location.hash="#/simulasi";
  }).catch(function(){
    S.fullscreenExpected=false;
    location.hash="#/simulasi";
  });
  setTimeout(function(){ if(S.session&&location.hash!=="#/simulasi") location.hash="#/simulasi"; },800);
}

/* ================= SIMULASI ================= */
function qAnswered(q){ return window.TKAEngine.isAnswered(q, S.session.answers[q.id]); }
function qMarked(qid){ return S.session.marked.indexOf(qid)!==-1; }

function vSimulasi(){
  var ses=S.session;
  if(!ses){
    // coba pulihkan dari penyimpanan (refresh tak sengaja)
    var saved=window.TKAStore.getActive();
    if(saved && saved.status==="RUNNING"){
      // rekonstruksi ringan: endTime tetap dari simpanan
      S.session=saved; ses=saved;
      if(!ses.mode) ses.mode="normal";
      if(!ses.totalMs) ses.totalMs=ses.durationMs||(ses.endTime-ses.startTime);
      toast("Session dipulihkan dari penyimpanan.");
    } else {
      view.innerHTML='<div class="card pad">Tidak ada simulasi aktif. <a class="btn btn-primary" href="#/" style="margin-left:8px">Ke Beranda</a></div>';
      return;
    }
  }
  startTimer();
  if(ses.onBreak){ renderBreak(); return; }
  renderSim();
}
/* ---------- Jeda antar mapel (TKA Lengkap): timer berhenti ---------- */
function enterBreak(auto){
  var ses=S.session; if(!ses||!ses.blocks) return;
  ses.onBreak=true; ses.breakStart=Date.now();
  stopTimer(); persistActive();
  if(auto) toast("Waktu bagian habis — jawaban tersimpan.");
  renderBreak();
}
function renderBreak(){
  var ses=S.session; if(!ses||!ses.blocks) return;
  var bi=ses.blockIdx||0;
  var doneBlk=ses.blocks[bi], nextBlk=ses.blocks[bi+1];
  var ansCount=doneBlk.questions.filter(function(x){return qAnswered(x)}).length;
  closeNavPanel();
  view.innerHTML='<div class="sim-single" style="margin-top:20px"><div class="card pad" style="text-align:center">'
    +'<div class="q-meta" style="justify-content:center"><span class="q-num">BAGIAN '+(bi+1)+' SELESAI</span><span class="badge ok">✓ '+esc(window.subjectName(doneBlk.subject))+'</span></div>'
    +'<h2 style="margin:8px 0">'+esc(window.subjectName(doneBlk.subject))+' selesai</h2>'
    +'<p class="hint">Terjawab '+ansCount+'/'+doneBlk.questions.length+' • Timer berhenti selama jeda.</p>'
    +(nextBlk
      ? '<div class="ok-box" style="text-align:left;margin-top:12px"><b>Berikutnya — Bagian '+(bi+2)+': '+esc(window.subjectName(nextBlk.subject))+'</b><br>'+nextBlk.questions.length+' soal • '+fmtDur(nextBlk.durationMs)+' • Timer bagian dimulai saat kamu menekan tombol di bawah.</div>'
        +'<button class="btn btn-primary btn-lg" id="breakGo" style="margin-top:14px">Mulai: '+esc(window.subjectName(nextBlk.subject))+' ▶</button>'
      : '<button class="btn btn-primary btn-lg" id="breakGo" style="margin-top:14px">Lihat Hasil</button>')
    +'</div></div>';
  document.getElementById("breakGo").onclick=function(){
    if(!ses.blocks[bi+1]){ finishSession("COMPLETED"); return; }
    ses.blockIdx=bi+1;
    ses.currentIndex=ses.blockStarts[ses.blockIdx];
    ses.blockEnd=Date.now()+ses.blocks[ses.blockIdx].durationMs;
    ses.onBreak=false; delete ses.breakStart;
    persistActive(); startTimer(); renderSim();
    toast("Bagian "+(ses.blockIdx+1)+": "+window.subjectName(ses.blocks[ses.blockIdx].subject));
  };
}
function confirmFinishBlock(){
  var ses=S.session; if(!ses||!ses.blocks) return;
  var blk=window.TKAEngine.blockOf(ses, ses.currentIndex);
  var bq=ses.blocks[blk.i].questions;
  var answered=bq.filter(function(x){return qAnswered(x)}).length;
  var nextSubj=window.TKAEngine.blockOf(ses, ses.currentIndex+1).subject;
  modal('<h3>Selesaikan Bagian '+esc(window.subjectName(blk.subject))+'?</h3>'
    +'<p class="hint">Sudah dijawab: <b>'+answered+'/'+bq.length+'</b> • Belum: <b>'+(bq.length-answered)+'</b></p>'
    +'<p class="hint">Timer berhenti dan kamu masuk jeda sebelum Bagian '+esc(window.subjectName(nextSubj))+'. Soal bagian ini tidak bisa diubah lagi.</p>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" id="fBack">Kembali</button><button class="btn btn-primary" id="fOk">Lanjut</button></div>');
  document.getElementById("fBack").onclick=closeModal;
  document.getElementById("fOk").onclick=function(){closeModal(); enterBreak(false);};
}
function blockTimeout(){
  enterBreak(true);
}
function renderSim(){
  var ses=S.session; if(!ses) return;
  var idx=ses.currentIndex;
  var q=ses.questions[idx];
  var total=ses.questions.length;
  var remain=(ses.blockEnd||ses.endTime)-Date.now();
  var answeredCount=ses.questions.filter(function(x){return qAnswered(x)}).length;
  var s=subjOf(ses.subject);

  var body="";
  if(q.type==="multiple_choice"){
    var cur=(ses.answers[q.id]||[]);
    body=q.options.map(function(o){
      var sel=cur.indexOf(o.id)!==-1;
      return '<div class="opt'+(sel?" sel":"")+'" data-pick="'+o.id+'"><span class="key">'+o.id+'</span><span class="txt">'+esc(o.text)+'</span></div>';
    }).join("")+'<p class="hint">Pilih <b>satu</b> jawaban.</p>';
  } else if(q.type==="multiple_select"){
    var cur2=(ses.answers[q.id]||[]);
    body=q.options.map(function(o){
      var sel=cur2.indexOf(o.id)!==-1;
      return '<label class="opt'+(sel?" sel":"")+'"><input type="checkbox" data-check="'+o.id+'"'+(sel?" checked":"")+'><span class="txt">'+esc(o.text)+'</span></label>';
    }).join("")+'<p class="hint">Bisa pilih <b>lebih dari satu</b>. Nilai penuh hanya jika kombinasi tepat semua.</p>';
  } else if(q.type==="true_false_table"){
    var ans=(ses.answers[q.id]||{});
    body='<table class="tf-table"><tr><th>Pernyataan</th><th style="text-align:center">Benar</th><th style="text-align:center">Salah</th></tr>'
      +q.statements.map(function(st,i){
        var v=ans[i];
        return '<tr><td>'+esc(st.text)+'</td>'
          +'<td class="c"><button class="tf-btn'+(v==="true"?" sel":"")+'" data-tf="'+i+':true">'+(v==="true"?"✓":"○")+'</button></td>'
          +'<td class="c"><button class="tf-btn'+(v==="false"?" sel":"")+'" data-tf="'+i+':false">'+(v==="false"?"✓":"○")+'</button></td></tr>';
      }).join("")+'</table><p class="hint">Setiap baris hanya satu pilihan. Klik untuk memberi tanda ✓.</p>';
  }

  var isLast = (idx === total - 1);
  var blk = window.TKAEngine.blockOf(ses, idx);
  var isBlockLast = (idx === blk.start + blk.count - 1);
  var qNo = idx - blk.start + 1; // nomor dalam blok/mapel
  var bottomBtn;
  if(isLast){
    bottomBtn = '<span class="spacer"></span><button class="btn btn-primary" id="btnFinish">Selesai</button>';
  } else if(ses.blocks && isBlockLast){
    bottomBtn = '<span class="spacer"></span><button class="btn btn-primary" id="btnFinishBlock">Selesaikan Bagian</button>';
  } else {
    bottomBtn = '<span class="spacer"></span><button class="btn btn-primary" id="btnNext">Soal Berikutnya →</button>';
  }

  closeNavPanel();
  var blockDur=(ses.blocks&&(ses.blocks[blk.i]||{}).durationMs)||ses.totalMs||ses.durationMs||1;
  var totalAll=ses.totalMs||ses.durationMs||blockDur;
  var frac0=remain/blockDur;
  var timerCls=frac0<=window.TKA_TIME.dangerAt?" danger":frac0<=window.TKA_TIME.warnAt?" warn":"";
  var elapsedMs=Math.max(0, Date.now()-ses.startTime);
  var avgPace=answeredCount? fmtAvgSec(elapsedMs/1000/answeredCount)+" /soal" : "—";
  var budgetPace=fmtAvgSec(totalAll/1000/(total||1))+" /soal";
  var timerLbl=ses.blocks? "WAKTU BAGIAN "+(blk.i+1) : "WAKTU TERSISA";
  var subjLabel = esc(window.subjectName(blk.subject));
  var blockLabel = ses.blocks
    ? 'Bagian '+(blk.i+1)+'/'+ses.blocks.length+' • '+subjLabel
    : 'SIMULASI TKA • '+subjLabel;
  view.innerHTML=
    '<div class="sim-header"><div><div class="subj">'+blockLabel+'</div>'
    +'<div class="progress">Soal '+qNo+' dari '+blk.count+' • Sudah dijawab: '+answeredCount+'/'+total+'</div>'
    +'<div class="pace">'+(ses.blocks?"TKA Lengkap":"Mode "+esc(window.timeModeLabel(ses.mode)))+' • Rata-rata: <b>'+avgPace+'</b> • Target ≤ '+budgetPace+'</div></div>'
    +'<div class="sim-header-actions"><button class="btn btn-sm btn-list" id="btnList">☰ Daftar Soal</button>'
    +'<div class="timer-box"><div class="timer-label">'+timerLbl+'</div><div class="timer'+timerCls+'" id="simTimer">'+fmtTime(remain)+'</div></div></div></div>'
    +'<div class="sim-single"><div class="card q-card">'
    +'<div class="q-meta"><span class="q-num">SOAL '+qNo+'</span><span class="badge">'+esc(typeLabel(q.type))+'</span><span class="badge">'+esc(diffLabel(q.difficulty))+'</span>'
    +(qMarked(q.id)?'<span class="badge warn">★ Ditandai</span>':"")+'</div>'
    +'<div class="q-text">'+esc(q.question)+'</div>'
    + body
    +'<div class="sim-nav"><button class="btn" id="btnMark">'+(qMarked(q.id)?"★ Batalkan Tanda":"☆ Tandai Soal")+'</button>'
    + bottomBtn +'</div>'
    +'</div></div>';

  // interactions
  view.querySelectorAll("[data-pick]").forEach(function(el){
    el.onclick=function(){
      S.session.answers[q.id]=[el.getAttribute("data-pick")];
      persistActive(); renderSim();
    };
  });
  view.querySelectorAll("[data-check]").forEach(function(cb){
    cb.onchange=function(){
      var cur=(S.session.answers[q.id]||[]).slice();
      var id=cb.getAttribute("data-check");
      if(cb.checked){ if(cur.indexOf(id)===-1) cur.push(id); }
      else { cur=cur.filter(function(x){return x!==id}); }
      cur.sort();
      if(cur.length) S.session.answers[q.id]=cur; else delete S.session.answers[q.id];
      persistActive(); renderSim();
    };
  });
  view.querySelectorAll("[data-tf]").forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute("data-tf").split(":");
      var i=parseInt(parts[0],10), v=parts[1];
      var a=Object.assign({}, S.session.answers[q.id]||{});
      a[i]=v;
      S.session.answers[q.id]=a;
      persistActive(); renderSim();
    };
  });
  document.getElementById("btnList").onclick=function(){ toggleNavPanel(); };
  var nx=document.getElementById("btnNext");
  if(nx) nx.onclick=function(){
    if(S.session.currentIndex<S.session.questions.length-1){S.session.currentIndex++; persistActive(); renderSim();}
  };
  var nxb=document.getElementById("btnFinishBlock");
  if(nxb) nxb.onclick=function(){ confirmFinishBlock(); };
  document.getElementById("btnMark").onclick=function(){
    var id=q.id, m=S.session.marked;
    if(m.indexOf(id)!==-1) S.session.marked=m.filter(function(x){return x!==id});
    else m.push(id);
    persistActive(); renderSim();
  };
  var fin=document.getElementById("btnFinish");
  if(fin) fin.onclick=function(){ confirmFinish(); };
}
/* ---------- Panel Daftar Soal (overlay; timer & session tidak disentuh) ---------- */
function navBoxLabel(x, i, dispNo){
  var answered=qAnswered(x), marked=qMarked(x.id);
  var mark = marked && answered ? "✓★" : marked ? "★" : answered ? "✓" : "";
  return (mark ? '<span class="mi">'+mark+'</span>' : "") + (dispNo!=null?dispNo:(i+1));
}
function navNumBtn(x, globalIdx, labelNo, subjName){
  var cls="num";
  if(globalIdx===S.session.currentIndex) cls+=" cur";
  if(qAnswered(x)) cls+=" answered";
  if(qMarked(x.id)) cls+=" marked";
  return '<button class="'+cls+'" data-navjump="'+globalIdx+'" aria-label="Soal '+labelNo+(subjName?" "+subjName:"")+'">'+navBoxLabel(x,globalIdx,labelNo)+'</button>';
}
function openNavPanel(){
  if(!S.session || S.session.status!=="RUNNING") return;
  closeNavPanel();
  S.navPanelOpen=true;
  var ses=S.session, idx=ses.currentIndex, total=ses.questions.length;
  var answeredCount=ses.questions.filter(function(x){return qAnswered(x)}).length;
  var gridHtml="", panelBadge=esc(window.subjectName(ses.subject)), panelSub="";
  if(ses.blocks){
    // Hanya mapel yang sedang dikerjakan (resmi: antar-bagian dipisah jeda)
    var blk=window.TKAEngine.blockOf(ses, idx);
    var b=ses.blocks[blk.i], start=blk.start;
    var nums=b.questions.map(function(x,k){
      return navNumBtn(x, start+k, k+1, window.subjectName(b.subject));
    }).join("");
    var ansB=b.questions.filter(function(x){return qAnswered(x)}).length;
    gridHtml='<div class="navblock"><div class="navpanel-sub" style="padding:0 0 8px">Bagian '+(blk.i+1)+'/'+ses.blocks.length+'</div>'
      +'<div class="num-grid">'+nums+'</div></div>';
    panelBadge=esc(window.subjectName(b.subject));
    panelSub='Sudah dijawab '+ansB+'/'+b.questions.length+' • Ditandai '+ses.marked.filter(function(id){
      return b.questions.some(function(x){return x.id===id;});
    }).length+' • Klik nomor untuk pindah (panel tertutup otomatis).';
  } else {
    gridHtml='<div class="num-grid">'+ses.questions.map(function(x,i){
      return navNumBtn(x, i, i+1, null);
    }).join("")+'</div>';
    panelSub='Sudah dijawab '+answeredCount+'/'+total+' • Ditandai '+ses.marked.length+' • Klik nomor untuk pindah (panel tertutup otomatis).';
  }
  var ov=document.createElement("div");
  ov.className="navpanel-back"; ov.id="navPanel";
  ov.innerHTML='<div class="navpanel" role="dialog" aria-label="Daftar Soal">'
    +'<div class="navpanel-head"><b>DAFTAR SOAL</b><span class="badge">'+panelBadge+'</span>'
    +'<span style="flex:1"></span><button class="btn btn-sm" id="navClose">Tutup</button></div>'
    +'<div class="navpanel-sub">'+panelSub+'</div>'
    +'<div class="navpanel-grid">'+gridHtml
    +'<div class="legend"><span><i class="dot" style="background:#f1f5f9;border:1px solid #cbd5e1"></i>Belum</span><span><span style="font-weight:800">✓</span> Sudah</span><span><span style="font-weight:800">★</span> Ditandai</span><span><i class="dot" style="background:#fff;border:2px solid var(--accent)"></i>Aktif</span></div></div>'
    +'<div class="navpanel-foot"><button class="btn btn-primary" id="navDone" style="flex:1">Tutup</button>'
    +'<button class="btn btn-sm" id="navExitFs" title="Keluar fullscreen untuk menguji deteksi">Uji: Keluar Fullscreen</button></div></div>';
  document.body.appendChild(ov);
  // Klik backdrop menutup panel — tidak mengubah jawaban apa pun
  ov.addEventListener("click", function(e){ if(e.target===ov) closeNavPanel(); });
  document.getElementById("navClose").onclick=function(e){ e.stopPropagation(); closeNavPanel(); };
  document.getElementById("navDone").onclick=function(e){ e.stopPropagation(); closeNavPanel(); };
  ov.querySelector(".navpanel").addEventListener("click", function(e){ e.stopPropagation(); });
  ov.querySelectorAll("[data-navjump]").forEach(function(b){
    b.onclick=function(e){
      e.stopPropagation();
      S.session.currentIndex=parseInt(b.getAttribute("data-navjump"),10);
      persistActive(); // jawaban soal lain tetap tersimpan (tidak direset)
      closeNavPanel();
      renderSim();
    };
  });
  var ef=document.getElementById("navExitFs");
  if(ef) ef.onclick=function(e){
    e.stopPropagation();
    if(document.fullscreenElement) document.exitFullscreen();
    else terminateFullscreenExit();
  };
}
function closeNavPanel(){
  S.navPanelOpen=false;
  var p=document.getElementById("navPanel");
  if(p) p.remove();
}
function toggleNavPanel(){
  if(S.navPanelOpen) closeNavPanel();
  else openNavPanel();
}
function confirmFinish(){
  var ses=S.session;
  var sc=window.TKAEngine.score(ses);
  var un=ses.questions.map(function(q,i){return {q:q,i:i}}).filter(function(x){return !qAnswered(x.q)});
  modal('<h3>Selesaikan Simulasi?</h3>'
    +'<p class="hint">Sudah dijawab: <b>'+(sc.total-sc.empty)+'</b></p>'
    +'<p class="hint">Belum dijawab: <b>'+sc.empty+'</b></p>'
    +(un.length? '<p class="hint">Belum dijawab: soal '+un.slice(0,12).map(function(x){return x.i+1}).join(", ")+(un.length>12?" …":"")+'</p>':"")
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" id="fBack">Kembali</button><button class="btn btn-primary" id="fOk">Selesaikan</button></div>');
  document.getElementById("fBack").onclick=closeModal;
  document.getElementById("fOk").onclick=function(){closeModal(); finishSession("COMPLETED");};
}

/* ---------- Evaluasi waktu: kecepatan + akurasi, tanpa menghakimi ---------- */
function evaluasiWaktu(r){
  var avg=r.avgSecPerQ||0, budget=r.budgetSecPerQ||0, empty=r.empty||0;
  var answered=r.total-empty;
  var paceOk = budget? avg<=budget : true;
  var paceLine='Kecepatan: menjawab <b>'+answered+'/'+r.total+'</b> soal • Rata-rata <b>'+fmtAvgSec(avg)+'</b>/soal (target ≤ '+fmtAvgSec(budget)+') — '+(paceOk?"dalam target":"melebihi target")+').';
  var saran="";
  var ulang = (r.subject==="lengkap") ? "Ulangi <b>TKA Lengkap</b>" : "Coba ulangi simulasi dengan Mode Tantangan";
  if(empty>0){
    saran="Kamu berhasil menyelesaikan sebagian besar soal, tetapi masih ada <b>"+empty+" soal yang belum dijawab</b>. "+ulang+" dan latih pengelolaan waktu (target ≤ "+fmtAvgSec(budget)+"/soal).";
  } else if(r.nilai>=80 && paceOk){
    saran="Akurasi dan kecepatan sama-sama baik. "+(r.subject==="lengkap"?"Pertahankan konsistensi di semua 5 bagian.":"Pertahankan, lalu naik ke <b>Mode Intensif</b> untuk tantangan berikutnya.");
  } else if(r.nilai>=80){
    saran="Akurasi baik, tetapi rata-rata "+fmtAvgSec(avg)+" melebihi target "+fmtAvgSec(budget)+". "+(r.subject==="lengkap"?"Latih kecepatan tiap bagian tanpa mengorbankan ketelitian.":"Latih kecepatan dengan <b>Mode Tantangan</b> tanpa mengorbankan ketelitian.");
  } else if(r.nilai>=60){
    saran=(r.subject==="lengkap"?"Hasil cukup. Perdalam dulu mapel dengan nilai terendah lewat simulasi per mapel, lalu ulangi TKA Lengkap.":"Hasil cukup. Perdalam materi dengan <b>Mode Normal</b>, lalu uji kecepatan di Mode Tantangan.");
  } else {
    saran=(r.subject==="lengkap"?"Fokus latih dulu tiap mapel secara terpisah sebelum mengulang TKA Lengkap.":"Fokus pahami materi dulu dengan <b>Mode Normal</b> sebelum berlatih kecepatan — kecepatan tanpa akurasi tidak menambah nilai.");
  }
  return '<div class="ok-box" style="margin-top:12px;text-align:left"><b>Evaluasi Waktu</b><br>'+paceLine+'<br><br><b>Saran latihan berikutnya:</b><br>'+saran+'</div>';
}

/* ================= HASIL ================= */
function vHasil(){
  var r=S.lastResult;
  if(!r){
    // ambil riwayat terbaru agar refresh halaman hasil tidak kosong
    var h=window.TKAStore.getHistory();
    if(h.length){ S.lastResult=h[0]; r=h[0]; }
  }
  if(!r){ view.innerHTML='<div class="card pad">Belum ada hasil. <a class="btn btn-primary" href="#/">Ke Beranda</a></div>'; return; }
  var reason = r.finishReason||"COMPLETED";
  var reasonId = reason==="COMPLETED"?"COMPLETED":reason==="TIMEOUT"?"TIMEOUT":reason==="TAB_SWITCH"?"TAB_SWITCH":"FULLSCREEN_EXIT";
  var badge = reasonId==="COMPLETED"?'<span class="badge ok">Selesai</span>':reasonId==="TIMEOUT"?'<span class="badge warn">Waktu Habis</span>':reasonId==="TAB_SWITCH"?'<span class="badge err">TERMINATED_TAB_SWITCH</span>':'<span class="badge err">TERMINATED_FULLSCREEN_EXIT</span>';
  var byType={};
  r.questions.forEach(function(q){
    byType[q.type]=byType[q.type]||{t:0,c:0};
    byType[q.type].t++;
    if(window.TKAEngine.isCorrect(q, r.answers[q.id])) byType[q.type].c++;
  });
  var typeRows=Object.keys(byType).map(function(t){return '<tr><td>'+esc(typeLabel(t))+'</td><td>'+byType[t].c+'/'+byType[t].t+'</td></tr>'}).join("");
  var modeLbl=(r.subject==="lengkap"||r.mode==="lengkap")?"TKA Lengkap":window.timeModeLabel(r.mode);
  var avgTxt=fmtAvgSec(r.avgSecPerQ||0), budgetTxt=fmtAvgSec(r.budgetSecPerQ||0);
  var answeredN=r.total-(r.empty||0);
  var evalHtml=evaluasiWaktu(r);
  view.innerHTML='<div class="card result-hero"><div class="q-meta" style="justify-content:center"><span class="q-num">HASIL SIMULASI</span><span class="badge">'+esc(window.subjectName(r.subject))+'</span><span class="badge">Mode '+esc(modeLbl)+'</span>'+badge+'</div>'
    +'<h2 style="margin:8px 0 0">'+esc(window.subjectName(r.subject))+'</h2>'
    +'<div class="score-big">'+r.nilai+'</div>'
    +'<div class="hint">Nilai • '+r.correct+' benar dari '+r.total+' soal</div>'
    +'<div class="result-grid" style="text-align:left">'
    +'<div class="card pad"><b>'+r.correct+'</b><br><span class="hint">Benar</span></div>'
    +'<div class="card pad"><b>'+r.wrong+'</b><br><span class="hint">Salah</span></div>'
    +'<div class="card pad"><b>'+r.empty+'</b><br><span class="hint">Tidak dijawab</span></div>'
    +'<div class="card pad"><b>'+esc(fmtDur(r.durationMs))+'</b><br><span class="hint">Total waktu</span></div>'
    +'<div class="card pad"><b>'+esc(avgTxt)+'</b><br><span class="hint">Rata-rata /soal</span></div>'
    +'<div class="card pad"><b>'+esc(modeLbl)+'</b><br><span class="hint">Mode waktu</span></div></div>'
    +'<table class="mini"><tr><th>Jumlah soal</th><td>'+r.total+'</td></tr><tr><th>Persentase</th><td>'+r.nilai+'%</td></tr><tr><th>Waktu pengerjaan</th><td>'+esc(fmtDur(r.durationMs))+' • '+fmtDate(r.date)+'</td></tr><tr><th>Rata-rata waktu per soal</th><td>'+esc(avgTxt)+' (target ≤ '+esc(budgetTxt)+')</td></tr><tr><th>Soal terjawab</th><td>'+answeredN+'/'+r.total+'</td></tr><tr><th>Mode yang digunakan</th><td>'+esc(modeLbl)+'</td></tr><tr><th>Alasan selesai</th><td>'+reasonId+'</td></tr><tr><th>Status</th><td>'+esc(r.status)+'</td></tr></table>'
    +evalHtml
    +'<table class="mini"><tr><th>Tipe soal</th><th>Benar/Total</th></tr>'+typeRows+'</table>'
    +(r.breakdown? '<table class="mini"><tr><th>Bagian</th><th>Benar</th><th>Nilai</th></tr>'
      +r.breakdown.map(function(b,i){
        return '<tr><td>'+(i+1)+'. '+esc(window.subjectName(b.subject))+'</td><td>'+b.correct+'/'+b.total+'</td><td><b>'+b.nilai+'</b></td></tr>';
      }).join("")+'</table>' : "")
    +'<div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap"><a class="btn btn-primary" href="#/review?id='+r.id+'">Lihat Pembahasan</a><a class="btn" href="#/">Kembali ke Menu</a><a class="btn" href="'+(r.subject==="lengkap"?"#/setup-lengkap":"#/setup?subject="+r.subject)+'">Simulasi Lagi (Soal Baru)</a></div></div>';
}

/* ================= REVIEW ================= */
function vReview(id){
  var r=S.lastResult && (!id || S.lastResult.id===id) ? S.lastResult : window.TKAStore.getHistory().find(function(h){return h.id===id});
  if(!r){ var h=window.TKAStore.getHistory(); r=h[0]; }
  if(!r){ view.innerHTML='<div class="card pad">Belum ada data review.</div>'; return; }
  function reviewItem(q, no){
    var ans=r.answers[q.id];
    var ok=window.TKAEngine.isCorrect(q,ans);
    var emp=!window.TKAEngine.isAnswered(q,ans);
    var cls=emp?"rev-empty":ok?"rev-correct":"rev-wrong";
    var status=emp?"Tidak dijawab":ok?"✓ Benar":"✕ Salah";
    var userHtml="", kunciHtml="";
    if(q.type==="true_false_table"){
      var rows=q.statements.map(function(st,j){
        var u=ans&&ans[j], k=st.answer;
        var uu=u==="true"?"Benar":u==="false"?"Salah":"—";
        var kk=k==="true"?"Benar":"Salah";
        var sOk=u===k;
        return '<tr><td>'+esc(st.text)+'</td><td>'+uu+'</td><td>'+kk+'</td><td>'+(sOk?"✓":"✕")+'</td></tr>';
      }).join("");
      userHtml='<table class="mini"><tr><th>Pernyataan</th><th>Jawaban Anda</th><th>Jawaban Benar</th><th>Status</th></tr>'+rows+'</table>';
      kunciHtml="";
    } else {
      var txt=function(ids){
        if(!ids||!ids.length) return "—";
        return ids.map(function(id){
          var o=(q.options||[]).find(function(x){return x.id===id});
          return id+(o?". "+o.text:"");
        }).join("; ");
      };
      userHtml='<div><b>Jawaban Anda:</b> '+esc(txt(Array.isArray(ans)?ans:[]))+'</div>';
      kunciHtml='<div><b>Jawaban Benar:</b> '+esc(txt(q.correctAnswer))+'</div>';
    }
    return '<div class="card rev-item '+cls+'"><div class="q-meta"><span class="q-num">SOAL '+no+'</span><span class="badge">'+esc(typeLabel(q.type))+'</span><span class="badge">'+status+'</span></div>'
      +'<div style="font-size:14px;line-height:1.7;white-space:pre-wrap;margin-bottom:8px">'+esc(q.question)+'</div>'
      +'<div style="font-size:13px;line-height:1.7">'+userHtml+kunciHtml
      +(q.explanation?'<div style="margin-top:6px;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:8px 10px"><b>Pembahasan:</b> '+esc(q.explanation)+'</div>':"")
      +'</div></div>';
  }
  // Kelompokkan per mapel untuk TKA Lengkap
  var groups;
  if(r.subject==="lengkap" && r.breakdown){
    groups=r.breakdown.map(function(b){
      return { title:window.subjectName(b.subject),
               qs:r.questions.filter(function(q){return q.subject===b.subject;}) };
    });
  } else {
    groups=[{title:null, qs:r.questions}];
  }
  var items=groups.map(function(g){
    var list=g.qs.map(function(q,k){ return reviewItem(q,k+1); }).join("");
    return (g.title? '<div class="section-title" style="margin-top:18px">'+esc(g.title)+'</div>' : "") + list;
  }).join("");
  view.innerHTML='<a href="#/hasil" class="btn btn-sm">← Hasil</a> <a href="#/" class="btn btn-sm">Beranda</a>'
    +'<div class="section-title">Pembahasan — '+esc(window.subjectName(r.subject))+' (Nilai '+r.nilai+')</div>'+items;
}

/* ================= RIWAYAT ================= */
function vRiwayat(){
  var hist=window.TKAStore.getHistory();
  S.histFilter=S.histFilter||{subject:"all",mode:"all"};
  var f=S.histFilter;
  var filtered=hist.filter(function(h){
    if(f.subject!=="all"&&h.subject!==f.subject) return false;
    if(f.mode!=="all"&&(h.mode||"normal")!==f.mode) return false;
    return true;
  });
  // Ringkasan per mode (dari seluruh riwayat, bukan yang terfilter)
  var perMode={};
  hist.forEach(function(h){
    var m=h.mode||"normal";
    perMode[m]=perMode[m]||{n:0,sum:0,best:0};
    perMode[m].n++; perMode[m].sum+=h.nilai; if(h.nilai>perMode[m].best) perMode[m].best=h.nilai;
  });
  var chips=Object.keys(window.TKA_TIME.modes).map(function(m){
    var d=perMode[m];
    var txt=d? d.n+"× • rata-rata "+Math.round(d.sum/d.n)+" • terbaik "+d.best : "belum ada data";
    return '<span class="pill"><b>Mode '+esc(window.timeModeLabel(m))+':</b> '+txt+'</span>';
  }).join(" ");
  var rows=filtered.map(function(h){
    var avg=h.avgSecPerQ!=null? ' • '+fmtAvgSec(h.avgSecPerQ)+'/soal' : '';
    return '<div class="card hist-item"><div class="hist-score '+(h.nilai>=80?"":h.nilai>=60?"mid":"low")+'">'+h.nilai+'</div>'
      +'<div class="hist-main"><b>'+esc(window.subjectName(h.subject))+'</b><div>'+h.correct+'/'+h.total+' • '+fmtDate(h.date)+' • '+esc(fmtDur(h.durationMs))+avg+' • '+esc(window.historyModeLabel(h.mode||"normal"))+' • '+(h.finishReason||h.status)+'</div></div>'
      +'<div style="display:flex;gap:6px"><a class="btn btn-sm" href="#/review?id='+h.id+'">Bahasan</a><button class="btn btn-sm" data-del="'+h.id+'">Hapus</button></div></div>';
  }).join("") || '<div class="card pad hint">Belum ada riwayat untuk filter ini.</div>';
  view.innerHTML='<div class="section-title">Riwayat Simulasi</div>'
    +'<div class="card pad" style="margin-bottom:12px"><b>Perbandingan per Mode</b><div class="subj-meta" style="margin-top:8px">'+chips+'</div>'
    +'<p class="hint">Perbandingan antar-mode hanya bermakna untuk jumlah soal yang sama — nilai dari jumlah soal berbeda tidak setara.</p></div>'
    +'<div class="toolbar"><select id="hfSubj"><option value="all">Mapel: Semua</option>'
    +window.TKA_CONFIG.subjects.map(function(s){return '<option value="'+s.id+'"'+(f.subject===s.id?" selected":"")+'>'+esc(s.name)+'</option>'}).join("")
    +'</select><select id="hfMode"><option value="all">Mode: Semua</option>'
    +Object.keys(window.TKA_TIME.modes).map(function(m){return '<option value="'+m+'"'+(f.mode===m?" selected":"")+'>Mode '+esc(window.timeModeLabel(m))+'</option>'}).join("")
    +'</select></div>'
    +'<div style="display:flex;gap:8px;margin-bottom:12px"><button class="btn btn-sm" id="clearH">Hapus Semua</button><a class="btn btn-sm" href="#/">Beranda</a></div>'
    +'<div class="hist-list">'+rows+'</div>';
  document.getElementById("hfSubj").onchange=function(e){S.histFilter.subject=e.target.value;render()};
  document.getElementById("hfMode").onchange=function(e){S.histFilter.mode=e.target.value;render()};
  document.getElementById("clearH").onclick=function(){
    modal('<h3>Hapus seluruh riwayat?</h3><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" id="x1">Batal</button><button class="btn btn-danger" id="x2">Hapus</button></div>');
    document.getElementById("x1").onclick=closeModal;
    document.getElementById("x2").onclick=function(){window.TKAStore.clearHistory();closeModal();render();};
  };
  view.querySelectorAll("[data-del]").forEach(function(b){
    b.onclick=function(){window.TKAStore.deleteHistory(b.getAttribute("data-del"));render();toast("Riwayat dihapus.");};
  });
}

/* ================= BANK SOAL ================= */
function vBank(){
  var f=S.bankFilter;
  var all=window.TKAStore.getAllBank();
  var filtered=all.filter(function(q){
    if(f.subject!=="all"&&q.subject!==f.subject) return false;
    if(f.type!=="all"&&q.type!==f.type) return false;
    if(f.diff!=="all"&&q.difficulty!==f.diff) return false;
    if(f.q){ var hay=(q.question+" "+q.id+" "+(q.options||[]).map(function(o){return o.text}).join(" ")).toLowerCase(); if(hay.indexOf(f.q.toLowerCase())===-1) return false; }
    return true;
  });
  var rows=filtered.slice(0,200).map(function(q){
    var prev=q.type==="true_false_table"
      ? q.statements.map(function(s){return "• "+s.text+" ("+(s.answer==="true"?"BENAR":"SALAH")+")"}).join("<br>")
      : (q.options||[]).map(function(o){return esc(o.id)+". "+esc(o.text)}).join("<br>");
    return '<div class="card qrow"><h4>['+esc(q.id)+'] '+esc(q.question)+'</h4>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:6px">'+esc(window.subjectName(q.subject))+' • '+esc(typeLabel(q.type))+' • '+esc(diffLabel(q.difficulty))+' • Kunci: <b>'+esc((q.correctAnswer||[]).join(",")||q.statements.map(function(s){return s.answer==="true"?"B":"S"}).join(","))+'</b></div>'
      +'<div style="font-size:13px;line-height:1.7">'+prev+'</div>'
      +'<div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-sm" data-edit="'+esc(q.id)+'">Edit</button><button class="btn btn-sm" data-hapus="'+esc(q.id)+'">Hapus</button></div></div>';
  }).join("");
  view.innerHTML='<div class="section-title">Bank Soal ('+filtered.length+'/'+all.length+' ditampilkan)</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px"><a class="btn btn-sm btn-primary" href="#/tambah">+ Tambah Soal</a><a class="btn btn-sm" href="#/import">Import / Paste Soal</a><button class="btn btn-sm" id="resetBank">Reset Soal Custom</button></div>'
    +'<div class="toolbar"><select id="bfSubj"><option value="all">Mapel: Semua</option>'
    +window.TKA_CONFIG.subjects.map(function(s){return '<option value="'+s.id+'"'+(f.subject===s.id?" selected":"")+'>'+esc(s.name)+'</option>'}).join("")
    +'</select><select id="bfType"><option value="all">Tipe: Semua</option><option value="multiple_choice"'+(f.type==="multiple_choice"?" selected":"")+'>Pilihan Ganda</option><option value="multiple_select"'+(f.type==="multiple_select"?" selected":"")+'>Kompleks</option><option value="true_false_table"'+(f.type==="true_false_table"?" selected":"")+'>Benar/Salah</option></select>'
    +'<select id="bfDiff"><option value="all">Kesulitan: Semua</option><option value="easy"'+(f.diff==="easy"?" selected":"")+'>Mudah</option><option value="medium"'+(f.diff==="medium"?" selected":"")+'>Sedang</option><option value="hard"'+(f.diff==="hard"?" selected":"")+'>Sulit</option></select>'
    +'<input type="text" id="bfQ" placeholder="Cari soal..." value="'+esc(f.q)+'"></div>'
    +'<div id="bankRows">'+rows+(filtered.length>200?'<p class="hint">Menampilkan 200 pertama — persempit filter.</p>':"")+'</div>';
  document.getElementById("bfSubj").onchange=function(e){S.bankFilter.subject=e.target.value;render()};
  document.getElementById("bfType").onchange=function(e){S.bankFilter.type=e.target.value;render()};
  document.getElementById("bfDiff").onchange=function(e){S.bankFilter.diff=e.target.value;render()};
  document.getElementById("bfQ").oninput=function(e){S.bankFilter.q=e.target.value; var v=e.target.value, pos=e.target.selectionStart; render(); var el=document.getElementById("bfQ"); if(el){el.focus(); el.setSelectionRange(pos,pos);} };
  document.getElementById("resetBank").onclick=function(){
    modal('<h3>Reset soal custom?</h3><p class="hint">Menghapus semua soal tambahan, hasil edit, dan soal import. Bank bawaan kembali murni.</p><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" id="r1">Batal</button><button class="btn btn-danger" id="r2">Reset</button></div>');
    document.getElementById("r1").onclick=closeModal;
    document.getElementById("r2").onclick=function(){window.TKAStore.resetAllCustom();closeModal();render();toast("Bank custom direset.");};
  };
  view.querySelectorAll("[data-hapus]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-hapus");
      modal('<h3>Hapus soal '+esc(id)+'?</h3><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" id="d1">Batal</button><button class="btn btn-danger" id="d2">Hapus</button></div>');
      document.getElementById("d1").onclick=closeModal;
      document.getElementById("d2").onclick=function(){window.TKAStore.deleteQuestion(id);closeModal();render();toast("Soal dihapus.");};
    };
  });
  view.querySelectorAll("[data-edit]").forEach(function(b){
    b.onclick=function(){ openEditModal(b.getAttribute("data-edit")); };
  });
}
function openEditModal(id){
  var q=window.TKAStore.getAllBank().find(function(x){return x.id===id});
  if(!q) return;
  var optText=(q.options||[]).map(function(o){return o.id+". "+o.text}).join("\n");
  var kunci=(q.correctAnswer||[]).join(",");
  var stText=(q.statements||[]).map(function(s){return s.text+" = "+(s.answer==="true"?"BENAR":"SALAH")}).join("\n");
  modal('<h3>Edit Soal '+esc(id)+'</h3>'
    +'<label class="lbl">Pertanyaan</label><textarea id="eQ">'+esc(q.question)+'</textarea>'
    +'<label class="lbl">Tingkat kesulitan</label><select id="eD"><option value="easy"'+(q.difficulty==="easy"?" selected":"")+'>Mudah</option><option value="medium"'+(q.difficulty==="medium"?" selected":"")+'>Sedang</option><option value="hard"'+(q.difficulty==="hard"?" selected":"")+'>Sulit</option></select>'
    +'<label class="lbl">Pembahasan</label><textarea id="eE" style="min-height:60px">'+esc(q.explanation||"")+'</textarea>'
    +(q.type!=="true_false_table"
      ? '<label class="lbl">Pilihan (satu per baris, format "A. teks")</label><textarea id="eO" class="code">'+esc(optText)+'</textarea><label class="lbl">Kunci (mis: B atau A,C,E)</label><input type="text" id="eK" value="'+esc(kunci)+'">'
      : '<label class="lbl">Pernyataan (satu per baris: "teks = BENAR/SALAH")</label><textarea id="eS" class="code">'+esc(stText)+'</textarea>')
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" id="eB">Batal</button><button class="btn btn-primary" id="eS2">Simpan</button></div>'
    +'<p class="hint" id="eErr"></p>');
  document.getElementById("eB").onclick=closeModal;
  document.getElementById("eS2").onclick=function(){
    var patch={question:document.getElementById("eQ").value.trim(), difficulty:document.getElementById("eD").value, explanation:document.getElementById("eE").value.trim()};
    if(!patch.question){document.getElementById("eErr").textContent="Pertanyaan tidak boleh kosong.";return;}
    if(q.type!=="true_false_table"){
      var olines=document.getElementById("eO").value.split("\n").map(function(s){return s.trim()}).filter(Boolean);
      var opts=[];
      for(var i=0;i<olines.length;i++){
        var m=olines[i].match(/^([A-E])[\.\)\:\-\s]\s*(.+)$/);
        if(!m){document.getElementById("eErr").textContent="Baris opsi "+(i+1)+" tidak valid.";return;}
        opts.push({id:m[1].toUpperCase(),text:m[2].trim()});
      }
      if(opts.length<2){document.getElementById("eErr").textContent="Minimal 2 pilihan.";return;}
      var letters=(document.getElementById("eK").value.toUpperCase().match(/[A-E]/g)||[]);
      letters=Array.from(new Set(letters)).sort();
      if(!letters.length){document.getElementById("eErr").textContent="Kunci tidak boleh kosong.";return;}
      var ids=opts.map(function(o){return o.id});
      if(letters.some(function(L){return ids.indexOf(L)===-1})){document.getElementById("eErr").textContent="Kunci tidak ada di pilihan.";return;}
      patch.options=opts; patch.correctAnswer=letters;
      patch.type=letters.length>1?"multiple_select":"multiple_choice";
    } else {
      var slines=document.getElementById("eS").value.split("\n").map(function(s){return s.trim()}).filter(Boolean);
      var sts=[];
      for(var j=0;j<slines.length;j++){
        var mm=slines[j].match(/^(.*?)\s*=\s*(benar|salah|true|false|b|s)\s*\.?$/i);
        if(!mm){document.getElementById("eErr").textContent="Baris pernyataan "+(j+1)+" harus 'teks = BENAR/SALAH'.";return;}
        var na=mm[2].toLowerCase();
        sts.push({text:mm[1].trim(), answer:(/^(benar|betul|true|t|b)$/.test(na))?"true":"false"});
      }
      if(!sts.length){document.getElementById("eErr").textContent="Minimal 1 pernyataan.";return;}
      patch.statements=sts;
    }
    window.TKAStore.updateQuestion(id,patch);
    closeModal(); render(); toast("Soal diperbarui.");
  };
}

/* ================= IMPORT ================= */
var EXAMPLE_TEXT = "SOAL 1\nApa hasil dari 5 + 5?\n\nA. 8\nB. 9\nC. 10\nD. 11\nE. 12\n\nJawaban: C\nPembahasan: 5 + 5 = 10.\n\nSOAL 2\nManakah yang termasuk bahasa pemrograman?\n\nA. Python\nB. HTML\nC. Java\nD. CSS\nE. PHP\n\nJawaban: A,C,E\n\nSOAL 3\nTentukan benar atau salah:\n\nHTML digunakan untuk membuat struktur halaman web = BENAR\nCSS digunakan untuk membuat database = SALAH\nJavaScript dapat memberikan interaksi pada website = BENAR";
function vImport(){
  var p=S.importPreview;
  var prevHtml="";
  if(p){
    prevHtml='<div class="'+(p.errors.length?"warn-box":"ok-box")+'" style="margin-top:12px">Berhasil membaca: <b>'+p.total+' soal</b><br>'
      +'Pilihan ganda: '+p.counts.multiple_choice+' • Kompleks: '+p.counts.multiple_select+' • Benar/Salah: '+p.counts.true_false_table
      +(p.errors.length?'<br><br>Error:<br>'+p.errors.map(function(e){return "• "+esc(e)}).join("<br>"):"")
      +'</div>'
      +p.questions.slice(0,10).map(function(q,i){
        return '<div class="card qrow"><h4>'+(i+1)+'. ['+esc(typeLabel(q.type))+'] '+esc(q.question)+'</h4><div style="font-size:12px;color:var(--muted)">Kunci: '+esc((q.correctAnswer||[]).join(",")||q.statements.map(function(s){return s.answer==="true"?"B":"S"}).join(","))+'</div></div>';
      }).join("")
      +(p.total>10?'<p class="hint">…dan '+(p.total-10)+' soal lainnya.</p>':"")
      +'<div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="impCancel">Batalkan</button><button class="btn btn-primary" id="impSave"'+(p.errors.length||!p.total?" disabled":"")+'>Simpan ke Bank Soal</button></div>'
      +(p.errors.length?'<p class="hint">Perbaiki teks untuk soal yang error, lalu klik "Preview Soal" ulang. Soal error tidak ikut disimpan.</p>':"");
  }
  view.innerHTML='<div class="section-title">Bank Soal / Import Soal</div>'
    +'<div class="card pad"><label class="lbl">Mata Pelajaran Tujuan</label><select id="impSubj">'
    +window.TKA_CONFIG.subjects.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>'}).join("")
    +'</select><label class="lbl">Paste Soal (1–20 soal teks)</label>'
    +'<textarea id="impText" class="code" style="min-height:260px" placeholder="Paste soal di sini..."></textarea>'
    +'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="impExample">Isi Contoh</button><button class="btn btn-primary" id="impPreview">Preview Soal</button><a class="btn" href="#/bank">Ke Bank Soal</a><a class="btn" href="#/generator">Buat Prompt AI</a></div>'
    +'<div class="section-title">Format yang didukung</div><pre class="ex">'+esc(EXAMPLE_TEXT)+'</pre>'
    +'<p class="hint">Parser mendeteksi tipe otomatis: satu huruf jawaban → pilihan ganda; multi-huruf (A,C,E) → kompleks; baris "pernyataan = BENAR/SALAH" → tabel benar/salah. Preview wajib sebelum simpan; soal gagal baca ditolak dengan pesan error.</p>'
    +'<div id="impPrev">'+prevHtml+'</div></div>';
  document.getElementById("impExample").onclick=function(){document.getElementById("impText").value=EXAMPLE_TEXT;};
  document.getElementById("impPreview").onclick=function(){
    var subj=document.getElementById("impSubj").value;
    var txt=document.getElementById("impText").value;
    if(!txt.trim()){toast("Textarea masih kosong.");return;}
    var res=window.TKAParser.parseBulk(txt,subj);
    // validasi tambahan: duplikat id & jawaban kosong
    S.importPreview={questions:res.questions,errors:res.errors,counts:res.counts,total:res.total,subject:subj};
    vImport();
    toast("Preview: "+res.total+" terbaca, "+res.errors.length+" error.");
  };
  var c=document.getElementById("impCancel"), sv=document.getElementById("impSave");
  if(c) c.onclick=function(){S.importPreview=null;vImport();};
  if(sv) sv.onclick=function(){
    var pr=S.importPreview;
    if(!pr||!pr.questions.length) return;
    window.TKAStore.addMany(pr.questions);
    toast(pr.questions.length+" soal disimpan ke "+window.subjectName(pr.subject)+".");
    S.importPreview=null;
    location.hash="#/bank";
  };
}

/* ================= GENERATOR PROMPT AI =================
   Menyusun prompt siap-salin agar AI lain menghasilkan soal dalam
   format yang PERSIS dibaca parser Import (paste → preview → simpan). */
var GEN_TOPICS = {
  matematika: "Bilangan, pecahan, rasio dan persentase; aljabar dan persamaan; geometri dan pengukuran; statistika dan peluang; penalaran matematis dan soal kontekstual.",
  bindo: "Ide pokok dan informasi tersurat/tersirat; simpulan dan tujuan penulis; makna kata dalam konteks; teks argumentasi, berita dan eksposisi; evaluasi informasi dan struktur teks.",
  binggris: "Reading comprehension; main idea dan specific information; vocabulary in context; grammar dalam konteks; functional texts, notices dan messages.",
  produktif: "Algoritma, flowchart dan pseudocode; variabel, percabangan dan perulangan; fungsi, array dan OOP; HTML, CSS, JavaScript dan dasar backend; basis data SQL dan relasi tabel; SDLC, debugging, testing dan QA.",
  pkwu: "Ide dan peluang usaha; analisis pasar dan target konsumen; perencanaan produk; biaya produksi, harga jual, laba dan BEP; strategi promosi dan pemasaran digital; risiko usaha dan evaluasi bisnis."
};
var GEN_GRADES = ["Kelas X SMK", "Kelas XI SMK", "Kelas XII SMK", "Kelas XI–XII SMK"];
var GEN_COUNTS = ["10 soal", "20 soal", "40 soal", "50 soal"];
var GEN_DIFFS = [
  {id:"mudah", label:"Mudah"},
  {id:"sedang", label:"Sedang"},
  {id:"sulit", label:"Sulit"},
  {id:"campuran", label:"Campuran: mudah, sedang, dan sulit"}
];
var GEN_KINDS = [
  {id:"pg", label:"Pilihan Ganda", desc:"tepat satu jawaban benar per soal."},
  {id:"kompleks", label:"Pilihan Ganda Kompleks", desc:"dua jawaban benar atau lebih per soal (ditulis dipisah koma)."},
  {id:"bs", label:"Benar/Salah", desc:"3–4 pernyataan per soal, dinilai terpisah."},
  {id:"campuran", label:"Ketiga jenis, seimbang", desc:"bagi rata: sekitar 1/3 Pilihan Ganda, 1/3 Kompleks, 1/3 Benar-Salah."}
];
function genKindText(id){
  var k=GEN_KINDS.find(function(x){return x.id===id})||GEN_KINDS[3];
  return k.label+" — "+k.desc;
}
function buildAIPrompt(cfg){
  var subjName=window.subjectName(cfg.subject);
  var topics=GEN_TOPICS[cfg.subject]||"Materi sesuai kurikulum SMK.";
  var L=[
  "Kamu adalah seorang ahli penyusun soal ujian dan materi pembelajaran untuk siswa SMK di Indonesia. Tugasmu adalah menghasilkan materi dan soal Simulasi TKA yang berkualitas, sesuai tingkat kesulitan siswa, menggunakan Bahasa Indonesia yang jelas, serta memiliki jawaban yang benar dan dapat dipertanggungjawabkan.",
  "",
  "KONFIGURASI SOAL",
  "- Mata pelajaran: "+subjName,
  "- Jenjang: "+cfg.grade,
  "- Jumlah: "+cfg.count,
  "- Tingkat kesulitan: "+cfg.diff,
  "- Jenis soal: "+genKindText(cfg.kind),
  "- Topik yang harus dicakup (variasikan, jangan mengulang pertanyaan yang sama): "+topics,
  "",
  "KETENTUAN WAJIB",
  "1. Soal relevan dengan jenjang "+cfg.grade+" dan Bahasa Indonesia yang jelas.",
  "2. Setiap soal wajib memiliki kunci jawaban dan pembahasan yang menjelaskan alasan jawabannya.",
  "3. Pilihan jawaban tidak ambigu; pilihan ganda biasa hanya boleh memiliki SATU jawaban benar.",
  "4. Soal perhitungan menyertakan langkah penyelesaian yang benar.",
  "5. Soal berbasis bacaan mencantumkan teks bacaan terlebih dahulu.",
  "6. Soal pemrograman memakai kode yang valid dan hasil yang dijelaskan dengan benar.",
  "7. Variasikan konteks, angka, teks, kode, dan bentuk pertanyaan. Jangan asal-asalan hanya untuk memenuhi jumlah.",
  "8. Kunci jawaban dan pembahasan HANYA dalam format di bawah (ditampilkan di halaman pembahasan, bukan saat simulasi).",
  "",
  "FORMAT KELUARAN — WAJIB DIPATUHI PERSIS (agar bisa ditempel langsung ke menu Import website):",
  "SOAL 1",
  "<pertanyaan>",
  "",
  "A. <pilihan>",
  "B. <pilihan>",
  "C. <pilihan>",
  "D. <pilihan>",
  "E. <pilihan>",
  "",
  "Jawaban: C",
  "Pembahasan: <penjelasan alasan jawaban>",
  "",
  "ATURAN FORMAT:",
  "- Pilihan ganda biasa: Jawaban cukup SATU huruf (contoh: Jawaban: B).",
  "- Pilihan ganda kompleks: Jawaban DUA huruf atau lebih, dipisah koma TANPA spasi (contoh: Jawaban: A,C,E).",
  "- Benar/Salah: tanpa opsi A–E; tulis 3–4 baris dengan format '<pernyataan> = BENAR' atau '<pernyataan> = SALAH'.",
  "- Setiap soal selalu diakhiri baris Pembahasan.",
  "- Jangan menambahkan komentar, nomor versi, atau teks apa pun di luar blok-blok soal.",
  "- Periksa kembali setiap soal sebelum ditampilkan."
  ];
  return L.join("\n");
}
function vGenerator(){
  S.genCfg=S.genCfg||{subject:"produktif",grade:"Kelas XI–XII SMK",count:"20 soal",diff:"campuran",kind:"campuran"};
  var c=S.genCfg;
  function opts(list, val, labelFn){
    return list.map(function(o){
      var v=(typeof o==="string")?o:o.id, l=labelFn?labelFn(o):(o.label||o);
      return '<option value="'+esc(v)+'"'+(v===val?" selected":"")+'>'+esc(l)+'</option>';
    }).join("");
  }
  var prompt=buildAIPrompt(c);
  view.innerHTML='<div class="section-title">Generator Prompt AI</div>'
    +'<div class="two-col"><div class="card pad">'
    +'<label class="lbl">Mata Pelajaran</label><select id="gSubj">'
    + window.TKA_CONFIG.subjects.map(function(s){return '<option value="'+s.id+'"'+(s.id===c.subject?" selected":"")+'>'+esc(s.name)+'</option>'}).join("")
    +'</select>'
    +'<label class="lbl">Jenjang / Kelas</label><select id="gGrade">'+opts(GEN_GRADES,c.grade)+'</select>'
    +'<label class="lbl">Jumlah Soal</label><select id="gCount">'+opts(GEN_COUNTS,c.count)+'</select>'
    +'<label class="lbl">Tingkat Kesulitan</label><select id="gDiff">'+opts(GEN_DIFFS,c.diff,function(o){return o.label})+'</select>'
    +'<label class="lbl">Jenis Soal</label><select id="gKind">'+opts(GEN_KINDS,c.kind,function(o){return o.label})+'</select>'
    +'<p class="hint">Topik otomatis mengikuti mapel: '+esc(GEN_TOPICS[c.subject]||"")+'</p>'
    +'</div><div class="card pad">'
    +'<label class="lbl">Salin prompt yang sudah diatur</label>'
    +'<pre class="ex" id="gOut" style="max-height:380px">'+esc(prompt)+'</pre>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-primary" id="gCopy">Salin Prompt</button><a class="btn" href="#/import">Ke Halaman Import</a></div>'
    +'<div class="section-title">Cara pakai</div>'
    +'<ol class="hint" style="line-height:1.8"><li>Atur kebutuhan soal, lalu klik <b>Salin Prompt</b>.</li>'
    +'<li>Tempel prompt ke AI pembuat soal, kirim.</li>'
    +'<li>Salin <b>hasil soal</b> dari AI.</li>'
    +'<li>Tempel di halaman <b>Import Soal</b> → Preview → Simpan ke Bank Soal.</li>'
    +'<li>Periksa kunci & pembahasan di Bank Soal sebelum dipakai latihan.</li></ol>'
    +'</div></div>';
  function re(){ S.genCfg={subject:document.getElementById("gSubj").value,grade:document.getElementById("gGrade").value,count:document.getElementById("gCount").value,diff:document.getElementById("gDiff").value,kind:document.getElementById("gKind").value}; vGenerator(); }
  ["gSubj","gGrade","gCount","gDiff","gKind"].forEach(function(id){ document.getElementById(id).onchange=re; });
  document.getElementById("gCopy").onclick=function(){
    var txt=buildAIPrompt(S.genCfg);
    function done(){ toast("Prompt disalin — tempel ke AI pembuat soal."); }
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done,function(){ fallback(); }); }
    else fallback();
    function fallback(){
      var ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); done(); }catch(e){ toast("Gagal menyalin otomatis — blok lalu salin manual."); }
      ta.remove();
    }
  };
}

/* ================= TEBAK-TEBAKAN (KUIS INTERAKTIF) ================= */
var KUIS_COUNTS=[5,10,15,20];
var KUIS_TIMES=[{id:10,label:"10 dtk"},{id:15,label:"15 dtk"},{id:20,label:"20 dtk"},{id:30,label:"30 dtk"},{id:0,label:"Tanpa batas"}];
function vKuis(subject){
  if(!subjOf(subject)){ location.hash="#/mapel?mode=kuis"; return; }
  var avail=window.TKAGames.quizItemCount(subject);
  if(!avail){
    view.innerHTML='<a href="#/mapel?mode=kuis" class="btn btn-sm">← Pilih Mapel</a>'
      +'<div class="card pad" style="margin-top:14px;max-width:640px"><h3>Soal kuis belum tersedia</h3>'
      +'<p class="hint">Bank soal '+esc(window.subjectName(subject))+' belum memiliki pilihan ganda atau benar/salah untuk kuis. Tambahkan lewat Bank Soal atau Import.</p>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#/bank">Kelola Bank Soal</a><a class="btn" href="#/import">Import Soal</a></div></div>';
    return;
  }
  if(!S.quiz || S.quiz.subject!==subject || S.quiz.phase==="setup") renderKuisSetup(subject, avail);
  else if(S.quiz.phase==="playing") renderKuisQ();
  else renderKuisDone();
}
function kuisSoundBtn(){
  var on=window.TKASound.on();
  return '<button class="btn btn-sm" id="qSound" title="Suara">'+(on?"🔊":"🔇")+'</button>';
}
function bindKuisSound(){
  var b=document.getElementById("qSound");
  if(b) b.onclick=function(e){ e.stopPropagation(); window.TKASound.set(!window.TKASound.on()); b.textContent=window.TKASound.on()?"🔊":"🔇"; if(window.TKASound.on()) window.TKASound.click(); };
}
function renderKuisSetup(subject, avail){
  var s=subjOf(subject);
  S.quiz=S.quiz||{};
  S.quiz.subject=subject; S.quiz.phase="setup";
  S.quiz.count=S.quiz.count||Math.min(10,avail);
  if(S.quiz.perQ==null) S.quiz.perQ=15;
  var counts=KUIS_COUNTS.filter(function(c){ return c<=avail; });
  if(!counts.length) counts=[avail];
  if(counts.indexOf(S.quiz.count)===-1) S.quiz.count=counts[counts.length-1];
  view.innerHTML='<a href="#/mapel?mode=kuis" class="btn btn-sm">← Pilih Mapel</a>'
    +'<div class="card pad quiz-setup" style="margin-top:14px;max-width:640px">'
    +'<div class="q-meta"><span class="q-num">TEBAK-TEBAKAN</span><span class="badge">'+esc(s.name)+'</span><span style="flex:1"></span>'+kuisSoundBtn()+'</div>'
    +'<h2 style="margin:6px 0">Kuis '+esc(s.name)+'</h2>'
    +'<p class="hint">'+avail+' pertanyaan tersedia (pilihan ganda + benar/salah). Jawab satu per satu — +10 poin per jawaban benar, beruntun menambah bonus!</p>'
    +'<label class="lbl">Jumlah Pertanyaan</label><div class="radio-row" id="kCount">'
    +counts.map(function(c){ return '<button class="radio-pill'+(c===S.quiz.count?" sel":"")+'" data-c="'+c+'">'+c+'</button>'; }).join("")
    +'</div><label class="lbl">Timer per Pertanyaan</label><div class="radio-row" id="kTime">'
    +KUIS_TIMES.map(function(t){ return '<button class="radio-pill'+(t.id===S.quiz.perQ?" sel":"")+'" data-t="'+t.id+'">'+t.label+'</button>'; }).join("")
    +'</div><div style="margin-top:16px"><button class="btn btn-primary btn-lg" id="kStart">Mulai Main ▶</button></div></div>';
  bindKuisSound();
  view.querySelectorAll("#kCount [data-c]").forEach(function(b){
    b.onclick=function(){ S.quiz.count=+b.getAttribute("data-c"); window.TKASound.click(); renderKuisSetup(subject, avail); };
  });
  view.querySelectorAll("#kTime [data-t]").forEach(function(b){
    b.onclick=function(){ S.quiz.perQ=+b.getAttribute("data-t"); window.TKASound.click(); renderKuisSetup(subject, avail); };
  });
  document.getElementById("kStart").onclick=function(){ startKuis(); };
}
function startKuis(){
  var subject=S.quiz.subject;
  var items=window.TKAGames.quizPickItems(subject, S.quiz.count);
  if(!items.length){ toast("Soal tidak mencukupi."); return; }
  S.quiz={ subject:subject, phase:"playing", items:items, idx:0, score:0, streak:0, best:0,
    correct:0, answers:[], perQ:S.quiz.perQ, qEnd:0, timerId:null, advId:null, token:0,
    locked:false, startTime:Date.now(), count:items.length };
  S.leaveGuard={ route:"#/kuis?subject="+subject,
    message:"Skor kuis yang sedang berjalan akan hilang.",
    onQuit:function(){ quitKuis(); } };
  window.TKASound.click();
  renderKuisQ();
}
function quitKuis(){
  if(S.quiz&&S.quiz.timerId) clearInterval(S.quiz.timerId);
  if(S.quiz&&S.quiz.advId) clearTimeout(S.quiz.advId);
  var sub=S.quiz?S.quiz.subject:null;
  S.quiz=null; S.leaveGuard=null;
  location.hash=sub? "#/mapel?mode=kuis" : "#/";
}
function renderKuisQ(){
  var Q=S.quiz; if(!Q||Q.phase!=="playing") return;
  var it=Q.items[Q.idx], total=Q.items.length;
  Q.locked=false; Q.token++;
  var myToken=Q.token;
  if(Q.timerId) clearInterval(Q.timerId);
  if(Q.advId) clearTimeout(Q.advId);
  var pct=Math.round(Q.idx/total*100);
  var timerHtml="";
  if(Q.perQ>0){
    Q.qEnd=Date.now()+Q.perQ*1000;
    timerHtml='<div class="qtime"><div class="qtime-fill" id="qTimeFill" style="width:100%"></div><span id="qTimeTxt">'+Q.perQ+'</span></div>';
  }
  var body="";
  if(it.kind==="mc"){
    body=it.q.options.map(function(o){
      return '<button class="quiz-opt" data-pick="'+o.id+'"><span class="key">'+o.id+'</span><span class="txt">'+esc(o.text)+'</span></button>';
    }).join("");
  } else {
    body='<div class="quiz-tf"><button class="quiz-opt tf" data-pick="true">BENAR ✓</button>'
      +'<button class="quiz-opt tf" data-pick="false">SALAH ✕</button></div>'
      +'<p class="hint">Pernyataan: tentukan Benar atau Salah.</p>';
  }
  view.innerHTML='<div class="quiz-top"><a href="#/mapel?mode=kuis" class="btn btn-sm" id="qQuit">✕ Keluar</a>'
    +'<div class="quiz-score">⭐ <b id="qScore">'+Q.score+'</b>'+(Q.streak>1?' <span class="badge ok">🔥 ×'+Q.streak+'</span>':"")+'</div>'
    +kuisSoundBtn()+'</div>'
    +'<div class="q-progress"><div class="q-progress-fill" style="width:'+pct+'%"></div></div>'
    +'<div class="progress" style="margin:6px 0">Pertanyaan '+(Q.idx+1)+' dari '+total+'</div>'
    +timerHtml
    +'<div class="card pad quiz-card" id="qCard"><div class="q-text">'+esc(it.kind==="mc"?it.q.question:it.text)+'</div>'+body
    +'<div id="qFeed"></div></div>';
  bindKuisSound();
  document.getElementById("qQuit").onclick=function(e){
    e.preventDefault(); confirmLeaveGame();
  };
  view.querySelectorAll("[data-pick]").forEach(function(b){
    b.onclick=function(){ kuisAnswer(b.getAttribute("data-pick"), myToken); };
  });
  if(Q.perQ>0){
    Q.timerId=setInterval(function(){
      if(!S.quiz||S.quiz.token!==myToken||S.quiz.phase!=="playing"){ clearInterval(Q.timerId); return; }
      var left=Math.max(0, Q.qEnd-Date.now());
      var f=document.getElementById("qTimeFill"), t=document.getElementById("qTimeTxt");
      if(f) f.style.width=(left/(Q.perQ*1000)*100)+"%";
      if(t) t.textContent=Math.ceil(left/1000);
      if(left<=0){ clearInterval(Q.timerId); kuisAnswer(null, myToken, true); }
    },100);
  }
}
function kuisCorrectId(it){
  if(it.kind==="mc") return (it.q.correctAnswer||[])[0];
  return it.answer;
}
function kuisAnswer(pick, token, timeout){
  var Q=S.quiz;
  if(!Q||Q.phase!=="playing"||Q.locked||Q.token!==token) return;
  Q.locked=true;
  if(Q.timerId) clearInterval(Q.timerId);
  var it=Q.items[Q.idx], cid=kuisCorrectId(it);
  var ok = pick!=null && String(pick)===String(cid);
  var pts=0;
  if(ok){
    Q.streak++; if(Q.streak>Q.best) Q.best=Q.streak;
    pts=10+Math.min(Q.streak-1,5)*2;
    Q.score+=pts; Q.correct++;
    window.TKASound.correct();
  } else {
    Q.streak=0;
    window.TKASound.wrong();
  }
  Q.answers.push({ it:it, pick:pick, ok:ok, timeout:!!timeout });
  // umpan balik visual
  view.querySelectorAll("[data-pick]").forEach(function(b){
    var v=b.getAttribute("data-pick");
    b.disabled=true;
    if(String(v)===String(cid)) b.classList.add("ok");
    else if(v===pick) b.classList.add("no");
    else b.classList.add("dim");
  });
  var card=document.getElementById("qCard");
  if(card) card.classList.add(ok?"pop":"shake");
  var feed=document.getElementById("qFeed");
  var rightTxt = it.kind==="mc"
    ? (function(){ var o=it.q.options.find(function(x){return String(x.id)===String(cid)}); return o? o.id+". "+o.text : cid; })()
    : (cid==="true"?"Benar":"Salah");
  if(feed) feed.innerHTML='<div class="'+(ok?"ok-box":"err-box")+'" style="margin-top:12px">'
    +(ok? "Benar! +"+pts+" poin 🎉" : (timeout? "Waktu habis! ⏰" : "Kurang tepat."))
    +'<br>Jawaban benar: <b>'+esc(rightTxt)+'</b>'
    +((it.q.explanation)? '<br><span style="font-size:12px">'+esc(it.q.explanation)+'</span>':"")
    +'</div><button class="btn btn-primary" id="qNext" style="margin-top:10px">Lanjut →</button>';
  var nb=document.getElementById("qNext");
  if(nb) nb.onclick=function(){ kuisNext(); };
  Q.advId=setTimeout(function(){ kuisNext(token); }, 2600);
}
function kuisNext(token){
  var Q=S.quiz;
  if(!Q||Q.phase!=="playing") return;
  if(token!=null && Q.token!==token) return;
  if(Q.advId) clearTimeout(Q.advId);
  Q.idx++;
  if(Q.idx>=Q.items.length) finishKuis();
  else renderKuisQ();
}
function finishKuis(){
  var Q=S.quiz; if(!Q) return;
  Q.phase="done";
  if(Q.timerId) clearInterval(Q.timerId);
  if(Q.advId) clearTimeout(Q.advId);
  S.leaveGuard=null;
  var total=Q.items.length;
  var nilai=total? Math.round(Q.correct/total*100) : 0;
  window.TKASound.finish();
  window.TKAStore.pushHistory({
    id:"KUIS"+Date.now().toString(36).toUpperCase(), simulationId:"KUIS"+Date.now().toString(36).toUpperCase(),
    subject:Q.subject, date:Date.now(), total:total, nilai:nilai,
    correct:Q.correct, wrong:total-Q.correct, empty:0,
    durationMs:Date.now()-Q.startTime, status:"COMPLETED", finishReason:"COMPLETED", mode:"kuis",
    totalMs:0, avgSecPerQ:0, budgetSecPerQ:0, questions:[], answers:{}
  });
  renderKuisDone();
}
function renderKuisDone(){
  var Q=S.quiz; if(!Q) return;
  var total=Q.items.length;
  var nilai=total? Math.round(Q.correct/total*100) : 0;
  var rows=Q.answers.map(function(a,i){
    var rightTxt = a.it.kind==="mc"
      ? (function(){ var o=a.it.q.options.find(function(x){return String(x.id)===String(kuisCorrectId(a.it))}); return o? o.id+". "+o.text : ""; })()
      : (kuisCorrectId(a.it)==="true"?"Benar":"Salah");
    var yours = a.pick==null ? "Waktu habis" : (a.it.kind==="mc"
      ? (function(){ var o=a.it.q.options.find(function(x){return String(x.id)===String(a.pick)}); return o? o.id+". "+o.text : a.pick; })()
      : (a.pick==="true"?"Benar":"Salah"));
    return '<div class="card rev-item '+(a.ok?"rev-correct":"rev-wrong")+'"><div class="q-meta"><span class="q-num">'+(i+1)+'</span><span class="badge">'+(a.ok?"✓ Benar":"✕ Salah")+'</span></div>'
      +'<div style="font-size:14px;margin-bottom:6px">'+esc(a.it.kind==="mc"?a.it.q.question:a.it.text)+'</div>'
      +'<div style="font-size:13px">Jawabanmu: <b>'+esc(yours)+'</b><br>Benar: <b>'+esc(rightTxt)+'</b></div></div>';
  }).join("");
  view.innerHTML='<div class="card result-hero"><div class="q-meta" style="justify-content:center"><span class="q-num">HASIL KUIS</span><span class="badge">'+esc(window.subjectName(Q.subject))+'</span></div>'
    +'<div class="score-big">⭐ '+Q.score+'</div>'
    +'<div class="hint">Nilai '+nilai+' • '+Q.correct+'/'+total+' benar • Beruntun terbaik ×'+Q.best+'</div>'
    +'<div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">'
    +'<button class="btn btn-primary" id="kAgain">Main Lagi ▶</button>'
    +'<a class="btn" href="#/mapel?mode=kuis">Pilih Mapel</a><a class="btn" href="#/">Beranda</a></div></div>'
    +'<div class="section-title">Pembahasan Singkat</div>'+rows;
  document.getElementById("kAgain").onclick=function(){
    S.quiz={ subject:Q.subject, phase:"setup", count:Math.min(Q.count, window.TKAGames.quizItemCount(Q.subject)), perQ:Q.perQ };
    renderKuisSetup(Q.subject, window.TKAGames.quizItemCount(Q.subject));
  };
}

/* ================= TTS — TEKA-TEKI SILANG ================= */
function ttsWordList(subject){
  return (window.BANK_TTS && window.BANK_TTS[subject]) || [];
}
function vTTS(subject){
  if(!subjOf(subject)){ location.hash="#/mapel?mode=tts"; return; }
  var list=ttsWordList(subject);
  if(!list.length){
    view.innerHTML='<a href="#/mapel?mode=tts" class="btn btn-sm">← Pilih Mapel</a>'
      +'<div class="card pad" style="margin-top:14px;max-width:640px"><h3>TTS belum tersedia</h3>'
      +'<p class="hint">Mata pelajaran '+esc(window.subjectName(subject))+' belum memiliki data kata TTS. Data TTS terpisah dari bank soal ujian dan sedang disiapkan.</p>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#/bank">Kelola Bank Soal</a><a class="btn" href="#/mapel?mode=tts">Pilih Mapel Lain</a></div></div>';
    return;
  }
  if(!S.tts || S.tts.subject!==subject || S.tts.needNew){
    var g=window.TKAGames.buildCrossword(list,{maxWords:10});
    if(!g){
      view.innerHTML='<div class="card pad">Gagal menyusun TTS. <a class="btn" href="#/mapel?mode=tts">Kembali</a></div>';
      return;
    }
    S.tts={ subject:subject, grid:g, entryIdx:0, vals:{}, locked:{}, wrong:{}, started:true, done:false, needNew:false, focusKey:null };
  }
  if(!S.tts.done){
    S.leaveGuard={ route:"#/tts?subject="+subject,
      message:"Progres TTS yang sedang dikerjakan akan hilang.",
      onQuit:function(){ quitTTS(); } };
  }
  renderTTS();
}
function quitTTS(){
  S.tts=null; S.leaveGuard=null;
  location.hash="#/mapel?mode=tts";
}
function ttsKey(r,c){ return r+","+c; }
function ttsActiveEntry(){
  return S.tts.grid.entries[S.tts.entryIdx];
}
function ttsEntriesAt(r,c){
  return S.tts.grid.entries.map(function(e,i){ return {e:e,i:i}; }).filter(function(x){
    return x.e.cells.some(function(cell){ return cell.r===r && cell.c===c; });
  });
}
function renderTTS(focusKey){
  var T=S.tts; if(!T) return;
  if(focusKey!==undefined) T.focusKey=focusKey;
  var s=subjOf(T.subject), g=T.grid;
  var lockedCount=Object.keys(T.locked).length;
  var pct=g.totalCells? Math.round(lockedCount/g.totalCells*100) : 0;
  // grid
  var cells="";
  for(var r=0;r<g.rows;r++){
    for(var c=0;c<g.cols;c++){
      var sol=g.sol[r][c];
      if(!sol){ cells+='<div class="xw-blank"></div>'; continue; }
      var k=ttsKey(r,c), v=T.vals[k]||"", num=g.nums[r][c];
      var cls="xw"+(T.locked[k]?" ok":"")+((T.wrong[k]&&!T.locked[k])?" bad":"");
      cells+='<div class="xw-cell">'+(num?'<span class="xw-num">'+num+'</span>':"")
        +'<input class="'+cls+'" data-r="'+r+'" data-c="'+c+'" maxlength="1" value="'+esc(v)+'"'
        +(T.locked[k]?" disabled":"")+' autocomplete="off" autocapitalize="characters" aria-label="Kotak baris '+(r+1)+' kolom '+(c+1)+'">'
        +'</div>';
    }
  }
  function clueList(dir, title){
    var items=g.entries.map(function(e,i){ return {e:e,i:i}; }).filter(function(x){ return x.e.dir===dir; });
    items.sort(function(a,b){ return a.e.num-b.e.num; });
    return '<div class="clue-col"><b>'+title+'</b>'+items.map(function(x){
      var done=x.e.cells.every(function(cell){ return T.locked[ttsKey(cell.r,cell.c)]; });
      return '<button class="clue'+(x.i===T.entryIdx?" sel":"")+(done?" done":"")+'" data-clue="'+x.i+'"><b>'+x.e.num+'.</b> '+esc(x.e.c)+(done?" ✓":"")+'</button>';
    }).join("")+'</div>';
  }
  var ae=ttsActiveEntry();
  view.innerHTML='<a href="#/mapel?mode=tts" class="btn btn-sm" id="ttsBack">← Pilih Mapel</a>'
    +'<div class="section-title">TTS — '+esc(s.name)+'</div>'
    +'<div class="tts-bar"><div class="progress">Terisi benar: '+lockedCount+'/'+g.totalCells+' ('+pct+'%) • Kata aktif: <b>'+ae.num+' '+(ae.dir==="H"?"Mendatar":"Menurun")+'</b></div>'
    +'<div class="q-progress"><div class="q-progress-fill" style="width:'+pct+'%"></div></div></div>'
    +'<div class="two-col"><div class="card pad"><div class="xw-wrap"><div class="xw-grid" style="grid-template-columns:repeat('+g.cols+',var(--xw))">'+cells+'</div></div>'
    +'<p class="hint">Ketuk kotak/petunjuk untuk memilih kata, lalu ketik hurufnya. Huruf benar terkunci hijau.</p>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    +'<button class="btn btn-primary" id="ttsCheck">Periksa Jawaban</button>'
    +'<button class="btn" id="ttsReset">Ulangi</button>'
    +'<button class="btn" id="ttsNew">Acak Baru</button>'
    +'<button class="btn" id="ttsFinish">Selesaikan</button></div></div>'
    +'<div class="card pad"><div class="clues">'+clueList("H","Mendatar")+clueList("V","Menurun")+'</div></div></div>';
  paintActiveEntry();
  // interaksi sel
  view.querySelectorAll(".xw").forEach(function(inp){
    inp.addEventListener("focus", function(){ selectCellForInput(inp, false); });
    inp.addEventListener("click", function(){ selectCellForInput(inp, true); });
    inp.addEventListener("input", function(){
      var r=+inp.getAttribute("data-r"), c=+inp.getAttribute("data-c"), k=ttsKey(r,c);
      var ch=inp.value.toUpperCase().replace(/[^A-Z]/g,"").slice(-1);
      inp.value=ch; T.vals[k]=ch; delete T.wrong[k]; inp.classList.remove("bad");
      if(ch) focusNextCell(r,c,1);
    });
    inp.addEventListener("keydown", function(e){
      var r=+inp.getAttribute("data-r"), c=+inp.getAttribute("data-c");
      if(e.key==="Backspace" && !inp.value){ e.preventDefault(); focusNextCell(r,c,-1); }
      else if(e.key==="ArrowLeft"){ e.preventDefault(); focusDelta(r,c,0,-1); }
      else if(e.key==="ArrowRight"){ e.preventDefault(); focusDelta(r,c,0,1); }
      else if(e.key==="ArrowUp"){ e.preventDefault(); focusDelta(r,c,-1,0); }
      else if(e.key==="ArrowDown"){ e.preventDefault(); focusDelta(r,c,1,0); }
    });
  });
  view.querySelectorAll("[data-clue]").forEach(function(b){
    b.onclick=function(){ window.TKASound.click(); T.entryIdx=+b.getAttribute("data-clue"); renderTTS(); focusEntryStart(); };
  });
  document.getElementById("ttsCheck").onclick=ttsCheck;
  document.getElementById("ttsReset").onclick=function(){
    T.vals={}; T.wrong={}; T.locked={}; renderTTS(); toast("TTS diulang dari awal.");
  };
  document.getElementById("ttsNew").onclick=function(){ T.needNew=true; vTTS(T.subject); toast("Susunan TTS baru."); };
  document.getElementById("ttsFinish").onclick=ttsFinish;
  document.getElementById("ttsBack").onclick=function(e){
    // biarkan guard bekerja bila progres ada
  };
  if(T.focusKey){
    var f=view.querySelector('input[data-r="'+T.focusKey.split(",")[0]+'"][data-c="'+T.focusKey.split(",")[1]+'"]');
    if(f) f.focus();
  }
}
function paintActiveEntry(){
  var T=S.tts; if(!T) return;
  var ae=ttsActiveEntry(); if(!ae) return;
  view.querySelectorAll(".xw").forEach(function(inp){ inp.classList.remove("hl","cur"); });
  ae.cells.forEach(function(cell){
    var inp=view.querySelector('input[data-r="'+cell.r+'"][data-c="'+cell.c+'"]');
    if(inp) inp.classList.add("hl");
  });
}
function selectCellForInput(inp, toggle){
  var T=S.tts; if(!T) return;
  var r=+inp.getAttribute("data-r"), c=+inp.getAttribute("data-c");
  var at=ttsEntriesAt(r,c);
  if(!at.length) return;
  var cur=ttsActiveEntry();
  var inCur=cur.cells.some(function(cell){ return cell.r===r && cell.c===c; });
  if(toggle && inCur && at.length>1){
    var other=at.find(function(x){ return x.e.dir!==cur.dir; });
    if(other){ T.entryIdx=other.i; paintActiveEntry(); refreshClueSel(); return; }
  }
  if(!inCur){ T.entryIdx=at[0].i; paintActiveEntry(); refreshClueSel(); }
  else { paintActiveEntry(); }
}
function refreshClueSel(){
  var T=S.tts; if(!T) return;
  view.querySelectorAll("[data-clue]").forEach(function(b){
    b.classList.toggle("sel", +b.getAttribute("data-clue")===T.entryIdx);
  });
  var ae=ttsActiveEntry();
  var bar=view.querySelector(".tts-bar .progress");
  if(bar&&ae) bar.innerHTML=bar.innerHTML.replace(/Kata aktif: <b>.*?<\/b>/, "Kata aktif: <b>"+ae.num+" "+(ae.dir==="H"?"Mendatar":"Menurun")+"</b>");
}
function focusEntryCell(cell){
  var inp=view.querySelector('input[data-r="'+cell.r+'"][data-c="'+cell.c+'"]');
  if(inp){ inp.focus(); }
}
function focusEntryStart(){
  var ae=ttsActiveEntry();
  if(ae&&ae.cells.length) focusEntryCell(ae.cells[0]);
}
function focusNextCell(r,c,step){
  var ae=ttsActiveEntry(); if(!ae) return;
  var idx=ae.cells.findIndex(function(cell){ return cell.r===r&&cell.c===c; });
  if(idx===-1) return;
  var n=ae.cells[idx+step];
  if(n) focusEntryCell(n);
}
function focusDelta(r,c,dr,dc){
  var inp=view.querySelector('input[data-r="'+(r+dr)+'"][data-c="'+(c+dc)+'"]');
  if(inp) inp.focus();
}
function ttsCheck(){
  var T=S.tts; if(!T||T.done) return;
  var g=T.grid, newly=0, wrong=0;
  for(var r=0;r<g.rows;r++) for(var c=0;c<g.cols;c++){
    var sol=g.sol[r][c]; if(!sol) continue;
    var k=ttsKey(r,c), v=(T.vals[k]||"").toUpperCase();
    if(T.locked[k]) continue;
    if(v===sol){ T.locked[k]=1; delete T.wrong[k]; newly++; }
    else if(v){ T.wrong[k]=1; wrong++; }
  }
  if(newly) window.TKASound.correct(); else if(wrong) window.TKASound.wrong(); else window.TKASound.click();
  renderTTS();
  var lockedCount=Object.keys(T.locked).length;
  if(lockedCount>=g.totalCells){ ttsFinish(true); }
  else toast(newly? newly+" huruf benar terkunci." : (wrong? "Belum ada yang tepat — coba lagi." : "Isi dulu kotaknya, lalu periksa."));
}
function ttsFinish(auto){
  var T=S.tts; if(!T||T.done) return;
  T.done=true; S.leaveGuard=null;
  var g=T.grid, lockedCount=Object.keys(T.locked).length;
  var nilai=g.totalCells? Math.round(lockedCount/g.totalCells*100) : 0;
  window.TKASound.finish();
  window.TKAStore.pushHistory({
    id:"TTS"+Date.now().toString(36).toUpperCase(), simulationId:"TTS"+Date.now().toString(36).toUpperCase(),
    subject:T.subject, date:Date.now(), total:g.entries.length, nilai:nilai,
    correct:T.grid.entries.filter(function(e){ return e.cells.every(function(cell){ return T.locked[ttsKey(cell.r,cell.c)]; }); }).length,
    wrong:0, empty:0, durationMs:0, status:"COMPLETED", finishReason:"COMPLETED", mode:"tts",
    totalMs:0, avgSecPerQ:0, budgetSecPerQ:0, questions:[], answers:{}
  });
  modal('<h3>TTS Selesai! 🧩</h3>'
    +'<div class="score-big" style="font-size:52px">'+nilai+'</div>'
    +'<p class="hint">'+lockedCount+'/'+g.totalCells+' huruf benar • '+esc(window.subjectName(T.subject))+'</p>'
    +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">'
    +'<button class="btn btn-primary" id="tAgain">Main Lagi</button>'
    +'<button class="btn" id="tMapel">Pilih Mapel</button>'
    +'<button class="btn" id="tHome">Beranda</button></div>');
  document.getElementById("tAgain").onclick=function(){ closeModal(); T.needNew=true; T.done=false; vTTS(T.subject); };
  document.getElementById("tMapel").onclick=function(){ closeModal(); S.tts=null; location.hash="#/mapel?mode=tts"; };
  document.getElementById("tHome").onclick=function(){ closeModal(); S.tts=null; location.hash="#/"; };
  renderTTS();
}

/* ================= TAMBAH MANUAL ================= */
function vTambah(){
  var t=S.manualType;
  var subjOpts=window.TKA_CONFIG.subjects.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>'}).join("");
  var dyn="";
  if(t==="multiple_choice"||t==="multiple_select"){
    dyn='<label class="lbl">Pilihan Jawaban (A–E)</label>'
      +["A","B","C","D","E"].map(function(L){
        return '<div style="display:flex;gap:8px;margin-bottom:6px;align-items:center"><span class="pill">'+L+'</span><input type="text" id="mOpt'+L+'" placeholder="Teks pilihan '+L+'">'
        +'<label style="font-size:12px;white-space:nowrap"><input type="'+(t==="multiple_choice"?"radio":"checkbox")+'" name="mKey" value="'+L+'" style="width:16px;height:16px"> benar</label></div>';
      }).join("")
      +'<p class="hint">'+(t==="multiple_choice"?"Pilih tepat 1 kunci.":"Centang ≥2 kunci untuk kompleks.")+'</p>';
  } else {
    dyn='<label class="lbl">Pernyataan (3 baris, pilih Benar/Salah per baris)</label>'
      +[0,1,2].map(function(i){
        return '<div style="display:flex;gap:8px;margin-bottom:6px"><input type="text" id="mSt'+i+'" placeholder="Pernyataan '+(i+1)+'"><select id="mStV'+i+'" style="max-width:130px"><option value="true">Benar</option><option value="false">Salah</option></select></div>';
      }).join("");
  }
  view.innerHTML='<div class="section-title">Tambah Soal Manual</div><div class="card pad" style="max-width:760px">'
    +'<label class="lbl">Mata Pelajaran</label><select id="mSubj">'+subjOpts+'</select>'
    +'<label class="lbl">Tipe Soal</label><div class="type-tabs"><button class="btn btn-sm'+(t==="multiple_choice"?" btn-primary":"")+'" data-t="multiple_choice">Pilihan Ganda</button><button class="btn btn-sm'+(t==="multiple_select"?" btn-primary":"")+'" data-t="multiple_select">Lebih dari Satu</button><button class="btn btn-sm'+(t==="true_false_table"?" btn-primary":"")+'" data-t="true_false_table">Benar/Salah</button></div>'
    +'<label class="lbl">Pertanyaan</label><textarea id="mQ"></textarea>'
    +dyn
    +'<label class="lbl">Pembahasan</label><textarea id="mE" style="min-height:60px"></textarea>'
    +'<label class="lbl">Tingkat Kesulitan</label><div class="radio-row" id="mDiff"><button class="radio-pill sel" data-d="easy">Mudah</button><button class="radio-pill" data-d="medium">Sedang</button><button class="radio-pill" data-d="hard">Sulit</button></div>'
    +'<p class="hint" id="mErr"></p>'
    +'<button class="btn btn-primary" id="mAdd" style="margin-top:10px">Tambah Soal</button></div>';
  var diff="easy";
  view.querySelectorAll("[data-t]").forEach(function(b){b.onclick=function(){S.manualType=b.getAttribute("data-t");vTambah();};});
  view.querySelectorAll("#mDiff [data-d]").forEach(function(b){b.onclick=function(){diff=b.getAttribute("data-d");view.querySelectorAll("#mDiff [data-d]").forEach(function(x){x.classList.toggle("sel",x===b)});};});
  document.getElementById("mAdd").onclick=function(){
    var err=document.getElementById("mErr");
    var subj=document.getElementById("mSubj").value;
    var qq=document.getElementById("mQ").value.trim();
    if(!qq){err.textContent="Pertanyaan wajib diisi.";return;}
    var q={id:"M"+Date.now().toString(36).toUpperCase(),subject:subj,type:t,question:qq,explanation:document.getElementById("mE").value.trim(),difficulty:diff};
    if(t==="multiple_choice"||t==="multiple_select"){
      var opts=[];
      ["A","B","C","D","E"].forEach(function(L){
        var v=document.getElementById("mOpt"+L).value.trim();
        if(v) opts.push({id:L,text:v});
      });
      if(opts.length<2){err.textContent="Minimal 2 pilihan jawaban.";return;}
      var keys=Array.prototype.slice.call(view.querySelectorAll('[name="mKey"]:checked')).map(function(x){return x.value});
      // petakan ulang karena opsi kosong di-skip: gunakan teks
      var keyTexts=keys.map(function(k){
        var el=document.getElementById("mOpt"+k);
        return el?el.value.trim():null;
      }).filter(Boolean);
      if(!keyTexts.length){err.textContent="Tentukan jawaban benar.";return;}
      if(t==="multiple_choice"&&keyTexts.length!==1){err.textContent="Pilihan ganda hanya boleh 1 jawaban benar.";return;}
      if(t==="multiple_select"&&keyTexts.length<2){err.textContent="Kompleks minimal 2 jawaban benar.";return;}
      // re-id berurutan
      var letters=["A","B","C","D","E"];
      q.options=opts.map(function(o,i){return {id:letters[i],text:o.text}});
      q.correctAnswer=[];
      q.options.forEach(function(o){ if(keyTexts.indexOf(o.text)!==-1) q.correctAnswer.push(o.id); });
      if(!q.correctAnswer.length){err.textContent="Kunci tidak cocok dengan pilihan.";return;}
    } else {
      var sts=[];
      for(var i=0;i<3;i++){
        var s=document.getElementById("mSt"+i).value.trim();
        if(!s) continue;
        sts.push({text:s,answer:document.getElementById("mStV"+i).value});
      }
      if(!sts.length){err.textContent="Minimal 1 pernyataan.";return;}
      q.statements=sts; q.correctAnswer=[];
      if(!q.question || q.question=== "") q.question="Tentukan apakah pernyataan berikut BENAR atau SALAH.";
    }
    // validasi duplikat id
    var saved=window.TKAStore.addQuestion(q);
    toast("Soal "+saved.id+" ditambahkan.");
    location.hash="#/bank";
  };
}

/* ---------- init ---------- */
if(!location.hash) location.hash="#/";
render();
})();
