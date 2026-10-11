/* storageManager — LocalStorage, pisahkan bank soal & hasil simulasi */
(function(){
  var LS = {
    BANK_PREFIX: "tka_bank_",
    CUSTOM_BANK: "tka_bank_custom",
    HISTORY: "tka_history",
    USED: "tka_used_pool",
    ACTIVE: "tka_active_session",
    SETTINGS: "tka_settings"
  };
  function read(key, fallback){
    try{
      var v = localStorage.getItem(key);
      if(v==null) return fallback;
      return JSON.parse(v);
    }catch(e){ return fallback; }
  }
  function write(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }
  // Bank default dari file data-*.js
  function defaultBanks(){
    return {
      matematika: window.BANK_MATEMATIKA || [],
      bindo: window.BANK_BINDO || [],
      binggris: window.BANK_BINGGRIS || [],
      produktif: window.BANK_PRODUKTIF || [],
      pkwu: window.BANK_PKWU || []
    };
  }
  function getCustom(){ return read(LS.CUSTOM_BANK, []); }
  function saveCustom(arr){ write(LS.CUSTOM_BANK, arr); }

  // Gabungan default + custom + edit/delete overlay
  // Deleted ids: stored in settings? Simpler: custom bank holds added; overrides & deletions in separate keys
  var OVER = "tka_overrides", DEL = "tka_deleted";
  function getOverrides(){ return read(OVER, {}); }
  function getDeleted(){ return read(DEL, []); }

  function getBank(subject){
    var defs = defaultBanks()[subject] || [];
    var custom = getCustom().filter(function(q){return q.subject===subject});
    var ov = getOverrides();
    var del = getDeleted();
    var merged = defs.map(function(q){ return ov[q.id] ? Object.assign({}, q, ov[q.id]) : q; })
      .filter(function(q){ return del.indexOf(q.id)===-1; });
    custom.forEach(function(q){
      if(del.indexOf(q.id)!==-1) return;
      if(ov[q.id]) q = Object.assign({}, q, ov[q.id]);
      merged.push(q);
    });
    return merged;
  }
  function getAllBank(){
    var out = [];
    window.TKA_CONFIG.subjects.forEach(function(s){ out = out.concat(getBank(s.id)); });
    return out;
  }
  function addQuestion(q){
    var c = getCustom();
    // cegah duplikat id
    var all = getAllBank();
    if(all.some(function(x){return x.id===q.id})) {
      q.id = q.id + "_" + Date.now().toString(36);
    }
    c.push(q); saveCustom(c); return q;
  }
  function addMany(arr){
    var c = getCustom();
    arr.forEach(function(q){ c.push(q); });
    saveCustom(c);
  }
  function updateQuestion(id, patch){
    var ov = getOverrides(); ov[id] = Object.assign({}, ov[id]||{}, patch);
    write(OVER, ov);
  }
  function deleteQuestion(id){
    var del = getDeleted(); if(del.indexOf(id)===-1) del.push(id);
    write(DEL, del);
    // juga hapus dari custom jika ada
    var c = getCustom().filter(function(q){return q.id!==id});
    saveCustom(c);
  }
  function resetAllCustom(){
    localStorage.removeItem(LS.CUSTOM_BANK); localStorage.removeItem(OVER); localStorage.removeItem(DEL);
  }

  function getHistory(){ return read(LS.HISTORY, []); }
  function pushHistory(h){ var a=getHistory(); a.unshift(h); write(LS.HISTORY, a); }
  function clearHistory(){ write(LS.HISTORY, []); }
  function deleteHistory(id){ write(LS.HISTORY, getHistory().filter(function(h){return h.id!==id})); }

  function getUsed(){ return read(LS.USED, {}); }
  function markUsed(subject, ids){
    var u = getUsed(); u[subject] = (u[subject]||[]).concat(ids);
    // batasi 500 terakhir
    if(u[subject].length>500) u[subject]=u[subject].slice(-500);
    write(LS.USED, u);
  }
  function resetUsed(subject){
    var u=getUsed(); if(subject){delete u[subject];} else {u={};}
    write(LS.USED,u);
  }

  // Template dinamis yang sudah dipakai sesi-sesi terakhir (rotasi anti-ulang)
  var DYN = "tka_used_dyn";
  function getUsedDyn(subject){
    var u = read(DYN, {});
    return subject ? (u[subject]||[]) : u;
  }
  function markUsedDyn(subject, tplIds){
    var u = read(DYN, {});
    u[subject] = (u[subject]||[]).concat(tplIds);
    if(u[subject].length>40) u[subject]=u[subject].slice(-40);
    write(DYN, u);
  }
  function resetUsedDyn(subject){
    var u = read(DYN, {});
    if(subject){ delete u[subject]; } else { u={}; }
    write(DYN, u);
  }

  function getActive(){ return read(LS.ACTIVE, null); }
  function setActive(s){ if(s) write(LS.ACTIVE,s); else localStorage.removeItem(LS.ACTIVE); }

  function getSettings(){
    var stored = read(LS.SETTINGS, {});
    var out = Object.assign({timeOverrides:{}, lastMode:null}, stored);
    // Migrasi: timeMap lama (per jumlah soal) -> override mode normal
    if(stored.timeMap && (!out.timeOverrides || !Object.keys(out.timeOverrides).length)){
      out.timeOverrides = {};
      Object.keys(stored.timeMap).forEach(function(k){
        out.timeOverrides[k+"|normal"] = stored.timeMap[k];
      });
    }
    if(!out.timeOverrides) out.timeOverrides={};
    return out;
  }
  function saveSettings(s){ write(LS.SETTINGS, s); }

  window.TKAStore = {
    getBank:getBank, getAllBank:getAllBank, addQuestion:addQuestion, addMany:addMany,
    updateQuestion:updateQuestion, deleteQuestion:deleteQuestion, resetAllCustom:resetAllCustom,
    getCustom:getCustom,
    getHistory:getHistory, pushHistory:pushHistory, clearHistory:clearHistory, deleteHistory:deleteHistory,
    getUsed:getUsed, markUsed:markUsed, resetUsed:resetUsed,
    getUsedDyn:getUsedDyn, markUsedDyn:markUsedDyn, resetUsedDyn:resetUsedDyn,
    getActive:getActive, setActive:setActive,
    getSettings:getSettings, saveSettings:saveSettings
  };
})();
