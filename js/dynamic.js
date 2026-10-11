/* Soal DINAMIS (angka-acak) — jawaban dihitung ulang setiap simulasi.
   Tiap template punya make(rng) yang menghasilkan soal konkret dengan
   angka berbeda di tiap session. ID instansi = idTemplate + "@" + nonce,
   sehingga tidak pernah bentrok dan tidak mencemari pool soal-terpakai. */
(function(){
"use strict";
function rngFn(){
  return function(){
    if(window.crypto && window.crypto.getRandomValues){
      var a = new Uint32Array(1); window.crypto.getRandomValues(a);
      return a[0]/4294967296;
    }
    return Math.random();
  };
}
function ri(rng, min, max){ return min + Math.floor(rng()*(max-min+1)); }
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
function shuf(rng, arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(rng()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function fmt(n){ return Number(n).toLocaleString("id-ID"); }
function nonce(rng){ return Math.floor(rng()*46656).toString(36); }
function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){ var t=a%b; a=b; b=t; } return a||1; }
// pengecoh numerik di sekitar jawaban (unik, tidak sama dengan jawaban)
function distract(rng, ans, spreads){
  var out = [], seen = {};
  seen[fmt(ans)] = 1;
  var cands = [];
  spreads.forEach(function(s){ cands.push(ans+s, ans-s); });
  cands.push(ans*2, Math.round(ans/2));
  cands = shuf(rng, cands);
  cands.forEach(function(c){
    if(out.length>=4) return;
    if(!seen[fmt(c)]){ seen[fmt(c)]=1; out.push({ v:c, t:fmt(c) }); }
  });
  var k=3;
  while(out.length<4){ var c2=ans+k*7+1; k++; if(!seen[fmt(c2)]){ seen[fmt(c2)]=1; out.push({v:c2,t:fmt(c2)}); } }
  return out;
}
// pengecoh dari daftar string (untuk jawaban pecahan/teks)
function distractStr(rng, ansText, pool){
  var rest = shuf(rng, pool.filter(function(s){ return s!==ansText; }));
  return rest.slice(0,4).map(function(t){ return { v:t, t:t }; });
}
function mcQ(subject, topic, question, ansVal, ansText, wrongs, explanation, difficulty){
  var opts = wrongs.map(function(w){ return { text:w.t, hit:(w.v===ansVal && w.t===ansText) }; });
  opts.push({ text:ansText, hit:true });
  opts = shuf(Math.random, opts);
  var letters=["A","B","C","D","E"], correct=null;
  var finalOpts = opts.map(function(o,i){ if(o.hit && !correct) correct=letters[i]; return {id:letters[i], text:o.text}; });
  return { subject:subject, type:"multiple_choice", topic:topic,
    question:question, options:finalOpts, correctAnswer:[correct],
    explanation:explanation, difficulty:difficulty||"medium", dynamic:true };
}
// koefisien bertanda untuk persamaan, mis. coef(-3,"x") -> " − 3x"
function coef(n, v, first){
  if(n===0) return "";
  var a=Math.abs(n), num=(a===1&&v)?"":fmt(a);
  return (n<0?" − ":(first?"":" + "))+num+(v||"");
}
function T(id, subject, topic, difficulty, make){
  return { id:id, subject:subject, topic:topic, difficulty:difficulty, make:make };
}

var TRIG=[
  {a:0,s:"0",c:"1"},{a:30,s:"1/2",c:"√3/2"},{a:45,s:"√2/2",c:"√2/2"},
  {a:60,s:"√3/2",c:"1/2"},{a:90,s:"1",c:"0"},{a:120,s:"√3/2",c:"−1/2"},
  {a:135,s:"√2/2",c:"−√2/2"},{a:150,s:"1/2",c:"−√3/2"},{a:180,s:"0",c:"−1"},
  {a:210,s:"−1/2",c:"−√3/2"},{a:270,s:"−1",c:"0"}
];
var TRIPLES=[{x:3,y:4,c:5,s:3},{x:5,y:12,c:13,s:1},{x:6,y:8,c:10,s:2},{x:8,y:15,c:17,s:1},{x:9,y:12,c:15,s:2},{x:7,y:24,c:25,s:1},{x:20,y:21,c:29,s:1}];
var DICE={5:["1/9"],6:["5/36"],7:["1/6"],8:["5/36"],9:["1/9"],10:["1/12"],11:["1/18"]};

var TPL = [
T("MTKV01","matematika","Operasi bilangan","easy",function(rng){
  var a=ri(rng,25,95), b=ri(rng,25,95), op=pick(rng,["+","−"]);
  var ans = op==="+" ? a+b : a-b;
  return mcQ("matematika","Operasi bilangan","Hasil dari "+a+" "+op+" "+b+" adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,10]), a+" "+op+" "+b+" = "+fmt(ans)+".","easy");
}),
T("MTKV02","matematika","Perkalian dan pembagian","easy",function(rng){
  var a=ri(rng,6,19), b=ri(rng,3,12), ans, q;
  if(rng()<0.5){ q=a+" × "+b; ans=a*b; } else { q=(a*b)+" : "+a; ans=b; }
  return mcQ("matematika","Perkalian dan pembagian","Hasil dari "+q+" adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,3,a]), q+" = "+fmt(ans)+".","easy");
}),
T("MTKV03","matematika","Pecahan","medium",function(rng){
  var pairs=[[1,2],[1,3],[2,3],[1,4],[3,4],[2,5],[3,5],[4,5],[3,7],[5,8]];
  var p=pick(rng,pairs), k=ri(rng,2,9);
  var num=k*p[0], den=k*p[1], ans=p[0]+"/"+p[1];
  var pool=["1/2","1/3","2/3","1/4","3/4","2/5","3/5","4/5","3/7","5/8","4/3","5/4"];
  return mcQ("matematika","Pecahan","Bentuk paling sederhana dari "+num+"/"+den+" adalah …",
    ans, ans, distractStr(rng,ans,pool),
    "Bagi pembilang dan penyebut dengan "+k+": "+num+"/"+den+" = "+ans+".","medium");
}),
T("MTKV04","matematika","Persentase","easy",function(rng){
  var p=pick(rng,[10,15,20,25,40,50,75]);
  var n=20*ri(rng,5,100), ans=p/100*n;
  var step=Math.max(1,Math.round(ans*0.05)), step2=Math.max(2,Math.round(ans*0.1));
  return mcQ("matematika","Persentase",p+"% dari "+fmt(n)+" adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,step,step2]),
    p+"/100 × "+fmt(n)+" = "+fmt(ans)+".","easy");
}),
T("MTKV05","matematika","Persamaan linear","medium",function(rng){
  var a=ri(rng,2,9), x=ri(rng,2,12), b=ri(rng,1,20);
  var c=a*x+b;
  return mcQ("matematika","Persamaan linear","Jika "+a+"x + "+b+" = "+c+", nilai x adalah …",
    x, fmt(x), distract(rng,x,[1,2]), "x = ("+c+" − "+b+") : "+a+" = "+x+".","medium");
}),
T("MTKV06","matematika","SPLTV kontekstual","medium",function(rng){
  var x=500*ri(rng,6,16), y=500*ri(rng,3,8);
  var t1=3*x+2*y, t2=2*x+3*y, ans=x+y;
  return mcQ("matematika","SPLTV kontekstual",
    "Tiga buku dan dua pensil Rp"+fmt(t1)+"; dua buku dan tiga pensil Rp"+fmt(t2)+". Harga satu buku dan satu pensil adalah …",
    ans, "Rp"+fmt(ans), distract(rng,ans,[500,1000]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    "Jumlahkan: 5 buku + 5 pensil = Rp"+fmt(t1+t2)+" → 1 buku + 1 pensil = Rp"+fmt(ans)+".","medium");
}),
T("MTKV07","matematika","Fungsi kuadrat","medium",function(rng){
  var a=pick(rng,[1,2]), h=ri(rng,1,6), k=ri(rng,-8,8);
  var B=-2*a*h, C=a*h*h+k;
  var eq="y = "+coef(a,"x²",true).trimStart()+coef(B,"x")+coef(C,"");
  var ans="x = "+h+", minimum "+k;
  var pool=["x = "+h+", minimum "+k,"x = "+(-h)+", minimum "+k,"x = "+h+", minimum "+(-k),
    "x = "+h+", maksimum "+k,"x = "+(-h)+", maksimum "+(-k),"x = "+(h+1)+", minimum "+k];
  return mcQ("matematika","Fungsi kuadrat","Sumbu simetri dan nilai minimum fungsi "+eq+" adalah …",
    ans, ans, distractStr(rng,ans,pool),
    "Sumbu x = −("+B+")/(2×"+a+") = "+h+"; nilai minimum y("+h+") = "+k+".","medium");
}),
T("MTKV08","matematika","Deret aritmetika","medium",function(rng){
  var n=pick(rng,[8,10,12]), a=50*ri(rng,4,16), d=5*ri(rng,4,12);
  var ans=n/2*(2*a+(n-1)*d);
  return mcQ("matematika","Deret aritmetika",
    "Suku pertama "+fmt(a)+", beda "+d+". Jumlah "+n+" suku pertama adalah …",
    ans, fmt(ans), distract(rng,ans,[d*n,2*d]),
    "S"+n+" = "+n+"/2 × (2×"+fmt(a)+" + "+(n-1)+"×"+d+") = "+fmt(ans)+".","medium");
}),
T("MTKV09","matematika","Deret geometri tak hingga","medium",function(rng){
  var a=3*ri(rng,2,6), kk=ri(rng,2,4);
  var ans=a*kk/(kk-1);
  return mcQ("matematika","Deret geometri tak hingga",
    "Jumlah deret geometri tak hingga dengan suku pertama "+a+" dan rasio 1/"+kk+" adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,a]),
    "S = "+a+"/(1 − 1/"+kk+") = "+a+"/"+(kk-1)+"/"+kk+" = "+fmt(ans)+".","medium");
}),
T("MTKV10","matematika","Statistika","medium",function(rng){
  var n=ri(rng,5,7), M=ri(rng,5,9), vals=[], sum=0, guard=0;
  while(guard++<200){
    vals=[]; sum=0;
    for(var i=0;i<n-1;i++){ var v=ri(rng,3,12); vals.push(v); sum+=v; }
    var last=n*M-sum;
    if(last>=1&&last<=15){ vals.push(last); break; }
  }
  vals=shuf(rng,vals);
  return mcQ("matematika","Statistika","Rata-rata dari data "+vals.join(", ")+" adalah …",
    M, fmt(M), distract(rng,M,[1,2]), "Jumlah = "+(n*M)+" dari "+n+" data → "+(n*M)+"/"+n+" = "+M+".","medium");
}),
T("MTKV11","matematika","Peluang dadu","medium",function(rng){
  var s=ri(rng,5,11), ans=DICE[s][0];
  var pool=["1/9","5/36","1/6","1/12","1/18","1/4","5/18"];
  var cnt={5:4,6:5,7:6,8:5,9:4,10:3,11:2}[s];
  return mcQ("matematika","Peluang dadu","Dua dadu dilambungkan. Peluang muncul jumlah mata dadu "+s+" adalah …",
    ans, ans, distractStr(rng,ans,pool),
    "Ada "+cnt+" pasangan berjumlah "+s+" dari 36 kemungkinan → "+ans+".","medium");
}),
T("MTKV12","matematika","Eksponen","medium",function(rng){
  var b=pick(rng,[2,3]), p=ri(rng,1,4), e=ri(rng,2,4), s=p+e;
  var q=ri(rng,1,s-1), r=s-q, ans=Math.pow(b,e);
  return mcQ("matematika","Eksponen","Nilai dari ("+b+"^"+q+" × "+b+"^"+r+") : "+b+"^"+p+" adalah …",
    ans, fmt(ans), distract(rng,ans,[1,b]),
    "= "+b+"^("+(q+r)+"−"+p+") = "+b+"^"+e+" = "+fmt(ans)+".","medium");
}),
T("MTKV13","matematika","Logaritma","medium",function(rng){
  var b=pick(rng,[2,3,5,10]), k=b===10?ri(rng,2,3):ri(rng,2,4);
  var x=Math.pow(b,k);
  return mcQ("matematika","Logaritma","Nilai dari "+(b===10?"log":b+"log")+" "+fmt(x)+" adalah …",
    k, fmt(k), distract(rng,k,[1]), fmt(x)+" = "+b+"^"+k+" sehingga hasilnya "+k+".","medium");
}),
T("MTKV14","matematika","Vektor","medium",function(rng){
  var t=pick(rng,TRIPLES), m=ri(rng,1,t.s);
  var vx=m*t.x, vy=m*t.y, ans=m*t.c;
  return mcQ("matematika","Vektor","Panjang vektor ("+vx+", "+vy+") adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,m]),
    "√("+vx+"² + "+vy+"²) = √"+(vx*vx+vy*vy)+" = "+fmt(ans)+".","medium");
}),
T("MTKV15","matematika","Trigonometri","medium",function(rng){
  var t=pick(rng,TRIG), useSin=rng()<0.5;
  var ans=useSin?t.s:t.c, q="Nilai "+(useSin?"sin":"cos")+" "+t.a+"° adalah …";
  var pool=["0","1","−1","1/2","−1/2","√2/2","−√2/2","√3/2","−√3/2"];
  return mcQ("matematika","Trigonometri",q, ans, ans, distractStr(rng,ans,pool),
    (useSin?"sin ":"cos ")+t.a+"° = "+ans+" (sudut istimewa).","medium");
}),
T("MTKV16","matematika","Lingkaran","medium",function(rng){
  // h,k tak nol agar varian tanda pusat selalu berbeda
  var NZ=[-5,-4,-3,-2,-1,1,2,3,4,5];
  var h=pick(rng,NZ), k=pick(rng,NZ), r=ri(rng,3,9), c0=h*h+k*k-r*r, guard=0;
  while(c0===0&&guard++<20){ r=ri(rng,3,9); c0=h*h+k*k-r*r; }
  var eq="x² + y²"+coef(-2*h,"x")+coef(2*k,"y")+coef(c0,"")+" = 0";
  var ans="("+h+", "+k+") dan r = "+r;
  var pool=["("+h+", "+k+") dan r = "+r,"("+(-h)+", "+k+") dan r = "+r,
    "("+h+", "+(-k)+") dan r = "+r,"("+(-h)+", "+(-k)+") dan r = "+r,
    "("+h+", "+k+") dan r = "+(r+1),"("+h+", "+k+") dan r = "+(r-1)];
  return mcQ("matematika","Lingkaran","Pusat dan jari-jari lingkaran "+eq+" adalah …",
    ans, ans, distractStr(rng,ans,pool),
    "Pusat ("+h+", "+k+"); r = √("+(h*h)+"+"+(k*k)+"+("+c0+")) = "+r+".","medium");
}),
T("MTKV17","matematika","Matriks","medium",function(rng){
  var a=ri(rng,1,9), b=ri(rng,1,9), c=ri(rng,1,9), d=ri(rng,1,9), ans=a*d-b*c, guard=0;
  while(ans===0&&guard++<20){ a=ri(rng,1,9); d=ri(rng,1,9); ans=a*d-b*c; }
  return mcQ("matematika","Matriks","Determinan matriks [["+a+", "+b+"], ["+c+", "+d+"]] adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,3]),
    fmt(a)+"×"+fmt(d)+" − "+fmt(b)+"×"+fmt(c)+" = "+fmt(ans)+".","medium");
}),
T("MTKV18","matematika","Limit fungsi","medium",function(rng){
  var a=ri(rng,2,9), ans=2*a;
  return mcQ("matematika","Limit fungsi","Nilai lim x→"+a+" dari (x² − "+(a*a)+")/(x − "+a+") adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2]),
    "Faktorkan: (x−"+a+")(x+"+a+")/(x−"+a+") = x+"+a+" → "+fmt(ans)+".","medium");
}),
T("MTKV19","matematika","Turunan fungsi","hard",function(rng){
  var a=ri(rng,1,3), b=ri(rng,-4,4), c=ri(rng,-6,6), d=ri(rng,-5,5), t=ri(rng,-2,3);
  var fx="f(x) = "+coef(a,"x³",true).trimStart()+coef(b,"x²")+coef(c,"x")+coef(d,"");
  var ans=3*a*t*t+2*b*t+c;
  return mcQ("matematika","Turunan fungsi","Diketahui "+fx+". Nilai f′("+t+") adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,3]),
    "f′(x) = "+(3*a)+"x²"+coef(2*b,"x")+coef(c,"")+" → f′("+t+") = "+fmt(ans)+".","hard");
}),
T("MTKV20","matematika","Integral","medium",function(rng){
  var a=pick(rng,[2,4]), b=ri(rng,1,9), t=ri(rng,1,4);
  var ans=a*t*t/2+b*t;
  return mcQ("matematika","Integral","Nilai ∫₀^"+t+" ("+a+"x + "+b+") dx adalah …",
    ans, fmt(ans), distract(rng,ans,[1,2,t]),
    "["+a+"/2·x² + "+b+"x]₀^"+t+" = "+fmt(ans)+".","medium");
}),
T("MTKV21","matematika","Busur lingkaran","easy",function(rng){
  var m=ri(rng,1,4), r=7*m, ang=pick(rng,[90,180,270]);
  var ans=ang*11*m/90;
  return mcQ("matematika","Busur lingkaran",
    "Lingkaran berjari-jari "+r+" cm dengan sudut pusat "+ang+"° (π = 22/7). Panjang busurnya adalah …",
    ans, fmt(ans)+" cm", distract(rng,ans,[11*m]).map(function(w){return {v:w.v,t:w.t+" cm"};}),
    "Busur = "+ang+"/360 × 2 × 22/7 × "+r+" = "+fmt(ans)+" cm.","easy");
}),
T("MTKV22","matematika","Permutasi","medium",function(rng){
  var k=ri(rng,2,3), n=ri(rng,Math.max(4,k+1),7), ans=1;
  for(var i=0;i<k;i++) ans*=n-i;
  return mcQ("matematika","Permutasi","Banyak susunan "+k+" objek berbeda dari "+n+" objek yang tersedia adalah …",
    ans, fmt(ans), distract(rng,ans,[n,k]),
    "P("+n+","+k+") = "+n+"×"+(n-1)+(k>2?"×"+(n-2):"")+" = "+fmt(ans)+".","medium");
}),
T("MTKV23","matematika","Kombinasi","medium",function(rng){
  var k=pick(rng,[2,3]), n=k===2?ri(rng,5,9):pick(rng,[6,7,8,9]), ans=1, guard=0;
  if(k===2) ans=n*(n-1)/2;
  else { ans=n*(n-1)*(n-2)/6; }
  return mcQ("matematika","Kombinasi","Dari "+n+" orang akan dipilih "+k+" secara acak. Banyak cara memilih adalah …",
    ans, fmt(ans), distract(rng,ans,[n,k]),
    "C("+n+","+k+") = "+fmt(ans)+".","medium");
}),
/* ===== PKWU (angka usaha selalu diacak) ===== */
T("PKWUV01","pkwu","HPP","easy",function(rng){
  var q=pick(rng,[20,25,40,50,100]), u=500*ri(rng,4,30), p=100*ri(rng,1,10);
  var ans=u+p, total=q*ans;
  return mcQ("pkwu","HPP","Biaya produksi "+q+" pcs sebesar Rp"+fmt(total)+". HPP per pcs adalah …",
    ans, "Rp"+fmt(ans), distract(rng,ans,[100,500]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    fmt(total)+" : "+q+" = Rp"+fmt(ans)+".","easy");
}),
T("PKWUV02","pkwu","Keuntungan","easy",function(rng){
  var h=1000*ri(rng,5,20), laba=1000*ri(rng,1,8), j=h+laba;
  return mcQ("pkwu","Keuntungan","HPP sebuah produk Rp"+fmt(h)+", dijual Rp"+fmt(j)+". Keuntungan per unit adalah …",
    laba, "Rp"+fmt(laba), distract(rng,laba,[500,1000]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    fmt(j)+" − "+fmt(h)+" = Rp"+fmt(laba)+".","easy");
}),
T("PKWUV03","pkwu","Diskon","easy",function(rng){
  var price=10000*ri(rng,5,30), d=pick(rng,[10,20,25,50]);
  var ans=price*(100-d)/100;
  return mcQ("pkwu","Diskon","Toko memberi diskon "+d+"% untuk barang Rp"+fmt(price)+". Harga bayar adalah …",
    ans, "Rp"+fmt(ans), distract(rng,ans,[price*d/100]).map(function(w){return {v:w.v,t:"Rp"+w.t};}),
    "Diskon Rp"+fmt(price*d/100)+" → bayar Rp"+fmt(ans)+".","easy");
}),
T("PKWUV04","pkwu","BEP","medium",function(rng){
  var m=5000*ri(rng,1,6), u=ri(rng,50,300), f=m*u;
  var v=10000*ri(rng,2,10), price=v+m;
  return mcQ("pkwu","BEP","Biaya tetap Rp"+fmt(f)+". Harga jual Rp"+fmt(price)+"/unit, biaya variabel Rp"+fmt(v)+"/unit. Titik impas (BEP) tercapai pada …",
    u, fmt(u)+" unit", distract(rng,u,[10,50]).map(function(w){return {v:w.v,t:fmt(w.v)+" unit"};}),
    "Kontribusi Rp"+fmt(m)+"/unit → "+fmt(f)+" : "+fmt(m)+" = "+u+" unit.","medium");
}),
/* ===== PRODUKTIF (angka/logika selalu diacak) ===== */
T("RPLV01","produktif","Bilangan biner","easy",function(rng){
  var n=ri(rng,5,8), val=Math.pow(2,n-1)+ri(rng,0,Math.pow(2,n-1)-1);
  var bin=val.toString(2);
  return mcQ("produktif","Bilangan biner","Bilangan biner "+bin+" sama dengan desimal …",
    val, fmt(val), distract(rng,val,[1,2]),
    bin+" = "+val+" desimal.","easy");
}),
T("RPLV02","produktif","Perulangan","medium",function(rng){
  var n=ri(rng,10,30), s=ri(rng,2,5), ans=Math.ceil(n/s);
  return mcQ("produktif","Perulangan","Perulangan for (i = 0; i < "+n+"; i += "+s+") berjalan sebanyak …",
    ans, ans+" kali", distract(rng,ans,[1]).map(function(w){return {v:w.v,t:w.t+" kali"};}),
    "i = 0, "+s+", … < "+n+" → "+ans+" iterasi.","medium");
}),
T("RPLV03","produktif","Array","easy",function(rng){
  var len=ri(rng,6,8), arr=[], i, guard=0;
  while(arr.length<len&&guard++<300){ var v=ri(rng,10,99); if(arr.indexOf(v)===-1) arr.push(v); }
  var k=ri(rng,0,len-1), ans=arr[k];
  var pool=arr.filter(function(v){return v!==ans;});
  return mcQ("produktif","Array","Diketahui arr = ["+arr.join(", ")+"]. Nilai arr["+k+"] adalah …",
    ans, fmt(ans), distractStr(rng,fmt(ans),pool.map(fmt)),
    "Indeks dimulai dari 0, jadi arr["+k+"] = "+ans+".","easy");
})
];

var DYNAMIC_CAP = { matematika:12, pkwu:6, produktif:5, bindo:5, binggris:6 };
window.DYNAMIC_CAP = DYNAMIC_CAP;
window.DYNAMIC_TPL = TPL;
// Helper bersama agar file template lain (dynamic2.js) konsisten
window.DynH = { rngFn:rngFn, ri:ri, pick:pick, shuf:shuf, fmt:fmt, nonce:nonce,
  gcd:gcd, distract:distract, distractStr:distractStr, mcQ:mcQ, coef:coef, T:T };
window.dynamicCap = function(subject){ return window.DYNAMIC_CAP[subject]||0; };
window.instantiateDynamics = function(subject, n){
  var rng = rngFn();
  var allTpl = window.DYNAMIC_TPL || TPL;
  var pool = allTpl.filter(function(t){ return t.subject===subject; });
  // Rotasi anti-ulang: utamakan template yang belum dipakai sesi-sesi terakhir
  var used = [], usedSet = {};
  try{ used = (window.TKAStore && window.TKAStore.getUsedDyn(subject)) || []; }catch(e){}
  used.forEach(function(id){ usedSet[id]=1; });
  var fresh = pool.filter(function(t){ return !usedSet[t.id]; });
  var src = fresh.length>=Math.min(n,pool.length) ? fresh : pool.slice();
  if(fresh.length>0 && fresh.length<pool.length && fresh.length<n){
    // campur agar tetap bervariasi bila fresh kurang
    var rest = shuf(rng, pool.filter(function(t){ return usedSet[t.id]; }));
    src = fresh.concat(rest);
  }
  return shuf(rng, src).slice(0, Math.max(0,Math.min(n, pool.length))).map(function(t){
    var q = t.make(rngFn());
    q.id = t.id + "@" + nonce(rng);
    q.difficulty = t.difficulty;
    q.subject = subject;
    q.tplId = t.id;
    return q;
  });
};
})();
