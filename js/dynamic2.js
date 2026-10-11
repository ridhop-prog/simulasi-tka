/* Template DINAMIS jilid 2 — variasi anti-bosan & anti-ulang.
   Memakai helper bersama window.DynH dari dynamic.js.
   - Matematika: konteks cerita acak (nama, benda) + topik baru (FPB/KPK, median, skala, akar, gradien ...).
   - Bindo/Binggris: bank kata (sinonim, antonim, ungkapan, baku, vocab, grammar) — kombinasi jawaban
     diundi dari bank sehingga soal praktis tidak pernah sama.
   - PKWU/RPL: template numerik & istilah tambahan. */
(function(){
"use strict";
var H = window.DynH;
if(!H) return;
var ri=H.ri, pick=H.pick, shuf=H.shuf, fmt=H.fmt, distract=H.distract,
    distractStr=H.distractStr, mcQ=H.mcQ, coef=H.coef, gcd=H.gcd, T=H.T;

function bankQ(subject, topic, question, ansText, wrongTexts, explanation, difficulty){
  var wrongs = shuf(Math.random, wrongTexts.filter(function(t){return t!==ansText})).slice(0,4)
    .map(function(t){return {v:t,t:t};});
  return mcQ(subject, topic, question, ansText, ansText, wrongs, explanation, difficulty);
}
// Soal pilihan dari bank pasangan [kunci, nilai]: tanya kunci->nilai atau sebaliknya
function pairQ(subject, topic, qTextFn, pairs, askForward, explanationFn, difficulty){
  return function(rng){
    var shuffled = shuf(rng, pairs);
    var chosen = shuffled[0];
    var others = shuffled.slice(1);
    var qSide = askForward ? chosen[0] : chosen[1];
    var aSide = askForward ? chosen[1] : chosen[0];
    var wrongPool = others.map(function(p){ return askForward ? p[1] : p[0]; })
      .filter(function(t){ return t!==aSide; });
    var wrongs = shuf(rng, wrongPool).slice(0,4).map(function(t){ return {v:t,t:t}; });
    while(wrongs.length<4) wrongs.push({v:"—",t:"—"});
    return mcQ(subject, topic, qTextFn(qSide), aSide, aSide, wrongs.slice(0,4),
      explanationFn(qSide, aSide), difficulty);
  };
}

/* ===== BANK KATA ===== */
var ENG_SYN=[["rapid","fast"],["glad","happy"],["begin","start"],["assist","help"],["purchase","buy"],["wealthy","rich"],["tiny","small"],["big","large"],["wide","broad"],["clever","smart"],["strong","powerful"],["feeble","weak"],["neat","clean"],["filthy","dirty"],["chilly","cold"],["shiny","bright"],["gloomy","dark"],["lengthy","long"],["brief","short"],["famous","well-known"],["furious","angry"],["unhappy","sad"],["hard","difficult"],["ancient","old"],["brave","bold"],["calm","quiet"]];
var ENG_ANT=[["expensive","cheap"],["happy","sad"],["fast","slow"],["big","small"],["hot","cold"],["strong","weak"],["clean","dirty"],["rich","poor"],["bright","dark"],["early","late"],["win","lose"],["pass","fail"],["boring","interesting"],["rude","polite"],["dangerous","safe"],["brave","cowardly"]];
var ENG_ID=[["library","perpustakaan"],["teacher","guru"],["book","buku"],["school","sekolah"],["water","air"],["house","rumah"],["food","makanan"],["morning","pagi"],["night","malam"],["friend","teman"],["family","keluarga"],["money","uang"],["time","waktu"],["day","hari"],["market","pasar"],["cat","kucing"],["dog","anjing"],["fish","ikan"],["rice","nasi"],["mother","ibu"],["village","desa"],["river","sungai"]];
var ENG_TOBE=[["I","am"],["you","are"],["he","is"],["she","is"],["it","is"],["we","are"],["they","are"],["Rani","is"],["The cats","are"],["Budi and Ani","are"],["My father","is"],["The students","are"]];
var ENG_PLUR=[["book","books"],["box","boxes"],["baby","babies"],["knife","knives"],["child","children"],["man","men"],["woman","women"],["tooth","teeth"],["foot","feet"],["mouse","mice"],["bus","buses"],["dish","dishes"]];
var ENG_ART=[["apple","an"],["book","a"],["egg","an"],["car","a"],["orange","an"],["umbrella","an"],["desk","a"],["hour","an"],["university","a"],["honest man","an"],["dog","a"],["island","an"]];
var IND_SIN=[["bahagia","senang"],["cepat","lekas"],["indah","elok"],["pandai","cerdas"],["kaya","makmur"],["berani","gagah"],["jujur","amanah"],["marah","murka"],["sedih","pilu"],["rajin","tekun"],["bodoh","dungu"],["miskin","melarat"],["bohong","dusta"],["kecil","mungil"],["lamban","perlahan"],["haus","dahaga"]];
var IND_ANT=[["rajin","malas"],["cepat","lambat"],["besar","kecil"],["pandai","bodoh"],["kaya","miskin"],["berani","penakut"],["jujur","bohong"],["tinggi","rendah"],["mahal","murah"],["terang","gelap"],["kuat","lemah"],["datang","pergi"],["hidup","mati"],["menang","kalah"],["atas","bawah"],["bersih","kotor"]];
var IND_UNGK=[["besar kepala","sombong"],["ringan tangan","suka menolong"],["meja hijau","pengadilan"],["angkat tangan","menyerah"],["buah bibir","perbincangan"],["bertukar pikiran","berdiskusi"],["campur tangan","ikut terlibat"],["darah biru","bangsawan"],["kutu buku","suka membaca"],["panjang tangan","suka mencuri"],["tutup usia","meninggal"],["naik daun","populer"],["keras kepala","susah dinasihati"],["rendah hati","tidak sombong"]];
var IND_BAKU=[["nasihat","nasehat"],["apotek","apotik"],["jadwal","jadual"],["risiko","resiko"],["sistem","system"],["cenderamata","cendramata"],["telepon","telpon"],["foto","poto"],["bus","bis"],["aktif","aktip"],["pasif","pasip"],["standar","standard"],["objek","obyek"],["subjek","subyek"],["teknik","tehnik"],["kualitas","kwalitas"]];
var RPL_TAG=[["p","paragraf"],["h1","judul utama"],["img","menampilkan gambar"],["a","tautan ke halaman lain"],["ul","daftar tak berurut"],["table","tabel data"],["form","formulir isian"],["button","tombol klik"],["input","kolom masukan"],["title","judul tab browser"]];
var RPL_SQL=[["SELECT","menampilkan data"],["INSERT","menambah data"],["UPDATE","mengubah data"],["DELETE","menghapus data"],["WHERE","menyaring baris data"],["ORDER BY","mengurutkan hasil"],["PRIMARY KEY","pengenal unik baris"],["COMMIT","menyimpan permanen"]];
var NAMES=["Andi","Budi","Citra","Dewi","Eko","Fitri","Gilang","Hana","Irma","Joko","Kiki","Lina","Made","Nina","Omar","Putri","Rian","Sinta","Tono","Wulan"];
var ITEMS=["kelereng","permen","buku tulis","pensil","apel","jeruk","kue","stiker","bintang kertas","manik"];

var NEW_TPL = [
/* ===== MATEMATIKA: konteks acak ===== */
T("MTKV24","matematika","Cerita penjumlahan","easy",function(rng){
  var nm=pick(rng,NAMES), it=pick(rng,ITEMS);
  var a=ri(rng,15,80), b=ri(rng,15,80), ans=a+b;
  return mcQ("matematika","Cerita penjumlahan",
    nm+" memiliki "+a+" "+it+", lalu diberi lagi "+b+" "+it+". Jumlah semuanya adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,10]),
    a+" + "+b+" = "+fmt(ans)+".","easy");
}),
T("MTKV25","matematika","FPB","medium",function(rng){
  var g=ri(rng,2,9), x,y,guard=0;
  do{ x=ri(rng,2,9); y=ri(rng,2,9); guard++; }while(gcd(x,y)!==1&&guard<50);
  var a=g*x, b=g*y;
  return mcQ("matematika","FPB","FPB dari "+a+" dan "+b+" adalah …",
    g, fmt(g), distract(rng,g,[1,2]),
    "Faktor bersama terbesar "+a+" dan "+b+" adalah "+g+".","medium");
}),
T("MTKV26","matematika","KPK","medium",function(rng){
  var g=ri(rng,2,6), x,y,guard=0;
  do{ x=ri(rng,2,9); y=ri(rng,2,9); guard++; }while(gcd(x,y)!==1&&guard<50);
  var a=g*x, b=g*y, ans=g*x*y;
  return mcQ("matematika","KPK","KPK dari "+a+" dan "+b+" adalah …",
    ans, fmt(ans), distract(rng,ans,[a,b]),
    "Kelipatan bersama terkecil "+a+" dan "+b+" adalah "+fmt(ans)+".","medium");
}),
T("MTKV27","matematika","Median","medium",function(rng){
  var n=pick(rng,[5,7]), vals=[], i;
  for(i=0;i<n;i++) vals.push(ri(rng,3,20));
  var srt=vals.slice().sort(function(a,b){return a-b;});
  var ans=srt[Math.floor(n/2)];
  return mcQ("matematika","Median","Median dari data "+vals.join(", ")+" adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2]),
    "Urutkan: "+srt.join(", ")+". Nilai tengah = "+ans+".","medium");
}),
T("MTKV28","matematika","Persen untung","medium",function(rng){
  var B=1000*ri(rng,10,50), p=pick(rng,[10,20,25,50]);
  var J=B*(100+p)/100;
  return mcQ("matematika","Persen untung",
    "Barang dibeli Rp"+fmt(B)+" lalu dijual Rp"+fmt(J)+". Persentase keuntungannya adalah …",
    p, p+"%", distract(rng,p,[5,10]).map(function(w){return {v:w.v,t:w.t+"%"};}),
    "(Rp"+fmt(J)+" − Rp"+fmt(B)+") : Rp"+fmt(B)+" × 100% = "+p+"%.","medium");
}),
T("MTKV29","matematika","Sudut segitiga","easy",function(rng){
  var x,y,guard=0;
  do{ x=ri(rng,40,70); y=ri(rng,30,80); guard++; }while(x+y>=160&&guard<50);
  var ans=180-x-y;
  return mcQ("matematika","Sudut segitiga",
    "Dua sudut segitiga adalah "+x+"° dan "+y+"°. Besar sudut ketiga adalah …",
    ans, ans+"°", distract(rng,ans,[5,10]).map(function(w){return {v:w.v,t:w.t+"°"};}),
    "180° − "+x+"° − "+y+"° = "+ans+"°.","easy");
}),
T("MTKV30","matematika","Persegi panjang","easy",function(rng){
  var p=ri(rng,5,20), l=ri(rng,4,15);
  var askK=rng()<0.5, ans=askK?2*(p+l):p*l;
  return mcQ("matematika","Persegi panjang",
    "Persegi panjang "+p+" cm × "+l+" cm. "+(askK?"Kelilingnya":"Luasnya")+" adalah …",
    ans, fmt(ans)+" cm"+(askK?"":"²"), distract(rng,ans,[p,l]).map(function(w){return {v:w.v,t:fmt(w.v)+" cm"+(askK?"":"²")};}),
    askK? ("2 × ("+p+" + "+l+") = "+ans+" cm.") : (p+" × "+l+" = "+ans+" cm²."),"easy");
}),
T("MTKV31","matematika","Volume balok","easy",function(rng){
  var p=ri(rng,3,10), l=ri(rng,3,10), t=ri(rng,3,10), ans=p*l*t;
  return mcQ("matematika","Volume balok",
    "Balok berukuran "+p+" × "+l+" × "+t+" cm. Volumenya adalah …",
    ans, fmt(ans)+" cm³", distract(rng,ans,[p*l,t]).map(function(w){return {v:w.v,t:fmt(w.v)+" cm³"};}),
    p+" × "+l+" × "+t+" = "+fmt(ans)+" cm³.","easy");
}),
T("MTKV32","matematika","Rata-rata gabungan","hard",function(rng){
  var n1=ri(rng,10,30), m1=ri(rng,60,80), n2=ri(rng,10,30), m2=m1, guard=0;
  while(((n1*m1+n2*m2)%(n1+n2)!==0||m2===m1)&&guard++<200){ m2=ri(rng,60,80); }
  var ans=(n1*m1+n2*m2)/(n1+n2);
  return mcQ("matematika","Rata-rata gabungan",
    "Rata-rata "+n1+" siswa adalah "+m1+", rata-rata "+n2+" siswa lain "+m2+". Rata-rata gabungan adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2]),
    "("+(n1*m1)+" + "+(n2*m2)+") : "+(n1+n2)+" = "+ans+".","hard");
}),
T("MTKV33","matematika","Suku barisan","medium",function(rng){
  var a=ri(rng,2,20), b=ri(rng,2,12), n=ri(rng,8,15);
  var ans=a+(n-1)*b;
  return mcQ("matematika","Suku barisan",
    "Suku pertama "+a+", beda "+b+". Suku ke-"+n+" adalah …",
    ans, fmt(ans), distract(rng,ans,[b,2*b]),
    a+" + "+(n-1)+" × "+b+" = "+fmt(ans)+".","medium");
}),
T("MTKV34","matematika","Jarak kecepatan waktu","easy",function(rng){
  var v=ri(rng,4,8)*10, t=ri(rng,2,5), s=v*t, ask=ri(rng,0,2), q, ans;
  if(ask===0){ q="Kecepatan "+v+" km/jam selama "+t+" jam. Jarak tempuh …"; ans=s+" km"; }
  else if(ask===1){ q="Jarak "+s+" km ditempuh dalam "+t+" jam. Kecepatan …"; ans=v+" km/jam"; }
  else { q="Jarak "+s+" km dengan kecepatan "+v+" km/jam. Waktu tempuh …"; ans=t+" jam"; }
  var numAns=ask===0?s:(ask===1?v:t);
  return mcQ("matematika","Jarak kecepatan waktu",q,
    numAns, ans, distract(rng,numAns,[1,2,t]).map(function(w){return {v:w.v,t:w.t+(ask===0?" km":ask===1?" km/jam":" jam")};}),
    "Jarak = kecepatan × waktu.","easy");
}),
T("MTKV35","matematika","Skala","medium",function(rng){
  var m=ri(rng,1,20), d=ri(rng,2,12);
  var ans=d*m;
  return mcQ("matematika","Skala",
    "Peta berskala 1:"+fmt(m*100000)+". Jarak pada peta "+d+" cm. Jarak sebenarnya adalah …",
    ans, fmt(ans)+" km", distract(rng,ans,[m,d]).map(function(w){return {v:w.v,t:fmt(w.v)+" km"};}),
    d+" × "+m+" = "+fmt(ans)+" km.","medium");
}),
T("MTKV36","matematika","Akar kuadrat","medium",function(rng){
  var r1,r2,guard=0;
  do{ r1=pick(rng,[-5,-4,-3,-2,-1,1,2,3,4,5]); r2=pick(rng,[-5,-4,-3,-2,-1,1,2,3,4,5]); guard++; }while(r1===r2&&guard<30);
  var S=r1+r2, P=r1*r2, askSum=rng()<0.5;
  var eq="x²"+coef(-S,"x")+coef(P,"")+" = 0";
  var ans=askSum?S:P;
  return mcQ("matematika","Akar kuadrat",
    "Diketahui "+eq+". "+(askSum?"Jumlah":"Hasil kali")+" akar-akarnya adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2]),
    askSum? ("x₁ + x₂ = "+S+".") : ("x₁ × x₂ = "+P+"."),"medium");
}),
T("MTKV37","matematika","Gradien","medium",function(rng){
  var m,guard=0;
  do{ m=ri(rng,-3,3); guard++; }while(m===0&&guard<20);
  var x1=ri(rng,-5,5), x2,guard2=0;
  do{ x2=ri(rng,-5,5); guard2++; }while(x2===x1&&guard2<20);
  var y1=ri(rng,-5,5), y2=y1+m*(x2-x1);
  return mcQ("matematika","Gradien",
    "Gradien garis melalui ("+x1+", "+y1+") dan ("+x2+", "+y2+") adalah …",
    m, fmt(m), distract(rng,m,[1]),
    "("+y2+" − ("+y1+")) : ("+x2+" − ("+x1+")) = "+m+".","medium");
}),
/* ===== BAHASA INDONESIA generatif (diundi dari bank kata) ===== */
T("INDV01","bindo","Sinonim","easy",pairQ("bindo","Sinonim",
  function(w){ return "Sinonim kata '"+w+"' adalah …"; },
  IND_SIN, true,
  function(w,a){ return "'"+w+"' bersinonim dengan '"+a+"'."; },"easy")),
T("INDV02","bindo","Antonim","easy",pairQ("bindo","Antonim",
  function(w){ return "Antonim kata '"+w+"' adalah …"; },
  IND_ANT, true,
  function(w,a){ return "'"+w+"' berantonim dengan '"+a+"'."; },"easy")),
T("INDV03","bindo","Ungkapan","medium",pairQ("bindo","Ungkapan",
  function(w){ return "Ungkapan '"+w+"' bermakna …"; },
  IND_UNGK, true,
  function(w,a){ return "'"+w+"' berarti "+a+"."; },"medium")),
T("INDV04","bindo","Kata baku","medium",function(rng){
  var all=shuf(rng,IND_BAKU);
  var chosen=all[0];
  var wrongPool=[];
  all.slice(1).forEach(function(p){ if(p[1]!==chosen[0]) wrongPool.push(p[1]); });
  if(chosen[1]!==chosen[0]) wrongPool.push(chosen[1]);
  // unik + tepat 4 pengecoh
  var seen={}, uw=[];
  shuf(rng,wrongPool).forEach(function(t){ if(!seen[t]){ seen[t]=1; uw.push(t); } });
  var wrongs=uw.slice(0,4).map(function(t){return {v:t,t:t};});
  return mcQ("bindo","Kata baku","Kata baku yang tepat adalah …",
    chosen[0], chosen[0], wrongs,
    "Bentuk baku: '"+chosen[0]+"' (bukan '"+chosen[1]+"').","medium");
}),
/* ===== BAHASA INGGRIS generatif ===== */
T("ENGV01","binggris","Synonym","easy",pairQ("binggris","Synonym",
  function(w){ return "The word '"+w+"' is closest in meaning to …"; },
  ENG_SYN, true,
  function(w,a){ return "'"+w+"' means "+a+"."; },"easy")),
T("ENGV02","binggris","Antonym","easy",pairQ("binggris","Antonym",
  function(w){ return "The opposite of '"+w+"' is …"; },
  ENG_ANT, true,
  function(w,a){ return "The opposite is "+a+"."; },"easy")),
T("ENGV03","binggris","Vocabulary","easy",pairQ("binggris","Vocabulary",
  function(w){ return "'"+w+"' in Indonesian means …"; },
  ENG_ID, true,
  function(w,a){ return "'"+w+"' = "+a+"."; },"easy")),
T("ENGV04","binggris","To be","easy",function(rng){
  var p=pick(rng,ENG_TOBE);
  // Opsi berupa kalimat utuh agar 5 pilihan berbeda dan hanya satu yang benar
  var forms=["am","is","are","be"];
  var wrongForms=forms.filter(function(t){return t!==p[1];});
  var wrongs=wrongForms.map(function(t){
    return {v:t, t:p[0]+" "+t+" happy."};
  });
  // pengecoh ke-4: dua to be sekaligus (jelas salah)
  wrongs.push({v:"xx", t:p[0]+" "+wrongForms[0]+" "+wrongForms[1]+" happy."});
  return mcQ("binggris","To be","Choose the correct sentence.",
    p[1], p[0]+" "+p[1]+" happy.", shuf(rng,wrongs).slice(0,4),
    "'"+p[0]+"' memakai to be '"+p[1]+"'.","easy");
}),
T("ENGV05","binggris","Plural","medium",pairQ("binggris","Plural",
  function(w){ return "The plural form of '"+w+"' is …"; },
  ENG_PLUR, true,
  function(w,a){ return "Plural of "+w+" = "+a+"."; },"medium")),
T("ENGV06","binggris","Article","medium",function(rng){
  var all=shuf(rng,ENG_ART);
  var chosen=all[0];
  // Lawan: kata yang artikelnya BERBEDA, sehingga semua pengecoh pasti salah
  var others=all.filter(function(p){ return p[1]!==chosen[1] && p[0]!==chosen[0]; }).slice(0,3);
  var wrongs=[{ v:"x", t:(chosen[1]==="a"?"an":"a")+" "+chosen[0] }];
  others.forEach(function(p){ wrongs.push({ v:"x"+p[0], t:chosen[1]+" "+p[0] }); });
  return mcQ("binggris","Article","Choose the correct phrase.",
    chosen[1]+" "+chosen[0], chosen[1]+" "+chosen[0], wrongs.slice(0,4),
    "Jawaban tepat: '"+chosen[1]+" "+chosen[0]+"'.","medium");
}),
/* ===== PKWU tambahan ===== */
T("PKWUV05","pkwu","Persen margin","medium",function(rng){
  var H=1000*ri(rng,10,60), p=pick(rng,[10,20,25,50]);
  var J=H*(100+p)/100;
  return mcQ("pkwu","Persen margin","HPP Rp"+fmt(H)+", harga jual Rp"+fmt(J)+". Margin keuntungan …",
    p, p+"%", distract(rng,p,[5,10]).map(function(w){return {v:w.v,t:w.t+"%"};}),
    "(Rp"+fmt(J)+" − Rp"+fmt(H)+") : Rp"+fmt(H)+" × 100% = "+p+"%.","medium");
}),
T("PKWUV06","pkwu","Harga jual","medium",function(rng){
  var H=1000*ri(rng,5,30), p=pick(rng,[10,20,25,50]);
  var J=H*(100+p)/100;
  return mcQ("pkwu","Harga jual","HPP Rp"+fmt(H)+" ingin margin "+p+"%. Harga jual …",
    J, "Rp"+fmt(J), distract(rng,J,[H]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    "Rp"+fmt(H)+" × "+(100+p)+"% = Rp"+fmt(J)+".","medium");
}),
T("PKWUV07","pkwu","Omzet","easy",function(rng){
  var n=ri(rng,20,200), P=1000*ri(rng,5,50);
  var ans=n*P;
  return mcQ("pkwu","Omzet","Terjual "+n+" unit @Rp"+fmt(P)+". Total omzet …",
    ans, "Rp"+fmt(ans), distract(rng,ans,[P,n]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    n+" × Rp"+fmt(P)+" = Rp"+fmt(ans)+".","easy");
}),
T("PKWUV08","pkwu","Target laba","medium",function(rng){
  var n=ri(rng,20,100), H=1000*ri(rng,5,20), x=1000*ri(rng,1,5);
  var ans=H+x;
  return mcQ("pkwu","Target laba","HPP Rp"+fmt(H)+"/unit. Ingin laba Rp"+fmt(n*x)+" dari "+n+" unit. Harga jual minimum …",
    ans, "Rp"+fmt(ans), distract(rng,ans,[1000,x]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    "Rp"+fmt(H)+" + Rp"+fmt(n*x)+":"+n+" = Rp"+fmt(ans)+".","medium");
}),
/* ===== PRODUKTIF tambahan ===== */
T("RPLV04","produktif","Desimal ke biner","medium",function(rng){
  var val=ri(rng,10,200), bin=val.toString(2);
  function flip(s,k){ var a=s.split(""); for(var i=0;i<k;i++){ var p=ri(rng,0,a.length-1); a[p]=a[p]==="0"?"1":"0"; } return a.join(""); }
  var pool=[flip(bin,1),flip(bin,2),(val+1).toString(2),(val-1).toString(2),flip(bin,1)];
  var wrongs=pool.filter(function(t,i){return t!==bin&&pool.indexOf(t)===i;}).slice(0,4).map(function(t){return {v:t,t:t};});
  while(wrongs.length<4) wrongs.push({v:"0",t:"0"});
  return mcQ("produktif","Desimal ke biner","Desimal "+val+" dalam biner adalah …",
    bin, bin, wrongs.slice(0,4),"Ubah "+val+" ke basis 2 = "+bin+".","medium");
}),
T("RPLV05","produktif","Tag HTML","easy",pairQ("produktif","Tag HTML",
  function(w){ return "Tag HTML <"+w+"> digunakan untuk …"; },
  RPL_TAG, true,
  function(w,a){ return "<"+w+"> untuk "+a+"."; },"easy")),
T("RPLV06","produktif","Perintah SQL","medium",pairQ("produktif","Perintah SQL",
  function(w){ return "Perintah SQL "+w+" berfungsi untuk …"; },
  RPL_SQL, true,
  function(w,a){ return w+": "+a+"."; },"medium"))
];
window.DYNAMIC_TPL = window.DYNAMIC_TPL.concat(NEW_TPL);
window.DYNAMIC_CAP.matematika = 12;
window.DYNAMIC_CAP.bindo = 5;
window.DYNAMIC_CAP.binggris = 6;
window.DYNAMIC_CAP.pkwu = 6;
window.DYNAMIC_CAP.produktif = 5;
})();
