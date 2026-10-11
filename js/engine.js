/* engine — randomisasi kuat, scoring, fullscreen, alarm, simulationManager */
(function(){
  function rng(){
    if(window.crypto && window.crypto.getRandomValues){
      var a = new Uint32Array(1); window.crypto.getRandomValues(a);
      return a[0]/4294967296;
    }
    return Math.random();
  }
  function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(rng()*(i+1));
      var t=a[i];a[i]=a[j];a[j]=t;
    }
    return a;
  }

  // Acak opsi + petakan ulang correctAnswer (berdasarkan teks opsi agar adil)
  function shuffleOptions(q){
    if(q.type==="multiple_choice" || q.type==="multiple_select"){
      var correctTexts = {};
      (q.options||[]).forEach(function(o){ if((q.correctAnswer||[]).indexOf(o.id)!==-1) correctTexts[o.text]=1; });
      var shuffled = shuffle(q.options||[]);
      var letters = ["A","B","C","D","E","F","G"];
      var newOpts = shuffled.map(function(o,i){ return {id:letters[i], text:o.text}; });
      var newCorrect = [];
      newOpts.forEach(function(o){ if(correctTexts[o.text]) newCorrect.push(o.id); });
      return Object.assign({}, q, {options:newOpts, correctAnswer:newCorrect.sort()});
    }
    if(q.type==="true_false_table"){
      // acak urutan pernyataan (jawaban ikut bersama pernyataan)
      var st = shuffle(q.statements||[]);
      return Object.assign({}, q, {statements:st});
    }
    return q;
  }

  // Ambil soal statis: utamakan yang belum dipakai sesi-sesi terakhir
  function sampleStatic(bank, subject, take){
    var used = window.TKAStore.getUsed()[subject] || [];
    var usedSet = {}; used.forEach(function(id){usedSet[id]=1});
    var fresh = bank.filter(function(q){return !usedSet[q.id]});
    var pool = fresh.length>=take ? fresh : bank.slice();
    if(fresh.length>0 && fresh.length<take){
      var rest = shuffle(bank.filter(function(q){return usedSet[q.id]})).slice(0, take-fresh.length);
      pool = fresh.concat(rest);
    }
    if(fresh.length===0 && bank.length>0) window.TKAStore.resetUsed(subject);
    return shuffle(pool).slice(0, take).map(shuffleOptions);
  }
  function markDynUsed(dynQuestions){
    var bySubj = {};
    dynQuestions.forEach(function(q){
      var base = String(q.id).split("@")[0];
      var s = q.subject;
      (bySubj[s] = bySubj[s]||[]).push(base);
    });
    Object.keys(bySubj).forEach(function(s){
      if(window.TKAStore.markUsedDyn) window.TKAStore.markUsedDyn(s, bySubj[s]);
    });
  }

  function buildSession(subject, count){
    var bank = window.TKAStore.getBank(subject);
    // Slot soal DINAMIS (angka diacak + jawaban dihitung ulang tiap sesi)
    var dynCap = (window.dynamicCap) ? window.dynamicCap(subject) : 0;
    var dyn = (window.instantiateDynamics && dynCap>0) ? window.instantiateDynamics(subject, Math.min(dynCap, count)) : [];
    var staticNeed = Math.max(0, count - dyn.length);
    if(bank.length===0 && dyn.length===0) return {error:"Bank soal "+subject+" masih kosong."};
    var take = Math.min(staticNeed, bank.length);
    var insufficient = (bank.length + dyn.length) < count;
    var picked = sampleStatic(bank, subject, take);
    markDynUsed(dyn);
    // campur soal dinamis (sudah ber-ID unik per sesi) lalu acak posisi akhir
    var all = shuffle(picked.concat(dyn).map(shuffleOptions));
    var now = Date.now();
    var session = {
      simulationId: "SIM"+now.toString(36).toUpperCase()+Math.floor(rng()*999),
      subject: subject,
      questionIds: all.map(function(q){return q.id}),
      questions: all,
      answers: {},       // qid -> array (MC/MS) atau object (TF)
      marked: [],
      currentIndex: 0,
      startTime: now,
      durationMs: 0,
      endTime: 0,
      status: "RUNNING"
    };
    return {session:session, insufficient:insufficient, available:bank.length+dyn.length, dynamicCount:dyn.length};
  }

  // ===== TKA LENGKAP: sekuens blok per mapel dalam satu sesi =====
  // specs: [{subject, count}] — tiap blok diacak independen (statis+dinamis)
  function buildSessionLengkap(specs){
    var blocks=[], insufficient=false, available=0, dynTotal=0;
    for(var i=0;i<specs.length;i++){
      var sp=specs[i];
      var bank=window.TKAStore.getBank(sp.subject);
      var dynCap=(window.dynamicCap)?window.dynamicCap(sp.subject):0;
      var dyn=(window.instantiateDynamics&&dynCap>0)?window.instantiateDynamics(sp.subject,Math.min(dynCap,sp.count)):[];
      if(bank.length===0&&dyn.length===0) return {error:"Bank soal "+window.subjectName(sp.subject)+" masih kosong."};
      var take=Math.min(Math.max(0,sp.count-dyn.length), bank.length);
      if((bank.length+dyn.length)<sp.count) insufficient=true;
      var picked=sampleStatic(bank, sp.subject, take);
      var qs=shuffle(picked.concat(dyn).map(shuffleOptions));
      blocks.push({subject:sp.subject, questions:qs});
      available+=bank.length+dyn.length; dynTotal+=dyn.length;
    }
    var flat=[], starts=[];
    blocks.forEach(function(b){ starts.push(flat.length); flat=flat.concat(b.questions); });
    markDynUsed(flat.filter(function(q){return q.tplId;}));
    var now=Date.now();
    var session={
      simulationId:"SIM"+now.toString(36).toUpperCase()+Math.floor(rng()*999),
      subject:"lengkap",
      blocks:blocks, blockStarts:starts,
      questionIds:flat.map(function(q){return q.id}),
      questions:flat,
      answers:{}, marked:[], currentIndex:0,
      startTime:now, durationMs:0, endTime:0, status:"RUNNING"
    };
    return {session:session, insufficient:insufficient, available:available, dynamicCount:dynTotal};
  }
  // Blok ke-i yang memuat index global idx
  function blockOf(session, idx){
    if(!session.blocks) return {i:0, subject:session.subject, start:0, count:session.questions.length};
    var bi=0;
    for(var i=0;i<session.blockStarts.length;i++){
      if(idx>=session.blockStarts[i]) bi=i;
    }
    var b=session.blocks[bi];
    return {i:bi, subject:b.subject, start:session.blockStarts[bi], count:b.questions.length};
  }
  // Skor per blok: [{subject,total,correct,wrong,empty,nilai}]
  function scoreBlocks(session){
    if(!session.blocks) {
      var s=score(session);
      return [{subject:session.subject,total:s.total,correct:s.correct,wrong:s.wrong,empty:s.empty,nilai:s.nilai}];
    }
    return session.blocks.map(function(b){
      var c=0,w=0,e=0;
      b.questions.forEach(function(q){
        var ans=session.answers[q.id];
        if(!isAnswered(q,ans)) e++;
        else if(isCorrect(q,ans)) c++;
        else w++;
      });
      var t=b.questions.length;
      return {subject:b.subject,total:t,correct:c,wrong:w,empty:e,nilai:t?Math.round(c/t*100):0};
    });
  }

  function isAnswered(q, ans){
    if(!ans) return false;
    if(q.type==="true_false_table"){
      return Object.keys(ans).length>0;
    }
    return Array.isArray(ans) && ans.length>0;
  }
  function isFullyAnswered(q, ans){
    if(!ans) return false;
    if(q.type==="true_false_table"){
      return (q.statements||[]).every(function(_,i){ return ans[i]==="true"||ans[i]==="false"; });
    }
    return Array.isArray(ans)&&ans.length>0;
  }
  function isCorrect(q, ans){
    if(!ans) return false;
    if(q.type==="multiple_choice" || q.type==="multiple_select"){
      if(!Array.isArray(ans)) return false;
      var a = ans.slice().sort().join(",");
      var b = (q.correctAnswer||[]).slice().sort().join(",");
      return a===b && a.length>0;
    }
    if(q.type==="true_false_table"){
      var st=q.statements||[];
      for(var i=0;i<st.length;i++){
        if(ans[i]!==st[i].answer) return false;
      }
      return st.length>0;
    }
    return false;
  }
  function score(session){
    var correct=0, wrong=0, empty=0;
    session.questions.forEach(function(q){
      var ans = session.answers[q.id];
      if(!isAnswered(q,ans)) empty++;
      else if(isCorrect(q,ans)) correct++;
      else wrong++;
    });
    var total = session.questions.length;
    var nilai = total? Math.round(correct/total*100):0;
    return {correct:correct, wrong:wrong, empty:empty, total:total, nilai:nilai};
  }

  // Fullscreen manager
  function enterFullscreen(){
    var el = document.documentElement;
    try{
      if(el.requestFullscreen) return el.requestFullscreen();
      if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    }catch(e){}
    return Promise.resolve();
  }
  function exitFullscreen(){
    try{
      if(document.exitFullscreen && document.fullscreenElement) return document.exitFullscreen();
    }catch(e){}
    return Promise.resolve();
  }
  function playAlarm(){
    try{
      var Ctx = window.AudioContext||window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = new Ctx();
      var times=[0,0.25,0.5];
      times.forEach(function(t,i){
        var o=ctx.createOscillator(), g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = i%2? 660:880;
        var s=ctx.currentTime+t;
        g.gain.setValueAtTime(0.0001,s);
        g.gain.exponentialRampToValueAtTime(0.35,s+0.03);
        g.gain.exponentialRampToValueAtTime(0.0001,s+0.2);
        o.start(s); o.stop(s+0.22);
      });
    }catch(e){}
  }

  window.TKAEngine = {
    shuffle:shuffle, shuffleOptions:shuffleOptions, buildSession:buildSession,
    buildSessionLengkap:buildSessionLengkap, blockOf:blockOf, scoreBlocks:scoreBlocks,
    isAnswered:isAnswered, isFullyAnswered:isFullyAnswered, isCorrect:isCorrect, score:score,
    enterFullscreen:enterFullscreen, exitFullscreen:exitFullscreen, playAlarm:playAlarm
  };
})();
