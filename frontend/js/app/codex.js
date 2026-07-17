// codex.js — the rooms' own script (classic, shared closure).
// Navigation & page-turn (go), day/night lamp, Atlas (goals, forge, ladder,
// constellations, threads-in-sky), Cabinet (wishbook), capture quill, deep
// dive, canon, live sky. Extracted verbatim from index.html — one closure,
// one file. Split further only when a section is being reworked.

(function(){
  "use strict";
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  var rid=function(){return Math.random().toString(36).slice(2,8);};
  var esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};

  /* ---- rooms ---- */
  var links=$$('.plate-link'), rooms=$$('.room'), leaf=$('.leaf');
  var backdrop=document.getElementById('backdrop');
  var ROOM_ORDER=['threshold','reading','atlas','life','cabinet','observatory','study'];
  window.RM_ROOM_ORDER=ROOM_ORDER;
  var curRoom='threshold', roomHist=['threshold'];
  window.RM_roomHist=roomHist;
  var seenRooms={threshold:true}; // threshold is where you wake; it counts as seen
  function go(r,viaPop){
    if(!document.getElementById(r))return;
    // direction-aware slide on mobile: leaving right→new enters from right
    var from=ROOM_ORDER.indexOf(curRoom),to=ROOM_ORDER.indexOf(r);
    var dir=(to>from)?'fwd':(to<from?'back':'');
    rooms.forEach(function(x){
      var on=(x.id===r);
      x.classList.toggle('active',on);
      if(on){x.classList.remove('slide-fwd','slide-back');if(dir){void x.offsetWidth;x.classList.add(dir==='fwd'?'slide-fwd':'slide-back');}}
    });
    links.forEach(function(l){l.setAttribute('aria-current',l.dataset.room===r?'true':'false');});
    // the room remembers you: full ceremony on first entry, a compact header after
    var el=document.getElementById(r);
    if(seenRooms[r]){
      if(!el.classList.contains('again')){
        el.classList.add('again');
        // the h1 breaks its line for the grand header; joined for the compact one
        $$('.plate-head h1 br',el).forEach(function(b){b.replaceWith(' ');});
      }
    }else seenRooms[r]=true;
    if(backdrop)backdrop.dataset.room=r;
    leaf.scrollTop=0;
    curRoom=r;window.RM_curRoom=r;
    if(!viaPop){roomHist.push(r);if(roomHist.length>60)roomHist.shift();}
    // the Observatory recomputes its honest weekly review each time it's entered
    if(r==='observatory'){if(window.loadObservatory)window.loadObservatory();if(window.loadTemporalMirror)window.loadTemporalMirror();}
    if(r==='study'&&window.RM_loadStudy)window.RM_loadStudy();
  }
  window.go = go;
  // expose the forge so inbox-triage can re-use it, optionally prefilled from a capture
  window.RM_openForge = function(prefillTitle){
    go('atlas');
    openForge();
    if(prefillTitle){var ft=$('#fg-title');if(ft)ft.value=String(prefillTitle).split('\n')[0].slice(0,120);}
  };
  links.forEach(function(l){l.addEventListener('click',function(){go(l.dataset.room);});});
  $$('[data-jump]').forEach(function(b){b.addEventListener('click',function(){go(b.getAttribute('data-jump'));});});
  // deep-link rooms via #hash (e.g. #atlas) — also drives review/testing
  function roomFromHash(){var r=(location.hash||'').replace('#','');if(r&&document.getElementById(r)&&document.getElementById(r).classList.contains('room'))go(r);}
  window.addEventListener('hashchange',roomFromHash);roomFromHash();
  $$('[data-goread]').forEach(function(b){b.addEventListener('click',function(){go('reading');});});
  // room tabs: long rooms switch sections instead of scrolling them.
  // The chosen section is remembered for the session, per room.
  $$('.room-tabs').forEach(function(bar){
    var room=bar.closest('.room');if(!room)return;
    function show(id){
      $$('.rtab-sect',room).forEach(function(s){s.hidden=(s.getAttribute('data-sect')!==id);});
      $$('button',bar).forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-tab')===id?'true':'false');});
      try{sessionStorage.setItem('rm-tab-'+room.id,id);}catch(e){}
    }
    bar.addEventListener('click',function(e){
      var b=e.target.closest('[data-tab]');if(b)show(b.getAttribute('data-tab'));
    });
    var def=bar.getAttribute('data-default');
    try{def=sessionStorage.getItem('rm-tab-'+room.id)||def;}catch(e){}
    show(def);
  });
  // the ferry only sails from the installed codex
  if(!window.__TAURI__){var fbn=document.getElementById('ferry-browser-note');if(fbn)fbn.style.display='block';}

  /* the table of keys: ? opens the engraved key plate (never while writing) */
  document.addEventListener('keydown',function(e){
    if(e.key!=='?')return;
    var t=e.target;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    var ks=document.getElementById('keys-scrim');
    if(ks){e.preventDefault();ks.classList.toggle('on');}
  });

  /* one escape hatch for every sheet: Esc closes the topmost open scrim, the
     backdrop always dismisses. The palette keeps its own richer handling. */
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var open=$$('.scrim.on').filter(function(s){return s.id!=='palette-scrim';});
    if(open.length)open[open.length-1].classList.remove('on');
  });
  $$('.scrim').forEach(function(s){
    s.addEventListener('click',function(e){if(e.target===s)s.classList.remove('on');});
  });
  /* the pocket quill-seal mirrors the ribbon quill */
  var qfab=document.getElementById('quill-fab');
  if(qfab)qfab.addEventListener('click',function(){var q=$('#capquill');if(q)q.click();});

  /* ---- day / night (theme) — persisted, defaults to night ---- */
  var lamp=$('#lamp'),lampTxt=lamp?$('.lamp-txt',lamp):null;
  function applyTheme(t){
    if(t==='light')document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    if(lampTxt)lampTxt.textContent=(t==='light')?'day':'night';
  }
  var savedTheme='dark';
  try{savedTheme=localStorage.getItem('rm-theme')||'dark';}catch(e){}
  applyTheme(savedTheme);
  if(lamp)lamp.addEventListener('click',function(){
    var next=(document.documentElement.getAttribute('data-theme')==='light')?'dark':'light';
    applyTheme(next);
    try{localStorage.setItem('rm-theme',next);}catch(e){}
    flash(next==='light'?'day breaks':'night falls');
  });

  /* ---- ink confirmation (replaces toasts — per design spec) ---- */
  // a gentle tactile tick — the ink meeting the page, never a notification buzz
  function haptic(ms){try{if(navigator.vibrate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate(ms||10);}catch(e){}}
  window.RM_haptic=haptic;
  function flash(m){
    var el=document.createElement('span');
    el.className='ink-confirm';el.textContent=m;
    document.body.appendChild(el);
    el.addEventListener('animationend',function(){el.remove();});
    haptic(9);
  }
  window.flash=flash;

  /* ---- universal capture ---- */
  var scrim=$('#scrim'),inbox=[],inboxN=$('#inboxn');
  function openSlip(){scrim.classList.add('on');setTimeout(function(){$('#sliptext').focus();},40);}
  function closeSlip(){scrim.classList.remove('on');$('#sliptext').value='';}
  $('#capquill').addEventListener('click',openSlip);
  $('#slipcancel').addEventListener('click',closeSlip);
  scrim.addEventListener('click',function(e){if(e.target===scrim)closeSlip();});
  $$('.kind').forEach(function(k){k.addEventListener('click',function(){$$('.kind').forEach(function(x){x.setAttribute('aria-pressed','false');});k.setAttribute('aria-pressed','true');});});
  $('#slipsave').addEventListener('click',function(){
    var t=$('#sliptext').value.trim();if(!t){$('#sliptext').focus();return;}
    var kind=$('.kind[aria-pressed="true"]').dataset.kind;
    closeSlip();
    // Persist to vault via Tauri bridge; fall back to in-memory for browser dev
    if(window.Bridge){
      window.Bridge.capture.save(kind,[],t).then(function(){
        flash('kept in the inbox · '+kind);
        loadThresholdCard();
        if(window.loadInboxCount)window.loadInboxCount();
      }).catch(function(e){flash('error: '+e);});
    } else {
      inbox.push({t:t,kind:kind});inboxN.textContent=inbox.length;
      flash('kept in the inbox · '+kind);
    }
  });

  /* ---- reading: highlight → why → marginalia ---- */
  var body=$('#rbody'),cap=$('#capture'),capText=$('#captext'),notes=$('#notes');
  var savedRange=null,savedText='';
  body.addEventListener('mouseup',function(){
    var sel=window.getSelection();if(!sel||sel.isCollapsed)return;
    var txt=sel.toString().trim();if(txt.length<3||!body.contains(sel.anchorNode))return;
    savedText=txt;window._savedHighlightText=txt;savedRange=sel.getRangeAt(0).cloneRange();
    var rect=sel.getRangeAt(0).getBoundingClientRect(),host=$('#reader').getBoundingClientRect();
    cap.style.top=(rect.bottom-host.top+8)+'px';
    cap.style.left=Math.max(0,Math.min(rect.left-host.left,$('#reader').clientWidth-292))+'px';
    cap.classList.add('on');capText.value='';setTimeout(function(){capText.focus();},40);
  });
  function closeCap(){cap.classList.remove('on');savedRange=null;savedText='';var s=window.getSelection();if(s)s.removeAllRanges();}
  $('#capcancel').addEventListener('click',closeCap);
  $('#capsave').addEventListener('click',function(){
    var why=capText.value.trim();
    if(savedRange){try{var m=document.createElement('mark');savedRange.surroundContents(m);}catch(e){}}
    var em=notes.querySelector('.empty-note');if(em)em.remove();
    var n=document.createElement('div');n.className='mnote';
    var short=savedText.length>88?savedText.slice(0,88)+'…':savedText;
    n.innerHTML='<q>“'+short.replace(/</g,'&lt;')+'”</q><div class="wl">'+(why?why.replace(/</g,'&lt;'):'<span style="color:var(--ink-3);font-style:italic">— kept without a note</span>')+'</div>';
    notes.appendChild(n);closeCap();
  });

  /* reading progress + ribbon bookmark */
  // Reading progress is owned entirely by the open book on the desk (it scrolls
  // internally and saves its own position); the page scroll no longer drives it.

  /* deep dive */
  var codex=$('#codex'),deep=$('#deep'),timer=$('#timer'),tval=$('#tval'),tk=null,sec=0;
  deep.addEventListener('click',function(){
    var on=codex.classList.toggle('deep');
    if(on){timer.classList.add('on');sec=0;tval.textContent='00:00';tk=setInterval(function(){sec++;var m=Math.floor(sec/60),s=sec%60;tval.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;},1000);deep.lastChild.textContent=' leave the dive';}
    else{timer.classList.remove('on');clearInterval(tk);deep.lastChild.textContent=' deep dive';}
  });

  /* thread ask */
  var ans=$('#threadans');
  $('#threadgo').addEventListener('click',function(){
    var q=$('#threadq').value.trim();ans.classList.add('on');
    ans.textContent=q?'Across all three: Popper supplies the test — an explanation must risk being wrong; Deutsch supplies the prize — a good one reaches far past its evidence; and your own note already saw the seam. Falsifiability keeps an explanation honest; reach is what makes it worth keeping.':'Ask, and I answer only from these three — nothing else.';
  });

  /* ---- ATLAS ---- */
  var check='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4 10-11"/></svg>';
  var goals=[
    {id:'prob',title:'Fluency in probability',domain:'mathematics',kind:'mastery',temp:'warm',deadline:'2026-09-30',
     rungs:[
      {t:'Build intuition for randomness',consume:'Watch one careful intro to sample spaces.',produce:'Write the sample spaces of 3 everyday events by hand.',done:'You can describe a sample space without looking.',complete:true},
      {t:'Master conditional probability',consume:'Read on conditioning; do 6 worked examples.',produce:'Re-solve Monty Hall and write why the intuition fails.',done:'You can explain conditioning to a clever 12-year-old.',complete:true},
      {t:'Independence vs correlation',consume:'Read independence with counterexamples.',produce:'Build one pair: uncorrelated yet dependent.',done:'You can give the counterexample from memory.',complete:true},
      {t:'Derive Bayes from the product rule',consume:'Review the product rule and conditional probability.',produce:'Derive Bayes on paper, then apply it to a medical test.',done:'You can re-derive it cold and explain the base-rate trap.',complete:false},
      {t:'Random variables & expectation',consume:'Read on discrete variables and linearity of expectation.',produce:'Prove linearity and use it on a counting problem.',done:'You can find an expectation without summing term by term.',complete:false},
      {t:'Variance & the spread of outcomes',consume:'Study variance and why we square.',produce:'Compute a die roll\u2019s variance two ways.',done:'You can say what variance buys over expectation.',complete:false},
      {t:'The great distributions',consume:'Meet binomial, Poisson, normal.',produce:'Match 5 real situations to the fitting distribution.',done:'You can pick the right one from a description.',complete:false},
      {t:'The central limit theorem',consume:'Study why normality emerges from sums.',produce:'Explain in writing why averages go normal.',done:'You can explain CLT without hand-waving.',complete:false},
      {t:'Estimation & confidence',consume:'Read what a confidence interval truly means.',produce:'Write the correct reading of a 95% interval.',done:'You can say what is and isn\u2019t random in it.',complete:false},
      {t:'Synthesis: model a real question',consume:'Pick a question you care about with uncertainty in it.',produce:'Build a small probabilistic model and write it up.',done:'You\u2019ve made one analysis you would defend.',complete:false}
     ]},
    {id:'gr',title:'Read general relativity',domain:'physics',kind:'mastery',temp:'cooling',
     rungs:[
      {t:'Special relativity first',consume:'Read on simultaneity and spacetime intervals.',produce:'Draw the twin paradox as a spacetime diagram.',done:'You can explain why the interval is invariant.',complete:true},
      {t:'Vectors, then tensors, slowly',consume:'Read tensors as machines that eat vectors.',produce:'Write what a (0,2) tensor does, in your words.',done:'Tensors feel like objects, not notation.',complete:false},
      {t:'The metric tensor',consume:'Study how the metric encodes distance and time.',produce:'Compute an interval from a given metric.',done:'You can read a metric and say what it means.',complete:false},
      {t:'Curvature & geodesics',consume:'Read geodesics as straightest possible paths.',produce:'Explain why orbits are straight lines in curved spacetime.',done:'You grasp what \u201cgravity is geometry\u201d means.',complete:false},
      {t:'The field equations, conceptually',consume:'Read a walkthrough of G = 8\u03c0T.',produce:'Write what each side of the equation says.',done:'You can narrate the equation plainly.',complete:false},
      {t:'Schwarzschild & the horizon',consume:'Read the meaning of the Schwarzschild solution.',produce:'Explain what the event horizon is and isn\u2019t.',done:'You understand one exact solution in depth.',complete:false},
      {t:'Synthesis: explain GR with no maths',consume:'Gather your notes across the rungs.',produce:'Write a 1000-word explainer with no equations.',done:'A non-physicist friend finally gets it.',complete:false}
     ]},
    {id:'write',title:'Write with clarity',domain:'craft',kind:'mastery',temp:'warm',deadline:'2026-08-01',
     rungs:[
      {t:'Diagnose your own fog',consume:'Read one essay on plain prose.',produce:'Mark every vague word in a murky paragraph you wrote.',done:'You can spot your own hedging.',complete:true},
      {t:'One idea per sentence',consume:'Study how strong writers cut clauses.',produce:'Rewrite a tangled passage as single-idea sentences.',done:'Your sentences carry one load each.',complete:true},
      {t:'Verbs over nouns',consume:'Read on nominalisation.',produce:'Turn 10 zombie nouns back into verbs.',done:'Your sentences move.',complete:true},
      {t:'Structure before style',consume:'Learn one-paragraph-one-point.',produce:'Outline a piece as one sentence per paragraph.',done:'The argument reads cleanly from the outline alone.',complete:true},
      {t:'Cut to the bone',consume:'Read on omitting needless words.',produce:'Cut a finished piece by 20% without losing meaning.',done:'You feel the relief of a tighter draft.',complete:true},
      {t:'Rhythm and the ear',consume:'Study how length sets pace.',produce:'Read aloud; rewrite where the ear stumbles.',done:'You edit by sound, not only sight.',complete:false},
      {t:'Revise like a stranger',consume:'Read on cold revision.',produce:'Leave a draft a day, then edit as if a stranger wrote it.',done:'You can be ruthless with your own words.',complete:false},
      {t:'Publish one clear thing',consume:'Choose the piece you\u2019re proudest of.',produce:'Polish and publish it somewhere real.',done:'It\u2019s out in the world, and it\u2019s clear.',complete:false}
     ]},
    {id:'squat',title:'Squat 2× bodyweight',domain:'body',kind:'numeric',temp:'warm',deadline:'2026-12-20',
     metric:{name:'squat',current:100,target:156,unit:'kg'},
     rungs:[
      {t:'Own bodyweight, deep and clean',consume:'Film a set; check depth and bracing.',produce:'Hit 5 clean reps at full depth at 80 kg.',done:'Depth and brace are honest, on video.',complete:true},
      {t:'Build to 100 kg',consume:'Run a simple linear progression 8 weeks.',produce:'Hit a true 100 kg single.',done:'100 kg moved with form intact.',complete:true},
      {t:'120 kg — past the wall',consume:'Add a weekly back-off and accessory work.',produce:'Hit 120 kg for a controlled single.',done:'120 kg with no form breakdown.',complete:false},
      {t:'140 kg — strength, not just effort',consume:'Periodise; mind sleep and protein.',produce:'Hit 140 kg.',done:'140 kg banked and repeatable.',complete:false},
      {t:'156 kg — twice bodyweight',consume:'Peak carefully; deload into the attempt.',produce:'Hit 156 kg — 2× your bodyweight.',done:'The plates say twice what you weigh.',complete:false}
     ]}
  ];
  var selected='prob';
  var chart=$('#starchart'),pane=$('#ladderpane'),NS='http://www.w3.org/2000/svg';
  // the becomings: pursuits are the identities the sky serves (VISION.md §2)
  var pursuits=[],pursuitFilter='all';
  function curIdx(g){for(var i=0;i<g.rungs.length;i++)if(!g.rungs[i].complete)return i;return g.rungs.length-1;}
  function doneN(g){return g.rungs.filter(function(r){return r.complete;}).length;}
  function hexA(hex,a){var h=(hex||'#a8341f').replace('#','');var n=parseInt(h.length===3?h.replace(/(.)/g,'$1$1'):h,16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}
  function daysUntil(d){if(!d)return null;var ms=new Date(d+'T00:00').getTime()-Date.now();return Math.ceil(ms/86400000);}
  function addDaysISO(n){var d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmtShort(iso){if(!iso)return '';var p=String(iso).split('-');return MON[((+p[1]||1)-1)%12]+' '+(+p[2]||1);}

  /* ---- THE ORDERED SKY ----
     Eight curated constellations as normalized open polylines (0..1, y down).
     A goal always renders its FULL authentic figure; its rungs sit as beads
     at even arc-length along the line, and progress is one cut of lit line —
     the constellation draws itself as you climb. */
  var CONSTELLATIONS=[
    {name:'Cassiopeia', pts:[[0,.55],[.24,.08],[.50,.48],[.76,.02],[1,.34]]},
    {name:'Corona',     pts:[[0,.20],[.16,.55],[.36,.75],[.60,.74],[.82,.55],[1,.22]]},
    {name:'Ursa Minor', pts:[[0,.08],[.17,.20],[.33,.36],[.50,.50],[.72,.42],[.95,.50],[.86,.74],[.60,.66]]},
    {name:'Delphinus',  pts:[[0,.90],[.22,.62],[.42,.38],[.60,.14],[.82,.06],[1,.28],[.72,.45]]},
    {name:'Lyra',       pts:[[.05,.05],[.25,.30],[.05,.60],[.45,.95],[.85,.75],[.55,.35]]},
    {name:'Aquila',     pts:[[0,.30],[.25,.45],[.50,.62],[.75,.40],[1,.22]]},
    {name:'Draco',      pts:[[0,.70],[.15,.45],[.33,.60],[.50,.35],[.66,.50],[.82,.22],[1,.40]]},
    {name:'Eridanus',   pts:[[0,.15],[.20,.28],[.34,.52],[.52,.62],[.68,.48],[.84,.60],[1,.85]]}
  ];
  function titleHash(s){var h=0;s=String(s||'');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
  function polyLen(pts){var seg=[],total=0;for(var i=0;i<pts.length-1;i++){var dx=pts[i+1][0]-pts[i][0],dy=pts[i+1][1]-pts[i][1];var L=Math.sqrt(dx*dx+dy*dy);seg.push(L);total+=L;}return {seg:seg,total:total};}
  function pointAtLen(pts,L,s){
    for(var i=0;i<L.seg.length;i++){
      if(s<=L.seg[i]||i===L.seg.length-1){
        var t=L.seg[i]?Math.max(0,Math.min(1,s/L.seg[i])):0;
        return [pts[i][0]+(pts[i+1][0]-pts[i][0])*t, pts[i][1]+(pts[i+1][1]-pts[i][1])*t];
      }
      s-=L.seg[i];
    }
    return pts[pts.length-1].slice();
  }
  function subPath(pts,L,s0,s1){
    if(s1<=s0)return [];
    var out=[pointAtLen(pts,L,s0)],acc=0;
    for(var i=0;i<L.seg.length;i++){
      var end=acc+L.seg[i];
      if(end>s0&&end<s1)out.push(pts[i+1].slice());
      acc=end;
      if(acc>=s1)break;
    }
    out.push(pointAtLen(pts,L,s1));
    return out;
  }
  function beadPositions(pts,L,n){
    if(n<=1)return [pointAtLen(pts,L,L.total/2)];
    var out=[];for(var i=0;i<n;i++)out.push(pointAtLen(pts,L,L.total*i/(n-1)));return out;
  }
  function fitToBox(pts,x,y,w,h){
    var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    pts.forEach(function(p){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);});
    var pw=Math.max(1e-6,maxX-minX),ph=Math.max(1e-6,maxY-minY);
    var k=Math.min(w/pw,h/ph);
    var ox=x+(w-pw*k)/2-minX*k, oy=y+(h-ph*k)/2-minY*k;
    return pts.map(function(p){return [p[0]*k+ox,p[1]*k+oy];});
  }
  function dStr(pts){return pts.length?('M '+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L ')):'';}
  // the sky is ordered by the tide: nearest deadline first, undated last
  function sortGoals(){
    goals.sort(function(a,b){
      var da=a.deadline||'9999-12-31',db=b.deadline||'9999-12-31';
      if(da!==db)return da<db?-1:1;
      return (a.title||'')<(b.title||'')?-1:1;
    });
  }
  function computeSkyLayout(n){
    var rows=n<=3?1:2, cols=n<=3?Math.max(n,1):Math.ceil(n/2);
    var gutter=24, usable=920;
    var slotW=Math.min((usable-(cols-1)*gutter)/cols,420);
    var startX=40+(usable-(cols*slotW+(cols-1)*gutter))/2;
    var slots=[];
    for(var i=0;i<n;i++){
      var r=rows===1?0:Math.floor(i/cols), c=rows===1?i:(i%cols);
      var x=startX+c*(slotW+gutter);
      var fy,fh,ly;
      if(rows===1){fy=186;fh=114;ly=322;}
      else if(r===0){fy=158;fh=82;ly=256;}
      else {fy=270;fh=74;ly=362;}
      slots.push({x:x+20,y:fy,w:slotW-40,h:fh,labelX:x+slotW/2,labelY:ly,
        haloR:Math.min(80,slotW*.35),labelMax:Math.floor((slotW-16)/8)});
    }
    return slots;
  }
  // each goal keeps a stable figure (by title hash) but no two share one at once
  function templateFor(g,used){
    var idx=titleHash(g.title)%CONSTELLATIONS.length;
    for(var k=0;k<CONSTELLATIONS.length;k++){
      var j=(idx+k)%CONSTELLATIONS.length;
      if(!used[j]){used[j]=true;return CONSTELLATIONS[j];}
    }
    return CONSTELLATIONS[idx];
  }
  function starCount(g){
    if(g.kind==='numeric')return 5;
    if(g.kind==='habit')return 4;
    return Math.max((g.rungs||[]).length,1);
  }
  // the pace of a mastery goal against its deadline — a tide, never a whip
  function pace(g){
    if(g.kind&&g.kind!=='mastery')return null;
    if(!g.deadline||!g.rungs||!g.rungs.length)return null;
    var idxs=[];g.rungs.forEach(function(r,i){if(!r.complete)idxs.push(i);});
    if(!idxs.length)return null;
    var du=daysUntil(g.deadline);
    if(du===null)return null;
    if(du<0)return {turned:true,longTurned:du<-365};
    var rem=idxs.length;
    var dates={};
    idxs.forEach(function(ri,k){var r=g.rungs[ri];dates[ri]=r.by||addDaysISO(Math.round(du*(k+1)/rem));});
    return {turned:false,rem:rem,du:du,cadence:Math.max(1,Math.round(du/rem)),dates:dates};
  }
  // Compute current streak from habit_log (consecutive completed days ending today or yesterday)
  function computeStreak(log, target){
    var map={};(log||[]).forEach(function(e){map[e.date]=(e.count||0);});
    var d=new Date(),today=d.toISOString().slice(0,10);
    if(!map[today]||map[today]<target){d.setDate(d.getDate()-1);}
    var streak=0;
    for(var i=0;i<365;i++){
      var ds=d.toISOString().slice(0,10);
      if(map[ds]&&map[ds]>=target){streak++;d.setDate(d.getDate()-1);}
      else break;
    }
    return streak;
  }

  // unified progress 0..1 for mastery (rungs), numeric (metric), and habit (streak) goals
  function goalProg(g){
    if(g.kind==='numeric'&&g.metric){var c=+g.metric.current||0,t=+g.metric.target||0;return t?Math.max(0,Math.min(1,c/t)):0;}
    if(g.kind==='habit'){var s=g.streak||0,b=Math.max(g.best_streak||0,30);return Math.min(1,s/b);}
    return g.rungs&&g.rungs.length?doneN(g)/g.rungs.length:0;
  }

  function drawChart(){
    $$('.constel',chart).forEach(function(n){n.remove();});
    var emptyMsg=$('#atlas-empty',chart);
    if(!goals.length){
      if(!emptyMsg){
        emptyMsg=document.createElementNS(NS,'text');
        emptyMsg.setAttribute('id','atlas-empty');
        emptyMsg.setAttribute('x','500');emptyMsg.setAttribute('y','230');
        emptyMsg.setAttribute('text-anchor','middle');
        emptyMsg.setAttribute('class','atlas-empty-txt');
        emptyMsg.textContent='The sky is dark — chart your first guiding star ✦';
        emptyMsg.style.cursor='pointer';
        emptyMsg.addEventListener('click',function(){var b=$('#forge-star');if(b)b.click();});
        chart.appendChild(emptyMsg);
      }
      return;
    } else if(emptyMsg){ emptyMsg.remove(); }
    sortGoals();
    // the pursuit lens: one becoming's stars alone, or the whole sky
    var sg=(pursuitFilter!=='all')?goals.filter(function(g){return (g.pursuit||'')===pursuitFilter;}):goals;
    if(!sg.length){
      var fe=document.createElementNS(NS,'text');
      fe.setAttribute('id','atlas-empty');fe.setAttribute('x','500');fe.setAttribute('y','230');
      fe.setAttribute('text-anchor','middle');fe.setAttribute('class','atlas-empty-txt');
      fe.textContent='No stars serve this becoming yet — forge one under its name.';
      chart.appendChild(fe);return;
    }
    var slots=computeSkyLayout(sg.length),used={};
    sg.forEach(function(g,gi){
      var slot=slots[gi];if(!slot)return;
      var bn=g.banner||'#a8341f';
      var grp=document.createElementNS(NS,'g');grp.setAttribute('class','constel'+(g.id===selected?' sel':''));
      grp.style.cursor='pointer';
      var tpl=templateFor(g,used);
      var pts=fitToBox(tpl.pts,slot.x,slot.y,slot.w,slot.h);
      var L=polyLen(pts);
      var n=starCount(g),prog=goalProg(g);
      var lit=(g.kind==='mastery'||!g.kind)?Math.min(doneN(g),n):(prog>=1?n:Math.round(prog*(n-1)));
      // halo sits behind the figure, sized to its slot — no more colliding suns
      var halo=document.createElementNS(NS,'circle');
      halo.setAttribute('cx',slot.x+slot.w/2);halo.setAttribute('cy',slot.y+slot.h/2);
      halo.setAttribute('r',slot.haloR);halo.setAttribute('fill','url(#halo)');halo.setAttribute('class','halo');
      grp.appendChild(halo);
      // the line-work: what is climbed burns solid; what remains lies faint ahead
      var cut=(n<=1)?(lit>=1?L.total:0):(lit>=n?L.total:(lit<=1?0:L.total*(lit-1)/(n-1)));
      if(cut>0){
        var litP=document.createElementNS(NS,'path');litP.setAttribute('class','c-line lit');
        litP.setAttribute('d',dStr(subPath(pts,L,0,cut)));
        litP.style.stroke=hexA(bn,.75);grp.appendChild(litP);
      }
      if(cut<L.total-0.01){
        var ahP=document.createElementNS(NS,'path');ahP.setAttribute('class','c-line ahead');
        ahP.setAttribute('d',dStr(subPath(pts,L,cut,L.total)));
        ahP.style.stroke=hexA(bn,.42);grp.appendChild(ahP);
      }
      // rung-stars as beads at even arc-length along the figure
      var beads=beadPositions(pts,L,n),curSet=false;
      var rBase=n>12?0.75:1;
      beads.forEach(function(p,i){
        var cls;
        if(i<lit)cls='done';else if(!curSet){cls='cur';curSet=true;}else cls='future';
        var st=document.createElementNS(NS,'circle');st.setAttribute('class','star '+cls);
        st.style.fill=(cls==='future')?hexA(bn,.45):bn;
        st.setAttribute('cx',p[0].toFixed(1));st.setAttribute('cy',p[1].toFixed(1));
        st.setAttribute('r',(cls==='cur'?4.5:(cls==='done'?3.2:2.4))*rBase);
        grp.appendChild(st);
      });
      // name plate, centred beneath its own figure
      var tx=document.createElementNS(NS,'text');tx.setAttribute('class','c-name');
      if(g.id===selected)tx.style.fill=hexA(bn,.95);
      tx.setAttribute('x',slot.labelX);tx.setAttribute('y',slot.labelY);
      var name=(g.sigil?g.sigil+' ':'')+g.title;
      if(name.length>slot.labelMax)name=name.slice(0,Math.max(1,slot.labelMax-1))+'…';
      tx.textContent=name;
      var du=daysUntil(g.deadline);
      if(du!==null&&du>=0&&du<=21){
        var ts=document.createElementNS(NS,'tspan');ts.setAttribute('class','c-due');ts.setAttribute('dx','8');
        ts.textContent='⟡ '+du+' day'+(du===1?'':'s');tx.appendChild(ts);
      }
      grp.appendChild(tx);
      grp.addEventListener('click',function(){selected=g.id;render();});
      chart.appendChild(grp);
    });
  }

  function drawLadder(){
    var g=goals.filter(function(x){return x.id===selected;})[0];
    if(!g){
      pane.innerHTML=goals.length?'':'<p class="ladder-empty">Nothing charted yet. A guiding star is a thing you make, not just something you read about.</p>';
      return;
    }
    var prog=goalProg(g),pct=Math.round(prog*100),numeric=(g.kind==='numeric'&&g.metric),habit=(g.kind==='habit');
    var ci=(g.rungs&&g.rungs.length)?curIdx(g):0;
    var acts='<span class="goal-acts"><button class="edit" data-edit="'+g.id+'">edit</button><button class="retire" data-retire="'+g.id+'">retire</button></span>';
    var h='';
    // banner: sigil + colour + gentle deadline countdown (a tide, never a whip)
    if(g.banner||g.sigil||g.deadline){
      var du=daysUntil(g.deadline),dl='';
      if(du!==null)dl=du>=0?(du+' day'+(du===1?'':'s')+' hence'):(du<-365?'the tide has long turned':('the tide turned '+(-du)+' day'+(du===-1?'':'s')+' ago'));
      h+='<div class="goal-banner" style="--bn:'+hexA(g.banner||'#a8341f',.20)+';--bnc:'+(g.banner||'#a8341f')+'">'+
         '<span class="sigil">'+(g.sigil||'✦')+'</span>'+
         '<div class="gb-meta"><div style="font-family:var(--disp);font-size:21px;color:var(--ink)">'+esc(g.title)+'</div>'+
         (dl?'<div class="gb-dl'+(du!==null&&du<=14?' soon':'')+'">⟡ '+dl+'</div>':'')+'</div>'+acts+'</div>';
    }
    var posTxt=habit?((g.streak||0)+'-day streak'):numeric?(pct+'% of the way'):('rung '+(ci+1)+' of '+g.rungs.length+' · '+pct+'%');
    h+='<div class="ladder-head"><h2>'+esc(g.title)+'</h2><span class="pos">'+posTxt+'</span>'+((g.banner||g.sigil||g.deadline)?'':acts)+'</div>';
    h+='<div class="momentum" style="margin:8px 0 0"><span class="dot '+g.temp+'"></span> '+(g.domain||'a pursuit')+' · momentum '+g.temp+'</div>';
    // the becoming: who this star is making you — identity above outcome.
    // A goal without its own line inherits the voice of its pursuit.
    var toward=g.becoming||pursuitTitle(g.pursuit);
    if(toward){h+='<div class="goal-becoming">toward — <em>'+esc(toward)+'</em></div>';}
    if(g.why){h+='<div class="goal-why"><b>why you set this star</b>'+esc(g.why)+'</div>';}
    if(habit){
      // ── Habit streak calendar ──
      var todayStr=new Date().toISOString().slice(0,10);
      var logMap={};(g.habit_log||[]).forEach(function(e){logMap[e.date]=e.count||0;});
      var todayCount=logMap[todayStr]||0,target=g.daily_target||1,unit=g.daily_unit||'times';
      var todayDone=todayCount>=target;
      h+='<div class="streak-head"><span class="streak-num">'+(g.streak||0)+'</span><span class="streak-label">day streak</span>';
      if(g.best_streak>0)h+='<span class="streak-best">best: '+g.best_streak+'</span>';
      h+='</div>';
      // momentum over streaks: the rolling week is the honest measure
      var wk=0;for(var wi=0;wi<7;wi++){var wd=new Date();wd.setDate(wd.getDate()-wi);if((logMap[wd.toISOString().slice(0,10)]||0)>=target)wk++;}
      h+='<div class="week-line">this week · '+wk+' of 7 days honoured</div>';
      // 30-day calendar (last 30 days, row of 15 + row of 15)
      h+='<div class="habit-cal">';
      for(var di=29;di>=0;di--){
        var dd=new Date();dd.setDate(dd.getDate()-di);
        var ds=dd.toISOString().slice(0,10);
        var cnt=logMap[ds]||0;
        var cls='habit-day'+(cnt>=target?' done':(cnt>0?' partial':''))+(ds===todayStr?' today':'');
        var title2=ds+(cnt?' · '+cnt+' '+unit:'');
        h+='<div class="'+cls+'" title="'+title2+'"></div>';
      }
      h+='</div>';
      h+='<p style="font-family:var(--mono);font-size:11.5px;color:var(--ink-3);letter-spacing:.08em;margin:0 0 10px">daily target · <b style="color:var(--ink-2)">'+target+'</b> '+esc(unit)+(todayDone?' · <span style="color:var(--gold-hi)">honoured today ✦</span>':' · today: '+todayCount+'/'+target)+'</p>';
      h+='<div class="habit-log-row"><input type="number" id="habit-count" min="0" placeholder="'+todayCount+'" value="'+todayCount+'"><button class="btn" data-habit-log="'+g.id+'">log today</button><span class="hint">how many '+esc(unit)+' you did today</span></div>';
    } else if(numeric){
      h+='<p class="numeric">'+esc(g.metric.name)+' · now '+g.metric.current+' '+esc(g.metric.unit||'')+' → target '+g.metric.target+' '+esc(g.metric.unit||'')+'</p>';
      var duN=daysUntil(g.deadline),togo=Math.round(((+g.metric.target||0)-(+g.metric.current||0))*10)/10;
      if(duN!==null&&duN>0&&togo>0){
        var wks=Math.max(1,Math.round(duN/7)),rate=togo/wks;
        rate=rate>=10?Math.round(rate):Math.round(rate*10)/10;
        h+='<div class="week-line">'+togo+' '+esc(g.metric.unit||'')+' to go over '+wks+' week'+(wks===1?'':'s')+' — '+rate+' '+esc(g.metric.unit||'')+' a week holds the course.</div>';
      }
      h+='<div class="bar" style="margin:10px 0 0"><i style="width:'+pct+'%"></i></div>';
      h+='<div class="advance"><input type="text" id="adv-val" inputmode="decimal" placeholder="'+g.metric.current+'"><button class="btn" data-advance="'+g.id+'">log the figure</button><span class="hint">where the number stands today</span></div>';
    } else {
      // the tide: how the remaining rungs lie against the deadline — never a whip
      var pc=pace(g),today0=new Date().toISOString().slice(0,10);
      if(pc){
        if(pc.turned)h+='<div class="tide-line">'+(pc.longTurned?'the tide has long turned — the stars wait, unhurried.':'the tide has turned — the stars wait, unhurried.')+'</div>';
        else h+='<div class="tide-line">'+pc.rem+' rung'+(pc.rem===1?'':'s')+', '+pc.du+' day'+(pc.du===1?'':'s')+' — a star every '+pc.cadence+' day'+(pc.cadence===1?'':'s')+' keeps the tide.</div>';
      }
      h+='<div class="bar" style="margin:14px 0 0"><i style="width:'+pct+'%"></i></div><div class="ladder">';
      g.rungs.forEach(function(r,i){
        var cls=r.complete?'done':(i===ci?'current':'future');
        var byTag='';
        if(pc&&!pc.turned&&!r.complete&&pc.dates[i]){
          byTag=(pc.dates[i]<today0)?'<span class="rung-by past">the tide runs ahead of this star</span>'
                                    :'<span class="rung-by">by ⟡ '+fmtShort(pc.dates[i])+'</span>';
        }
        var nodeH=r.complete
          ?'<button class="node" data-undo="'+g.id+'" data-ri="'+i+'" title="unlight this star" aria-label="unlight this star">'+check+'<span class="unlight-hint">click to unlight</span></button>'
          :'<span class="node">'+check+'</span>';
        h+='<div class="rung '+cls+'">'+nodeH+'<div class="rtitle">'+esc(r.t)+byTag+'</div>';
        if(i===ci&&!r.complete){
          var steps='';
          if(r.consume)steps+='<div class="step"><span class="k">consume</span><span class="v">'+esc(r.consume)+'</span></div>';
          if(r.produce)steps+='<div class="step"><span class="k">produce</span><span class="v" style="font-style:italic">'+esc(r.produce)+'</span></div>';
          if(r.done)steps+='<div class="step"><span class="k">done when</span><span class="v">'+esc(r.done)+'</span></div>';
          h+='<div class="rung-body">'+steps+
             '<div class="act"><button class="btn" data-done="'+g.id+'">'+check+' mark this star lit</button><span class="hint">the next lights only when this is truly done</span></div></div>';
        }
        h+='</div>';
      });
      h+='</div>';
    }
    pane.innerHTML=h;
    $$('[data-done]',pane).forEach(function(b){b.addEventListener('click',function(){lightStar(b.getAttribute('data-done'));});});
    $$('[data-undo]',pane).forEach(function(b){b.addEventListener('click',function(){unlightStar(b.getAttribute('data-undo'),parseInt(b.getAttribute('data-ri'),10));});});
    $$('[data-edit]',pane).forEach(function(b){b.addEventListener('click',function(){editGoal(b.getAttribute('data-edit'));});});
    $$('[data-retire]',pane).forEach(function(b){b.addEventListener('click',function(){retireGoal(b.getAttribute('data-retire'));});});
    var adv=$('[data-advance]',pane);if(adv)adv.addEventListener('click',function(){advanceMetric(adv.getAttribute('data-advance'),$('#adv-val').value);});
    var hl=$('[data-habit-log]',pane);if(hl)hl.addEventListener('click',function(){logHabitDay(hl.getAttribute('data-habit-log'),parseInt($('#habit-count').value)||0);});
  }
  // write a goal's full state back to its vault file (Tauri only; no-op in browser)
  function persistGoal(g){
    if(!window.Bridge||!g.path)return;
    window.Bridge.notes.readParsed(g.path).then(function(note){
      var fm=(note&&note.frontmatter)||{};
      fm.type='goal';fm.title=g.title;fm.domain=g.domain;fm.kind=g.kind;fm.temp=g.temp;
      fm.why=g.why;fm.becoming=g.becoming||'';fm.pursuit=g.pursuit||'';fm.result=g.result||g.title;fm.deadline=g.deadline||null;
      fm.banner={color:g.banner,sigil:g.sigil};
      fm.last_touched=new Date().toISOString().slice(0,10);
      if(g.kind==='numeric'&&g.metric)fm.metric=g.metric;else delete fm.metric;
      if(g.kind==='habit'){fm.daily_target=g.daily_target;fm.daily_unit=g.daily_unit;fm.habit_log=g.habit_log||[];fm.streak=g.streak||0;fm.best_streak=g.best_streak||0;}
      fm.rungs=(g.rungs||[]).map(function(r){return {t:r.t,consume:r.consume||'',produce:r.produce||'',done:r.done||'',by:r.by||'',complete:!!r.complete};});
      window.Bridge.notes.write(g.path,fm,(note&&note.body)||'').catch(function(e){console.debug('[goal persist]',e);});
    }).catch(function(e){console.debug('[goal read]',e);});
  }
  function lightStar(id){
    var g=goals.filter(function(x){return x.id===id;})[0];if(!g)return;var ci=curIdx(g);
    if(g.rungs[ci])g.rungs[ci].complete=true;if(g.temp==='cooling')g.temp='warm';
    flash('a star is lit · '+g.title);persistGoal(g);render();
    // ceremony: the freshly-lit node blooms gold, once
    var rungEls=$$('.rung',pane);
    var nodeEl=rungEls[ci]?rungEls[ci].querySelector('.node'):null;
    if(nodeEl){nodeEl.classList.add('bloom');setTimeout(function(){nodeEl.classList.remove('bloom');},1000);}
    if(window.loadThresholdCard)window.loadThresholdCard();
  }
  // the undo: a lit star can always be put out again — no harm, no ceremony
  function unlightStar(id,ri){
    var g=goals.filter(function(x){return x.id===id;})[0];
    if(!g||!g.rungs||!g.rungs[ri]||!g.rungs[ri].complete)return;
    g.rungs[ri].complete=false;
    flash('the star is unlit — no harm done');persistGoal(g);render();
    if(window.loadThresholdCard)window.loadThresholdCard();
  }
  function advanceMetric(id,val){
    var g=goals.filter(function(x){return x.id===id;})[0];if(!g||!g.metric)return;
    var n=parseFloat(val);if(isNaN(n)){flash('a number, please');return;}
    g.metric.current=n;if(g.temp==='cooling')g.temp='warm';
    flash('logged · '+g.metric.name+' '+n+' '+(g.metric.unit||''));persistGoal(g);render();
  }
  function logHabitDay(id,count){
    var g=goals.filter(function(x){return x.id===id;})[0];if(!g)return;
    if(isNaN(count)||count<0){flash('enter a number');return;}
    var today=new Date().toISOString().slice(0,10);
    var log=g.habit_log||[];
    var idx=log.findIndex(function(e){return e.date===today;});
    if(idx>=0)log[idx].count=count;else log.push({date:today,count:count});
    g.habit_log=log;
    var target=g.daily_target||1,unit=g.daily_unit||'times';
    var newStreak=computeStreak(log,target);
    var honoured=count>=target;
    if(honoured&&newStreak>(g.best_streak||0))g.best_streak=newStreak;
    g.streak=newStreak;
    if(g.temp==='cooling')g.temp='warm';
    if(honoured){
      flash('honoured · '+count+' '+unit+' · '+newStreak+'-day streak ✦');
    } else {
      flash('logged · '+count+' / '+target+' '+unit);
    }
    persistGoal(g);render();
  }
  function retireGoal(id){
    var g=goals.filter(function(x){return x.id===id;})[0];if(!g)return;
    if(!confirm('Retire “'+g.title+'”? It leaves the sky; its file is kept (set to archived).'))return;
    if(window.Bridge&&g.path){
      window.Bridge.notes.readParsed(g.path).then(function(note){
        var fm=(note&&note.frontmatter)||{};fm.status='archived';
        window.Bridge.notes.write(g.path,fm,(note&&note.body)||'');
      }).catch(function(e){console.debug('[retire]',e);});
    }
    goals=goals.filter(function(x){return x.id!==id;});
    if(selected===id)selected=goals.length?goals[0].id:null;
    flash('retired · '+g.title);render();
  }
  function syncThreshold(){
    var g=goals[0];if(!g)return;
    var ci=(g.rungs&&g.rungs.length)?curIdx(g):0;
    var pos=(g.kind==='numeric'&&g.metric)?(g.metric.current+'/'+g.metric.target+' '+(g.metric.unit||'')):('rung '+(ci+1)+' of '+g.rungs.length);
    $('#th-goal-title').textContent=g.title;$('#th-goal-pos').textContent=pos;
    $('#th-goal-bar').style.width=Math.round(goalProg(g)*100)+'%';
    $('#th-goal-rung').textContent=(g.rungs&&g.rungs[ci])?(g.rungs[ci].produce||g.rungs[ci].t):(g.why||'advance the figure');
  }
  function render(){drawChart();drawLadder();syncThreshold();}

  /* ---- forge a guiding star (create + edit) ---- */
  var forgeScrim=$('#forge-scrim'),fgRoadmap=$('#fg-roadmap'),fgColor='#a8341f',fgKind='mastery',fgEditId=null;
  function fgRenumber(){$$('.rung-row',fgRoadmap).forEach(function(row,i){row.querySelector('.step-no').textContent=(i+1);});}
  // The Charting Table: each rung can unfold to carry its consume, produce,
  // done-when, and tide date — quick one-line entry still works.
  function fgAddRung(rung,focus){
    var r=(typeof rung==='string'||rung==null)?{t:rung||''}:rung;
    var row=document.createElement('div');row.className='rung-row';
    row.innerHTML='<span class="step-no"></span>'+
      '<input type="text" class="rg-t" placeholder="a rung — and what you will make to clear it" autocomplete="off">'+
      '<button class="expand" type="button" title="chart this rung">⌄</button>'+
      '<button class="mv" data-mv="-1" type="button" title="move up">↑</button>'+
      '<button class="mv" data-mv="1" type="button" title="move down">↓</button>'+
      '<button class="del" type="button" title="remove">×</button>'+
      '<div class="rung-detail">'+
        '<label><span>consume</span><input type="text" class="rg-consume" placeholder="what you will take in" autocomplete="off"></label>'+
        '<label><span>produce</span><input type="text" class="rg-produce" placeholder="what you will make" autocomplete="off"></label>'+
        '<label><span>done when</span><input type="text" class="rg-done" placeholder="the unambiguous test" autocomplete="off"></label>'+
        '<label><span>by · the tide</span><input type="date" class="rg-by"></label>'+
      '</div>';
    row.querySelector('.rg-t').value=r.t||'';
    row.querySelector('.rg-consume').value=r.consume||'';
    row.querySelector('.rg-produce').value=(r.produce&&r.produce!==r.t)?r.produce:'';
    row.querySelector('.rg-done').value=r.done||'';
    row.querySelector('.rg-by').value=r.by||'';
    var xp=row.querySelector('.expand');
    xp.addEventListener('click',function(){row.classList.toggle('open');xp.textContent=row.classList.contains('open')?'⌃':'⌄';});
    if(r.consume||r.done||r.by||(r.produce&&r.produce!==r.t)){row.classList.add('open');xp.textContent='⌃';}
    row.querySelector('.del').addEventListener('click',function(){row.remove();if(!$$('.rung-row',fgRoadmap).length)fgAddRung();fgRenumber();});
    $$('.mv',row).forEach(function(mb){mb.addEventListener('click',function(){
      var dir=+mb.getAttribute('data-mv');
      var sib=dir<0?row.previousElementSibling:row.nextElementSibling;
      if(!sib||!sib.classList.contains('rung-row'))return;
      if(dir<0)fgRoadmap.insertBefore(row,sib);else fgRoadmap.insertBefore(sib,row);
      fgRenumber();
    });});
    fgRoadmap.appendChild(row);fgRenumber();
    if(focus)row.querySelector('.rg-t').focus();
  }
  function fgSetKind(k){
    fgKind=k;
    $$('.ktab',$('#fg-kind')).forEach(function(t){t.setAttribute('aria-pressed',t.getAttribute('data-kind')===k?'true':'false');});
    $('#fg-metric-field').style.display=(k==='numeric')?'block':'none';
    $('#fg-habit-field').style.display=(k==='habit')?'block':'none';
    $('#fg-roadmap-field').style.display=(k==='mastery')?'block':'none';
  }
  function fgSetColor(c){fgColor=c;$$('.swatch',$('#fg-swatches')).forEach(function(s){s.setAttribute('aria-pressed',s.getAttribute('data-color')===c?'true':'false');});}
  function openForge(){
    fgEditId=null;$('#fg-heading').textContent='Forge a guiding star';$('#fg-save').textContent='set it in the sky';
    $('#fg-title').value='';$('#fg-why').value='';$('#fg-domain').value='';$('#fg-deadline').value='';
    $('#fg-becoming').value='';
    fillForgePursuits('');
    $('#fg-mname').value='';$('#fg-mcur').value='';$('#fg-mtgt').value='';$('#fg-munit').value='';
    $('#fg-htarget').value='';$('#fg-hunit').value='';
    $('#fg-sigil').value='✦';fgSetColor('#a8341f');fgSetKind('mastery');
    // one rung to start — the full apparatus (consume/produce/done/tide) is one ⌄ away,
    // and "add a rung" is right there when the star needs more steps
    fgRoadmap.innerHTML='';fgAddRung();
    forgeScrim.classList.add('on');setTimeout(function(){$('#fg-title').focus();},40);
  }
  function editGoal(id){
    var g=goals.filter(function(x){return x.id===id;})[0];if(!g)return;
    fgEditId=id;$('#fg-heading').textContent='Re-chart this star';$('#fg-save').textContent='save the changes';
    $('#fg-title').value=g.title||'';$('#fg-why').value=g.why||'';$('#fg-domain').value=(g.domain==='a pursuit'?'':g.domain)||'';
    $('#fg-becoming').value=g.becoming||'';
    fillForgePursuits(g.pursuit||'');
    $('#fg-deadline').value=g.deadline||'';$('#fg-sigil').value=g.sigil||'✦';fgSetColor(g.banner||'#a8341f');
    fgSetKind(g.kind==='numeric'?'numeric':(g.kind==='habit'?'habit':'mastery'));
    var m=g.metric||{};$('#fg-mname').value=m.name||'';$('#fg-mcur').value=(m.current!=null?m.current:'');$('#fg-mtgt').value=(m.target!=null?m.target:'');$('#fg-munit').value=m.unit||'';
    $('#fg-htarget').value=(g.daily_target!=null?g.daily_target:'');$('#fg-hunit').value=g.daily_unit||'';
    fgRoadmap.innerHTML='';(g.rungs&&g.rungs.length?g.rungs:[null]).forEach(function(r){fgAddRung(r||'');});
    forgeScrim.classList.add('on');setTimeout(function(){$('#fg-title').focus();},40);
  }
  function closeForge(){forgeScrim.classList.remove('on');}
  function slugify(t){return t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||('star-'+rid());}
  $('#forge-star').addEventListener('click',openForge);
  $('#fg-cancel').addEventListener('click',closeForge);
  forgeScrim.addEventListener('click',function(e){if(e.target===forgeScrim)closeForge();});
  $('#fg-addrung').addEventListener('click',function(){fgAddRung('',true);});
  // lay only the EMPTY tide dates evenly from today to the deadline
  $('#fg-laytide').addEventListener('click',function(){
    var dl=$('#fg-deadline').value;
    if(!dl){flash('set a tide first — a deadline to lay against');return;}
    var du=daysUntil(dl);
    if(du===null||du<0){flash('the tide has already turned');return;}
    var rows=$$('.rung-row',fgRoadmap).filter(function(r){return r.querySelector('.rg-t').value.trim();});
    if(!rows.length){flash('chart at least one rung');return;}
    var laid=0;
    rows.forEach(function(row,i){
      var by=row.querySelector('.rg-by');
      if(!by.value){by.value=addDaysISO(Math.round(du*(i+1)/rows.length));laid++;if(!row.classList.contains('open')){row.classList.add('open');row.querySelector('.expand').textContent='⌃';}}
    });
    flash(laid?('the tide is laid · '+laid+' rung'+(laid===1?'':'s')):'every rung already keeps its own tide');
  });
  $$('.ktab',$('#fg-kind')).forEach(function(t){t.addEventListener('click',function(){fgSetKind(t.getAttribute('data-kind'));});});
  $$('.swatch',$('#fg-swatches')).forEach(function(s){s.addEventListener('click',function(){fgSetColor(s.getAttribute('data-color'));});});
  $('#fg-save').addEventListener('click',function(){
    var title=$('#fg-title').value.trim();
    if(!title){$('#fg-title').focus();flash('a star needs a name');return;}
    var why=$('#fg-why').value.trim(),domain=$('#fg-domain').value.trim()||'a pursuit';
    var becoming=$('#fg-becoming').value.trim();
    var pursuit=($('#fg-pursuit')?$('#fg-pursuit').value:'')||'';
    var sigil=($('#fg-sigil').value||'✦').slice(0,2),deadline=$('#fg-deadline').value||null;
    var rungs=[],metric=null,daily_target=null,daily_unit='';
    if(fgKind==='numeric'){
      metric={name:$('#fg-mname').value.trim()||'the figure',current:parseFloat($('#fg-mcur').value)||0,
        target:parseFloat($('#fg-mtgt').value)||0,unit:$('#fg-munit').value.trim()};
      if(!metric.target){flash('a figure needs a target');return;}
    } else if(fgKind==='habit'){
      daily_target=parseInt($('#fg-htarget').value)||1;
      daily_unit=$('#fg-hunit').value.trim()||'times';
    } else {
      var rungRows=$$('.rung-row',fgRoadmap).filter(function(row){return row.querySelector('.rg-t').value.trim();});
      if(!rungRows.length){flash('chart at least one rung');return;}
      // the sacred law, enforced: every rung must name something you will make —
      // reading alone was the one easy path this app is built to close off
      var missing=rungRows.filter(function(row){return !row.querySelector('.rg-produce').value.trim();});
      if(missing.length){
        var badRow=missing[0];
        if(!badRow.classList.contains('open')){badRow.classList.add('open');badRow.querySelector('.expand').textContent='⌃';}
        badRow.querySelector('.rg-produce').focus();
        flash('each rung needs something you will make — reading alone never lights a star');
        return;
      }
      rungs=rungRows.map(function(row){
        return {t:row.querySelector('.rg-t').value.trim(),consume:row.querySelector('.rg-consume').value.trim(),
          produce:row.querySelector('.rg-produce').value.trim(),done:row.querySelector('.rg-done').value.trim(),
          by:row.querySelector('.rg-by').value||'',complete:false};
      });
    }
    var existing=fgEditId?goals.filter(function(x){return x.id===fgEditId;})[0]:null;
    if(existing){
      // preserve identity, position, and rung-completion where titles still match
      var prev=existing.rungs||[];
      if(fgKind!=='numeric')rungs.forEach(function(r){var p=prev.filter(function(o){return o.t===r.t;})[0];if(p)r.complete=p.complete;});
      existing.title=title;existing.why=why;existing.domain=domain;existing.sigil=sigil;existing.banner=fgColor;
      existing.becoming=becoming;existing.pursuit=pursuit;
      existing.deadline=deadline;existing.result=title;existing.kind=fgKind;existing.metric=metric;existing.rungs=rungs;
      if(fgKind==='habit'){existing.daily_target=daily_target;existing.daily_unit=daily_unit;}
      selected=existing.id;closeForge();render();flash('re-charted · '+title);persistGoal(existing);
      if(window.loadThresholdCard)window.loadThresholdCard();
      return;
    }
    var id='g'+rid();
    var g={id:id,title:title,domain:domain,kind:fgKind,temp:'warm',banner:fgColor,sigil:sigil,
      deadline:deadline,why:why,becoming:becoming,pursuit:pursuit,result:title,metric:metric,daily_target:daily_target,daily_unit:daily_unit,
      habit_log:[],streak:0,best_streak:0,rungs:rungs};
    goals.push(g);selected=id;closeForge();render();go('atlas');
    flash('a new star is set · '+title);
    if(window.Bridge){
      var fm={type:'goal',title:title,domain:domain,kind:fgKind,temp:'warm',
        last_touched:new Date().toISOString().slice(0,10),why:why,becoming:becoming,pursuit:pursuit,result:title,deadline:deadline,
        banner:{color:fgColor,sigil:sigil}};
      if(metric)fm.metric=metric;
      if(fgKind==='habit'){fm.daily_target=daily_target;fm.daily_unit=daily_unit;fm.habit_log=[];fm.streak=0;fm.best_streak=0;}
      fm.rungs=rungs.map(function(r){return {t:r.t,consume:r.consume,produce:r.produce,done:r.done,by:r.by||'',complete:false};});
      window.Bridge.notes.create('Goals',slugify(title),fm,'')
        .then(function(rel){g.path=rel;if(window.loadThresholdCard)window.loadThresholdCard();})
        .catch(function(e){console.debug('[forge] persist failed',e);});
    }
  });

  /* ---- the becomings (Pursuits/) — the identity altitude above the stars ---- */
  function pursuitTitle(slug){
    var p=pursuits.filter(function(x){return x.slug===slug;})[0];
    return p?p.title:'';
  }
  function renderPursuitRail(){
    var rail=document.getElementById('pursuit-rail'),chipsEl=document.getElementById('pursuit-chips');
    if(!rail||!chipsEl)return;
    if(!pursuits.length){rail.hidden=true;pursuitFilter='all';return;}
    rail.hidden=false;
    var order={burning:0,steady:1,fallow:2,fulfilled:3};
    var sorted=pursuits.slice().sort(function(a,b){return (order[a.state]||1)-(order[b.state]||1);});
    var h='<button class="pr-chip" data-p="all" aria-pressed="'+(pursuitFilter==='all')+'">all the sky</button>';
    sorted.forEach(function(p){
      var cnt=goals.filter(function(g){return (g.pursuit||'')===p.slug;}).length;
      h+='<button class="pr-chip" data-p="'+esc(p.slug)+'" aria-pressed="'+(pursuitFilter===p.slug)+'">'+esc(p.title)+
         '<span class="st '+esc(p.state||'steady')+'">'+esc(p.state||'steady')+'</span>'+
         (cnt?'<span class="n">'+cnt+' ✦</span>':'')+'</button>';
    });
    chipsEl.innerHTML=h;
    $$('.pr-chip',chipsEl).forEach(function(c){c.addEventListener('click',function(){
      pursuitFilter=c.getAttribute('data-p');
      renderPursuitRail();drawChart();
    });});
  }
  function fillForgePursuits(sel){
    var el=$('#fg-pursuit'),field=$('#fg-pursuit-field');
    if(!el||!field)return;
    field.style.display=pursuits.length?'block':'none';
    el.innerHTML='<option value="">— its own pursuit —</option>'+pursuits.map(function(p){
      return '<option value="'+esc(p.slug)+'"'+(sel===p.slug?' selected':'')+'>'+esc(p.title)+'</option>';
    }).join('');
  }
  window.RM_loadPursuits=function(){
    if(!window.Bridge||!window.Bridge.vault){renderPursuitRail();return;}
    window.Bridge.vault.listFiles('Pursuits').then(function(files){
      if(!files){pursuits=[];renderPursuitRail();return;}
      Promise.all(files.map(function(f){
        var rel='Pursuits/'+f.name+'.md';
        return window.Bridge.notes.readParsed(rel).then(function(note){
          var fm=(note&&note.frontmatter)||{};
          if(fm.type&&fm.type!=='pursuit')return null;
          return {slug:f.name,rel:rel,title:fm.title||f.name,why:fm.why||'',state:fm.state||'steady'};
        }).catch(function(){return null;});
      })).then(function(rows){
        pursuits=rows.filter(Boolean);
        renderPursuitRail();fillForgePursuits();
      });
    }).catch(function(){pursuits=[];renderPursuitRail();});
  };
  // the naming scrim
  var puScrim=document.getElementById('pursuit-scrim');
  var puNew=document.getElementById('pursuit-new');
  if(puNew)puNew.addEventListener('click',function(){
    document.getElementById('pu-title').value='';
    document.getElementById('pu-why').value='';
    document.getElementById('pu-state').value='burning';
    puScrim.classList.add('on');
    setTimeout(function(){document.getElementById('pu-title').focus();},40);
  });
  if(puScrim){
    document.getElementById('pu-cancel').addEventListener('click',function(){puScrim.classList.remove('on');});
    document.getElementById('pu-save').addEventListener('click',function(){
      var title=document.getElementById('pu-title').value.trim();
      if(!title){document.getElementById('pu-title').focus();flash('a becoming needs a name');return;}
      var why=document.getElementById('pu-why').value.trim();
      var state=document.getElementById('pu-state').value;
      var today=new Date().toISOString().slice(0,10);
      var fm={type:'pursuit',title:title,why:why,state:state,opened:today};
      if(!window.__TAURI__){
        pursuits.push({slug:slugify(title),rel:'',title:title,why:why,state:state});
        puScrim.classList.remove('on');renderPursuitRail();fillForgePursuits();
        flash('a becoming is named · '+title);return;
      }
      var base=slugify(title);
      (function tryCreate(attempt){
        var slug=attempt===0?base:base+'-'+Math.random().toString(36).slice(2,5);
        window.Bridge.notes.create('Pursuits',slug,fm,'').then(function(){
          puScrim.classList.remove('on');
          flash('a becoming is named · '+title);
          window.RM_loadPursuits();
        }).catch(function(e){
          if(attempt<3&&String(e).indexOf('already exists')>=0){tryCreate(attempt+1);return;}
          flash('the becoming would not keep');console.debug('[pursuit create]',e);
        });
      })(0);
    });
  }

  // load real goals from the vault (Tauri); replaces the demo set when any exist
  window.RM_loadGoalsFromVault=function(){
    if(!window.Bridge||!window.Bridge.vault)return;
    window.Bridge.vault.listFiles('Goals').then(function(files){
      if(!files||!files.length){goals=[];sortGoals();render();return;}
      Promise.all(files.map(function(f){
        var rel='Goals/'+f.name+'.md';
        return window.Bridge.notes.readParsed(rel).then(function(note){return {rel:rel,fm:(note&&note.frontmatter)||{}};}).catch(function(){return null;});
      })).then(function(rows){
        var loaded=[];
        rows.forEach(function(row){
          if(!row)return;var fm=row.fm;
          if((fm.status||'')==='archived')return;
          if((fm.type||'goal')!=='goal')return;
          var rungs=(Array.isArray(fm.rungs)?fm.rungs:[]).map(function(r){return {t:r.t||'',consume:r.consume||'',produce:r.produce||r.t||'',done:r.done||'',by:r.by||'',complete:!!r.complete};});
          var metric=(fm.metric&&typeof fm.metric==='object')?{name:fm.metric.name||'the figure',current:+fm.metric.current||0,target:+fm.metric.target||0,unit:fm.metric.unit||''}:null;
          var kind=fm.kind||(metric?'numeric':'mastery');
          var banner=(fm.banner&&fm.banner.color)||'#a8341f',sigil=(fm.banner&&fm.banner.sigil)||'✦';
          var name=row.rel.split('/').pop().replace(/\.md$/,'');
          var habitLog=Array.isArray(fm.habit_log)?fm.habit_log:[];
          var dailyTarget=fm.daily_target!=null?+fm.daily_target:1;
          loaded.push({id:'v_'+slugify(row.rel),path:row.rel,title:fm.title||name,
            domain:fm.domain||'a pursuit',kind:kind,temp:fm.temp||'warm',banner:banner,sigil:sigil,
            deadline:fm.deadline||null,why:fm.why||'',becoming:fm.becoming||'',pursuit:fm.pursuit||'',result:fm.result||fm.title||name,metric:metric,
            daily_target:dailyTarget,daily_unit:fm.daily_unit||'times',
            habit_log:habitLog,streak:computeStreak(habitLog,dailyTarget),best_streak:fm.best_streak||0,
            rungs:rungs});
        });
        goals=loaded;sortGoals();selected=loaded.length?loaded[0].id:null;render();
        renderPursuitRail(); // star counts on the becomings rail depend on the loaded sky
      });
    }).catch(function(e){console.debug('[load goals]',e);});
  };

  // re-entry: select a guiding star by its vault-relative path (called from the Threshold)
  window.RM_selectGoalByPath=function(rel){
    var g=goals.filter(function(x){return x.path===rel;})[0];
    if(!g)return;
    selected=g.id;render();
  };

  /* ---- Phase F: THREADS IN THE SKY — constellations being drawn ----
     A burning thread rides high; a fallow one sits at the horizon, waiting;
     an answered one remains as a faint, finished constellation. Dissolved
     threads stay as ghosts — translucent, unlabelled, never deleted. */
  var skyThreads=[];
  function drawThreadStars(){
    $$('.thread-g',chart).forEach(function(n){n.remove();});
    skyThreads.forEach(function(t){
      var grp=document.createElementNS(NS,'g');
      grp.setAttribute('class','thread-g');grp.style.cursor='pointer';
      var x=t.cx,y=t.cy,dim=(t.status==='fallow'),ghost=(t.status==='dissolved'),done=(t.status==='answered');
      // the star: a fine four-point diamond — an unfinished constellation's first star
      var s=dim?4:(ghost?3:5.5);
      var d='M '+x+' '+(y-s)+' L '+(x+s*0.42)+' '+y+' L '+x+' '+(y+s)+' L '+(x-s*0.42)+' '+y+' Z';
      var star=document.createElementNS(NS,'path');
      star.setAttribute('d',d);
      star.setAttribute('class','th-star'+(dim?' fallow':'')+(ghost?' ghost':'')+(done?' answered':''));
      grp.appendChild(star);
      // open threads wear a dotted ring — the constellation not yet drawn
      if(!done&&!ghost){
        var ring=document.createElementNS(NS,'circle');
        ring.setAttribute('cx',x);ring.setAttribute('cy',y);ring.setAttribute('r',dim?8:11);
        ring.setAttribute('class','th-ring'+(dim?' fallow':''));grp.appendChild(ring);
      }
      if(!ghost){
        var tx=document.createElementNS(NS,'text');
        tx.setAttribute('class','th-name'+(dim?' fallow':''));
        tx.setAttribute('x',x+(dim?11:15));tx.setAttribute('y',y+3);
        var q=t.question||'';tx.textContent=q.length>42?q.slice(0,40)+'…':q;
        grp.appendChild(tx);
      }
      grp.addEventListener('click',function(){showThreadCartouche(t);});
      chart.appendChild(grp);
    });
  }
  function showThreadCartouche(t){
    var pane2=document.getElementById('concept-pane');if(!pane2)return;
    var stanceLine=t.stance?'<div class="cc-core">”'+esc(t.stance)+'”</div>':'';
    var capLine=(t.status==='fallow'&&t.capsule)?
      '<div class="cc-excerpt"><i>sealed —</i> '+esc(t.capsule)+'</div>':'';
    var statusWord={burning:'burning · being pulled',fallow:'fallow · sleeping at the horizon',
      answered:'answered · a finished constellation',dissolved:'dissolved'}[t.status]||t.status;
    pane2.innerHTML='<div class="concept-cartouche">'+
      '<div class="cc-src" style="margin:0 0 6px">'+esc(statusWord)+'</div>'+
      '<div class="cc-core" style="font-size:19px">'+esc(t.question)+'</div>'+
      stanceLine+capLine+
      '<div class="cc-src" style="margin-top:8px">the thread waits on the Threshold — it is pulled there, not here.</div>'+
      '</div>';
  }
  window.RM_loadThreadsIntoSky=function(){
    if(!window.Bridge||!window.Bridge.vault)return;
    window.Bridge.vault.listFiles('Threads').then(function(files){
      if(!files)return;
      Promise.all(files.map(function(f){
        var rel='Threads/'+f.name+'.md';
        return window.Bridge.notes.readParsed(rel).then(function(note){return {rel:rel,fm:(note&&note.frontmatter)||{}};}).catch(function(){return null;});
      })).then(function(rows){
        var loaded=[];
        rows.forEach(function(row){
          if(!row||row.fm.type!=='thread')return;
          var fm=row.fm,hash=0;
          for(var i=0;i<row.rel.length;i++)hash=(hash*31+row.rel.charCodeAt(i))>>>0;
          var status=fm.status||'burning';
          var pos=Array.isArray(fm.position)&&fm.position.length?fm.position[fm.position.length-1].stance:'';
          var seals=Array.isArray(fm.sealed)?fm.sealed:[];
          var cap=seals.length?seals[seals.length-1]:null;
          loaded.push({rel:row.rel,question:fm.question||'(unnamed)',status:status,stance:pos,
            capsule:cap?(cap.stood||''):'',
            // fallow & finished rest at the horizon; burning ones are placed below
            cx:90+(hash%820),
            cy:385+(hash%22)});
        });
        skyThreads=loaded.slice(0,30);
        // burning threads ride an ordered band above the goal sky — never through it
        var burning=skyThreads.filter(function(t){return t.status==='burning';});
        burning.forEach(function(t,i){
          t.cx=burning.length===1?500:Math.round(70+i*(860/(burning.length-1)));
          t.cy=(i%2)?100:62;
        });
        drawThreadStars();
      });
    }).catch(function(e){console.debug('[threads-sky]',e);});
  };

  /* ---- CONCEPT LAYER (Feature 4: Concept Stars) ---- */
  var conceptNodes=[], conceptEdgeList=[], conceptLayerOn=false;
  var NS_SVG='http://www.w3.org/2000/svg';
  var conceptLayer=document.getElementById('concept-layer');

  // Map pos_x/pos_y (0..1 from embedding) to SVG viewBox 1000×430
  function conceptSVGPos(node){
    return { x: Math.round(50 + node.pos_x * 900), y: Math.round(30 + node.pos_y * 370) };
  }

  function drawConceptLayer(){
    if(!conceptLayer)return;
    while(conceptLayer.firstChild)conceptLayer.removeChild(conceptLayer.firstChild);
    // Build path→node index for edge lookup
    var idx={};
    conceptNodes.forEach(function(n){idx[n.path]=n;});
    // Draw edges first (behind stars)
    conceptEdgeList.forEach(function(e){
      var a=idx[e.path_a],b=idx[e.path_b];
      if(!a||!b)return;
      var pa=conceptSVGPos(a),pb=conceptSVGPos(b);
      var ln=document.createElementNS(NS_SVG,'line');
      ln.setAttribute('class','concept-edge'+(e.bridged?' bridged':''));
      ln.setAttribute('x1',pa.x);ln.setAttribute('y1',pa.y);
      ln.setAttribute('x2',pb.x);ln.setAttribute('y2',pb.y);
      conceptLayer.appendChild(ln);
    });
    // Draw concept stars
    conceptNodes.forEach(function(node){
      var pos=conceptSVGPos(node);
      var grp=document.createElementNS(NS_SVG,'g');
      grp.setAttribute('class','concept-node');
      grp.style.cursor='pointer';
      var circle=document.createElementNS(NS_SVG,'circle');
      circle.setAttribute('class','concept-star'+(node.core?' has-core':''));
      circle.setAttribute('cx',pos.x);circle.setAttribute('cy',pos.y);
      circle.setAttribute('r',node.core?3.2:2);
      grp.appendChild(circle);
      if(node.core){
        var tx=document.createElementNS(NS_SVG,'text');
        tx.setAttribute('class','c-concept-name');
        tx.setAttribute('x',pos.x);tx.setAttribute('y',pos.y+13);
        tx.setAttribute('text-anchor','middle');
        tx.textContent=node.core.length>38?node.core.slice(0,35)+'…':node.core;
        grp.appendChild(tx);
      }
      grp.addEventListener('click',function(e){e.stopPropagation();showConceptCartouche(node);});
      conceptLayer.appendChild(grp);
    });
  }

  function showConceptCartouche(node){
    var pane=document.getElementById('concept-pane');
    if(!pane)return;
    var escH=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
    var src='';
    if(node.source){src='<div class="cc-src">from · <a href="#" class="cs-src" data-path="'+escH(node.source)+'">'+escH(node.source_title||node.source)+'</a></div>';}
    pane.innerHTML='<div class="concept-cartouche">'+
      '<div class="cc-core">'+(node.core?escH(node.core):escH(node.title))+'</div>'+
      (node.excerpt?'<div class="cc-excerpt">'+escH(node.excerpt)+'</div>':'')+
      src+
      '</div>';
    var link=pane.querySelector('.cs-src');
    if(link)link.addEventListener('click',function(e){e.preventDefault();go('reading');});
  }

  function loadConceptLayer(){
    if(!window.Bridge)return;
    Promise.all([
      window.Bridge.vault.listNotesForAtlas(),
      window.Bridge.search.conceptEdges(0.65)
    ]).then(function(results){
      conceptNodes=results[0]||[];
      conceptEdgeList=results[1]||[];
      conceptLayerOn=true;
      if(conceptLayer)conceptLayer.style.display='';
      drawConceptLayer();
      var btn=document.getElementById('concept-toggle');
      if(btn){btn.textContent='hide concepts';btn.classList.add('active');}
    }).catch(function(e){console.debug('[concept-layer]',e);});
  }

  function toggleConceptLayer(){
    if(!conceptLayerOn){
      loadConceptLayer();
    } else {
      conceptLayerOn=false;
      if(conceptLayer)conceptLayer.style.display='none';
      var btn=document.getElementById('concept-toggle');
      if(btn){btn.textContent='concept map';btn.classList.remove('active');}
      var pane=document.getElementById('concept-pane');
      if(pane)pane.innerHTML='';
    }
  }

  var ctBtn=document.getElementById('concept-toggle');
  if(ctBtn)ctBtn.addEventListener('click',toggleConceptLayer);

  /* ---- CABINET (bucket) ---- */
  var bucket=[
    {n:'See the aurora borealis',d:'travel',cost:'high',effort:'high',status:'attained',tags:'aurora northern lights iceland norway sky'},
    {n:'Learn to read the night sky by eye',d:'skill',cost:'free',effort:'mid',now:true,status:'open',tags:'astronomy stars constellations sky navigation'},
    {n:'Read Gödel, Escher, Bach cover to cover',d:'skill',cost:'low',effort:'high',status:'open',tags:'hofstadter logic music recursion book'},
    {n:'Swim in a bioluminescent bay',d:'travel',cost:'high',effort:'high',status:'open',tags:'bioluminescence ocean glow night swim'},
    {n:'Build a working telescope',d:'skill',cost:'mid',effort:'high',status:'open',tags:'optics lens mirror astronomy make build'},
    {n:'Memorise a poem worth keeping',d:'skill',cost:'free',effort:'low',now:true,status:'open',tags:'poetry memory recitation verse'},
    {n:'Stand inside the Pantheon at noon',d:'travel',cost:'high',effort:'mid',status:'open',tags:'rome architecture oculus light history'},
    {n:'Cook one dish from each continent',d:'skill',cost:'low',effort:'mid',now:true,status:'open',tags:'cooking food world cuisine craft'},
    {n:'Learn the basics of celestial navigation',d:'skill',cost:'free',effort:'mid',now:true,status:'open',tags:'sextant stars sea navigation latitude'},
    {n:'Watch a total solar eclipse',d:'travel',cost:'mid',effort:'high',status:'open',tags:'eclipse sun moon sky rare'},
    {n:'Write and bind one book of my own',d:'skill',cost:'low',effort:'high',status:'open',tags:'writing bookbinding craft publish make'},
    {n:'See the Northern and Southern skies both',d:'travel',cost:'high',effort:'high',status:'open',tags:'hemisphere stars travel sky'},
    {n:'Keep a garden through one whole year',d:'skill',cost:'low',effort:'mid',now:true,status:'open',tags:'garden plants seasons patience grow'},
    {n:'Learn to sketch what I see',d:'skill',cost:'free',effort:'mid',now:true,status:'open',tags:'drawing sketch art observation'}
  ];
  var grid=$('#cabgrid'),cabFilter='all',cabQ='',cabResurfEl=$('.cab-resurface');
  function curSeason(){var m=new Date().getMonth();if(m<=1||m===11)return 'winter';if(m<=4)return 'spring';if(m<=7)return 'summer';return 'autumn';}
  function inSeason(b){var s=b.season||'any';return s==='any'||s===curSeason();}
  function renderCab(){
    grid.innerHTML='';var shown=0;
    bucket.forEach(function(b,i){
      var nowDoable=inSeason(b)&&b.status!=='attained';
      var pass=cabFilter==='all'||(cabFilter==='now'&&nowDoable)||(cabFilter==='free'&&b.cost==='free')||(cabFilter==='travel'&&b.d==='travel')||(cabFilter==='skill'&&b.d==='skill');
      if(cabQ){var hay=(b.n+' '+(b.tags||'')+' '+(b.d||'')).toLowerCase();if(hay.indexOf(cabQ)===-1)pass=false;}
      if(!pass)return;shown++;
      var el=document.createElement('div');el.className='spec'+(b.status==='attained'?' attained':'');
      if(b.n===justSealed){el.classList.add('just-sealed');justSealed=null;}
      el.innerHTML='<button class="spec-more" data-i="'+i+'" title="details">···</button>'+
        '<div class="label">'+esc(b.d||'a wish')+(b.cost?(' · '+esc(b.cost)):'')+'</div>'+
        '<div class="name">'+esc(b.n)+'</div>'+
        '<div class="meta">'+(b.effort?'<span>effort: '+esc(b.effort)+'</span>':'')+(nowDoable?'<span style="color:var(--verm)">in season</span>':'')+(b.charted?'<span style="color:var(--gold-hi)">☆ charted as a star</span>':'')+'</div>'+
        '<span class="seal-done">✦ attained</span>'+
        (b.status==='open'?'<button class="mark-done" data-i="'+i+'">mark attained</button>':'');
      el.addEventListener('click',function(e){
        if(e.target.classList.contains('mark-done')){
          e.stopPropagation();markAttained(i);
        } else {
          openWishDetail(i);
        }
      });
      grid.appendChild(el);
    });
    if(!shown)grid.innerHTML='<p class="empty-note" style="padding:20px 2px">'+(bucket.length?'Nothing here matches — try the shape of the wish, not the exact words.':'The wishbook is empty. Record a wish above, or capture one (Ctrl+N) and sort it here from the inbox.')+'</p>';
    renderResurface();
  }
  var justSealed=null; // ceremony: the freshly-attained wish takes a pressed seal
  function markAttained(i){
    var b=bucket[i];if(!b)return;b.status='attained';justSealed=b.n;flash('attained · '+b.n);
    if(window.Bridge&&b.path){
      window.Bridge.notes.readParsed(b.path).then(function(note){
        var fm=(note&&note.frontmatter)||{};fm.status='attained';fm.attained_on=new Date().toISOString().slice(0,10);
        window.Bridge.notes.write(b.path,fm,(note&&note.body)||'').catch(function(e){console.debug('[cabinet attain]',e);});
      }).catch(function(e){console.debug('[cabinet attain read]',e);});
    }
    renderCab();
  }
  var wishScrim=document.getElementById('wish-scrim');
  var wishIdx=-1;
  function wishChrome(isNew){
    var h3=wishScrim.querySelector('h3'),sub=wishScrim.querySelector('.sub');
    if(h3)h3.textContent=isNew?'A new wish':'A wish';
    if(sub)sub.textContent=isNew?'— set it down; the cabinet will keep it —':'— edit the details or release it —';
    var tb=document.getElementById('wish-trash-btn');if(tb)tb.style.display=isNew?'none':'';
    var cb=document.getElementById('wish-chart-btn');if(cb)cb.style.display=isNew?'none':'';
    var sv=document.getElementById('wish-save-btn');if(sv)sv.textContent=isNew?'set it down':'save';
  }
  function openNewWish(){
    wishIdx=-1;
    document.getElementById('wish-title').value='';
    document.getElementById('wish-body').value='';
    document.getElementById('wish-domain').value='';
    document.getElementById('wish-cost').value='free';
    document.getElementById('wish-effort').value='low';
    document.getElementById('wish-season').value='any';
    wishChrome(true);
    wishScrim.classList.add('on');
    setTimeout(function(){document.getElementById('wish-title').focus();},40);
  }
  function openWishDetail(i){
    var b=bucket[i];if(!b)return;
    wishIdx=i;
    wishChrome(false);
    document.getElementById('wish-title').value=b.n||'';
    document.getElementById('wish-domain').value=b.d||'';
    document.getElementById('wish-cost').value=b.cost||'mid';
    document.getElementById('wish-effort').value=b.effort||'mid';
    document.getElementById('wish-season').value=b.season||'any';
    // load body from vault if available
    var bodyEl=document.getElementById('wish-body');
    bodyEl.value='';
    if(window.Bridge&&b.path){
      window.Bridge.notes.readParsed(b.path).then(function(note){bodyEl.value=(note&&note.body)||'';}).catch(function(){});
    }
    wishScrim.classList.add('on');
  }
  function closeWishScrim(){wishScrim.classList.remove('on');wishIdx=-1;}
  function saveWish(){
    var title=document.getElementById('wish-title').value.trim();
    var domain=document.getElementById('wish-domain').value.trim();
    var cost=document.getElementById('wish-cost').value;
    var effort=document.getElementById('wish-effort').value;
    var season=document.getElementById('wish-season').value;
    var body=document.getElementById('wish-body').value;
    // a fresh wish → its own leaf in Bucket/
    if(wishIdx===-1){
      if(!title){flash('give the wish a name first');return;}
      var today=new Date().toISOString().slice(0,10);
      var fmNew={type:'bucket',title:title,domain:domain,cost:cost,effort:effort,season:season,status:'open',added:today};
      if(!window.__TAURI__){
        bucket.push({n:title,d:domain,cost:cost,effort:effort,season:season,status:'open',tags:''});
        flash('a wish is set down · '+title);closeWishScrim();renderCab();return;
      }
      var base=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||('wish-'+Date.now());
      (function tryCreate(attempt){
        var slug=attempt===0?base:base+'-'+Math.random().toString(36).slice(2,5);
        window.Bridge.notes.create('Bucket',slug,fmNew,body).then(function(){
          flash('a wish is set down · '+title);
          closeWishScrim();
          if(window.RM_loadCabinet)window.RM_loadCabinet();
        }).catch(function(e){
          if(attempt<3&&String(e).indexOf('already exists')>=0){tryCreate(attempt+1);return;}
          flash('the wish would not keep');console.debug('[wish create]',e);
        });
      })(0);
      return;
    }
    var b=bucket[wishIdx];if(!b||!window.Bridge||!b.path)return;
    title=title||b.n;
    window.Bridge.notes.readParsed(b.path).then(function(note){
      var fm=Object.assign({},(note&&note.frontmatter)||{},{title:title,domain:domain,cost:cost,effort:effort,season:season});
      return window.Bridge.notes.write(b.path,fm,body);
    }).then(function(){
      flash('wish saved · '+title);
      closeWishScrim();
      if(window.RM_loadCabinet)window.RM_loadCabinet();
    }).catch(function(e){flash('could not save wish');console.debug('[wish save]',e);});
  }
  // graduation: a wish that has turned actionable becomes a guiding star.
  // Opens the forge prefilled; the wish stays in the cabinet, marked charted.
  function chartWish(){
    var b=bucket[wishIdx];if(!b)return;
    var body=document.getElementById('wish-body').value||'';
    closeWishScrim();
    if(window.RM_openForge){
      window.RM_openForge(b.n);
      var d=document.getElementById('fg-domain');if(d&&b.d)d.value=b.d;
      var w=document.getElementById('fg-why');if(w&&!w.value)w.value=body.split('\n').filter(Boolean)[0]||'';
    }
    if(window.Bridge&&b.path&&window.__TAURI__){
      window.Bridge.notes.readParsed(b.path).then(function(note){
        var fm=(note&&note.frontmatter)||{};fm.charted=new Date().toISOString().slice(0,10);
        return window.Bridge.notes.write(b.path,fm,(note&&note.body)||'');
      }).then(function(){b.charted=true;if(window.RM_loadCabinet)window.RM_loadCabinet();})
        .catch(function(e){console.debug('[wish chart]',e);});
    } else { b.charted=true; renderCab(); }
    flash('to the sky · forge the star from this wish');
  }
  function trashWish(){
    var b=bucket[wishIdx];if(!b)return;
    if(!window.Bridge||!b.path){closeWishScrim();return;}
    if(!window.confirm('Move "'+b.n+'" to trash?'))return;
    window.Bridge.notes.trash(b.path).then(function(){
      flash('moved to trash · '+b.n);
      closeWishScrim();
      if(window.RM_loadCabinet)window.RM_loadCabinet();
    }).catch(function(e){flash('could not trash wish');console.debug('[wish trash]',e);});
  }
  var cabNewBtn=document.getElementById('cab-new-wish');
  if(cabNewBtn)cabNewBtn.addEventListener('click',openNewWish);
  if(wishScrim){
    document.getElementById('wish-save-btn').addEventListener('click',saveWish);
    document.getElementById('wish-cancel-btn').addEventListener('click',closeWishScrim);
    document.getElementById('wish-trash-btn').addEventListener('click',trashWish);
    document.getElementById('wish-chart-btn').addEventListener('click',chartWish);
    wishScrim.addEventListener('click',function(e){if(e.target===wishScrim)closeWishScrim();});
  }
  function renderResurface(){
    if(!cabResurfEl)return;
    var open=bucket.filter(function(b){return b.status!=='attained'&&b.season&&b.season!=='any'&&b.season===curSeason();});
    if(!open.length){cabResurfEl.style.display='none';return;}
    cabResurfEl.style.display='';
    cabResurfEl.innerHTML='<span class="dot warm"></span> You once wished to <span class="verm">'+esc(open[0].n)+'</span> — its season is open now.';
  }
  // load the wishbook from the vault; the real Bucket wins, even when empty
  window.RM_loadCabinet=function(){
    if(!window.Bridge||!window.Bridge.vault)return;
    window.Bridge.vault.listFiles('Bucket').then(function(files){
      if(!files)return;
      Promise.all(files.map(function(f){
        var rel='Bucket/'+f.name+'.md';
        return window.Bridge.notes.readParsed(rel).then(function(note){return {rel:rel,fm:(note&&note.frontmatter)||{}};}).catch(function(){return null;});
      })).then(function(rows){
        var loaded=[];
        rows.forEach(function(row){
          if(!row)return;var fm=row.fm;
          if((fm.type||'bucket')!=='bucket')return;
          var tags=Array.isArray(fm.tags)?fm.tags.join(' '):'';
          loaded.push({n:fm.title||row.rel.split('/').pop().replace(/\.md$/,''),d:fm.domain||'',cost:fm.cost||'',
            effort:fm.effort||'',season:fm.season||'any',status:fm.status||'open',tags:tags,path:row.rel,
            charted:!!fm.charted});
        });
        bucket=loaded;renderCab();
      });
    }).catch(function(e){console.debug('[load cabinet]',e);});
  };
  $$('.chip').forEach(function(c){c.addEventListener('click',function(){
    $$('.chip').forEach(function(x){x.setAttribute('aria-pressed','false');});c.setAttribute('aria-pressed','true');
    cabFilter=c.getAttribute('data-filter');renderCab();});});
  $('#cabsearch').addEventListener('input',function(e){cabQ=e.target.value.toLowerCase().trim();renderCab();});

  /* ---- today's intentions: populated from real vault by loadIntentions() ---- */

  /* ---- global search → vault-ish (here: just routes to reading for the demo) ---- */
  $('#globalsearch').addEventListener('keydown',function(e){if(e.key==='Enter'){flash('search runs over your real vault in the full build');}});

  /* keys */
  /* ---- text zoom (Ctrl +/- /0, Ctrl+wheel) ----
     native webview zoom (viewport adapts, nothing gets cut off);
     CSS zoom only as a browser-preview fallback, with --rmz compensating the 100vh frame */
  var _zoom=(parseFloat(localStorage.getItem('rm_zoom'))||1);
  function _cssZoom(){
    document.documentElement.style.zoom=(_zoom===1?'':_zoom);
    document.documentElement.style.setProperty('--rmz',_zoom);
  }
  function _applyZoom(){
    try{
      if(window.__TAURI__&&window.__TAURI__.webview){
        window.__TAURI__.webview.getCurrentWebview().setZoom(_zoom).catch(_cssZoom);
        document.documentElement.style.zoom='';
        document.documentElement.style.setProperty('--rmz',1);
        return;
      }
    }catch(e){}
    _cssZoom();
  }
  function _setZoom(z){
    _zoom=Math.min(1.5,Math.max(0.7,Math.round(z*10)/10));
    localStorage.setItem('rm_zoom',_zoom);
    _applyZoom();
    flash('zoom · '+Math.round(_zoom*100)+'%');
  }
  if(_zoom!==1)_applyZoom();
  window.addEventListener('wheel',function(e){
    if(e.ctrlKey){e.preventDefault();_setZoom(_zoom+(e.deltaY<0?0.1:-0.1));}
  },{passive:false});

  document.addEventListener('keydown',function(e){
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='n'){e.preventDefault();openSlip();}
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();go('reading');}
    if(e.key==='Escape'){closeSlip();closeCap();closeForge();}
    if((e.metaKey||e.ctrlKey)&&(e.key==='='||e.key==='+')){e.preventDefault();_setZoom(_zoom+0.1);}
    if((e.metaKey||e.ctrlKey)&&e.key==='-'){e.preventDefault();_setZoom(_zoom-0.1);}
    if((e.metaKey||e.ctrlKey)&&e.key==='0'){e.preventDefault();_setZoom(1);}
  });

  render();renderCab();

  /* ---- Tauri vault overlay wiring ---- */
  var vaultOverlay=$('#vault-overlay');
  var vaultPickBtn=$('#vault-pick-btn');

  function showVaultPicker(){vaultOverlay.style.display='flex';}
  function hideVaultPicker(){vaultOverlay.style.display='none';}

  if(vaultPickBtn){
    vaultPickBtn.addEventListener('click',function(){
      if(window.Bridge){
        window.Bridge.vault.pick().then(function(){hideVaultPicker();}).catch(function(e){flash('could not open vault: '+e);});
      }
    });
  }
})();
