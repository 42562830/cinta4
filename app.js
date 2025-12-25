console.log("BUILD UXLEVELS 2025-12-25 v3 (Coach+WakeLock)");

        // --- DATA & CONFIG ---
        const LEVELS = [
            { name: "PRINCIPIANTE", spdBase: 5, spdHigh: 8, incMax: 3 },
            { name: "INTERMEDIO", spdBase: 7, spdHigh: 11, incMax: 6 },
            { name: "AVANZADO", spdBase: 9, spdHigh: 15, incMax: 10 }
        ];

        const BADGES = [
            { id: 'first', icon: '👟', name: 'Primer Paso', cond: (s) => s.sessions >= 1 },
            { id: 'fire', icon: '🔥', name: 'Racha 3 Días', cond: (s) => s.streak >= 3 },
            { id: 'marathon', icon: '🏅', name: '42km Club', cond: (s) => s.totalKm >= 42 },
            { id: 'flash', icon: '⚡', name: 'Velocista', cond: (s) => s.topSpeed >= 12 },
            { id: 'early', icon: '🌅', name: 'Madrugador', cond: (s, last) => last && new Date(last.date).getHours() < 9 }
        ];

        // --- DATABASE & LOGIC ---
        const db = {
            key: 'technorunner_pro_db',
            state: {
                user: null, // {name, age, weight, levelIdx}
                stats: { xp:0, level:1, totalKm:0, totalCal:0, sessions:0, streak:0, lastDate:null, topSpeed:0 },
                badges: [],
                history: [],
                week: { id:0, days:[] }
            },
            load: function() {
                const s = localStorage.getItem(this.key);
                if(s) try { this.state = JSON.parse(s); } catch(e) { localStorage.removeItem(this.key); }
                return !!this.state.user;
            },
            save: function() {
                localStorage.setItem(this.key, JSON.stringify(this.state));
            },
            addSession: function(s) {
                this.state.history.unshift(s);
                // Update Stats
                const st = this.state.stats;
                st.totalKm += s.dist; st.totalCal += s.cal; st.sessions++;
                if(s.maxSpd > st.topSpeed) st.topSpeed = s.maxSpd;
                
                // XP Logic (1km = 100XP)
                const gain = Math.floor((s.dist * 100) + (s.cal * 0.5));
                st.xp += gain;
                while(st.xp >= st.level*1000) { st.xp -= st.level*1000; st.level++; }

                // Streak
                const today = new Date().toDateString();
                if(st.lastDate) {
                    const yest = new Date(Date.now() - 86400000).toDateString();
                    if(st.lastDate === yest) st.streak++;
                    else if(st.lastDate !== today) st.streak = 1;
                } else st.streak = 1;
                st.lastDate = today;

                // Update Week Plan
                const dIdx = (new Date().getDay() + 6) % 7;
                if(this.state.week.days[dIdx]) this.state.week.days[dIdx].done = true;

                // Check Badges
                BADGES.forEach(b => {
                    if(!this.state.badges.includes(b.id) && b.cond(st, s)) {
                        this.state.badges.push(b.id);
                        alert(`¡INSIGNIA DESBLOQUEADA: ${b.name}!`);
                    }
                });

                this.save();
                return gain;
            }
        };

        const planner = {
            generate: function(lvlIdx) {
                // Generar semana si no existe o es nueva
                const wId = getWeekNum(new Date());
                if(db.state.week.id === wId && db.state.week.days.length > 0) return;

                const types = ['HIIT', 'REST', 'ENDURANCE', 'HILLS', 'REST', 'ENDURANCE', 'REST']; // Simple Logic
                const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                const newDays = days.map((d, i) => ({
                    day: d, type: types[i], done: false, dur: 30 + (lvlIdx*5)
                }));
                db.state.week = { id: wId, days: newDays };
                db.save();
            },
            render: function() {
                const c = document.getElementById('week-grid');
                c.innerHTML = '';
                const todayIdx = (new Date().getDay() + 6) % 7;
                const d = db.state.week.days;
                
                d.forEach((day, i) => {
                    const el = document.createElement('div');
                    el.className = `day-col ${i===todayIdx ? 'active' : ''}`;
                    let cls = 'day-dot';
                    if(day.done) cls += ' done';
                    else if(day.type !== 'REST' && i===todayIdx) cls += ' target';
                    
                    el.innerHTML = `<div style="font-size:0.7rem; font-weight:700;">${day.day}</div><div class="${cls}"></div>`;
                    c.appendChild(el);

                    if(i===todayIdx) {
                        document.getElementById('plan-today-type').innerText = day.type === 'REST' ? 'DESCANSO' : day.type;
                        document.getElementById('plan-today-dur').innerText = day.type === 'REST' ? 'Recuperación' : `${day.dur} min`;
                        const btn = document.getElementById('btn-do-today');
                        if(day.type === 'REST' || day.done) btn.style.display = 'none';
                        else {
                            btn.style.display = 'block';
                            btn.onclick = () => { ui.cat=day.type; ui.var='classic'; document.getElementById('rng-dur').value=day.dur; app.start(); };
                        }
                    }
                });
            }
        };

        function getWeekNum(d) {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
        }

        // --- UI CONTROLLER ---
        const ui = {
            updateStartLabel: function(){
                const btn = document.querySelector('#setup-view .btn-main[onclick="app.start()"]');
                if(!btn) return;
                const cat = (this.cat || 'HIIT');
                if(cat === 'HR'){
                    btn.innerText = 'COMENZAR POR PULSO';
                } else {
                    btn.innerText = 'COMENZAR LIBRE';
                }
            },
            cat: 'HIIT', var: 'classic',
            selectCat: function(c) {
                this.cat = c;
                document.querySelectorAll('.opt-card').forEach(e=>e.classList.remove('active'));
                document.getElementById('card-'+c.toLowerCase()).classList.add('active');
                document.querySelectorAll('.variant-scroll').forEach(e=>e.style.display='none');
                document.getElementById('vars-'+c).style.display='flex';
            this.updateStartLabel(); try{ app.updateModeBanner(); }catch(e){};
            },
            selectVar: function(v, el, ev) {
                if(ev) ev.stopPropagation();
                this.var = v;
                el.parentNode.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
                el.classList.add('active');
            },
            updateSliders: function() {
                const lvl = document.getElementById('rng-lvl').value;
                document.getElementById('disp-dur').innerText = document.getElementById('rng-dur').value + " min";
                document.getElementById('disp-lvl').innerText = LEVELS[lvl].name;
            this.updateStartLabel(); try{ app.updateModeBanner(); }catch(e){};
            },
            toast: function(msg){
                let t = document.getElementById('toast');
                if(!t){ t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
                t.textContent = msg;
                t.classList.add('show');
                clearTimeout(t._to);
                t._to = setTimeout(()=>t.classList.remove('show'), 1400);
            },
            openModal: function(title, html, onChoose){
                const m = document.getElementById('preview-modal');
                const t = document.getElementById('pm-title');
                const b = document.getElementById('pm-body');
                const c = document.getElementById('pm-choose');
                if(!m || !t || !b || !c) return;
                t.textContent = title || 'ENTRENAMIENTO';
                b.innerHTML = html || '';
                c.onclick = null;
                if(typeof onChoose === 'function'){
                    c.style.display = 'inline-flex';
                    c.onclick = () => { try{ onChoose(); } finally { ui.closeModal(); } };
                } else {
                    c.style.display = 'none';
                }
                m.style.display = 'flex';
            },
            closeModal: function(){
                const m = document.getElementById('preview-modal');
                if(m) m.style.display='none';
            },
            showScreen: function(id){
                document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
                const el = document.getElementById(id);
                if(el) el.classList.add('active');
            },
            openCatalog: async function(){ await app.renderCatalog(); ui.showScreen('catalog-view'); },
            openTest: function(){
                const r = document.getElementById('test-result');
                if(r) r.style.display='none';
                ui.showScreen('test-view');
            },

            goToTab: function(t) {
                document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
                
                if(t==='setup') { document.getElementById('setup-view').classList.add('active'); document.querySelectorAll('.tab-btn')[0].classList.add('active'); }
                if(t==='history') { 
                    app.renderHist(); document.getElementById('history-view').classList.add('active'); document.querySelectorAll('.tab-btn')[1].classList.add('active'); 
                }
                if(t==='profile') { 
                    app.renderProf(); document.getElementById('profile-view').classList.add('active'); document.querySelectorAll('.tab-btn')[2].classList.add('active'); 
                }
            },
            switchScreen: function(id) {
                document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                if(id==='workout-view' || id==='onboarding-view') document.getElementById('main-nav').style.display='none';
                else document.getElementById('main-nav').style.display='flex';
            }
        };

        // --- GENERATOR & APP LOGIC ---
        
// --- WORKOUT CATALOG (JSON) ---
// Nota: esta versión usa los templates y el builder de technorunner_A_TOPE (HIIT/HR/FARTLEK bien estructurados),
// pero mantiene la interfaz que la UI v3 espera (pick/toSegments).
const workoutCatalog = {
  data: null,

  // Carga catálogo y normaliza campos esperados por la UI (durMin, minLevel, maxLevel, stimulus, hardness, tags).
  async load() {
    if (this.data) return this.data;
    try {
      const res = await fetch("./data/workouts.core.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("catalog fetch failed");
      const raw = await res.json();

      const intensityToHardness = (intensity) => {
        const x = String(intensity || "").toLowerCase();
        if (x === "easy" || x === "recovery") return 2;
        if (x === "high") return 4;
        if (x === "very_high") return 5;
        return 3; // moderate default
      };

      const goalToStimulus = (goal) => {
        const g = String(goal || "").toLowerCase();
        if (!g) return null;
        if (g.includes("vo2")) return "vo2";
        if (g.includes("threshold")) return "threshold";
        if (g.includes("recovery")) return "recovery";
        if (g.includes("aerobic") || g.includes("base")) return "aerobic";
        return g;
      };

      const totalSec = (w) => {
        try {
          let t = 0;
          for (const it of (w.structure || [])) {
            if (it && it.repeat && Array.isArray(it.block)) {
              for (let r = 0; r < it.repeat; r++) for (const b of it.block) t += Number(b.sec || 0);
            } else {
              t += Number(it?.sec || 0);
            }
          }
          return t;
        } catch (e) { return 0; }
      };

      // normaliza
      raw.workouts = (raw.workouts || []).map((w) => {
        const baseSec = totalSec(w);
        const durMin = w.durMin || (baseSec ? Math.max(5, Math.round(baseSec / 60)) : 20);
        const hardness = (w.hardness != null) ? w.hardness : intensityToHardness(w.intensity);
        const stimulus = (w.stimulus != null) ? w.stimulus : goalToStimulus(w.goal);

        const tags = Array.isArray(w.tags) ? w.tags.slice() : [];
        // tags útiles para búsqueda/filtrado
        if (w.type && !tags.includes(w.type)) tags.push(w.type);
        if (w.variant && !tags.includes(w.variant)) tags.push(w.variant);
        if (w.goal && !tags.includes(w.goal)) tags.push(w.goal);
        if (w.intensity && !tags.includes(w.intensity)) tags.push(w.intensity);

        return {
          ...w,
          durMin,
          minLevel: (w.minLevel != null) ? w.minLevel : 0,
          maxLevel: (w.maxLevel != null) ? w.maxLevel : 10,
          stimulus,
          hardness,
          tags
        };
      });

      this.data = raw;
      return this.data;
    } catch (e) {
      this.data = null;
      return null;
    }
  },

  // fallback legacy scaling (se usa dentro del builder A_TOPE)
  buildSegments(workout, desiredMin) {
    const flat = [];
    const push = (s) => flat.push({ ...s });

    for (const it of (workout?.structure || [])) {
      if (it?.repeat && Array.isArray(it.block)) {
        for (let r = 0; r < it.repeat; r++) for (const b of it.block) push(b);
      } else push(it);
    }

    const baseTotal = flat.reduce((a, s) => a + (Number(s.sec || 0)), 0);
    const targetTotal = Math.round(Number(desiredMin || 0) * 60);

    let scaled = flat.map(s => ({ ...s }));
    if (baseTotal > 0 && targetTotal > 0) {
      const factor = targetTotal / baseTotal;
      const minSec = (t) => (t === "warm" || t === "cool") ? 120 : 30;

      scaled = scaled.map(s => {
        const raw = Number(s.sec || 0) * factor;
        const rounded = Math.max(minSec(s.type), Math.round(raw / 5) * 5);
        return { ...s, sec: rounded };
      });

      // corrige deriva en el último bloque "útil"
      const nowTotal = scaled.reduce((a, s) => a + (Number(s.sec || 0)), 0);
      let diff = targetTotal - nowTotal;
      if (Math.abs(diff) >= 5 && scaled.length) {
        let idx = scaled.length - 1;
        for (let i = scaled.length - 1; i >= 0; i--) {
          if (scaled[i].type !== "warm") { idx = i; break; }
        }
        scaled[idx].sec = Math.max(minSec(scaled[idx].type), Number(scaled[idx].sec || 0) + diff);
      }
    }

    return scaled.map(s => ({
      name: s.name || "Bloque",
      type: s.type || "steady",
      dur: Number(s.sec || 60),
      inc: Number(s.inc || 0),
      hrTarget: s.hrTarget || null,
      spdKey: s.spdKey || null
    }));
  },

  // Selección: prioriza variante si existe, evita repetición inmediata y permite escalar a cualquier duración.
  async pick({ cat, variant, durMin, lvlIdx }) {
    const catData = await this.load();
    if (!catData || !Array.isArray(catData.workouts)) return null;

    let pool = catData.workouts.filter(w => w.cat === cat);
    if (!pool.length) return null;

    // Si la UI pide una variante que existe en el catálogo, la respetamos.
    const hasVariant = pool.some(w => w.variant === variant);
    if (variant && hasVariant) pool = pool.filter(w => w.variant === variant);

    // evita repetir el mismo id de la sesión anterior
    const lastId = (db.state.history && db.state.history[0]) ? db.state.history[0].wid : null;
    const noRepeat = pool.filter(w => w.id !== lastId);
    if (noRepeat.length) pool = noRepeat;

    // determinista por día (más "estable" que random)
    const now = new Date();
    const dayKey = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
    return pool[dayKey % pool.length];
  },

  // Convierte workout -> segmentos para la UI v3. Escala duración usando builder A_TOPE.
  toSegments(workout, lvl, desiredMin) {
    const desired = Number(desiredMin || workout?.durMin || 20);

    // builder (A_TOPE) devuelve segmentos con spdKey (easy/steady/hard) y hrTarget opcional
    const rawSegs = (typeof builder !== "undefined" && builder?.build)
      ? builder.build(workout, desired)
      : this.buildSegments(workout, desired);

    const mapType = (t) => {
      const x = String(t || "").toLowerCase();
      if (x === "warm") return "warm";
      if (x === "cool") return "cool";
      if (x === "work" || x === "hard" || x === "sprint" || x === "hiit") return "high";
      if (x === "rest" || x === "easy" || x === "recovery") return "low";
      if (x === "steady" || x === "mid") return "mid";
      return "mid";
    };

    const spdFromKey = (key, base) => {
      const k = String(key || "").toLowerCase();
      const spdBase = (lvl?.spdBase ?? base ?? 9);
      const spdHigh = (lvl?.spdHigh ?? (spdBase + 2));
      if (k === "hard") return spdHigh;
      if (k === "steady") return spdBase;
      if (k === "easy") return Math.max(3, spdBase - 1.5);
      // fallback
      return spdBase;
    };

    return rawSegs.map(s => ({
      type: mapType(s.type),
      name: s.name || "BLOQUE",
      dur: Number(s.dur || 60),
      spd: spdFromKey(s.spdKey, lvl?.spdBase),
      inc: Number(s.inc || 0),
      // para HR Coach (lo usamos en loadSeg)
      hrTarget: s.hrTarget || null
    }));
  }
};


// ===== BUILDER PRO (Point 2) =====
const builder = {
  // Helper: clamp
  clamp(v, a, b){ return Math.max(a, Math.min(b, v)); },

  // Build segments for a workout to match desired duration (minutes), using type-specific logic.
  build(workout, desiredMin){
    if(!workout) throw new Error("builder.build: workout requerido");
    const t = workout.type || "default";
    if(t === "tabata") return this.buildTabata(workout, desiredMin);
    if(t === "pyramid") return this.buildPyramid(workout, desiredMin);
    if(t === "everest") return this.buildEverest(workout, desiredMin);
    if(t === "steady" || t === "long" || t === "recovery") return this.buildSteady(workout, desiredMin);
    if(t === "fartlek_random") return this.buildFartlekRandom(workout, desiredMin);
    // Fallback to legacy scaling (still deterministic) for other types for now.
    return workoutCatalog.buildSegments(workout, desiredMin);
  },

  buildTabata(workout, desiredMin){
    // Preserve 20/10 ratio and round counts. Adjust by number of sets and set-rest, then warm/cool.
    const p = workout.params || {};
    const workSec = Number(p.workSec || 20);
    const restSec = Number(p.restSec || 10);
    const roundsPerSet = Number(p.roundsPerSet || 8);
    const setRestSecDefault = Number(p.setRestSec || 120);

    // Total desired seconds
    const targetTotal = Math.round(Number(desiredMin||0) * 60);

    // Warmup/cooldown bounds
    // - For short sessions, keep 3-4 min each
    // - For longer, warm up up to 10, cool 5-8
    let warm = this.clamp(Math.round(targetTotal * 0.18), 180, 600); // 3–10 min
    let cool = this.clamp(Math.round(targetTotal * 0.12), 180, 480); // 3–8 min

    // Remaining for sets+rests
    let remaining = targetTotal - warm - cool;
    if(remaining < 240){ // if too short, reduce warm/cool but keep minimums
      warm = 180; cool = 180;
      remaining = targetTotal - warm - cool;
    }

    const oneRound = workSec + restSec;
    const setWork = roundsPerSet * oneRound; // includes rest after each work
    // Tabata convention often ends with rest; we'll keep as defined in template.

    // Determine number of sets and set-rest to fit remaining.
    // Start with 2 sets minimum if remaining allows, else 1.
    const minSets = remaining >= (setWork + 60) ? 2 : 1;

    // We'll search best combination: sets 1..12, setRest 30..180 step 15s
    let best = null;
    for(let sets=minSets; sets<=12; sets++){
      for(let setRest=30; setRest<=180; setRest+=15){
        // total = sets*setWork + (sets-1)*setRest
        const total = sets*setWork + (sets-1)*setRest;
        const diff = Math.abs(remaining - total);
        // Penalize huge number of sets for long sessions
        const score = diff + (sets>6 ? (sets-6)*20 : 0) + Math.abs(setRest-setRestSecDefault)*0.1;
        if(!best || score < best.score){
          best = {sets, setRest, total, diff, score};
        }
      }
    }

    // If still too long/short, adjust by stretching setRest slightly (within bounds)
    let sets = best.sets;
    let setRest = best.setRest;

    // Now build segments: warm, sets, cool
    const segs = [];
    segs.push({type:"warm", name:"Calentamiento", dur:warm, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
    for(let s=1; s<=sets; s++){
      for(let r=1; r<=roundsPerSet; r++){
        segs.push({type:"work", name:`Sprint ${r}/${roundsPerSet}`, dur:workSec, inc:0, hrTarget:null, spdKey:"hard"});
        segs.push({type:"rest", name:`Recuperación ${r}/${roundsPerSet}`, dur:restSec, inc:0, hrTarget:null, spdKey:"easy"});
      }
      if(s<sets){
        segs.push({type:"rest", name:`Descanso entre sets (${s}/${sets-1})`, dur:setRest, inc:0, hrTarget:null, spdKey:"easy"});
      }
    }
    segs.push({type:"cool", name:"Vuelta a la calma", dur:cool, inc:0, hrTarget:{z:1,label:"Z1"}, spdKey:"easy"});

    // Fix drift: adjust cooldown (preferred) then warm if needed to hit exact target
    const totalNow = segs.reduce((a,x)=>a+x.dur,0);
    let drift = targetTotal - totalNow;
    if(drift !== 0){
      // adjust cooldown within [180, 720]
      const coolIdx = segs.findIndex(x=>x.type==="cool");
      if(coolIdx>=0){
        const newCool = this.clamp(segs[coolIdx].dur + drift, 180, 720);
        drift -= (newCool - segs[coolIdx].dur);
        segs[coolIdx].dur = newCool;
      }
      if(drift !== 0){
        const warmIdx = segs.findIndex(x=>x.type==="warm");
        if(warmIdx>=0){
          const newWarm = this.clamp(segs[warmIdx].dur + drift, 180, 720);
          drift -= (newWarm - segs[warmIdx].dur);
          segs[warmIdx].dur = newWarm;
        }
      }
      // If still drift (edge case), add/subtract on last rest segment
      if(drift !== 0){
        for(let i=segs.length-1;i>=0;i--){
          if(segs[i].type==="rest"){
            const newDur = this.clamp(segs[i].dur + drift, 10, 600);
            drift -= (newDur - segs[i].dur);
            segs[i].dur = newDur;
            break;
          }
        }
      }
    }

    // Final sanity: ensure exact total
    const finalTotal = segs.reduce((a,x)=>a+x.dur,0);
    if(finalTotal !== targetTotal){
      // Force final segment to fix 1-2s drift
      const idx = segs.length-1;
      segs[idx].dur += (targetTotal - finalTotal);
    }

    return segs;

  },

  buildPyramid(workout, desiredMin){
    // PRO Pyramid: preserve shape, avoid weird seconds, and fit exact duration.
    // Strategy:
    // - Choose peak (3..7) and base unit (45/60/75/90)
    // - Work/rest ratio fixed 1:1 (simple & effective)
    // - For long sessions, allow "set" structure: repeat pyramid 2 times with a longer mid-rest.
    const targetTotal = Math.round(Number(desiredMin||0)*60);

    let warm = this.clamp(Math.round(targetTotal*0.16), 180, 600);
    let cool = this.clamp(Math.round(targetTotal*0.12), 180, 480);

    // Keep at least 6 min of main content
    if(targetTotal - warm - cool < 360){
      warm = 180; cool = 180;
    }

    const remaining = targetTotal - warm - cool;

    const units = [45, 60, 75, 90];
    const peaks = [3,4,5,6,7];

    // Build a pyramid sequence for a peak
    const seqFor = (peak)=>{
      const seq=[];
      for(let i=1;i<=peak;i++) seq.push(i);
      for(let i=peak-1;i>=1;i--) seq.push(i);
      return seq;
    };

    // Optional: for long duration, split into 2 pyramids (same peak) with a mid rest.
    // We'll evaluate both "single" and "double" modes.
    let best=null;

    const scoreCand = (cand)=>{
      // Lower diff better, prefer no crazy huge peaks for short workouts
      let score = cand.diff;
      if(desiredMin<=30) score += Math.abs(cand.peak-4)*40;
      if(desiredMin>=60) score += Math.abs(cand.peak-6)*25;
      // Prefer cleaner unit (60/75)
      score += (cand.unit===60 || cand.unit===75) ? 0 : 15;
      // Penalize too many segments (double mode adds more)
      score += cand.mode==="double" ? 30 : 0;
      return score;
    };

    for(const unit of units){
      for(const peak of peaks){
        const seq = seqFor(peak);
        const workTotal = seq.reduce((a,l)=>a+(l*unit),0);
        const restTotal = workTotal; // 1:1
        const singleTotal = workTotal + restTotal;

        // Candidate A: single pyramid
        {
          const diff = Math.abs(remaining - singleTotal);
          const cand = {mode:"single", unit, peak, seq, midRest:0, total:singleTotal, diff};
          cand.score = scoreCand(cand);
          if(!best || cand.score < best.score) best=cand;
        }

        // Candidate B: double pyramid (two pyramids) for long durations
        if(desiredMin >= 50){
          // Two pyramids + midRest (2-6 min) adjustable in 15s steps
          for(let midRest=120; midRest<=360; midRest+=15){
            const total = 2*singleTotal + midRest;
            const diff = Math.abs(remaining - total);
            const cand = {mode:"double", unit, peak, seq, midRest, total, diff};
            cand.score = scoreCand(cand);
            if(!best || cand.score < best.score) best=cand;
          }
        }
      }
    }

    // Build segments with spdKey
    const segs=[];
    segs.push({type:"warm", name:"Calentamiento", dur:warm, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});

    const emitPyramid = (tag)=>{
      for(const lvl of best.seq){
        // Work block: hard; Rest block: easy
        const wdur = lvl*best.unit;
        const rdur = lvl*best.unit;
        segs.push({type:"work", name:`Fuerte · Nivel ${lvl}${tag}`, dur:wdur, inc:0, hrTarget:null, spdKey:"hard"});
        segs.push({type:"rest", name:`Suave · Nivel ${lvl}${tag}`, dur:rdur, inc:0, hrTarget:null, spdKey:"easy"});
      }
    };

    if(best.mode === "single"){
      emitPyramid("");
    }else{
      emitPyramid(" · Set 1");
      segs.push({type:"rest", name:"Descanso entre sets", dur:best.midRest, inc:0, hrTarget:null, spdKey:"easy"});
      emitPyramid(" · Set 2");
    }

    segs.push({type:"cool", name:"Vuelta a la calma", dur:cool, inc:0, hrTarget:{z:1,label:"Z1"}, spdKey:"easy"});

    // Drift correction: adjust cooldown then warm then last rest
    let drift = targetTotal - segs.reduce((a,x)=>a+x.dur,0);
    if(drift!==0){
      const ci = segs.findIndex(x=>x.type==="cool");
      if(ci>=0){
        const newCool = this.clamp(segs[ci].dur + drift, 180, 900);
        drift -= (newCool - segs[ci].dur);
        segs[ci].dur = newCool;
      }
      if(drift!==0){
        const wi = segs.findIndex(x=>x.type==="warm");
        if(wi>=0){
          const newWarm = this.clamp(segs[wi].dur + drift, 180, 900);
          drift -= (newWarm - segs[wi].dur);
          segs[wi].dur = newWarm;
        }
      }
      if(drift!==0){
        for(let i=segs.length-1;i>=0;i--){
          if(segs[i].type==="rest"){
            segs[i].dur = this.clamp(segs[i].dur + drift, 10, 1200);
            drift = 0;
            break;
          }
        }
      }
    }

    // Final exact fix (1-2s)
    const finalTotal = segs.reduce((a,x)=>a+x.dur,0);
    if(finalTotal !== targetTotal){
      segs[segs.length-1].dur += (targetTotal-finalTotal);
    }
    return segs;
  },

  buildEverest(workout, desiredMin){
    const targetTotal = Math.round(Number(desiredMin||0)*60);
    let warm = this.clamp(Math.round(targetTotal*0.14), 180, 600);
    let cool = this.clamp(Math.round(targetTotal*0.10), 180, 480);
    let remaining = targetTotal - warm - cool;
    if(remaining < 420){ warm=180; cool=180; remaining = targetTotal-warm-cool; }

    const stepSecs=[45,60,75,90];
    let best=null;
    for(const stepSec of stepSecs){
      for(let steps=5; steps<=10; steps++){
        const levels = (2*steps-1);
        const total = levels*(2*stepSec);
        const diff = Math.abs(remaining-total);
        const score = diff + Math.abs(steps-8)*10;
        if(!best || score<best.score) best={stepSec, steps, total, diff, score};
      }
    }

    const segs=[];
    segs.push({type:"warm", name:"Calentamiento", dur:warm, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});

    const up=Array.from({length:best.steps},(_,i)=>i+1);
    const down=Array.from({length:best.steps-1},(_,i)=>best.steps-1-i);
    const ladder=up.concat(down);

    for(const lvl of ladder){
      const inc = Math.min(12, Math.max(1, lvl+2));
      segs.push({type:"work", name:`Subida · Nivel ${lvl}`, dur:best.stepSec, inc:inc, hrTarget:null, spdKey:"steady"});
      segs.push({type:"rest", name:`Recuperación · Nivel ${lvl}`, dur:best.stepSec, inc:0, hrTarget:null, spdKey:"easy"});
    }

    segs.push({type:"cool", name:"Vuelta a la calma", dur:cool, inc:0, hrTarget:{z:1,label:"Z1"}, spdKey:"easy"});

    let drift = targetTotal - segs.reduce((a,x)=>a+x.dur,0);
    if(drift!==0){
      const ci=segs.findIndex(x=>x.type==="cool");
      if(ci>=0){
        const newCool=this.clamp(segs[ci].dur+drift,180,900);
        drift -= (newCool-segs[ci].dur);
        segs[ci].dur=newCool;
      }
      if(drift!==0){
        const wi=segs.findIndex(x=>x.type==="warm");
        if(wi>=0){
          const newWarm=this.clamp(segs[wi].dur+drift,180,900);
          drift -= (newWarm-segs[wi].dur);
          segs[wi].dur=newWarm;
        }
      }
      if(drift!==0){
        for(let i=segs.length-1;i>=0;i--){
          if(segs[i].type==="rest"){ segs[i].dur=this.clamp(segs[i].dur+drift,10,900); break; }
        }
      }
    }
    const finalTotal=segs.reduce((a,x)=>a+x.dur,0);
    if(finalTotal!==targetTotal) segs[segs.length-1].dur += (targetTotal-finalTotal);
    return segs;
  },


    buildFartlekRandom(workout, desiredMin){
  const p = workout.params || {};
  const targetTotal = Math.round(Number(desiredMin||0)*60);
  // Modes:
  // - (default) random pairs (existing behaviour)
  // - 30_30
  // - semaforo
  // - piramide
  // - boss
  const mode = String(p.mode || p.pattern || "random");
  // Warm/Cool as minutes, bounded for normal people
  let warm = this.clamp(Math.round(Number(p.warmMin ?? 8)*60), 180, 900);
  let cool = this.clamp(Math.round(Number(p.coolMin ?? 5)*60), 180, 720);
  let core = targetTotal - warm - cool;
  if(core < 300){ warm = 180; cool = 180; core = targetTotal - warm - cool; }
  const segs=[];
  const push = (seg)=>segs.push(seg);
  // Helpers
  const addTail = (rem)=>{
    if(rem <= 0) return;
    const key = (rem >= 240) ? "steady" : "easy";
    const label = (rem >= 240) ? "Ritmo constante" : "Suave";
    push({type:key, name:label, dur:rem, inc:0, hrTarget:{z:3,label:"Z3"}, spdKey:key});
  };
  push({type:"warm", name:"Calentamiento", dur:warm, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
  // ===== MODE: 30/30 =====
  if(mode === "30_30" || mode === "30/30"){
    const hard = this.clamp(Number(p.hardSec ?? 30), 10, 180);
    const easy = this.clamp(Number(p.easySec ?? 30), 10, 300);
    let used = 0;
    let rep = 1;
    while(used + hard + easy <= core){
      push({type:"work", name:`Rep ${rep} · 30" fuerte`, dur:hard, inc:0, hrTarget:{z:4,label:"Z4"}, spdKey:"hard"});
      push({type:"rest", name:`Rep ${rep} · 30" suave`, dur:easy, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
      used += hard + easy;
      rep++;
    }
    addTail(core - used);
  }
  // ===== MODE: SEMÁFORO =====
  else if(mode === "semaforo"){
    const g = this.clamp(Number(p.greenSec ?? 60), 20, 300);  // Z2
    const y = this.clamp(Number(p.yellowSec ?? 45), 15, 240); // Z3
    const r = this.clamp(Number(p.redSec ?? 30), 10, 180);    // Z4
    const cycle = g + y + r;
    let used = 0;
    let c = 1;
    while(used + cycle <= core){
      push({type:"rest",   name:`Ciclo ${c} · 🟢 Verde`,   dur:g, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
      push({type:"steady", name:`Ciclo ${c} · 🟡 Amarillo`, dur:y, inc:0, hrTarget:{z:3,label:"Z3"}, spdKey:"steady"});
      push({type:"work",   name:`Ciclo ${c} · 🔴 Rojo`,    dur:r, inc:0, hrTarget:{z:4,label:"Z4"}, spdKey:"hard"});
      used += cycle;
      c++;
    }
    addTail(core - used);
  }
  // ===== MODE: PIRÁMIDE HR =====
  else if(mode === "piramide" || mode === "piramide_hr"){
    const steps = Array.isArray(p.steps) ? p.steps.map(Number).filter(Boolean) : [30,45,60,90,60,45,30];
    const rec = this.clamp(Number(p.recSec ?? 60), 20, 180); // Z2 between efforts
    let used = 0;
    let pyr = 1;
    const onePyr = steps.reduce((a,s)=>a+s,0) + rec*(steps.length-1);
    while(used + onePyr <= core){
      for(let i=0;i<steps.length;i++){
        const s = steps[i];
        push({type:"work", name:`Pirámide ${pyr} · ${s}" fuerte`, dur:s, inc:0, hrTarget:{z:4,label:"Z4"}, spdKey:"hard"});
        if(i < steps.length-1){
          push({type:"rest", name:`Pirámide ${pyr} · Recupera`, dur:rec, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
        }
      }
      used += onePyr;
      pyr++;
    }
    // If there's space, try to fit a partial pyramid from the start
    let rem = core - used;
    for(let i=0;i<steps.length;i++){
      const s = steps[i];
      const need = s + (i < steps.length-1 ? rec : 0);
      if(rem < need) break;
      push({type:"work", name:`Pirámide · ${s}" fuerte`, dur:s, inc:0, hrTarget:{z:4,label:"Z4"}, spdKey:"hard"});
      rem -= s;
      if(i < steps.length-1 && rem >= rec){
        push({type:"rest", name:`Pirámide · Recupera`, dur:rec, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
        rem -= rec;
      }
    }
    addTail(rem);
  }
  // ===== MODE: BOSS FIGHT =====
  else if(mode === "boss" || mode === "boss_fight"){
    const hard = this.clamp(Number(p.hardSec ?? 45), 10, 180);
    const easy = this.clamp(Number(p.easySec ?? 45), 10, 300);
    const bossZ = this.clamp(Number(p.bossZ ?? 5), 4, 5);
    // Allocate boss segment as 10–18% of total, bounded
    let bossSec = this.clamp(Math.round(targetTotal * Number(p.bossPct ?? 0.12)), 90, 240);
    if(core < bossSec + hard + easy + 60){
      bossSec = this.clamp(core - (hard+easy), 60, bossSec);
    }
    let preBoss = core - bossSec;
    let used = 0;
    let rep = 1;
    while(used + hard + easy <= preBoss){
      push({type:"work", name:`Ronda ${rep} · Fuerte`, dur:hard, inc:0, hrTarget:{z:4,label:"Z4"}, spdKey:"hard"});
      push({type:"rest", name:`Ronda ${rep} · Recupera`, dur:easy, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
      used += hard + easy;
      rep++;
    }
    // Smooth remainder before boss
    const rem = preBoss - used;
    if(rem > 0){
      const key = (rem >= 90) ? "steady" : "easy";
      push({type:key, name:"Preparación", dur:rem, inc:0, hrTarget:{z:3,label:"Z3"}, spdKey:key});
    }
    push({type:"work", name:"BOSS · Aprieta", dur:bossSec, inc:0, hrTarget:{z:bossZ,label:`Z${bossZ}`}, spdKey:"hard"});
  }
  // ===== DEFAULT: RANDOM (existing) =====
  else {
    const hardMin = this.clamp(Number(p.hardSecMin ?? 20), 10, 180);
    const hardMax = this.clamp(Number(p.hardSecMax ?? 90), hardMin, 240);
    const easyMin = this.clamp(Number(p.easySecMin ?? 40), 10, 420);
    const easyMax = this.clamp(Number(p.easySecMax ?? 200), easyMin, 600);
    const pairsMin = this.clamp(Number(p.pairsMin ?? 8), 2, 40);
    const pairsMax = this.clamp(Number(p.pairsMax ?? 18), pairsMin, 60);
    const randInt = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
    // Build random pairs (hard/easy) until core budget filled.
    const targetPairs = randInt(pairsMin, pairsMax);
    let used = 0;
    let pair = 1;
    while(pair <= targetPairs){
      const hard = randInt(hardMin, hardMax);
      const easy = randInt(easyMin, easyMax);
      if(used + hard + easy > core) break;
      push({type:"work", name:`Cambio ${pair} · Ritmo vivo`, dur:hard, inc:0, hrTarget:{z:4,label:"Z4"}, spdKey:"hard"});
      push({type:"rest", name:`Cambio ${pair} · Recupera`, dur:easy, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});
      used += hard + easy;
      pair++;
    }
    addTail(core - used);
  }
  push({type:"cool", name:"Vuelta a la calma", dur:cool, inc:0, hrTarget:{z:1,label:"Z1"}, spdKey:"easy"});
  // drift fix: adjust cooldown then warmup to match exact targetTotal
  let drift = targetTotal - segs.reduce((a,x)=>a+x.dur,0);
  if(drift !== 0){
    const ci = segs.findIndex(x=>x.type==="cool");
    if(ci>=0){
      const newCool = this.clamp(segs[ci].dur + drift, 180, 900);
      drift -= (newCool - segs[ci].dur);
      segs[ci].dur = newCool;
    }
    if(drift !== 0){
      const wi = segs.findIndex(x=>x.type==="warm");
      if(wi>=0){
        const newWarm = this.clamp(segs[wi].dur + drift, 180, 900);
        drift -= (newWarm - segs[wi].dur);
        segs[wi].dur = newWarm;
      }
    }
    if(drift !== 0){
      // final fallback: add drift to last segment
      segs[segs.length-1].dur = Math.max(60, segs[segs.length-1].dur + drift);
    }
  }
  return segs;
  },


  buildSteady(workout, desiredMin){
    const targetTotal = Math.round(Number(desiredMin||0)*60);
    let warm = this.clamp(Math.round(targetTotal*0.15), 180, 600);
    let cool = this.clamp(Math.round(targetTotal*0.10), 180, 480);
    let main = targetTotal - warm - cool;
    if(main < 300){ warm=180; cool=180; main=targetTotal-warm-cool; }

    const segs=[];
    segs.push({type:"warm", name:"Calentamiento", dur:warm, inc:0, hrTarget:{z:2,label:"Z2"}, spdKey:"easy"});

    const label = (workout.type==="recovery") ? "Recuperación" : "Ritmo constante";
    const key = (workout.type==="recovery") ? "easy" : "steady";
    segs.push({type:"steady", name:label, dur:main, inc:0, hrTarget:null, spdKey:key});

    segs.push({type:"cool", name:"Vuelta a la calma", dur:cool, inc:0, hrTarget:{z:1,label:"Z1"}, spdKey:"easy"});

    const finalTotal=segs.reduce((a,x)=>a+x.dur,0);
    if(finalTotal!==targetTotal) segs[segs.length-1].dur += (targetTotal-finalTotal);
    return segs;
  }

};
// ===== END BUILDER =====



const generator = {
            build: function(cat, vart, dur, lvl) {
                let segs = [];
                const warm=300, cool=300;
                const work = (dur*60) - warm - cool;
                segs.push({type:'warm', name:'CALENTAMIENTO', dur:warm, spd:lvl.spdBase-2, inc:0});

                if(cat==='HIIT') {
                    if(vart==='classic') {
                        let t=0; while(t<work){ segs.push({type:'high', name:'SPRINT', dur:60, spd:lvl.spdHigh, inc:1}); segs.push({type:'low', name:'RECUPERA', dur:60, spd:lvl.spdBase, inc:0}); t+=120; }
                    } else if(vart==='tabata') {
                        let t=0; while(t<work){ for(let i=0;i<8;i++){ segs.push({type:'high', name:'TABATA', dur:20, spd:lvl.spdHigh+1, inc:1}); segs.push({type:'low', name:'PAUSA', dur:10, spd:3, inc:0}); } segs.push({type:'low', name:'DESCANSO', dur:60, spd:lvl.spdBase, inc:0}); t+=300; }
                    } else { // pyramid
                        let steps=[30,60,90,60,30], idx=0, t=0; while(t<work){ let d=steps[idx%5]; segs.push({type:'high', name:'INTENSIDAD', dur:d, spd:lvl.spdHigh, inc:1}); segs.push({type:'low', name:'RECUPERA', dur:d, spd:lvl.spdBase, inc:0}); t+=d*2; idx++; }
                    }
                } else if(cat==='HILLS') {
                    let t=0; while(t<work){ let hard=Math.random()>0.5; segs.push({type:hard?'high':'mid', name:hard?'SUBIDA':'PENDIENTE', dur:120, spd:lvl.spdBase, inc:hard?lvl.incMax:Math.floor(lvl.incMax/2)}); t+=120; }
                } else {
                    segs.push({type:'mid', name:'RITMO CONSTANTE', dur:work, spd:lvl.spdHigh-2, inc:1});
                }
                segs.push({type:'cool', name:'ENFRIAMIENTO', dur:cool, spd:4, inc:0});
                return segs;
            }
        };

        const app = {

            selectedWorkout: null, // persistente (elegido en catálogo)
            manualWorkout: null,   // one-shot (ej. test)

            // --- WAKE LOCK ---
            wakeLockSentinel: null,
            inWorkout: false,
            async requestWakeLock(){
                try{
                    if(!('wakeLock' in navigator)) return;
                    if(this.wakeLockSentinel) return;
                    this.wakeLockSentinel = await navigator.wakeLock.request('screen');
                    this.wakeLockSentinel.addEventListener?.('release', ()=>{
                        this.wakeLockSentinel = null;
                    });
                }catch(e){
                    // ignore: not supported or permission denied
                    this.wakeLockSentinel = null;
                }
            },
            async releaseWakeLock(){
                try{
                    if(this.wakeLockSentinel){
                        await this.wakeLockSentinel.release();
                        this.wakeLockSentinel = null;
                    }
                }catch(e){
                    this.wakeLockSentinel = null;
                }
            },

            // --- COACH UI (objetivo + acción) ---
            _coach:{ objEl:null, actEl:null },
            coachInit(){
                if(this._coach.objEl && this._coach.actEl) return;
                this._coach.objEl = document.getElementById('coach-obj');
                this._coach.actEl = document.getElementById('coach-act');
            },
            coachSet(objTxt, actTxt, state){
                this.coachInit();
                const o = this._coach.objEl;
                const a = this._coach.actEl;
                if(o) o.textContent = objTxt || 'OBJETIVO: —';
                if(a){
                    a.textContent = actTxt || 'ACCIÓN: —';
                    a.classList.remove('good','low','high');
                    if(state) a.classList.add(state);
                }
            },
            coachFormatBpmRange(zMin, zMax){
                const age = db.state.user?.age;
                const b1 = this.hrCoach.zoneBounds(age, zMin);
                const b2 = this.hrCoach.zoneBounds(age, zMax);
                const lo = Math.min(b1.min, b2.min);
                const hi = Math.max(b1.max, b2.max);
                return `${lo}–${hi} bpm`;
            },
            coachUpdateForSegment(seg){
                if(!seg){ this.coachSet('OBJETIVO: —','ACCIÓN: —'); return; }

                // HR-guided
                if(seg.hrTarget && (seg.hrTarget.z || seg.hrTarget.zMin)){
                    const zMin = seg.hrTarget.zMin || seg.hrTarget.z || 2;
                    const zMax = seg.hrTarget.zMax || zMin;
                    const lbl = seg.hrTarget.label || `Z${zMin}`;
                    const rng = this.coachFormatBpmRange(zMin, zMax);
                    const obj = `OBJETIVO: ${lbl} · ${rng}`;

                    if(!this.hr.connected){
                        this.coachSet(obj, 'ACCIÓN: conecta el pulsómetro y entra en la zona', 'low');
                    } else if(typeof this.hr.bpm !== 'number'){
                        this.coachSet(obj, 'ACCIÓN: esperando lectura de pulso…', 'low');
                    } else {
                        this.coachUpdateLive();
                    }
                    return;
                }

                // Speed-guided
                const spd = (typeof seg.spd === 'number') ? seg.spd.toFixed(1) : '—';
                const inc = (seg.inc != null) ? String(seg.inc) : '—';
                const obj = `OBJETIVO: ${spd} km/h · ${inc}%`;

                let act = `ACCIÓN: ajusta la cinta a ${spd} km/h`;
                if(Number(inc) > 0) act += ` y ${inc}%`;
                // Add a tiny human hint by block type (purely text)
                if(seg.type === 'warm') act = 'ACCIÓN: calienta suave, respiración cómoda';
                if(seg.type === 'cool') act = 'ACCIÓN: baja intensidad y recupera';
                if(seg.type === 'high') act += ' · aprieta con control';
                if(seg.type === 'low') act += ' · recupera';

                this.coachSet(obj, act);
            },
            coachUpdateLive(){
                const seg = this.data?.[this.idx];
                if(!seg || !seg.hrTarget) return;

                const zMin = seg.hrTarget.zMin || seg.hrTarget.z || 2;
                const zMax = seg.hrTarget.zMax || zMin;
                const lbl = seg.hrTarget.label || `Z${zMin}`;

                const age = db.state.user?.age;
                const bMin = this.hrCoach.zoneBounds(age, zMin).min;
                const bMax = this.hrCoach.zoneBounds(age, zMax).max;
                const bpm = this.hr.bpm;
                const tol = 3;

                const obj = `OBJETIVO: ${lbl} · ${this.coachFormatBpmRange(zMin, zMax)}`;
                if(!this.hr.connected){
                    this.coachSet(obj, 'ACCIÓN: conecta el pulsómetro', 'low');
                    return;
                }
                if(typeof bpm !== 'number'){
                    this.coachSet(obj, 'ACCIÓN: esperando pulso…', 'low');
                    return;
                }

                if(bpm < bMin - tol){
                    this.coachSet(obj, `ACCIÓN: sube un poco el ritmo para entrar en ${lbl}`, 'low');
                } else if(bpm > bMax + tol){
                    this.coachSet(obj, `ACCIÓN: baja un poco el ritmo para entrar en ${lbl}`, 'high');
                } else {
                    this.coachSet(obj, `ACCIÓN: bien, mantén ${lbl}`, 'good');
                }
            },

            // --- HR COACH (guide by zones) ---
            hrCoach: {
                enabled: false,
                target: null, // {zMin,zMax,label}
                timeInTarget: 0,
                _coolUntil: 0,
                _lastMsg: '',
                reset(){
                    this.enabled = false;
                    this.target = null;
                    this.timeInTarget = 0;
                    this._coolUntil = 0;
                    this._lastMsg = '';
                    const t = document.getElementById('hr-target');
                    if(t){ t.innerText='OBJETIVO: —'; t.classList.remove('good','low','high'); }
                },
                setTarget(t){
                    this.enabled = !!t;
                    this.target = t;
                    const el = document.getElementById('hr-target');
                    if(el){
                        el.innerText = t ? (`OBJETIVO: ${t.label}`) : 'OBJETIVO: —';
                        el.classList.remove('good','low','high');
                    }
                },
                zoneBounds(age, zId){
                    const max = app.hrZones.max(age);
                    const zs = app.hrZones.zones(max);
                    const z = zs.find(x=>x.id===zId) || zs[0];
                    return {min: Math.round(z.min*max), max: Math.round(z.max*max)-1};
                },
                tick(bpm){
                    if(!this.enabled || !this.target || !bpm) return;
                    const age = db.state.user?.age;
                    const minZ = this.target.zMin, maxZ = this.target.zMax;
                    const bMin = this.zoneBounds(age, minZ).min;
                    const bMax = this.zoneBounds(age, maxZ).max;
                    // tolerance
                    const tol = 3;
                    const inTarget = (bpm >= (bMin - tol)) && (bpm <= (bMax + tol));
                    const el = document.getElementById('hr-target');
                    if(inTarget){
                        this.timeInTarget += 1;
                        if(el){ el.classList.add('good'); el.classList.remove('low','high'); }
                        return;
                    }
                    const now = Date.now();
                    if(now < this._coolUntil) return;

                    let msg = '';
                    if(bpm < bMin - tol){
                        msg = 'Sube un poco el ritmo';
                        if(el){ el.classList.add('low'); el.classList.remove('good','high'); }
                    } else if(bpm > bMax + tol){
                        msg = 'Baja un poco el ritmo';
                        if(el){ el.classList.add('high'); el.classList.remove('good','low'); }
                    }
                    if(msg && msg !== this._lastMsg){
                        this._lastMsg = msg;
                        try{ ui.toast(msg); }catch(e){}
                        this._coolUntil = now + 12000; // 12s cooldown
                    } else if(msg){
                        this._coolUntil = now + 12000;
                    }
                }
            },

        ensureHrButton(){
            let btn = document.getElementById('btn-hr-connect');
            if(btn) return;

            const hud = document.querySelector('.hud-top');
            if(!hud) return;

            btn = document.createElement('button');
            btn.id = 'btn-hr-connect';
            btn.className = 'btn-hr';
            btn.innerText = 'PULSO';
            btn.onclick = () => app.hr.toggle();

            hud.prepend(btn);
        },


        // --- HR ZONES (v3.0 FINAL, built on v2 BLE) ---
        hrZones: {
            max(age){
                const a = parseInt(age || '0', 10) || 0;
                if(a >= 10) return Math.round(208 - 0.7 * a);
                return 190; // fallback if age missing
            },
            zones(max){
                if(!max) return null;
                return [
                    {id:1,min:0.50,max:0.60,color:"#64D2FF",label:"Z1"},
                    {id:2,min:0.60,max:0.70,color:"#30D158",label:"Z2"},
                    {id:3,min:0.70,max:0.80,color:"#FFD60A",label:"Z3"},
                    {id:4,min:0.80,max:0.90,color:"#FF9F0A",label:"Z4"},
                    {id:5,min:0.90,max:1.01,color:"#FF453A",label:"Z5"}
                ];
            },
            getZone(bpm, age){
                const max = this.max(age);
                if(!max || !bpm) return null;
                const r = bpm/max;
                const zs = this.zones(max);
                if(r < zs[0].min) return zs[0];
                if(r >= zs[zs.length-1].min) return zs[zs.length-1];
                return zs.find(z=> r>=z.min && r<z.max) || zs[0];
            }
        },


            // --- HEART RATE (Web Bluetooth / BLE) ---
            hr: {
                device: null,
                server: null,
                svc: null,
                ch: null,
                connected: false,
                bpm: null,

                reconnecting: false,
                _boundHandler: null,
                _onDisc: null,

                isSupported() {
                    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
                },

                updateUI() {
                    const val = document.getElementById('val-hr');
                    if (val) {
                        if (typeof this.bpm === 'number') {
                            try{
                                const age = db.state.user?.age;
                                const z = app.hrZones?.getZone(this.bpm, age);
                                if((!age || age<10) && !app._ageWarned){ app._ageWarned=true; try{ ui.toast('Edad no configurada: usando FCmáx 190. Ajusta tu edad en Perfil'); }catch(e){} }
                                if(z){
                                    val.innerText = `${this.bpm} bpm · ${z.label}`;
                                    val.dataset.zone = String(z.id);
                                    val.style.setProperty('color', z.color, 'important');
                                } else {
                                    val.innerText = String(this.bpm);
                                    delete val.dataset.zone;
                                    val.style.removeProperty('color');
                                }
                            }catch(e){
                                val.innerText = String(this.bpm);
                                val.style.removeProperty('color');
                            }
                        } else {
                            val.innerText = '--';
                            delete val.dataset.zone;
                            val.style.removeProperty('color');
                        }
                    }

                    const btn = document.getElementById('btn-hr-connect');
                    if (btn) {
                        btn.classList.toggle('connected', !!this.connected);
                        btn.innerText = this.connected ? 'PULSO ✓' : 'PULSO';
                    }
                },

                _onDisconnected(reason) {
                    this.connected = false;
                    this.bpm = null;
                    this.server = null;
                    this.svc = null;
                    this.ch = null;
                    this.updateUI();
                    try{ ui.toast('Pulsómetro desconectado'); }catch(e){}
                    // auto-reconnect si ya había permiso y dispositivo seleccionado
                    this.autoReconnect();
                },

                _parseBpm(dataView) {
                    // Heart Rate Measurement (0x2A37)
                    // Flags byte 0: bit0 = HR format (0=uint8, 1=uint16)
                    if (!dataView || dataView.byteLength < 2) return null;
                    const flags = dataView.getUint8(0);
                    const is16 = (flags & 0x01) !== 0;
                    return is16 ? dataView.getUint16(1, true) : dataView.getUint8(1);
                },

                async _connectGatt() {
                    if (!this.device) throw new Error('No HR device');
                    this.server = await this.device.gatt.connect();
                    this.svc = await this.server.getPrimaryService('heart_rate');
                    this.ch = await this.svc.getCharacteristic('heart_rate_measurement');

                    // limpia listener anterior si existía
                    if (this._boundHandler) {
                        try { this.ch.removeEventListener('characteristicvaluechanged', this._boundHandler); } catch (e) {}
                    }

                    this._gotFirst = false;
                    this._boundHandler = (ev) => {
                        try {
                            const dv = ev.target.value;
                            const bpm = this._parseBpm(dv);
                            if (typeof bpm === 'number' && bpm >= 0) {
                                this.bpm = bpm;
                                this.connected = true;
                                this.updateUI();
                                this._gotFirst = true;
                            }
                        } catch (e) {}
                    };

                    // En algunos stacks es más fiable registrar primero el listener y luego startNotifications
                    this.ch.addEventListener('characteristicvaluechanged', this._boundHandler);
                    await this.ch.startNotifications();

                    // lectura inicial si se permite
                    try {
                        const first = await this.ch.readValue();
                        const bpm0 = this._parseBpm(first);
                        if (typeof bpm0 === 'number') { this.bpm = bpm0; this._gotFirst = true; }
                    } catch(e) {}

                    this.connected = true;
                    this.updateUI();

                    // aviso si no llega pulso
                    setTimeout(()=>{
                        if(this.connected && !this._gotFirst){
                            try{ ui.toast('Sin pulso aún: ponte la banda y humedece electrodos'); }catch(e){}
                        }
                    }, 6000);

                    return true;
                },

                async connect() {
                    if (!this.isSupported()) {
                        try{ ui.toast('Bluetooth no compatible en este navegador'); }catch(e){}
                        return;
                    }
                    try {
                        // Must be called from a user gesture (button click)
                        const device = await navigator.bluetooth.requestDevice({
                            filters: [{ services: ['heart_rate'] }]
                        });

                        // Si cambiamos de device, limpia listener anterior
                        try{
                            if(this.device && this._onDisc){
                                this.device.removeEventListener?.('gattserverdisconnected', this._onDisc);
                            }
                        }catch(e){}

                        this.device = device;

                        // handler estable (para poder quitarlo)
                        this._onDisc = () => this._onDisconnected();
                        this.device.addEventListener('gattserverdisconnected', this._onDisc);

                        await this._connectGatt();
                        try{ ui.toast('Pulsómetro conectado'); }catch(e){}
                    } catch (e) {
                        this.connected = false;
                        this.bpm = null;
                        this.updateUI();
                        try{ ui.toast('No se pudo conectar al pulsómetro'); }catch(e){}
                    }
                },

                async reconnect() {
                    if (!this.device) return this.connect();
                    try {
                        if (this.device.gatt?.connected) {
                            this.connected = true;
                            this.updateUI();
                            return true;
                        }
                        await this._connectGatt();
                        return true;
                    } catch (e) {
                        this.connected = false;
                        this.updateUI();
                        throw e;
                    }
                },

                async autoReconnect() {
                    if (this.reconnecting) return;
                    if (!this.device) return;
                    this.reconnecting = true;

                    const delays = [800, 1500, 3000, 6000, 12000, 20000];
                    for (const d of delays) {
                        if (!this.device) break;
                        if (this.device.gatt?.connected) {
                            this.connected = true;
                            this.updateUI();
                            break;
                        }
                        await new Promise(r => setTimeout(r, d));
                        try {
                            await this._connectGatt();
                            break;
                        } catch (e) {}
                    }

                    this.reconnecting = false;
                },

                disconnect() {
                    try {
                        if (this.ch && this._boundHandler) {
                            try { this.ch.removeEventListener('characteristicvaluechanged', this._boundHandler); } catch (e) {}
                        }
                        if (this.device && this.device.gatt && this.device.gatt.connected) {
                            this.device.gatt.disconnect();
                        }
                    } catch (e) {}
                    // no borres this.device: lo mantenemos para auto-reconnect / reconnect
                    this.connected = false;
                    this.bpm = null;
                    this.updateUI();
                },

                toggle() {
                    if (this.connected) this.disconnect();
                    else this.connect();
                }
            },
            data: [], idx: 0, timeLeft: 0, totalTime: 0, elapsed: 0, totalDist: 0, maxSpd: 0,
            timer: null, paused: false, videoEl: null,

            init: function() {
                const hasUser = db.load();
                if(hasUser) {
                    this.loadSetup();
                } else {
                    ui.switchScreen('onboarding-view');
                }
                document.getElementById('bg-video').play().catch(e=>{});
                this.videoEl = document.getElementById('workout-video');
                this.ensureHrButton();

                // Wake lock: re-request when user returns to tab (only during workout)
                if(!this._wakeLockListenerBound){
                    this._wakeLockListenerBound = true;
                    document.addEventListener('visibilitychange', async () => {
                        if(document.visibilityState === 'visible' && this.inWorkout){
                            // Safari/Chrome can drop the lock on tab switch
                            await this.releaseWakeLock();
                            await this.requestWakeLock();
                        }
                    });
                }
            
                // HR UI init
                try {
                    this.hr.updateUI();
                    if (!this.hr.isSupported()) {
                        const btn = document.getElementById('btn-hr-connect');
                        if (btn) btn.style.display = 'none';
                        const v = document.getElementById('val-hr');
                        if (v) v.innerText = '--';
                    }
                } catch(e) {}
            },

            saveUser: function() {
                const n = document.getElementById('in-name').value || "Runner";
                const a = parseInt(document.getElementById('in-age').value || '0', 10) || 0;
                const w = document.getElementById('in-weight').value || 70;
                db.state.user = { name: n, age: a, weight: w, levelIdx: 0 };

                planner.generate(0);
                db.save();
                this.loadSetup();
            },
            resetUser: function(){
                try{
                    localStorage.removeItem(db.key);
                }catch(e){}
                location.reload();
            },



            loadSetup: function() {
                document.body.classList.add('mode-app');
                const u = db.state.user;
                document.getElementById('disp-name').innerText = u.name.toUpperCase();
                document.getElementById('nav-av').innerText = u.name.charAt(0);
                document.getElementById('nav-xp').style.width = ((db.state.stats.xp/(db.state.stats.level*1000))*100)+'%';
                
                planner.generate(u.levelIdx);
                planner.render();
                ui.switchScreen('setup-view');
                ui.updateSliders();
                this.updateModeBanner();
            },

            renderHist: function() {
                const c = document.getElementById('hist-container');
                c.innerHTML = '';
                if(db.state.history.length===0) c.innerHTML = '<div style="text-align:center; color:#555; margin-top:20px;">Sin historial</div>';
                db.state.history.forEach(h => {
                    const d = document.createElement('div');
                    d.className = 'hist-card';
                    d.innerHTML = `<div><div style="font-size:0.75rem; color:#888;">${h.date}</div><div style="font-weight:700;">${h.type}</div></div><div style="text-align:right;"><div style="font-weight:800; font-size:1.1rem;">${h.dist.toFixed(2)} km</div><div style="font-size:0.8rem; color:#888;">${h.cal} kcal</div></div>`;
                    c.appendChild(d);
                });
            },

            renderProf: function() {
                const s = db.state.stats;
                const u = db.state.user;
                document.getElementById('prof-name').innerText = u.name.toUpperCase();
                document.getElementById('prof-av').innerText = u.name.charAt(0);
                document.getElementById('prof-lvl').innerText = s.level;
                document.getElementById('prof-xp-bar').style.width = ((s.xp/(s.level*1000))*100)+'%';
                document.getElementById('prof-xp-txt').innerText = `${s.xp} / ${s.level*1000} XP`;
                
                document.getElementById('stat-km').innerText = s.totalKm.toFixed(1);
                document.getElementById('stat-sess').innerText = s.sessions;
                document.getElementById('stat-cal').innerText = s.totalCal;
                document.getElementById('stat-streak').innerText = s.streak;

                const bc = document.getElementById('badge-container');
                bc.innerHTML = '';
                BADGES.forEach(b => {
                    const un = db.state.badges.includes(b.id);
                    const el = document.createElement('div');
                    el.className = `badge ${un?'unlocked':''}`;
                    el.innerHTML = `<div style="font-size:1.5rem; margin-bottom:5px;">${b.icon}</div><div style="font-size:0.6rem; font-weight:700;">${b.name}</div>`;
                    bc.appendChild(el);
                });
            },
            renderCatalog: async function(){
                const listEl = document.getElementById('catalog-list');
                if(!listEl) return;

                const catData = await workoutCatalog.load();
                const all = (catData && Array.isArray(catData.workouts)) ? catData.workouts : [];
                const q = (document.getElementById('cat-search')?.value || '').trim().toLowerCase();
                const fCat = document.getElementById('cat-filter-cat')?.value || 'ALL';
                const fStim = document.getElementById('cat-filter-stim')?.value || 'ALL';
                const fDur = document.getElementById('cat-filter-dur')?.value || 'ALL';

                const durBucket = (d) => {
                  if(d <= 20) return 15;
                  if(d <= 30) return 25;
                  if(d <= 40) return 35;
                  return 45;
                };

                const lvlIdx = parseInt(document.getElementById('rng-lvl')?.value || '1', 10);
                const targetDur = parseInt(document.getElementById('rng-dur')?.value || '30', 10);

                const items = all.filter(w => {
                    if(fCat !== 'ALL' && w.cat !== fCat) return false;
                    if(fStim !== 'ALL' && (w.stimulus || '') !== fStim) return false;
                    if(fDur !== 'ALL' && durBucket(w.durMin || 0) !== parseInt(fDur,10)) return false;
                    if(!(lvlIdx >= w.minLevel && lvlIdx <= w.maxLevel)) return false;

                    if(q){
                        const blob = ((w.title||'') + ' ' + (w.tags||[]).join(' ') + ' ' + (w.stimulus||'') + ' ' + w.id).toLowerCase();
                        if(!blob.includes(q)) return false;
                    }
                    return true;
                });

                items.sort((a,b)=>{
                    const da = Math.abs((a.durMin||targetDur)-targetDur);
                    const dbb = Math.abs((b.durMin||targetDur)-targetDur);
                    if(da !== dbb) return da-dbb;
                    return (a.hardness||3)-(b.hardness||3);
                });

                if(!items.length){
                    listEl.innerHTML = '<div style="color:#888; font-weight:700; padding:12px 4px;">No hay resultados con esos filtros. Prueba a quitar alguno.</div>';
                    return;
                }

                const labelStim = (s)=>({
                  vo2:'VO2', threshold:'Umbral', aerobic:'Base', progression:'Progresivo',
                  fartlek:'Fartlek', hill_strength:'Cuestas fuerza', hill_endurance:'Cuestas resistencia',
                  hill_soft:'Cuestas suave', recovery:'Suave', benchmark:'Benchmark'
                }[s]||s||'');

                listEl.innerHTML = items.slice(0, 120).map(w=>{
                    const stim = labelStim(w.stimulus);
                    const hard = w.hardness || 3;
                    const desc = app.shortDescribe(w);
                    const chips = [
                      `<span class="chip">${w.cat} · ${w.durMin}m</span>`,
                      stim ? `<span class="chip dim">${stim}</span>` : '',
                      `<span class="chip dim">Dureza ${hard}/5</span>`
                    ].join('');
                    return `
                      <div class="workout-card">
                        <div>
                          <div class="workout-title">${w.title || w.id}</div>
                          <div class="workout-meta">${desc}</div>
                        </div>
                        <div class="chip-row">${chips}</div>
                        <div class="workout-actions">
                          <button class="btn-mini" onclick="app.previewWorkout('${w.id}')">VER</button>
                          <button class="btn-mini primary" onclick="app.selectWorkout('${w.id}')">ELEGIR</button>
                        </div>
                      </div>
                    `;
                }).join('');
            },

            shortDescribe: function(w){
                try{
                  const s = w.structure || [];
                  let parts = [];
                  for(const it of s){
                    if(it.repeat && it.block){
                      const high = it.block.find(b=>b.type==='high') || it.block[0];
                      const low = it.block.find(b=>b.type==='low') || it.block[1] || it.block[0];
                      if(high && low){
                        parts.push(`${it.repeat}×${high.sec}s/${low.sec}s`);
                      } else {
                        parts.push(`${it.repeat}×bloque`);
                      }
                    }
                  }
                  if(parts.length) return parts.slice(0,2).join(' · ') + (parts.length>2?' · …':'');
                  return (w.tags||[]).slice(0,3).join(' · ');
                }catch(e){ return ''; }
            },

            clearSelectedWorkout: function(){
                this.selectedWorkout = null;
                if(this.manualWorkout) this.manualWorkout = null;
                this.updateModeBanner();
                ui.toast('Modo inteligente activado');
            },

            updateModeBanner: function(){
                try{
                    const banner = document.getElementById('mode-banner');
                    const title = document.getElementById('mode-title');
                    const sub = document.getElementById('mode-sub');
                    const clr = document.getElementById('mode-clear');
                    const btn = document.querySelector('#setup-view .btn-main');

                    const w = this.selectedWorkout;
                    if(!banner || !title || !sub || !btn) return;

                    if(w){
                        const guide = (w.guide === 'hr') ? 'Pulso' : 'Ritmo';
                        title.textContent = 'Entrenamiento elegido';
                        sub.textContent = `${w.title || w.id} · ${guide} · ${w.durMin || ''} min`;
                        if(clr) clr.style.display = 'inline-flex';
                        // botón
                        btn.innerText = (w.guide === 'hr' || ui.cat === 'HR') ? 'COMENZAR POR PULSO' : 'COMENZAR';
                    } else {
                        title.textContent = 'Modo inteligente';
                        sub.textContent = 'Elige un tipo, duración y nivel. Si entrenas por pulso, conecta el pulsómetro y sigue la zona objetivo.';
                        if(clr) clr.style.display = 'none';
                        // botón
                        btn.innerText = (ui.cat === 'HR') ? 'COMENZAR POR PULSO' : 'COMENZAR';
                    }
                }catch(e){}
            },

            previewWorkout: async function(id){
                const catData = await workoutCatalog.load();
                const all = (catData && Array.isArray(catData.workouts)) ? catData.workouts : [];
                const w = all.find(x=>x.id===id);
                if(!w) return;

                const lvlIdx = parseInt(document.getElementById('rng-lvl')?.value || '1', 10);
                const dur = parseInt(document.getElementById('rng-dur')?.value || String(w.durMin||30), 10);
                const lvl = LEVELS[lvlIdx];
                const segs = workoutCatalog.toSegments(w, lvl, dur);

                const fmt = (sec)=>{
                    const m = Math.floor(sec/60);
                    const s = sec%60;
                    return `${m}:${String(s).padStart(2,'0')}`;
                };
                const guide = (w.guide==='hr') ? 'Pulso (Zonas)' : 'Ritmo (cinta)';
                const how = (w.guide==='hr')
                  ? `<div class="pm-kicker">1) Conecta el pulsómetro. 2) Mantén la <b>zona objetivo</b> de cada bloque. 3) Si estás por debajo: acelera. Si estás por encima: afloja.</div>`
                  : `<div class="pm-kicker">Sigue la <b>velocidad objetivo</b> de cada bloque (aprox. para tu nivel). Ajusta en la cinta y prioriza terminar el bloque con control.</div>`;

                const rows = segs.map(s=>{
                    const target = (w.guide==='hr' && s.hrTarget) ? (s.hrTarget.label || `Z${s.hrTarget.z}`) : `${s.spd.toFixed(1)} km/h`;
                    const sub = (w.guide==='hr' && s.hrTarget) ? 'Objetivo de pulso' : 'Velocidad orientativa';
                    return `<div class="pm-block"><div class="pm-b-left"><div class="pm-b-name">${s.name}</div><div class="pm-b-sub">${sub}</div></div><div class="pm-b-right"><div>${fmt(s.dur)}</div><div style="color:#bbb; font-size:0.86rem;">${target}</div></div></div>`;
                }).join('');

                const lvlTag = (w.minLevel!=null && w.maxLevel!=null)
                  ? `${LEVELS[w.minLevel].name}–${LEVELS[w.maxLevel].name}`
                  : `${LEVELS[lvlIdx].name}`;

                const html = `
                    <div class="pm-kicker"><b>${w.title||w.id}</b> · ${dur} min · ${guide} · Recomendado: ${lvlTag}</div>
                    <div class="pm-section-title">Qué tienes que hacer</div>
                    ${how}
                    <div class="pm-section-title">Bloques</div>
                    ${rows}
                `;

                ui.openModal(w.title||'ENTRENAMIENTO', html, ()=>app.selectWorkout(id));
            },

            selectWorkout: async function(id){
                const catData = await workoutCatalog.load();
                const all = (catData && Array.isArray(catData.workouts)) ? catData.workouts : [];
                const w = all.find(x=>x.id===id);
                if(!w) return;

                ui.selectCat(w.cat);

                if(w.cat === 'HIIT' && w.variant){
                  ui.var = w.variant;
                  document.querySelectorAll('#vars-HIIT .pill').forEach(p=>p.classList.remove('active'));
                  const map = {classic:'clásico', tabata:'tabata', pyramid:'pirámide'};
                  const target = (map[w.variant] || w.variant).toLowerCase();
                  const pill = Array.from(document.querySelectorAll('#vars-HIIT .pill')).find(p=>p.textContent.toLowerCase().includes(target));
                  if(pill) pill.classList.add('active');
                }

                const rngDur = document.getElementById('rng-dur');
                if(rngDur){ rngDur.value = w.durMin; ui.updateSliders(); }

                app.selectedWorkout = w;
                app.updateModeBanner();
                ui.goToTab('setup');
                ui.toast('Entrenamiento elegido. Pulsa COMENZAR.');
            },

            startLevelTest: function(){
                const testWorkout = {
                  id: "level_test_12min",
                  cat: "ENDURANCE",
                  variant: "any",
                  title: "Test 12 min (Nivel)",
                  stimulus: "benchmark",
                  hardness: 4,
                  tags: ["benchmark"],
                  durMin: 20,
                  structure: [
                    { "type": "warm", "sec": 300, "spdOffset": -2, "inc": 0, "name": "CALENTAMIENTO" },
                    { "type": "mid",  "sec": 720, "spdKey": "spdHigh", "inc": 1, "name": "TEST 12 MIN" },
                    { "type": "cool", "sec": 300, "spdFixed": 4, "inc": 0, "name": "ENFRIAMIENTO" }
                  ],
                  minLevel: 0,
                  maxLevel: 2
                };
                this.testMode = true;
                this.manualWorkout = testWorkout;
                ui.goToTab('setup');
                this.start();
            },

            applyTestResult: function(){
                const km = this.totalDist || 0;
                let lvlIdx = 0;
                // thresholds: tweakable (12-min distance)
                if(km >= 2.7) lvlIdx = 2;
                else if(km >= 2.3) lvlIdx = 1;
                else lvlIdx = 0;

                db.state.user.levelIdx = lvlIdx;
                db.save();

                // reflect in UI slider
                const rng = document.getElementById('rng-lvl');
                if(rng){ rng.value = lvlIdx; ui.updateSliders(); }

                const name = (lvlIdx===0?'Principiante':(lvlIdx===1?'Intermedio':'Avanzado'));
            const age = parseInt(document.getElementById('in-age').value || '0', 10) || 0;                const txt = `Distancia en 12 min: ${km.toFixed(2)} km\nNivel recomendado: ${name}\n\nPuedes repetir el test cuando quieras.`;
                const box = document.getElementById('test-result');
                const t = document.getElementById('test-result-text');
                if(box && t){
                    t.textContent = txt;
                    box.style.display = 'block';
                }
                // go to test view to show result
                ui.showScreen('test-view');
                this.testMode = false;
            },


            start: async function() {
                const dur = parseInt(document.getElementById('rng-dur').value);
                const manual = this.manualWorkout || this.selectedWorkout || null;
                const lvlIdx = parseInt(document.getElementById('rng-lvl').value);
                const lvl = LEVELS[lvlIdx];
                let data = null;

                let picked = null;
                if (manual) {
                    picked = manual;
                    data = workoutCatalog.toSegments(picked, lvl, dur);
                    this.currentWorkoutId = picked.id;
                    this.currentWorkoutStimulus = picked.stimulus || null;
                    this.currentWorkoutTags = picked.tags || null;
                    if(this.manualWorkout) this.manualWorkout = null;
                } else {
                    picked = await workoutCatalog.pick({
                        cat: ui.cat,
                        variant: ui.var,
                        durMin: dur,
                        lvlIdx
                    });

                    if (picked) {
                        data = workoutCatalog.toSegments(picked, lvl, dur);
                        this.currentWorkoutId = picked.id;
                        this.currentWorkoutStimulus = picked.stimulus || null;
                        this.currentWorkoutTags = picked.tags || null;
                    } else {
                        data = generator.build(ui.cat, ui.var, dur, lvl);
                        this.currentWorkoutId = null;
                        this.currentWorkoutStimulus = null;
                        this.currentWorkoutTags = null;
                    }
                }

this.data = data;
                this.totalTime = data.reduce((a,b)=>a+b.dur, 0);
                this.elapsed = 0; this.totalDist = 0; this.maxSpd = 0;
                
                document.body.classList.add('mode-workout');
                ui.switchScreen('workout-view');
                try{ this.hrCoach.reset(); }catch(e){}

                this.inWorkout = true;
                this.coachSet('OBJETIVO: —','ACCIÓN: —');

                if(this.videoEl) { this.videoEl.currentTime=0; this.videoEl.play(); }
                
                this.renderVisuals();
                await this.requestWakeLock();
                this.speak(`Entrenamiento iniciado. ${data[0].name}`);
                this.loadSeg(0);
                this.timer = setInterval(()=>this.tick(), 1000);
            },

            loadSeg: function(i) {
                if(i>=this.data.length) return this.finish();
                this.idx = i;
                const s = this.data[i];
                this.timeLeft = s.dur;
                if(s.spd > this.maxSpd) this.maxSpd = s.spd;

                if(this.videoEl) this.videoEl.playbackRate = Math.max(0.5, Math.min(2, s.spd/10));

                document.getElementById('ph-title').innerText = s.name;
                document.getElementById('val-spd').innerText = s.spd.toFixed(1);
                document.getElementById('val-inc').innerText = s.inc;

                // HR Coach: objetivo por bloque (si el template lo define)
                try{
                    if(s.hrTarget && (s.hrTarget.z || s.hrTarget.zMin)){
                        const z = s.hrTarget.z || s.hrTarget.zMin;
                        const zMin = s.hrTarget.zMin || z;
                        const zMax = s.hrTarget.zMax || zMin;
                        const lbl = s.hrTarget.label || (`Z${zMin}`);
                        this.hrCoach.setTarget({zMin, zMax, label: lbl});
                    } else {
                        this.hrCoach.setTarget(null);
                    }
                }catch(e){
                    try{ this.hrCoach.setTarget(null); }catch(e2){}
                }

                // Coach panel (objetivo + acción)
                try{ this.coachUpdateForSegment(s); }catch(e){}

                
                let col = 'var(--primary)';
                if(s.type==='high') { col='var(--accent)'; document.body.setAttribute('data-mood','sprint'); }
                else if(s.type==='mid') { col='var(--endurance)'; document.body.setAttribute('data-mood','climb'); }
                else { col='var(--cool)'; document.body.removeAttribute('data-mood'); }

                document.getElementById('ph-title').style.color = col;
                document.getElementById('ring-arc').style.stroke = col;
                document.getElementById('val-spd').style.color = col;

                const nxt = this.data[i+1];
                document.getElementById('ph-next').innerText = nxt ? `Sig: ${nxt.name}` : "FINAL";
                
                this.updateVisuals();
                if(i>0) this.speak(`Cambio. ${s.name}`);
            },

            tick: function() {
                if(this.paused) return;
                this.timeLeft--; this.elapsed++;
                try{ this.hrCoach.tick(this.hr.bpm); }catch(e){}
                try{ this.coachUpdateLive(); }catch(e){}
                try{ this.coachUpdateLive(); }catch(e){}

                this.totalDist += (this.data[this.idx].spd / 3600);
                
                document.getElementById('ph-timer').innerText = this.fmt(this.timeLeft);
                document.getElementById('total-time').innerText = this.fmt(Math.max(0, this.totalTime-this.elapsed));
                
                const tot = this.data[this.idx].dur;
                const off = 816 - ((this.timeLeft/tot)*816);
                document.getElementById('ring-arc').style.strokeDashoffset = -off;

                if(this.timeLeft<=3 && this.timeLeft>0) {
                    document.getElementById('alert-overlay').classList.add('show');
                    document.getElementById('ov-num').innerText = this.timeLeft;
                    if(navigator.vibrate) navigator.vibrate(50);
                } else {
                    document.getElementById('alert-overlay').classList.remove('show');
                }

                if(this.timeLeft<=0) this.loadSeg(this.idx+1);
            },

            renderVisuals: function() {
                const c = document.getElementById('visualizer-container');
                c.innerHTML = '';
                const max = Math.max(...this.data.map(d=>d.spd));
                this.data.forEach((d,i)=>{
                    const b = document.createElement('div');
                    b.className = 'v-bar'; b.id = 'bar-'+i; b.setAttribute('data-t', d.type);
                    b.style.height = (20 + ((d.spd/max)*80))+'%';
                    b.style.minWidth = Math.max(30, Math.min(60, d.dur))+'px';
                    c.appendChild(b);
                });
            },
            updateVisuals: function() {
                this.data.forEach((_,i)=>{
                    const b = document.getElementById('bar-'+i);
                    b.classList.remove('active');
                    if(i===this.idx) { b.classList.add('active'); b.scrollIntoView({behavior:'smooth', inline:'center'}); }
                });
            },

            togglePause: function() {
                this.paused = !this.paused;
                document.getElementById('btn-pause').innerText = this.paused ? "▶" : "II";
                if(this.videoEl) this.paused ? this.videoEl.pause() : this.videoEl.play();
            },

            skipBlock: function() { this.elapsed+=this.timeLeft; this.loadSeg(this.idx+1); },

            confirmExit: function() {
                if(confirm("¿Salir? Se perderá el progreso.")) {
                    try{ this.hr.disconnect(); }catch(e){}
                    try{ this.releaseWakeLock(); }catch(e){}
                    this.inWorkout = false;
                    clearInterval(this.timer);
                    location.reload();
                }
            },

            finish: function() {
                try{ this.hr.disconnect(); }catch(e){}
                try{ this.releaseWakeLock(); }catch(e){}
                clearInterval(this.timer);
                if(this.videoEl) this.videoEl.pause();
                document.body.classList.remove('mode-workout');
                this.inWorkout = false;
                
                const cal = Math.floor(this.totalDist * db.state.user.weight * 1.036);
                const xp = db.addSession({
                    wid: this.currentWorkoutId || null,
                    stim: this.currentWorkoutStimulus || null,
                    tags: this.currentWorkoutTags || null,
                    date: new Date().toLocaleDateString(),
                    type: ui.cat,
                    dist: this.totalDist,
                    cal: cal,
                    time: this.elapsed,
                    maxSpd: this.maxSpd
                });

                ui.switchScreen('summary-view');
                this.speak("Sesión completada");
                
                document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
                document.getElementById('sum-cal').innerText = cal;
                document.getElementById('sum-time').innerText = this.fmt(this.elapsed);
                document.getElementById('sum-pk').innerText = this.maxSpd.toFixed(1);
                document.getElementById('sum-xp').innerText = `+${xp} XP`;
            },

            clearData: function() {
                if(confirm("¿Borrar todo?")) { localStorage.removeItem(db.key); location.reload(); }
            },

            fmt: function(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`; },
            speak: function(t) { const u = new SpeechSynthesisUtterance(t); u.lang='es-ES'; window.speechSynthesis.speak(u); }
        };

        window.onload = () => app.init();
    

// PWA: register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
