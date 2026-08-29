/* ============================================================
   WORDFORGE — game logic
   Fully local, offline, no backend. Reads ./words.txt once.
   ============================================================ */
(function(){
"use strict";

/* ---------------------------------------------------------- *
 * 0. CONSTANTS
 * ---------------------------------------------------------- */
const STORAGE = {
  stats:    "wordforge_v1_stats",
  settings: "wordforge_v1_settings",
  daily:    "wordforge_v1_progress_daily",
  practice: "wordforge_v1_progress_practice",
};

const RANK_STEPS = [
  { name:"Spark",         pct:0   },
  { name:"Kindling",      pct:2   },
  { name:"Ember",         pct:5   },
  { name:"Flicker",       pct:8   },
  { name:"Flame",         pct:15  },
  { name:"Blaze",         pct:25  },
  { name:"Bonfire",       pct:40  },
  { name:"Inferno",       pct:50  },
  { name:"Wildfire",      pct:70  },
  { name:"Master Forger", pct:100 },
];

const RARITY_ORDER = "etaoinshrdlcumwfgypbvkjxqz".split(""); // common -> rare
const CHUNK_SIZE = 1500;
const HINTS_PER_PUZZLE = 3;
const MIN_WORD_LEN = 4;
const TARGET_LETTER_COUNT = 7;

const BADGES = [
  { id:"first_word",     glyph:"🔥", name:"First Spark",   desc:"Find your first word.",
    check:(s)=> s.totalWordsFound >= 1 },
  { id:"first_pangram",  glyph:"✨", name:"Pangram",       desc:"Use every letter in one word.",
    check:(s)=> s.totalPangrams >= 1 },
  { id:"century",        glyph:"💯", name:"Century",       desc:"Score 100+ points in a single puzzle.",
    check:(s)=> s.bestScore >= 100 },
  { id:"hoarder",        glyph:"📚", name:"Word Hoarder",  desc:"Find 25+ words in a single puzzle.",
    check:(s)=> s.bestWordsInPuzzle >= 25 },
  { id:"longword",       glyph:"🐍", name:"Long Word",     desc:"Find a word of 9+ letters.",
    check:(s)=> s.longestWord && s.longestWord.length >= 9 },
  { id:"wildfire_rank",  glyph:"🌪️", name:"Wildfire",      desc:"Reach Wildfire rank in a puzzle.",
    check:(s)=> s.bestRankIndex >= RANK_STEPS.findIndex(r=>r.name==="Wildfire") },
  { id:"master_forger",  glyph:"👑", name:"Master Forger", desc:"Reach top rank in a puzzle.",
    check:(s)=> s.bestRankIndex >= RANK_STEPS.length-1 },
  { id:"streak7",        glyph:"🌙", name:"Week Streak",   desc:"Play the daily puzzle 7 days running.",
    check:(s)=> s.maxStreak >= 7 },
  { id:"streak30",       glyph:"🏆", name:"Month Streak",  desc:"Play the daily puzzle 30 days running.",
    check:(s)=> s.maxStreak >= 30 },
];

// Small fallback list used only if words.txt cannot be loaded, so the
// game is still playable and the person can see what to expect.
const FALLBACK_WORDS = ("able acid aged also area army away baby back ball band bank base "+
"bath bear beat been bell belt bend best bike bill bird bite blue boat body bold bolt bond "+
"bone book boot born both bowl bulk burn bush busy cage cake call calm camp card care case "+
"cash cast cave cell chip city claim clay clean clear climb clock close cloth cloud club coal "+
"coast coat code coin cold come cook cool cope copy cord core corn cost could count course cover "+
"crane crisp cross crowd crown dance dark dash data date dawn deal dear debt deck deep deer "+
"delay dense depth desk dial dice diet dirt dish dive dock does done door dose down draft drag "+
"drain drama draw dream dress drift drill drink drive drop drum dry duck dust duty each earn "+
"earth ease east easy edge eight elite else empty ended enjoy enter entry equal error even event "+
"every exact exist extra face fact fade fail fair fall fame farm fast fate fault fear feed feel "+
"field fight file fill film find fine fire firm fish flag flame flat flavor fleet flesh flick "+
"flight float flock floor flour flow fluid flush focus fold folk food foot force forge fork form "+
"forth forty found frame free fresh from front frost fruit fuel full fund funny gain game gate "+
"gaze gear gene gift girl give glad glass glide glow goal goat gold golf gone good grade grain "+
"grand grant grape grass great green greet grid grief grill grind grip grow guard guess guide "+
"habit hair half hall hand hang happy hard harm harsh haste have hazy head heal heap hear heart "+
"heat heavy helm help herb here hero hide high hill hint hire hold hole holy home hope horn hose "+
"host hour house huge hull human hunt hurt icon idea idle inch into iron item ivory jelly join "+
"joint joke jolly judge juice jumbo jump junk just keen keep kept kick kind king kite knee knife "+
"knit knot know label labor lace lack lady lake lamp land lane large last late laugh layer lead "+
"leaf lean learn least leave ledge left lend lens less level lever light like limb lime line link "+
"lion list live load loan lobby local lock loft logic lone long look loop loose lord lose loud "+
"love lower loyal luck lunar lunch lung made magic maid mail main make male mall many march mark "+
"mass mate math maze meal mean meat medal melt memo mend menu mercy merge merit mesh mild mile "+
"milk mill mind mine mint miss mist mode mold monk month mood moon more moss most moth mount "+
"mouse mouth move much mule music must myth naive name near neat neck need nerve nest never news "+
"next nice night nine noble noise noon north nose note noun nurse oath ocean odor offer often "+
"oil old omen once open opera orbit order organ other ought outer owed owner pace pack page paid "+
"pain paint pair palm panel panic paper party pass past path pause peace peak pearl phase phone "+
"photo piece pilot pinch pipe pitch place plain plan plant plate play plot plow poem point poise "+
"poll pond pool poor port pose post pour power press price pride prime print prior prize proof "+
"proud prove pulse pump punch pupil pure push quest queue quick quiet quilt quite quote race rack "+
"radio raid rail rain raise range rank rapid rare rate ratio reach react ready realm rebel refer "+
"reign relax reply rescue rice rich ride ridge right ring rise risk rival river roast robot rock "+
"role roll roof room root rope rose rough round route royal rule rural rush rust sail salt same "+
"sand save scale scan scare scene scent scope score scout screw seal seat seed seek seem self "+
"sell send sense serve shade shake shape share sharp shed sheep sheet shelf shell shift shine "+
"ship shirt shock shoe shoot shop shore short shot show shrug shut sight sign silk silly since "+
"sing sink site size skill skin skip sky slate sleep slice slide slim slip slope slow small smart "+
"smell smile smoke snap snow soap social soft soil solid solve some song soon sort soul sound "+
"south space spare spark speak speed spell spend spice spine split spoke sport spot spray spread "+
"spring squad stack staff stage stair stake stamp stand star start state stay steam steel steep "+
"stem step stick still stock stone stop store storm story stout stove strap straw stream street "+
"stress strike strip study stuff style suit sunny super sure surge swap swarm sweep sweet swift "+
"swing sword table take tale talk tall tank tape target task taste teach team tear tech tell "+
"tempo tend tense tent term test text thank that their theme then there thick thief thing think "+
"third this thorn those thread threat three throat throne throw thumb tidy tight time tiny title "+
"today toast toll tone tool tooth topic torch total touch tough tour towel tower town trace track "+
"trade trail train trait tramp trap trash treat tree trend trial tribe trick trim trip troop "+
"trout truck truly trunk trust truth tube tune turn twice twin type ultra uncle under undo unfair "+
"union unit unite unity until upon upper urban urge used user usual valid value valve vapor vary "+
"vast verb verse video view vine visit vital voice void voter wagon waist wake walk wall want "+
"ward warm warn wash waste watch water wave weak wealth wear weed week weigh weird welcome went "+
"were west whale wheat wheel when where which while white whole whom whose wide width wild will "+
"wind wine wing wire wise wish witch with woman wood wool word work world worry worth would wound "+
"wrap wreck write wrong yard yarn year yield young youth zebra zone").split(/\s+/);

/* ---------------------------------------------------------- *
 * 1. TINY UTILITIES
 * ---------------------------------------------------------- */
function cyrb53(str, seed){
  let h1 = 0xdeadbeef ^ (seed||0), h2 = 0x41c6ce57 ^ (seed||0);
  for (let i=0; i<str.length; i++){
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1>>>0);
}
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickRandom(arr, rng){ return arr[Math.floor((rng?rng():Math.random()) * arr.length)]; }
function shuffleArray(arr, rng){
  const a = arr.slice();
  for (let i=a.length-1; i>0; i--){
    const j = Math.floor((rng?rng():Math.random()) * (i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function todayStr(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function daysBetween(a,b){
  const A = new Date(a+"T00:00:00"), B = new Date(b+"T00:00:00");
  return Math.round((B-A)/86400000);
}
function safeGet(key){
  try{ const v = localStorage.getItem(key); return v?JSON.parse(v):null; }catch(e){ return null; }
}
function safeSet(key,val){
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ return false; }
}
function el(sel,root){ return (root||document).querySelector(sel); }
function els(sel,root){ return Array.from((root||document).querySelectorAll(sel)); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------------------------------------------------------- *
 * 2. STATE
 * ---------------------------------------------------------- */
const defaultStats = ()=>({
  gamesPlayed:0, totalWordsFound:0, totalPoints:0, bestScore:0,
  bestWordsInPuzzle:0, longestWord:"", totalPangrams:0,
  currentStreak:0, maxStreak:0, lastDailyDate:null,
  bestRankIndex:0, achievements:{}
});
const defaultSettings = ()=>({ hardMode:false, theme:"dark", reduceMotion:false });

let dictionarySet = new Set();
let dictionaryArray = [];
let usingFallback = false;

let stats = defaultStats();
let settings = defaultSettings();

let currentMode = "daily"; // 'daily' | 'practice'
let puzzle = null;         // active puzzle object
let currentInput = [];     // array of typed letters

/* Puzzle shape:
 {
   mode, dateSeed(optional), letters:[7], keyLetter,
   outerOrder:[6 letters, shuffle-able], hardMode:bool,
   foundWords:[{word,pts,pangram,ts}], hintsUsed:[{word,revealedAt}],
   score, revealed, validWords:null|[...], maxScore:null|num,
   pangramsTotal:null|num, validWordsReady:bool
 }
*/

/* ---------------------------------------------------------- *
 * 3. DICTIONARY LOAD
 * ---------------------------------------------------------- */
async function loadDictionary(){
  const sub = el("#loading-sub");
  try{
    const res = await fetch("words.txt", { cache:"no-store" });
    if(!res.ok) throw new Error("HTTP "+res.status);
    const text = await res.text();
    const words = text.split(/\r?\n/)
      .map(w=>w.trim().toLowerCase())
      .filter(w=>/^[a-z]{4,20}$/.test(w));
    const uniq = Array.from(new Set(words));
    if(uniq.length < 30) throw new Error("words.txt looked empty");
    dictionaryArray = uniq;
    dictionarySet = new Set(uniq);
    usingFallback = false;
  }catch(err){
    if(sub) sub.textContent = "Couldn't read words.txt — using a small demo list instead.";
    dictionaryArray = FALLBACK_WORDS.slice();
    dictionarySet = new Set(dictionaryArray);
    usingFallback = true;
    await new Promise(r=>setTimeout(r, 650)); // let the message be readable
  }
}

/* ---------------------------------------------------------- *
 * 4. PUZZLE GENERATION
 * ---------------------------------------------------------- */
function deriveLetters(baseWord){
  let letters = Array.from(new Set(baseWord.split("")));
  if(letters.length < TARGET_LETTER_COUNT){
    for(const c of RARITY_ORDER){
      if(letters.length >= TARGET_LETTER_COUNT) break;
      if(!letters.includes(c)) letters.push(c);
    }
  } else if(letters.length > TARGET_LETTER_COUNT){
    letters.sort((a,b)=> RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
    letters = letters.slice(0, TARGET_LETTER_COUNT);
  }
  return letters;
}

function chooseBaseWord(rng){
  const groups = {5:[],6:[],7:[],8:[]};
  for(const w of dictionaryArray){
    const uniq = new Set(w).size;
    if(uniq>=5 && uniq<=8 && w.length>=5 && groups[uniq]) groups[uniq].push(w);
  }
  for(const key of [7,6,8,5]){
    if(groups[key] && groups[key].length) return pickRandom(groups[key], rng);
  }
  const any = dictionaryArray.filter(w=>w.length>=4);
  return any.length ? pickRandom(any, rng) : "letters";
}

function quickLetterCounts(letterSet){
  // fast synchronous pass, used only to weight key-letter choice
  const counts = {};
  letterSet.forEach(l=>counts[l]=0);
  for(const w of dictionaryArray){
    if(w.length < MIN_WORD_LEN) continue;
    let ok = true;
    for(let i=0;i<w.length;i++){ if(!letterSet.has(w[i])){ ok=false; break; } }
    if(!ok) continue;
    const seen = new Set(w);
    seen.forEach(c=>{ if(counts[c]!==undefined) counts[c]++; });
  }
  return counts;
}

function weightedPick(counts, rng){
  const entries = Object.entries(counts);
  const pool = [];
  entries.forEach(([letter,count])=>{ for(let i=0;i<count+1;i++) pool.push(letter); });
  return pickRandom(pool, rng);
}

function buildPuzzle({ seeded=false, dateSeed=null } = {}){
  const rng = seeded ? mulberry32(cyrb53(dateSeed||todayStr())) : Math.random;
  const base = chooseBaseWord(rng);
  const letters = deriveLetters(base);
  const letterSet = new Set(letters);
  const counts = quickLetterCounts(letterSet);
  const keyLetter = weightedPick(counts, rng) || letters[0];
  const outer = letters.filter(l=>l!==keyLetter);
  // guard: if for some odd reason keyLetter duplicated logic broke length
  while(outer.length < TARGET_LETTER_COUNT-1) outer.push(pickRandom(RARITY_ORDER, rng));

  return {
    mode: seeded ? "daily" : "practice",
    dateSeed: seeded ? (dateSeed||todayStr()) : null,
    letters,
    keyLetter,
    outerOrder: shuffleArray(outer, rng),
    hardMode: settings.hardMode,
    foundWords: [],
    hintsUsed: [],
    score: 0,
    revealed: false,
    validWords: null,
    maxScore: null,
    pangramsTotal: null,
    validWordsReady: false,
  };
}

function isPangram(word, letters){
  const set = new Set(letters);
  const wset = new Set(word);
  if(wset.size < set.size) return false;
  for(const l of set){ if(!wset.has(l)) return false; }
  return true;
}
function scoreForWord(word, letters){
  let pts = word.length===MIN_WORD_LEN ? 1 : word.length;
  if(isPangram(word, letters)) pts += 7;
  return pts;
}

function computeValidWordsAsync(p){
  const letterSet = new Set(p.letters);
  const normal = [];
  let idx = 0;
  function step(){
    const end = Math.min(idx+CHUNK_SIZE, dictionaryArray.length);
    for(; idx<end; idx++){
      const w = dictionaryArray[idx];
      if(w.length < MIN_WORD_LEN) continue;
      let ok = true;
      for(let i=0;i<w.length;i++){ if(!letterSet.has(w[i])){ ok=false; break; } }
      if(ok) normal.push(w);
    }
    if(idx < dictionaryArray.length){
      setTimeout(step, 0);
    }else{
      finish();
    }
  }
  function finish(){
    const finalList = p.hardMode ? normal.filter(w=>w.includes(p.keyLetter)) : normal;
    p.validWords = finalList;
    p.maxScore = finalList.reduce((sum,w)=>sum+scoreForWord(w,p.letters), 0);
    p.pangramsTotal = finalList.filter(w=>isPangram(w,p.letters)).length;
    p.validWordsReady = true;
    onValidWordsReady(p);
  }
  step();
}

/* ---------------------------------------------------------- *
 * 5. PERSISTENCE
 * ---------------------------------------------------------- */
function loadAll(){
  stats = Object.assign(defaultStats(), safeGet(STORAGE.stats)||{});
  settings = Object.assign(defaultSettings(), safeGet(STORAGE.settings)||{});
}
function saveStats(){ safeSet(STORAGE.stats, stats); }
function saveSettings(){ safeSet(STORAGE.settings, settings); }
function savePuzzleProgress(){
  if(!puzzle) return;
  const slim = {
    mode:puzzle.mode, dateSeed:puzzle.dateSeed, letters:puzzle.letters, keyLetter:puzzle.keyLetter,
    outerOrder:puzzle.outerOrder, hardMode:puzzle.hardMode, foundWords:puzzle.foundWords,
    hintsUsed:puzzle.hintsUsed, score:puzzle.score, revealed:puzzle.revealed,
  };
  safeSet(puzzle.mode==="daily"?STORAGE.daily:STORAGE.practice, slim);
}

/* ---------------------------------------------------------- *
 * 6. RANK HELPERS
 * ---------------------------------------------------------- */
function rankIndexForPct(pct){
  let idx = 0;
  for(let i=0;i<RANK_STEPS.length;i++){ if(pct >= RANK_STEPS[i].pct) idx = i; }
  return idx;
}

/* ---------------------------------------------------------- *
 * 7. RENDERING
 * ---------------------------------------------------------- */
function renderWheel(){
  const wheel = el("#wheel");
  wheel.innerHTML = "";
  const ring = document.createElement("div");
  ring.className = "wheel-ring";
  wheel.appendChild(ring);

  const centerBtn = makeTile(puzzle.keyLetter, true);
  centerBtn.style.left = "50%"; centerBtn.style.top = "50%";
  wheel.appendChild(centerBtn);

  puzzle.outerOrder.forEach((letter,i)=>{
    const angle = (-90 + i*60) * Math.PI/180;
    const x = 50 + 38*Math.cos(angle);
    const y = 50 + 38*Math.sin(angle);
    const btn = makeTile(letter, false);
    btn.style.left = x+"%"; btn.style.top = y+"%";
    wheel.appendChild(btn);
  });
}
function makeTile(letter, isKey){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tile" + (isKey ? " key-tile":"");
  btn.textContent = letter;
  btn.dataset.letter = letter;
  btn.setAttribute("aria-label", "Letter "+letter.toUpperCase()+(isKey?" (key letter)":""));
  btn.addEventListener("click", ()=>{
    if(puzzle.revealed) return;
    appendLetter(letter);
    btn.classList.remove("pressed"); void btn.offsetWidth; btn.classList.add("pressed");
    setTimeout(()=>btn.classList.remove("pressed"), 150);
  });
  return btn;
}

function renderWordDisplay(){
  const disp = el("#word-display");
  if(currentInput.length===0){
    disp.innerHTML = '<span class="word-display-placeholder" id="word-placeholder">Tap letters to forge a word</span>';
    return;
  }
  disp.innerHTML = currentInput.map(l=>{
    const isKey = puzzle && l===puzzle.keyLetter;
    return isKey ? `<span class="key-glyph">${esc(l)}</span>` : esc(l);
  }).join("");
}

function renderRankUI(){
  const scoreEl = el("#score-value");
  scoreEl.textContent = String(puzzle.score);
  el("#words-found-count").textContent = puzzle.foundWords.length + (puzzle.foundWords.length===1?" word":" words");

  const hint = el("#max-score-hint");
  const label = el("#rank-label");
  const fill = el("#progress-fill");

  if(!puzzle.validWordsReady){
    hint.textContent = "calculating…";
    label.textContent = RANK_STEPS[0].name;
    fill.style.width = "4%";
    return;
  }
  const max = puzzle.maxScore || 1;
  const pct = Math.min(100, (puzzle.score/max)*100);
  const idx = rankIndexForPct(pct);
  label.textContent = RANK_STEPS[idx].name;
  const lower = RANK_STEPS[idx].pct;
  const upper = RANK_STEPS[idx+1] ? RANK_STEPS[idx+1].pct : 100;
  const band = upper>lower ? Math.min(100, ((pct-lower)/(upper-lower))*100) : 100;
  fill.style.width = band+"%";
  hint.textContent = idx===RANK_STEPS.length-1
    ? "Top rank reached!"
    : `${RANK_STEPS[idx+1].name} at ${Math.ceil(max*upper/100)} pts`;

  renderProgressDots();
}
function renderProgressDots(){
  const dotsWrap = el("#progress-dots");
  if(dotsWrap.childElementCount) return;
  dotsWrap.innerHTML = RANK_STEPS.slice(1,-1).map(()=>"<i></i>").join("");
}

function renderModeUI(){
  el("#pill-daily").classList.toggle("active", currentMode==="daily");
  el("#pill-practice").classList.toggle("active", currentMode==="practice");
  el("#btn-new-practice").classList.toggle("hidden", currentMode!=="practice");
}

function renderHint(){
  const remaining = HINTS_PER_PUZZLE - puzzle.hintsUsed.length;
  el("#hint-count").textContent = String(Math.max(0,remaining));
  const btn = el("#btn-hint");
  btn.style.opacity = (remaining<=0 || puzzle.revealed) ? ".45" : "1";
}

function renderDrawer(){
  const list = el("#found-list");
  const empty = el("#found-empty");
  const summary = el("#drawer-summary");
  list.innerHTML = "";

  if(puzzle.revealed && puzzle.validWords){
    const foundSet = new Set(puzzle.foundWords.map(f=>f.word));
    let items = puzzle.validWords.slice();
    items = sortWordList(items, el("#sort-select").value, foundSet);
    items.forEach(w=>{
      const li = document.createElement("li");
      const found = foundSet.has(w);
      li.className = (isPangram(w,puzzle.letters)?"is-pangram ":"") + (found?"":"is-missed");
      li.innerHTML = `<span class="fw-word">${esc(w)}</span><span class="fw-pts">${found?"✓ "+scoreForWord(w,puzzle.letters):scoreForWord(w,puzzle.letters)}</span>`;
      list.appendChild(li);
    });
    empty.classList.toggle("hidden", items.length>0);
    summary.textContent = `${puzzle.foundWords.length} of ${puzzle.validWords.length} words found`;
    return;
  }

  const rows = sortFoundRows();
  rows.forEach(row=>{
    const li = document.createElement("li");
    if(row.hint){
      li.className = "is-hint";
      li.innerHTML = `<span class="fw-word">${esc(row.pattern)}</span><span class="fw-pts">hint</span>`;
    } else {
      li.className = row.pangram ? "is-pangram" : "";
      li.innerHTML = `<span class="fw-word">${esc(row.word)}</span><span class="fw-pts">${row.pts} pt${row.pts===1?"":"s"}</span>`;
    }
    list.appendChild(li);
  });
  empty.classList.toggle("hidden", rows.length>0);
  const totalKnown = puzzle.validWordsReady ? puzzle.validWords.length : "?";
  summary.textContent = `${puzzle.foundWords.length} of ${totalKnown} words found`;
}
function sortFoundRows(){
  const sort = el("#sort-select").value;
  const words = puzzle.foundWords.slice();
  if(sort==="alpha") words.sort((a,b)=>a.word.localeCompare(b.word));
  else if(sort==="length") words.sort((a,b)=> a.word.length-b.word.length || a.word.localeCompare(b.word));
  const hints = puzzle.hintsUsed.filter(h=>!puzzle.foundWords.some(f=>f.word===h.word))
    .map(h=>({ hint:true, pattern:h.word[0].toUpperCase()+" "+"_ ".repeat(h.word.length-1).trim() }));
  return sort==="order" ? [...words, ...hints] : [...hints, ...words];
}
function sortWordList(items, sort, foundSet){
  const arr = items.slice();
  if(sort==="alpha") arr.sort((a,b)=>a.localeCompare(b));
  else if(sort==="length") arr.sort((a,b)=>a.length-b.length || a.localeCompare(b));
  else arr.sort((a,b)=>{ // "order": found-first by discovery, then unfound alpha
    const fa = foundSet.has(a), fb = foundSet.has(b);
    if(fa && fb) return 0;
    if(fa) return -1;
    if(fb) return 1;
    return a.localeCompare(b);
  });
  return arr;
}

function renderAll(){
  renderModeUI();
  renderWheel();
  renderWordDisplay();
  renderRankUI();
  renderHint();
  renderDrawer();
  el("#streak-count").textContent = String(stats.currentStreak);
  document.getElementById("btn-stuck").style.opacity = puzzle.revealed ? ".5":"1";
}

/* ---------------------------------------------------------- *
 * 8. FEEDBACK (toasts / shakes / fx)
 * ---------------------------------------------------------- */
function showToast(msg, type){
  const stack = el("#toast-stack");
  const t = document.createElement("div");
  t.className = "toast" + (type?" toast-"+type:"");
  t.textContent = msg;
  stack.appendChild(t);
  setTimeout(()=>t.remove(), 2000);
}
function shakeInput(errColor){
  const disp = el("#word-display");
  disp.classList.remove("shake","pop","err-color");
  void disp.offsetWidth;
  disp.classList.add("shake");
  if(errColor) disp.classList.add("err-color");
  setTimeout(()=>disp.classList.remove("shake","err-color"), 420);
}
function popInput(){
  const disp = el("#word-display");
  disp.classList.remove("pop"); void disp.offsetWidth; disp.classList.add("pop");
  setTimeout(()=>disp.classList.remove("pop"), 340);
}
function sparkTiles(){
  els(".tile").forEach(t=>{
    t.classList.remove("spark"); void t.offsetWidth; t.classList.add("spark");
    setTimeout(()=>t.classList.remove("spark"), 520);
  });
}
function sparkBurst(count){
  if(settings.reduceMotion) return;
  const layer = el("#fx-layer");
  const colors = ["#e8871e","#f6b854","#d9b54a"];
  for(let i=0;i<count;i++){
    const p = document.createElement("span");
    p.className = "spark-particle";
    p.style.left = Math.random()*100+"vw";
    p.style.top = "-10px";
    p.style.background = colors[i%colors.length];
    p.style.animationDelay = (Math.random()*0.3)+"s";
    p.style.animationDuration = (1.1+Math.random()*0.8)+"s";
    layer.appendChild(p);
    setTimeout(()=>p.remove(), 2200);
  }
}

/* ---------------------------------------------------------- *
 * 9. INPUT HANDLING
 * ---------------------------------------------------------- */
function appendLetter(letter){
  if(puzzle.revealed) return;
  currentInput.push(letter);
  renderWordDisplay();
}
function deleteLetter(){
  if(puzzle.revealed) return;
  currentInput.pop();
  renderWordDisplay();
}
function clearInput(){ currentInput = []; renderWordDisplay(); }

function shuffleLetters(){
  if(puzzle.revealed) return;
  els(".tile:not(.key-tile)").forEach(t=>t.classList.add("shuffling"));
  puzzle.outerOrder = shuffleArray(puzzle.outerOrder);
  setTimeout(renderWheel, 140);
}

function submitGuess(){
  if(!puzzle || puzzle.revealed) return;
  const word = currentInput.join("").toLowerCase();
  if(word.length===0) return;

  if(word.length < MIN_WORD_LEN){
    shakeInput(true); showToast("Too short — 4 letters minimum", "error");
    clearInput(); return;
  }
  const letterSet = new Set(puzzle.letters);
  for(const ch of word){
    if(!letterSet.has(ch)){
      shakeInput(true); showToast("Only use the letters shown", "error");
      clearInput(); return;
    }
  }
  if(puzzle.hardMode && !word.includes(puzzle.keyLetter)){
    shakeInput(true); showToast(`Must include "${puzzle.keyLetter.toUpperCase()}"`, "error");
    clearInput(); return;
  }
  if(puzzle.foundWords.some(f=>f.word===word)){
    shakeInput(false); showToast("Already found", "default");
    clearInput(); return;
  }
  if(!dictionarySet.has(word)){
    shakeInput(true); showToast("Not in the word list", "error");
    clearInput(); return;
  }

  // valid new word
  const pts = scoreForWord(word, puzzle.letters);
  const pangram = isPangram(word, puzzle.letters);
  const prevPct = puzzle.validWordsReady ? Math.min(100,(puzzle.score/(puzzle.maxScore||1))*100) : 0;
  const prevRank = rankIndexForPct(prevPct);

  puzzle.foundWords.push({ word, pts, pangram, ts:Date.now() });
  puzzle.score += pts;

  stats.totalWordsFound += 1;
  stats.totalPoints += pts;
  stats.bestScore = Math.max(stats.bestScore, puzzle.score);
  stats.bestWordsInPuzzle = Math.max(stats.bestWordsInPuzzle, puzzle.foundWords.length);
  if(!stats.longestWord || word.length > stats.longestWord.length) stats.longestWord = word;
  if(pangram) stats.totalPangrams += 1;

  if(puzzle.mode==="daily" && puzzle.foundWords.length===1) registerDailyStreak();

  popInput();
  sparkTiles();
  showToast(pangram ? `Pangram! +${pts} pts` : `+${pts} pt${pts===1?"":"s"}`, pangram?"gold":"success");
  if(pangram) sparkBurst(28);
  clearInput();

  if(puzzle.validWordsReady){
    const newPct = Math.min(100,(puzzle.score/(puzzle.maxScore||1))*100);
    const newRank = rankIndexForPct(newPct);
    stats.bestRankIndex = Math.max(stats.bestRankIndex, newRank);
    if(newRank > prevRank){
      showToast(`Rank up — ${RANK_STEPS[newRank].name}!`, "gold");
      sparkBurst(40);
    }
  }

  checkAchievements();
  saveStats(); savePuzzleProgress();
  renderRankUI(); renderHint(); renderDrawer();
  el("#streak-count").textContent = String(stats.currentStreak);
}

function registerDailyStreak(){
  const today = todayStr();
  if(stats.lastDailyDate === today) return;
  if(stats.lastDailyDate && daysBetween(stats.lastDailyDate, today)===1){
    stats.currentStreak += 1;
  }else{
    stats.currentStreak = 1;
  }
  stats.lastDailyDate = today;
  stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
}

/* ---------------------------------------------------------- *
 * 10. HINTS
 * ---------------------------------------------------------- */
function useHint(){
  if(!puzzle || puzzle.revealed) return;
  if(!puzzle.validWordsReady){ showToast("Still charting the letters… try again shortly","default"); return; }
  if(puzzle.hintsUsed.length >= HINTS_PER_PUZZLE){ showToast("No hints left this puzzle","default"); return; }
  const foundSet = new Set(puzzle.foundWords.map(f=>f.word));
  const hintedSet = new Set(puzzle.hintsUsed.map(h=>h.word));
  const candidates = puzzle.validWords.filter(w=>!foundSet.has(w) && !hintedSet.has(w));
  if(!candidates.length){ showToast("No more words to hint","default"); return; }
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  puzzle.hintsUsed.push({ word:pick, revealedAt:Date.now() });
  showToast(`Hint: starts with "${pick[0].toUpperCase()}", ${pick.length} letters`, "default");
  savePuzzleProgress();
  renderHint(); renderDrawer();
}

/* ---------------------------------------------------------- *
 * 11. REVEAL FLOW
 * ---------------------------------------------------------- */
function revealPuzzle(){
  if(!puzzle.validWordsReady){ showToast("Still charting the letters… try again shortly","default"); return; }
  puzzle.revealed = true;
  savePuzzleProgress();
  renderDrawer();
  renderHint();
  document.getElementById("btn-stuck").style.opacity = ".5";
  renderAllWordsModal();
  closeModal("modal-reveal-confirm");
  openModal("modal-allwords");
}
function renderAllWordsModal(){
  const list = el("#allwords-list");
  const foundSet = new Set(puzzle.foundWords.map(f=>f.word));
  const items = puzzle.validWords.slice().sort((a,b)=> a.length-b.length || a.localeCompare(b));
  list.innerHTML = items.map(w=>{
    const found = foundSet.has(w);
    const pang = isPangram(w,puzzle.letters);
    return `<li class="${pang?'is-pangram ':''}${found?'':'is-missed'}">
      <span class="fw-word">${esc(w)}</span>
      <span class="fw-pts">${found?'✓':''} ${scoreForWord(w,puzzle.letters)}</span>
    </li>`;
  }).join("");
}

/* ---------------------------------------------------------- *
 * 12. ACHIEVEMENTS
 * ---------------------------------------------------------- */
function checkAchievements(){
  let unlockedNew = [];
  BADGES.forEach(b=>{
    if(!stats.achievements[b.id] && b.check(stats)){
      stats.achievements[b.id] = true;
      unlockedNew.push(b);
    }
  });
  if(unlockedNew.length){
    saveStats();
    unlockedNew.forEach((b,i)=> setTimeout(()=>showToast(`Badge unlocked: ${b.name} ${b.glyph}`,"gold"), i*900));
  }
}

/* ---------------------------------------------------------- *
 * 13. PUZZLE LIFECYCLE (mode switching / persistence)
 * ---------------------------------------------------------- */
function onValidWordsReady(p){
  if(p !== puzzle) return; // user switched away already
  savePuzzleProgress();
  renderRankUI(); renderHint(); renderDrawer();
  if(p.revealed) renderAllWordsModal();
}

function newDailyPuzzle(){
  puzzle = buildPuzzle({ seeded:true, dateSeed:todayStr() });
  stats.gamesPlayed += 1; saveStats();
  savePuzzleProgress();
  computeValidWordsAsync(puzzle);
}
function newPracticePuzzle(){
  puzzle = buildPuzzle({ seeded:false });
  stats.gamesPlayed += 1; saveStats();
  savePuzzleProgress();
  computeValidWordsAsync(puzzle);
}
function resumePuzzle(saved){
  puzzle = {
    mode: saved.mode, dateSeed: saved.dateSeed, letters: saved.letters, keyLetter: saved.keyLetter,
    outerOrder: saved.outerOrder, hardMode: saved.hardMode, foundWords: saved.foundWords||[],
    hintsUsed: saved.hintsUsed||[], score: saved.score||0, revealed: !!saved.revealed,
    validWords:null, maxScore:null, pangramsTotal:null, validWordsReady:false,
  };
  computeValidWordsAsync(puzzle);
}

function loadDaily(){
  const saved = safeGet(STORAGE.daily);
  if(saved && saved.dateSeed===todayStr()){
    resumePuzzle(saved);
  }else{
    newDailyPuzzle();
  }
}
function loadPractice(){
  const saved = safeGet(STORAGE.practice);
  if(saved){
    resumePuzzle(saved);
  }else{
    newPracticePuzzle();
  }
}

function switchMode(mode){
  if(mode===currentMode) return;
  currentMode = mode;
  currentInput = [];
  if(mode==="daily") loadDaily(); else loadPractice();
  renderAll();
}

/* ---------------------------------------------------------- *
 * 14. MODALS / DRAWER CHROME
 * ---------------------------------------------------------- */
function openModal(id){
  const m = el("#"+id);
  m.classList.add("open");
  m.setAttribute("aria-hidden","false");
}
function closeModal(id){
  const m = el("#"+id);
  m.classList.remove("open");
  m.setAttribute("aria-hidden","true");
}
function closeAllModals(){ els("[data-modal]").forEach(m=>{ m.classList.remove("open"); m.setAttribute("aria-hidden","true"); }); }

function openDrawer(){
  el("#drawer").classList.add("open");
  el("#drawer-backdrop").classList.add("open");
  el("#drawer-handle").setAttribute("aria-expanded","true");
}
function closeDrawer(){
  el("#drawer").classList.remove("open");
  el("#drawer-backdrop").classList.remove("open");
  el("#drawer-handle").setAttribute("aria-expanded","false");
}

/* ---------------------------------------------------------- *
 * 15. STATS / SETTINGS MODAL RENDER
 * ---------------------------------------------------------- */
function renderStatsModal(){
  const grid = el("#stat-grid");
  const cards = [
    ["Games played", stats.gamesPlayed],
    ["Words found", stats.totalWordsFound],
    ["Total points", stats.totalPoints],
    ["Best single puzzle", stats.bestScore],
    ["Longest word", stats.longestWord ? stats.longestWord : "—"],
    ["Pangrams found", stats.totalPangrams],
    ["Current streak", stats.currentStreak+"d"],
    ["Best streak", stats.maxStreak+"d"],
  ];
  grid.innerHTML = cards.map(([label,val])=>`
    <div class="stat-card"><span class="stat-value">${esc(val)}</span><span class="stat-label">${esc(label)}</span></div>
  `).join("");

  const bgrid = el("#badge-grid");
  bgrid.innerHTML = BADGES.map(b=>{
    const unlocked = !!stats.achievements[b.id];
    return `<div class="badge ${unlocked?'unlocked':''}" title="${esc(b.desc)}">
      <span class="badge-glyph">${b.glyph}</span>${esc(b.name)}
    </div>`;
  }).join("");
}

function renderSettingsModal(){
  el("#toggle-hardmode").checked = !!settings.hardMode;
  el("#toggle-reduce-motion").checked = !!settings.reduceMotion;
  els("#theme-segmented .seg-btn").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.themeChoice===settings.theme);
  });
  el("#dict-count").textContent = dictionaryArray.length.toLocaleString() + (usingFallback?" (demo list)":"");
}

function renderRankLadder(){
  const ladder = el("#rank-ladder");
  const max = puzzle.maxScore;
  const curPct = puzzle.validWordsReady ? Math.min(100,(puzzle.score/(max||1))*100) : -1;
  const curIdx = puzzle.validWordsReady ? rankIndexForPct(curPct) : -1;
  ladder.innerHTML = RANK_STEPS.map((r,i)=>{
    const scoreAt = max ? Math.ceil(max*r.pct/100) : null;
    return `<li class="${i===curIdx?'current':''}">
      <span>${esc(r.name)}</span>
      <span class="rl-pct">${r.pct}%${scoreAt!=null?` · ${scoreAt} pts`:""}</span>
    </li>`;
  }).join("");
}

/* ---------------------------------------------------------- *
 * 16. EXPORT / IMPORT
 * ---------------------------------------------------------- */
function exportData(){
  const payload = {
    app:"wordforge", version:1, exportedAt:new Date().toISOString(),
    stats, settings,
    dailyProgress: safeGet(STORAGE.daily),
    practiceProgress: safeGet(STORAGE.practice),
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wordforge-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function importData(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    let data;
    try{ data = JSON.parse(reader.result); }
    catch(e){ showImportResult(false, "That file isn't valid JSON."); return; }
    if(!data || typeof data!=="object" || !data.stats){
      showImportResult(false, "That doesn't look like a WordForge backup.");
      return;
    }
    safeSet(STORAGE.stats, Object.assign(defaultStats(), data.stats));
    if(data.settings) safeSet(STORAGE.settings, Object.assign(defaultSettings(), data.settings));
    if(data.dailyProgress) safeSet(STORAGE.daily, data.dailyProgress);
    if(data.practiceProgress) safeSet(STORAGE.practice, data.practiceProgress);
    showImportResult(true, "Data imported. Reload to continue with it.");
  };
  reader.onerror = ()=> showImportResult(false, "Couldn't read that file.");
  reader.readAsText(file);
}
function showImportResult(ok, msg){
  const body = el("#import-result-body");
  body.innerHTML = `
    <h2 style="margin-bottom:10px;">${ok?"Import complete":"Import failed"}</h2>
    <p>${esc(msg)}</p>
    <div class="modal-actions">
      ${ok? '<button class="btn-primary" id="btn-reload-now">Reload now</button>' : '<button class="btn-secondary" data-close>Close</button>'}
    </div>`;
  if(ok) el("#btn-reload-now").addEventListener("click", ()=>location.reload());
  openModal("modal-import-result");
}

/* ---------------------------------------------------------- *
 * 17. EVENT WIRING
 * ---------------------------------------------------------- */
function wireEvents(){
  el("#btn-delete").addEventListener("click", deleteLetter);
  el("#btn-shuffle").addEventListener("click", shuffleLetters);
  el("#btn-enter").addEventListener("click", submitGuess);
  el("#btn-hint").addEventListener("click", useHint);
  el("#btn-stuck").addEventListener("click", ()=> openModal("modal-reveal-confirm"));
  el("#btn-confirm-reveal").addEventListener("click", revealPuzzle);

  el("#pill-daily").addEventListener("click", ()=>switchMode("daily"));
  el("#pill-practice").addEventListener("click", ()=>switchMode("practice"));
  el("#btn-new-practice").addEventListener("click", ()=>{
    if(currentMode!=="practice") switchMode("practice");
    currentInput = [];
    newPracticePuzzle();
    renderAll();
  });

  el("#drawer-handle").addEventListener("click", ()=>{
    const open = el("#drawer").classList.contains("open");
    if(open) closeDrawer(); else openDrawer();
  });
  el("#drawer-backdrop").addEventListener("click", closeDrawer);
  el("#sort-select").addEventListener("change", renderDrawer);

  el("#btn-stats").addEventListener("click", ()=>{ renderStatsModal(); openModal("modal-stats"); });
  el("#btn-settings").addEventListener("click", ()=>{ renderSettingsModal(); openModal("modal-settings"); });
  el("#btn-rank-info").addEventListener("click", ()=>{ renderRankLadder(); openModal("modal-rankinfo"); });

  els("[data-close]").forEach(btn=>btn.addEventListener("click", closeAllModals));
  els(".modal-backdrop").forEach(bg=>bg.addEventListener("click", e=>{ if(e.target===bg) closeAllModals(); }));
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeAllModals(); });

  el("#toggle-hardmode").addEventListener("change", e=>{
    settings.hardMode = e.target.checked; saveSettings();
    showToast("Hard mode will apply to your next puzzle","default");
  });
  el("#toggle-reduce-motion").addEventListener("change", e=>{
    settings.reduceMotion = e.target.checked; saveSettings();
    document.body.classList.toggle("reduce-motion", settings.reduceMotion);
  });
  els("#theme-segmented .seg-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      settings.theme = btn.dataset.themeChoice; saveSettings();
      document.body.setAttribute("data-theme", settings.theme);
      renderSettingsModal();
    });
  });

  el("#btn-export").addEventListener("click", exportData);
  el("#btn-import").addEventListener("click", ()=> el("#import-file").click());
  el("#import-file").addEventListener("change", e=>{
    const f = e.target.files[0];
    if(f) importData(f);
    e.target.value = "";
  });

  document.addEventListener("keydown", e=>{
    if(els("[data-modal].open").length) return;
    if(!puzzle) return;
    const k = e.key.toLowerCase();
    if(/^[a-z]$/.test(k)){
      if(new Set(puzzle.letters).has(k)){ e.preventDefault(); appendLetter(k); }
    } else if(e.key==="Backspace"){ e.preventDefault(); deleteLetter(); }
    else if(e.key==="Enter"){ e.preventDefault(); submitGuess(); }
    else if(e.key==="Escape"){ clearInput(); }
  });
}

/* ---------------------------------------------------------- *
 * 18. INIT
 * ---------------------------------------------------------- */
async function init(){
  loadAll();
  document.body.setAttribute("data-theme", settings.theme);
  document.body.classList.toggle("reduce-motion", settings.reduceMotion);

  await loadDictionary();

  el("#loading-screen").classList.add("hidden");
  el("#game-screen").classList.remove("hidden");

  currentMode = "daily";
  loadDaily();
  wireEvents();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);

})();
