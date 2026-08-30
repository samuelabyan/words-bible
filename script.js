(function(){
"use strict";

/* ============================= CONSTANTS ============================= */
var THEME_KEY   = "wordsforge_theme";
var LANG_KEY    = "wordsforge_lang";
var DEFAULT_LANG = "en";
function progressKey(lang){ return "wordsforge_progress_" + lang; }

var RANKS_P = [0, 0.02, 0.08, 0.18, 0.30, 0.45, 0.65, 1.00];

var FALLBACK_LEVELS = { levels: [
  { number:1, letters:["A","B","C","D","E","F","G"], words:["BAD","BED","CAB","DECAF","FACE","FADE","CAGE"], mandatoryLetter:null }
]};

/* ============================= STATE ============================= */
var ALL_DATA = null;
var currentLang = DEFAULT_LANG;
var levelsData = null;
var progress = null;
var viewingIndex = 0;
var currentBuffer = "";
var currentRingOrder = [];
var drawerOpen = false;

/* ============================= I18N ============================= */
function menu(){
  return (ALL_DATA && ALL_DATA[currentLang] && ALL_DATA[currentLang].menu) || {};
}
function t(key, vars){
  var m = menu();
  var str = m[key];
  if (str === undefined) return key;
  if (vars){
    Object.keys(vars).forEach(function(k){
      str = str.replace("{" + k + "}", vars[k]);
    });
  }
  return str;
}
function rankNameFor(scoreFraction){
  var names = menu().rankNames || [];
  var idx = 0;
  for (var i=0;i<RANKS_P.length;i++){
    if (scoreFraction >= RANKS_P[i]) idx = i;
  }
  return names[idx] || "";
}

/* ============================= DATA LOADING ============================= */
function loadAllData(){
  return fetch("levels.json").then(function(r){
    if (!r.ok) throw new Error("Failed to load levels.json");
    return r.json();
  });
}

function isLetterChar(ch){
  return /\p{L}/u.test(ch);
}

/* Converts the compact per-line level format:
   [number, "LETTERS", "MANDATORY_OR_EMPTY", "WORD1,WORD2,..."]
   into { number, letters:[...], words:[...], mandatoryLetter } and
   skips/repairs anything malformed so a hand-typo doesn't crash the app. */
function normalizeLevels(rawLevels){
  var out = [];
  if (!Array.isArray(rawLevels)) return out;
  rawLevels.forEach(function(row, i){
    var tag = "levels.json entry " + (i+1) + ": ";
    if (!Array.isArray(row) || row.length < 4){
      console.warn(tag + "expected [number, letters, mandatory, words] - skipped.");
      return;
    }
    var number = row[0];
    var lettersRaw = String(row[1] || "").toUpperCase();
    var mandRaw = String(row[2] || "").toUpperCase();
    var wordsRaw = String(row[3] || "");

    var letters = Array.from(new Set(Array.from(lettersRaw).filter(isLetterChar)));
    if (letters.length < 3){
      console.warn(tag + "needs at least 3 letters - skipped.");
      return;
    }
    var letterSet = {};
    letters.forEach(function(l){ letterSet[l] = true; });

    var words = Array.from(new Set(
      wordsRaw.split(",").map(function(w){ return w.trim().toUpperCase(); }).filter(function(w){ return w.length > 0; })
    )).filter(function(w){
      if (w.length < 3) { console.warn(tag + "word \"" + w + "\" is too short - dropped."); return false; }
      var chars = Array.from(w);
      for (var c=0;c<chars.length;c++){
        if (!letterSet[chars[c]]){
          console.warn(tag + "word \"" + w + "\" uses a letter outside this level's set - dropped.");
          return false;
        }
      }
      return true;
    });
    if (!words.length){
      console.warn(tag + "no valid words remain - skipped.");
      return;
    }

    var mandatoryLetter = null;
    if (mandRaw && letterSet[mandRaw]) mandatoryLetter = mandRaw;

    out.push({ number: number, letters: letters, words: words, mandatoryLetter: mandatoryLetter });
  });
  return out;
}

/* ============================= STORAGE ============================= */
function loadTheme(){
  return localStorage.getItem(THEME_KEY) || "light";
}
function saveTheme(theme){
  localStorage.setItem(THEME_KEY, theme);
}
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  saveTheme(theme);
  document.querySelectorAll(".seg-btn[data-theme-choice]").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-theme-choice") === theme);
  });
}
function loadLang(){
  var saved = localStorage.getItem(LANG_KEY);
  if (saved && ALL_DATA[saved]) return saved;
  return ALL_DATA[DEFAULT_LANG] ? DEFAULT_LANG : Object.keys(ALL_DATA)[0];
}
function saveLang(lang){
  localStorage.setItem(LANG_KEY, lang);
}
function loadProgress(lang){
  var raw = localStorage.getItem(progressKey(lang));
  if (raw){
    try{
      var parsed = JSON.parse(raw);
      if (!parsed.stats) parsed.stats = {wordsFound:0,longestWord:"",levelsCompleted:0,hintsUsed:0};
      return parsed;
    }catch(e){}
  }
  return { currentLevelIndex:0, totalScore:0, levelData:{}, stats:{wordsFound:0,longestWord:"",levelsCompleted:0,hintsUsed:0} };
}
function saveProgress(){
  localStorage.setItem(progressKey(currentLang), JSON.stringify(progress));
}

/* ============================= SCORING ============================= */
function wordScore(word, letters){
  var len = Array.from(word).length;
  var base = len === 3 ? 1 : len;
  var uniqueUsed = new Set(Array.from(word));
  var isPangram = letters.every(function(l){ return uniqueUsed.has(l); });
  return isPangram ? base + letters.length : base;
}
function isPangramWord(word, letters){
  var uniqueUsed = new Set(Array.from(word));
  return letters.every(function(l){ return uniqueUsed.has(l); });
}
function levelMaxScore(level){
  var max = 0;
  level.words.forEach(function(w){ max += wordScore(w, level.letters); });
  return max;
}

/* ============================= PROGRESS HELPERS ============================= */
function getLevelProgress(index){
  if (!progress.levelData[index]){
    progress.levelData[index] = { found:[], score:0, completed:false };
  }
  return progress.levelData[index];
}

/* ============================= LANGUAGE / THEME SWITCHING ============================= */
function setLanguage(lang){
  if (!ALL_DATA[lang]) return;
  currentLang = lang;
  saveLang(lang);
  levelsData = { levels: normalizeLevels(ALL_DATA[lang].levels) };
  if (!levelsData.levels.length) levelsData = FALLBACK_LEVELS;
  progress = loadProgress(lang);
  viewingIndex = Math.min(Math.max(progress.currentLevelIndex, 0), levelsData.levels.length-1);
  currentRingOrder = [];
  clearBuffer();
  translateStaticUI();
  document.querySelectorAll(".seg-btn[data-lang-choice]").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-lang-choice") === lang);
  });
  renderLevelList();
  render();
}

function translateStaticUI(){
  document.title = t("appName") + " - Bible Edition";
  document.getElementById("btnDelete").textContent = "\u232B " + t("btnDelete");
  document.getElementById("btnShuffle").textContent = "\u21BB " + t("btnShuffle");
  document.getElementById("btnEnter").textContent = t("btnEnter");
  document.getElementById("btnHint").textContent = "\u2605 " + t("btnHint");
  document.getElementById("btnReveal").textContent = "\uD83D\uDC41 " + t("btnReveal");
  document.getElementById("levelLabelText").textContent = t("levelLabel");
  document.getElementById("mapTitleText").textContent = t("mapTitle");
  document.getElementById("mapHintText").textContent = t("mapHint");
  document.getElementById("settingsTitleText").textContent = t("settingsTitle");
  document.getElementById("tabGeneral").textContent = t("tabGeneral");
  document.getElementById("tabLevels").textContent = t("tabLevels");
  document.getElementById("tabData").textContent = t("tabData");
  document.getElementById("languageLabelText").textContent = t("languageLabel");
  document.getElementById("themeLabelText").textContent = t("themeLabel");
  document.getElementById("dataProgressLabelText").textContent = t("dataProgressLabel");
  document.getElementById("statTotalScoreLabel").textContent = t("statTotalScore");
  document.getElementById("statLevelsDoneLabel").textContent = t("statLevelsDone");
  document.getElementById("statWordsFoundLabel").textContent = t("statWordsFoundTotal");
  document.getElementById("statLongestLabel").textContent = t("statLongestWordTotal");
  document.getElementById("btnExportProgress").textContent = t("btnExportProgress");
  document.getElementById("btnImportProgressBtn").textContent = t("btnImportProgress");
  document.getElementById("btnResetProgress").textContent = t("btnResetProgress");
  document.getElementById("completeTitleText").textContent = t("completeTitle");
  document.getElementById("statLevelScoreLabel").textContent = t("statLevelScore");
  document.getElementById("statWordsLabel").textContent = t("statWordsFound");
  document.getElementById("statLongestLabel2").textContent = t("statLongestWord");
  document.getElementById("statRankLabel").textContent = t("statRank");
  document.getElementById("btnNextLevel").textContent = t("btnNextLevel");
  document.getElementById("btnStayLevel").textContent = t("btnStayLevel");

  var themeSeg = document.getElementById("themeSegWrap");
  themeSeg.innerHTML =
    '<button class="seg-btn" data-theme-choice="light">' + t("themeLight") + '</button>' +
    '<button class="seg-btn" data-theme-choice="dark">' + t("themeDark") + '</button>';
  themeSeg.querySelectorAll(".seg-btn").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-theme-choice") === loadTheme());
    b.addEventListener("click", function(){ applyTheme(b.getAttribute("data-theme-choice")); });
  });

  var langSeg = document.getElementById("langSegWrap");
  langSeg.innerHTML = Object.keys(ALL_DATA).filter(function(k){ return k.charAt(0) !== "_"; }).map(function(code){
    return '<button class="seg-btn" data-lang-choice="' + code + '">' + ALL_DATA[code].name + '</button>';
  }).join("");
  langSeg.querySelectorAll(".seg-btn").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-lang-choice") === currentLang);
    b.addEventListener("click", function(){ setLanguage(b.getAttribute("data-lang-choice")); });
  });
}

/* ============================= RENDER: HEADER / PROGRESS ============================= */
function render(){
  var level = levelsData.levels[viewingIndex];
  if (!level) return;
  var lp = getLevelProgress(viewingIndex);
  var isHard = !!level.mandatoryLetter;

  document.getElementById("levelNum").textContent = level.number !== undefined ? level.number : (viewingIndex+1);
  document.getElementById("hardPillWrap").innerHTML = isHard
    ? '<span class="hard-pill">\u26A1 ' + t("mandatoryPill", {letter: level.mandatoryLetter}) + '</span>' : '';

  var total = level.words.length;
  var found = lp.found.length;
  document.getElementById("progressText").textContent = t("progressWords", {found: found, total: total});
  document.getElementById("scoreText").textContent = lp.score + " " + t("ptsSuffix");
  var pct = total ? Math.round((found/total)*100) : 0;
  var fillEl = document.getElementById("progressFill");
  fillEl.style.width = pct + "%";
  fillEl.className = "progress-fill" + (isHard ? " hard" : "");

  var maxScore = levelMaxScore(level);
  var frac = maxScore ? lp.score / maxScore : 0;
  document.getElementById("rankTag").innerHTML = maxScore ? t("rankPrefix") + "<b>" + rankNameFor(frac) + "</b>" : "";

  document.getElementById("ringWrap").className = "ring-wrap" + (isHard ? " hard" : "");

  renderTiles(level);
  renderBuffer(level);
  renderFoundList(level, lp);

  var allFound = found >= total;
  document.getElementById("btnHint").disabled = allFound;
  document.getElementById("btnReveal").disabled = allFound;
}

/* ============================= RING / TILES ============================= */
function buildRingOrder(level, keepOrder){
  var nonMand = level.letters.filter(function(l){ return l !== level.mandatoryLetter; });
  if (!keepOrder){
    nonMand = shuffleArr(nonMand.slice());
  }
  return nonMand;
}
function shuffleArr(arr){
  for (var i=arr.length-1;i>0;i--){
    var j = Math.floor(Math.random()*(i+1));
    var tmp = arr[i]; arr[i]=arr[j]; arr[j]=tmp;
  }
  return arr;
}
function renderTiles(level, animateShuffle){
  var container = document.getElementById("tiles");
  var isHard = !!level.mandatoryLetter;
  var ring = currentRingOrder.length ? currentRingOrder : buildRingOrder(level, false);
  currentRingOrder = ring;

  var html = "";
  var n = ring.length;
  var R = 34;

  if (isHard){
    html += '<div class="tile mandatory" data-letter="'+level.mandatoryLetter+'" style="left:50%;top:50%;">' +
            '<span class="mand-badge">MUST USE</span>' + level.mandatoryLetter + '</div>';
  }
  ring.forEach(function(letter, i){
    var angle = (360/n)*i - 90;
    var rad = angle * Math.PI/180;
    var x = 50 + R*Math.cos(rad);
    var y = 50 + R*Math.sin(rad);
    html += '<div class="tile'+(animateShuffle?' shuffling':'')+'" data-letter="'+letter+'" style="left:'+x+'%;top:'+y+'%;">'+letter+'</div>';
  });
  container.innerHTML = html;

  var tiles = container.querySelectorAll(".tile");
  tiles.forEach(function(tl){
    tl.addEventListener("click", function(){
      pressTile(tl);
    });
  });
}
function pressTile(el){
  el.classList.add("press");
  setTimeout(function(){ el.classList.remove("press"); }, 150);
  appendLetter(el.getAttribute("data-letter"));
}

/* ============================= WORD BUFFER ============================= */
function renderBuffer(level){
  var el = document.getElementById("wordBuffer");
  var mand = level.mandatoryLetter;
  var html = "";
  Array.from(currentBuffer).forEach(function(ch){
    html += '<span class="ch'+(ch===mand?' mand':'')+'">'+ch+'</span>';
  });
  html += '<span class="caret"></span>';
  el.innerHTML = html;
}
function appendLetter(letter){
  if (Array.from(currentBuffer).length >= 20) return;
  currentBuffer += letter;
  renderBuffer(levelsData.levels[viewingIndex]);
}
function backspace(){
  var chars = Array.from(currentBuffer);
  chars.pop();
  currentBuffer = chars.join("");
  renderBuffer(levelsData.levels[viewingIndex]);
}
function clearBuffer(){
  currentBuffer = "";
  var level = levelsData.levels[viewingIndex];
  if (level) renderBuffer(level);
}

/* ============================= SUBMIT LOGIC ============================= */
function submitWord(){
  var level = levelsData.levels[viewingIndex];
  if (!level) return;
  var word = currentBuffer.toUpperCase();
  var bufferEl = document.getElementById("wordBuffer");

  if (Array.from(word).length < 3){
    showToast(t("toastTooShort"), "bad");
    triggerShake(bufferEl);
    clearBuffer();
    return;
  }
  if (level.mandatoryLetter && word.indexOf(level.mandatoryLetter) === -1){
    showToast(t("toastNeedsLetter", {letter: level.mandatoryLetter}), "mand");
    triggerShake(bufferEl);
    clearBuffer();
    return;
  }
  var lp = getLevelProgress(viewingIndex);
  if (lp.found.indexOf(word) !== -1){
    showToast(t("toastAlreadyFound"), "bad");
    triggerShake(bufferEl);
    clearBuffer();
    return;
  }
  if (level.words.indexOf(word) === -1){
    showToast(t("toastNotInList"), "bad");
    triggerShake(bufferEl);
    clearBuffer();
    return;
  }

  var pts = wordScore(word, level.letters);
  var pangram = isPangramWord(word, level.letters);
  lp.found.push(word);
  lp.score += pts;
  progress.totalScore += pts;
  progress.stats.wordsFound += 1;
  if (Array.from(word).length > Array.from(progress.stats.longestWord).length) progress.stats.longestWord = word;

  showToast(t(pangram ? "toastPangram" : "toastPlus", {pts: pts}), "ok");
  if (pangram) burstSparks();

  clearBuffer();
  finishIfComplete(level, lp, false);
}

function finishIfComplete(level, lp, revealed){
  if (lp.found.length === level.words.length && !lp.completed){
    lp.completed = true;
    progress.stats.levelsCompleted += 1;
    if (viewingIndex + 1 > progress.currentLevelIndex){
      progress.currentLevelIndex = viewingIndex + 1;
    }
    saveProgress();
    render();
    setTimeout(function(){ openLevelComplete(level, lp, revealed); }, revealed ? 150 : 550);
    return true;
  }
  saveProgress();
  render();
  return false;
}

function triggerShake(el){
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}
function showToast(msg, kind){
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + kind;
  void el.offsetWidth;
  el.classList.add("show");
  setTimeout(function(){ el.classList.remove("show"); }, 1200);
}
function burstSparks(){
  var wrap = document.getElementById("ringWrap");
  for (var i=0;i<14;i++){
    var s = document.createElement("div");
    s.className = "spark";
    var ang = Math.random()*Math.PI*2;
    var dist = 60 + Math.random()*60;
    s.style.setProperty("--fly", "translate("+Math.cos(ang)*dist+"px,"+Math.sin(ang)*dist+"px)");
    s.style.left = "50%"; s.style.top = "50%";
    s.style.background = Math.random() > .5 ? "var(--gold)" : "var(--mint)";
    wrap.appendChild(s);
    (function(node){ setTimeout(function(){ node.remove(); }, 750); })(s);
  }
}

/* ============================= REVEAL ALL ============================= */
function revealAll(){
  var level = levelsData.levels[viewingIndex];
  if (!level) return;
  var lp = getLevelProgress(viewingIndex);
  if (lp.found.length >= level.words.length) return;
  if (!confirm(t("revealConfirm"))) return;

  level.words.forEach(function(w){
    if (lp.found.indexOf(w) === -1){
      lp.found.push(w);
      if (Array.from(w).length > Array.from(progress.stats.longestWord).length) progress.stats.longestWord = w;
    }
  });
  showToast(t("toastRevealed"), "mand");
  clearBuffer();
  finishIfComplete(level, lp, true);
}

/* ============================= FOUND LIST / DRAWER ============================= */
function renderFoundList(level, lp){
  document.getElementById("drawerLabel").textContent = t("foundWordsLabel", {count: lp.found.length});
  var list = document.getElementById("foundList");
  if (!lp.found.length){
    list.innerHTML = '<div class="empty-note">' + t("emptyNote") + '</div>';
    return;
  }
  var sorted = lp.found.slice().sort(function(a,b){ return Array.from(a).length-Array.from(b).length || a.localeCompare(b); });
  list.innerHTML = sorted.map(function(w){
    var pg = isPangramWord(w, level.letters);
    return '<span class="found-chip'+(pg?' pangram':'')+'">'+w+'</span>';
  }).join("");
}

/* ============================= HINT ============================= */
function useHint(){
  var level = levelsData.levels[viewingIndex];
  var lp = getLevelProgress(viewingIndex);
  var remaining = level.words.filter(function(w){ return lp.found.indexOf(w) === -1; });
  if (!remaining.length) return;
  var pick = remaining[Math.floor(Math.random()*remaining.length)];
  progress.stats.hintsUsed += 1;
  lp.score = Math.max(0, lp.score - 5);
  progress.totalScore = Math.max(0, progress.totalScore - 5);
  showToast(t("toastHint", {letter: Array.from(pick)[0], len: Array.from(pick).length}), "mand");
  saveProgress();
  render();
}

/* ============================= LEVEL COMPLETE MODAL ============================= */
function openLevelComplete(level, lp, revealed){
  var maxScore = levelMaxScore(level);
  var frac = maxScore ? lp.score/maxScore : 0;
  document.getElementById("completeLevelTitle").textContent = t("completeCleared", {num: level.number !== undefined ? level.number : (viewingIndex+1)});
  document.getElementById("completeScore").textContent = lp.score;
  document.getElementById("completeWords").textContent = lp.found.length;
  var longest = lp.found.slice().sort(function(a,b){return Array.from(b).length-Array.from(a).length;})[0] || "\u2014";
  document.getElementById("completeLongest").textContent = longest;
  document.getElementById("completeRank").textContent = rankNameFor(frac);
  var hasNext = !!levelsData.levels[viewingIndex+1];
  document.getElementById("btnNextLevel").style.display = hasNext ? "block" : "none";
  document.getElementById("completeSub").textContent = revealed ? t("completeSubRevealed") : (hasNext ? t("completeSubMore") : t("completeSubLast"));
  showOverlay("overlayComplete");
}

/* ============================= SHUFFLE ============================= */
function doShuffle(){
  var level = levelsData.levels[viewingIndex];
  currentRingOrder = buildRingOrder(level, false);
  renderTiles(level, true);
}

/* ============================= LEVEL NAVIGATION ============================= */
function goToLevel(index){
  if (index < 0 || index >= levelsData.levels.length) return;
  if (index > progress.currentLevelIndex) return;
  viewingIndex = index;
  currentRingOrder = [];
  clearBuffer();
  render();
}

/* ============================= LEVEL MAP MODAL ============================= */
function renderMap(){
  var grid = document.getElementById("mapGrid");
  var html = "";
  levelsData.levels.forEach(function(lvl, i){
    var locked = i > progress.currentLevelIndex;
    var lp = progress.levelData[i];
    var done = lp && lp.completed;
    var isCurrent = i === viewingIndex;
    var cls = "map-cell";
    if (done) cls += " done";
    if (isCurrent) cls += " current";
    if (locked) cls += " locked";
    if (lvl.mandatoryLetter) cls += " hard";
    html += '<div class="'+cls+'" data-idx="'+i+'">'+(lvl.number !== undefined ? lvl.number : (i+1))+'</div>';
  });
  grid.innerHTML = html;
  grid.querySelectorAll(".map-cell:not(.locked)").forEach(function(c){
    c.addEventListener("click", function(){
      goToLevel(parseInt(c.getAttribute("data-idx"),10));
      hideOverlay("overlayMap");
    });
  });
}

/* ============================= OVERLAYS ============================= */
function showOverlay(id){ document.getElementById(id).classList.add("show"); }
function hideOverlay(id){ document.getElementById(id).classList.remove("show"); }

/* ============================= SETTINGS: LEVEL LIST (read-only) ============================= */
function renderLevelList(){
  var list = document.getElementById("levelList");
  if (!levelsData) return;
  list.innerHTML = levelsData.levels.map(function(lvl, i){
    var num = lvl.number !== undefined ? lvl.number : (i+1);
    return '<div class="level-row">' +
      '<div class="info"><b>#'+num+'</b> \u00b7 ' + t("levelRowInfo", {letters: lvl.letters.length, words: lvl.words.length}) +
      (lvl.mandatoryLetter ? '<span class="badge-hard">' + t("badgeHard", {letter: lvl.mandatoryLetter}) + '</span>' : '') +
      '</div></div>';
  }).join("");
}

/* ============================= DATA TAB ============================= */
function renderDataStats(){
  document.getElementById("statTotalScore").textContent = progress.totalScore;
  document.getElementById("statLevelsDone").textContent = progress.stats.levelsCompleted;
  document.getElementById("statWordsFound").textContent = progress.stats.wordsFound;
  document.getElementById("statLongest").textContent = progress.stats.longestWord || "\u2014";
}
function downloadJSON(obj, filename){
  var blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function handleImportProgress(file){
  var fb = document.getElementById("dataFeedback");
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var parsed = JSON.parse(e.target.result);
      if (typeof parsed.currentLevelIndex !== "number" || typeof parsed.totalScore !== "number" || typeof parsed.levelData !== "object"){
        fb.innerHTML = '<div class="err-box">' + t("importErrorFormat") + '</div>';
        return;
      }
      progress = parsed;
      if (!progress.stats) progress.stats = {wordsFound:0,longestWord:"",levelsCompleted:0,hintsUsed:0};
      saveProgress();
      viewingIndex = Math.min(progress.currentLevelIndex, levelsData.levels.length-1);
      render();
      renderDataStats();
      fb.innerHTML = '<div class="ok-box">' + t("importSuccess") + '</div>';
    }catch(err){
      fb.innerHTML = '<div class="err-box">' + t("importErrorJson") + '</div>';
    }
  };
  reader.readAsText(file);
}

/* ============================= TABS ============================= */
function switchTab(name){
  document.querySelectorAll(".tab").forEach(function(tb){
    tb.classList.toggle("active", tb.getAttribute("data-tab") === name);
  });
  document.getElementById("panelGeneral").style.display = name === "general" ? "block" : "none";
  document.getElementById("panelLevels").style.display = name === "levels" ? "block" : "none";
  document.getElementById("panelData").style.display = name === "data" ? "block" : "none";
  if (name === "levels") renderLevelList();
  if (name === "data") renderDataStats();
}

/* ============================= EVENT WIRING ============================= */
function wireEvents(){
  document.getElementById("btnDelete").addEventListener("click", backspace);
  document.getElementById("btnShuffle").addEventListener("click", doShuffle);
  document.getElementById("btnEnter").addEventListener("click", submitWord);
  document.getElementById("btnHint").addEventListener("click", useHint);
  document.getElementById("btnReveal").addEventListener("click", revealAll);

  document.getElementById("drawerHandle").addEventListener("click", function(){
    drawerOpen = !drawerOpen;
    document.getElementById("drawer").classList.toggle("open", drawerOpen);
    document.getElementById("drawerHandle").classList.toggle("open", drawerOpen);
  });

  document.getElementById("btnMap").addEventListener("click", function(){ renderMap(); showOverlay("overlayMap"); });
  document.getElementById("closeMap").addEventListener("click", function(){ hideOverlay("overlayMap"); });
  document.getElementById("overlayMap").addEventListener("click", function(e){ if (e.target.id==="overlayMap") hideOverlay("overlayMap"); });

  document.getElementById("btnSettings").addEventListener("click", function(){
    switchTab("general"); showOverlay("overlaySettings");
  });
  document.getElementById("closeSettings").addEventListener("click", function(){ hideOverlay("overlaySettings"); });
  document.getElementById("overlaySettings").addEventListener("click", function(e){ if (e.target.id==="overlaySettings") hideOverlay("overlaySettings"); });

  document.querySelectorAll(".tab").forEach(function(tb){
    tb.addEventListener("click", function(){ switchTab(tb.getAttribute("data-tab")); });
  });

  document.getElementById("btnExportProgress").addEventListener("click", function(){
    downloadJSON(progress, "wordsforge-progress-" + currentLang + ".json");
  });
  document.getElementById("btnImportProgressBtn").addEventListener("click", function(){
    document.getElementById("importProgressFile").click();
  });
  document.getElementById("importProgressFile").addEventListener("change", function(e){
    if (e.target.files[0]) handleImportProgress(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("btnResetProgress").addEventListener("click", function(){
    if (confirm(t("resetConfirm"))){
      progress = { currentLevelIndex:0, totalScore:0, levelData:{}, stats:{wordsFound:0,longestWord:"",levelsCompleted:0,hintsUsed:0} };
      saveProgress();
      viewingIndex = 0;
      currentRingOrder = [];
      render();
      renderDataStats();
    }
  });

  document.getElementById("closeComplete").addEventListener("click", function(){ hideOverlay("overlayComplete"); });
  document.getElementById("btnStayLevel").addEventListener("click", function(){ hideOverlay("overlayComplete"); });
  document.getElementById("btnNextLevel").addEventListener("click", function(){
    hideOverlay("overlayComplete");
    goToLevel(viewingIndex+1);
  });

  document.addEventListener("keydown", function(e){
    if (document.querySelector(".overlay.show")) return;
    var level = levelsData.levels[viewingIndex];
    if (!level) return;
    var key = e.key.toUpperCase();
    if (key === "ENTER"){ submitWord(); return; }
    if (key === "BACKSPACE"){ backspace(); return; }
    if (key === "ESCAPE"){ clearBuffer(); return; }
    if (Array.from(key).length === 1 && level.letters.indexOf(key) !== -1){
      appendLetter(key);
      var tile = document.querySelector('.tile[data-letter="'+key+'"]');
      if (tile) pressTile(tile);
    }
  });
}

/* ============================= INIT ============================= */
function init(){
  applyTheme(loadTheme());
  loadAllData().then(function(data){
    ALL_DATA = data;
    currentLang = loadLang();
    levelsData = { levels: normalizeLevels(ALL_DATA[currentLang].levels) };
    if (!levelsData.levels.length) levelsData = FALLBACK_LEVELS;
    progress = loadProgress(currentLang);
    viewingIndex = Math.min(Math.max(progress.currentLevelIndex, 0), levelsData.levels.length-1);
    currentRingOrder = [];
    wireEvents();
    translateStaticUI();
    render();
  }).catch(function(err){
    console.error(err);
    document.getElementById("app").innerHTML =
      '<div style="padding:40px 24px;text-align:center;color:#c23f3f;font-family:sans-serif;">' +
      'Could not load levels.json. Make sure index.html, style.css, script.js and levels.json are all in the same folder, and open index.html through a local web server (not directly as a file://) so the browser is allowed to fetch it.' +
      '</div>';
  });
}
init();

})();
