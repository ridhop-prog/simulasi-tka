/* questionParser — membaca teks paste menjadi struktur soal. Fleksibel, validasi ketat. */
(function(){
  function linesOf(block){
    return block.split(/\r?\n/).map(function(s){return s.trim()}).filter(function(s){return s.length>0});
  }
  function normAns(tok){
    tok=(tok||"").trim().toLowerCase();
    if(/^(benar|b|betul|true|t)$/.test(tok)) return "true";
    if(/^(salah|s|tidak|slh|false|f)$/.test(tok)) return "false";
    return null;
  }
  function parseOne(block, index, subject){
    var errors=[];
    var rawLines = block.split(/\r?\n/);
    // buang header SOAL N
    var text = block.replace(/^\s*SOAL\s*\d+[\s\:\.\-\)]*/i,"").trim();
    if(!text){ return {error:"Soal "+(index+1)+" kosong / tidak dapat dibaca."}; }
    var ls = linesOf(text);
    if(ls.length===0) return {error:"Soal "+(index+1)+" tidak dapat dibaca."};

    // --- Deteksi TF: baris dengan '=' + benar/salah ---
    var eqLines = ls.filter(function(l){ return /=/.test(l); });
    var tfCands = eqLines.map(function(l){
      var m = l.match(/^(.*?)\s*=\s*(benar|salah|betul|true|false|b|s|t|f)\s*\.?$/i);
      if(m) return {text:m[1].trim(), ans:normAns(m[2])};
      return null;
    }).filter(Boolean);
    // juga format "1. pernyataan ... : BENAR"
    var colonTF = ls.map(function(l){
      var m = l.match(/^(?:\d+[\.\)]\s*)?(.*?)\s*[:\-–]\s*(benar|salah|betul|true|false)\s*$/i);
      if(m && !/^[A-E][\.\)]/.test(l.trim())) return {text:m[1].trim(), ans:normAns(m[2])};
      return null;
    }).filter(Boolean);

    var tfList = tfCands.length>=2 ? tfCands : (colonTF.length>=2 ? colonTF : []);
    // jika TF terdeteksi, pertanyaan = baris sebelum pernyataan pertama
    if(tfList.length>=2){
      var firstIdx = -1;
      for(var i=0;i<ls.length;i++){ if(ls[i].indexOf(tfList[0].text.slice(0,12))!==-1){firstIdx=i;break;} }
      // fallback: cari baris yg mengandung '='
      if(firstIdx===-1){
        for(var j=0;j<ls.length;j++){ if(/=/.test(ls[j])){firstIdx=j;break;} }
      }
      var qlines = firstIdx>0 ? ls.slice(0,firstIdx) : ["Tentukan apakah pernyataan berikut BENAR atau SALAH."];
      // buang baris "Jawaban:" jika ikut
      qlines = qlines.filter(function(l){return !/^jawaban\s*:/i.test(l)});
      var qtext = qlines.join(" ").trim() || "Tentukan apakah pernyataan berikut BENAR atau SALAH.";
      // validasi tiap baris ada jawaban
      var bad = tfList.filter(function(s){return !s.text || !s.ans});
      if(bad.length) return {error:"Soal "+(index+1)+" tidak dapat dibaca: setiap pernyataan harus punya jawaban BENAR/SALAH."};
      return {question:{
        id:"IMP"+Date.now().toString(36).toUpperCase()+ (index+1),
        subject:subject, type:"true_false_table", question:qtext,
        statements:tfList.map(function(s){return {text:s.text.replace(/^\d+[\.\)]\s*/,""), answer:s.ans}}),
        correctAnswer:[], explanation:"", difficulty:"medium"
      }};
    }

    // --- Deteksi PG: opsi A. / A) / A: ---
    var optRe = /^([A-E])[\.\)\:\-\s]\s*(.+)$/;
    var opts=[];
    ls.forEach(function(l){
      var m=l.match(optRe);
      if(m) opts.push({id:m[1].toUpperCase(), text:m[2].trim()});
    });
    // cari baris jawaban
    var ansLine = null;
    rawLines.forEach(function(l){
      var m=l.match(/jawaban\s*[:\-]\s*(.+)/i);
      if(m) ansLine=m[1].trim();
    });
    // format "Kunci: C" alternatif
    if(!ansLine){
      rawLines.forEach(function(l){
        var m=l.match(/^(?:kunci|key)\s*[:\-]\s*(.+)/i);
        if(m) ansLine=m[1].trim();
      });
    }
    if(opts.length>=2){
      // pertanyaan = teks sebelum opsi pertama
      var oi = ls.findIndex(function(l){return optRe.test(l)});
      var qpart = ls.slice(0,oi).filter(function(l){return !/^jawaban\s*:/i.test(l)&&!/^(?:kunci|key)\s*:/i.test(l)});
      var qq = qpart.join(" ").replace(/^\s*SOAL\s*\d+[\s\:\.\-\)]*/i,"").trim();
      if(!qq) return {error:"Soal "+(index+1)+" tidak dapat dibaca: pertanyaan kosong."};
      if(!ansLine) return {error:"Soal "+(index+1)+" tidak dapat dibaca: jawaban tidak ditemukan (tulis 'Jawaban: C')."};
      // parse jawaban: huruf A-E dipisah koma/spasi
      var letters = (ansLine.toUpperCase().match(/[A-E]/g)||[]);
      // untuk TF-inline "BENAR" di jawaban -> bukan PG
      if(letters.length===0) return {error:"Soal "+(index+1)+" tidak dapat dibaca: format jawaban '"+ansLine+"' tidak dikenali."};
      // validasi huruf ada di opsi
      var optIds = opts.map(function(o){return o.id});
      var invalid = letters.filter(function(L){return optIds.indexOf(L)===-1});
      if(invalid.length) return {error:"Soal "+(index+1)+" tidak dapat dibaca: jawaban "+invalid.join(",")+" tidak ada di pilihan."};
      // unik
      letters = Array.from(new Set(letters)).sort();
      var type = letters.length>1 ? "multiple_select" : "multiple_choice";
      if(type==="multiple_select" && letters.length<2) return {error:"Soal "+(index+1)+": pilihan ganda kompleks minimal 2 jawaban benar."};
      // pembahasan opsional: "Pembahasan: ..."
      var expl = "";
      rawLines.forEach(function(l){
        var m=l.match(/(?:pembahasan|penjelasan)\s*[:\-]\s*(.+)/i);
        if(m) expl=m[1].trim();
      });
      return {question:{
        id:"IMP"+Date.now().toString(36).toUpperCase()+(index+1),
        subject:subject, type:type, question:qq, options:opts,
        correctAnswer:letters, explanation:expl, difficulty:"medium"
      }};
    }

    return {error:"Soal "+(index+1)+" tidak dapat dibaca: format tidak dikenali. Gunakan opsi A.–E. + 'Jawaban: …' atau format 'pernyataan = BENAR/SALAH'."};
  }

  function parseBulk(rawText, subject){
    var parts = rawText.split(/(?=^\s*SOAL\s*\d+)/im).map(function(s){return s.trim()}).filter(Boolean);
    if(parts.length===0){
      // coba split per blok kosong ganda
      parts = rawText.split(/\n\s*\n\s*\n/).map(function(s){return s.trim()}).filter(Boolean);
    }
    var questions=[], errors=[];
    parts.forEach(function(p,i){
      var r = parseOne(p,i,subject);
      if(r.question) questions.push(r.question);
      else errors.push(r.error);
    });
    // pastikan id unik
    var seen={};
    questions.forEach(function(q,idx){
      var base = q.id.replace(/[^A-Z0-9]/gi,"").toUpperCase() || ("IMP"+idx);
      if(seen[base]){ base = base+"_"+(idx+1); }
      seen[base]=1; q.id=base.slice(0,24);
    });
    var counts={multiple_choice:0,multiple_select:0,true_false_table:0};
    questions.forEach(function(q){counts[q.type]=(counts[q.type]||0)+1});
    return {questions:questions, errors:errors, counts:counts, total:questions.length};
  }

  window.TKAParser = { parseBulk:parseBulk, parseOne:parseOne };
})();
