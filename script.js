/* 共通ロジック
 - A/B/C/D ラベル
 - ファイル選択（video/audio）対応
 - 動画はランダム位置(5%~95%)からサムネ生成
 - 再生はランダム順
 - 全再生必須（playedCount）
 - 任意再生（リピート用）画面
 - 回答画面：サムネ付き選択肢、回答後ロック
 - 戻り挙動：解答前は戻れる。戻るとリピート状態（全再生済み扱い）
*/

const LABELS = ["A","B","C","D"];

// ---------- 設定画面用 ----------
function createFileSelectors(){
  const container = document.getElementById("inputs");
  container.innerHTML = "";
  for (let i=0;i<4;i++){
    container.insertAdjacentHTML("beforeend", `
      <div class="video-input" id="inputWrap${i}">
        <h2 style="margin:4px 0 8px 0;">${LABELS[i]}</h2>
        <input type="file" id="file${i}" accept="video/*,audio/*">
        <video id="thumbVid${i}" class="thumbnail" style="display:none;" muted playsinline></video>
        <canvas id="thumbCanvas${i}" class="thumbCanvas" style="display:none;"></canvas>
      </div>
    `);
  }

  for (let i=0;i<4;i++){
    const input = document.getElementById("file"+i);
    input.addEventListener("change", async (e)=>{
      const f = e.target.files[0];
      clearThumb(i);
      if (!f) return;
      const type = f.type || "";
      if (type.startsWith("video/")){
        // show video and capture random frame
        const vid = document.getElementById("thumbVid"+i);
        vid.style.display = "block";
        vid.src = URL.createObjectURL(f);
        vid.load();
        vid.addEventListener("loadedmetadata", async function onmeta(){
          vid.removeEventListener("loadedmetadata", onmeta);
          // wait a short while to ensure ready
          await new Promise(r=>setTimeout(r,120));
          const dur = vid.duration || 1;
          const t = Math.max(0.05, dur * (0.05 + Math.random()*0.90)); // 5%~95%
          // seek and capture
          try {
            await seekVideo(vid, t);
            captureCanvas(i, vid);
          } catch(e){
            // fallback: try at 0.5s
            try{ await seekVideo(vid, Math.min(0.5, dur-0.01)); captureCanvas(i, vid); }catch(e2){}
          }
        });
      } else {
        // audio or unknown: show nothing but mark available
        const canvas = document.getElementById("thumbCanvas"+i);
        canvas.style.display = "none";
        const vid = document.getElementById("thumbVid"+i);
        vid.style.display = "none";
      }
    });
  }
}

function clearThumb(i){
  const vid = document.getElementById("thumbVid"+i);
  const canvas = document.getElementById("thumbCanvas"+i);
  if (vid) { vid.pause(); vid.src = ""; vid.style.display = "none"; }
  if (canvas){ canvas.style.display = "none"; const ctx = canvas.getContext('2d'); ctx && ctx.clearRect(0,0,canvas.width,canvas.height); }
}

function seekVideo(videoEl, time){
  return new Promise((resolve, reject)=>{
    function handler(){
      videoEl.removeEventListener('seeked', handler);
      resolve();
    }
    videoEl.addEventListener('seeked', handler);
    try {
      videoEl.currentTime = Math.min(time, videoEl.duration - 0.01);
    } catch(e){
      videoEl.removeEventListener('seeked', handler);
      reject(e);
    }
    // safety timeout
    setTimeout(()=>{ videoEl.removeEventListener('seeked', handler); resolve(); }, 1500);
  });
}

function captureCanvas(i, videoEl){
  try {
    const canvas = document.getElementById("thumbCanvas"+i);
    const w = Math.min(640, videoEl.videoWidth || 640);
    const h = Math.min(360, videoEl.videoHeight || 360);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, w, h);
    canvas.style.display = "block";
    // hide the video preview to save space (we rely on canvas)
    videoEl.style.display = "none";
  } catch(e){
    // ignore
  }
}

// ---------- クイズ開始 ----------
function startQuiz(){
  // gather files
  const files = [];
  const types = [];
  for (let i=0;i<4;i++){
    const inp = document.getElementById("file"+i);
    if (!inp || !inp.files || !inp.files[0]){
      alert("A〜Dすべてのファイルを選んでください");
      return;
    }
    files.push(inp.files[0]);
    types.push(inp.files[0].type || "");
  }

  // make object URLs for playback (these are local, no network)
  const urls = files.map(f => URL.createObjectURL(f));
  // prepare thumbnails: if canvas exists with data, extract dataURL; otherwise null
  const thumbs = [];
  for (let i=0;i<4;i++){
    const canvas = document.getElementById("thumbCanvas"+i);
    if (canvas && canvas.width>0){
      try {
        thumbs.push(canvas.toDataURL("image/jpeg", 0.8));
      } catch(e){
        thumbs.push(null);
      }
    } else {
      thumbs.push(null);
    }
  }

  const correct = parseInt(document.querySelector('input[name="correct"]:checked').value);

  // store session data
  sessionStorage.setItem("cq_urls", JSON.stringify(urls));
  sessionStorage.setItem("cq_types", JSON.stringify(types));
  sessionStorage.setItem("cq_thumbs", JSON.stringify(thumbs));
  sessionStorage.setItem("cq_correct", correct);

  // shuffle order
  let order = [0,1,2,3];
  order = shuffle(order);
  sessionStorage.setItem("cq_order", JSON.stringify(order));
  sessionStorage.setItem("cq_nowIndex", "0");
  sessionStorage.setItem("cq_playedFlags", JSON.stringify([0,0,0,0])); // 0/1 flags for original indices
  sessionStorage.setItem("cq_answered", "false");

  location.href = "quiz.html";
}

function shuffle(arr){
  for (let i = arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- quiz.html ロジック ----------
function initQuiz(){
  // load session
  const urls = JSON.parse(sessionStorage.getItem("cq_urls") || "[]");
  if (!urls || urls.length!==4){
    alert("設定が見つかりません。最初からやり直してください。");
    location.href = "index.html";
    return;
  }
  const types = JSON.parse(sessionStorage.getItem("cq_types") || "[]");
  const thumbs = JSON.parse(sessionStorage.getItem("cq_thumbs") || "[]");
  let order = JSON.parse(sessionStorage.getItem("cq_order") || "[]");
  let nowIndex = parseInt(sessionStorage.getItem("cq_nowIndex") || "0");
  let playedFlags = JSON.parse(sessionStorage.getItem("cq_playedFlags") || "[0,0,0,0]");
  const answered = sessionStorage.getItem("cq_answered") === "true";

  // prepare UI
  const playerWrap = document.getElementById("playerWrap");
  playerWrap.innerHTML = "";
  // create both elements but show one depending on type
  const videoEl = document.createElement("video");
  videoEl.id = "mainVideo";
  videoEl.controls = true;
  videoEl.playsInline = true;
  videoEl.className = "thumbnail";

  const audioEl = document.createElement("audio");
  audioEl.id = "mainAudio";
  audioEl.controls = true;
  audioEl.className = "thumbnail";

  playerWrap.appendChild(videoEl);
  playerWrap.appendChild(audioEl);

  const status = document.getElementById("status");
  const nextBtn = document.getElementById("nextBtn");
  const reviewArea = document.getElementById("review-area");
  const reviewButtons = document.getElementById("review-buttons");
  const toAnswerBtn = document.getElementById("toAnswerBtn");

  // set initial player to current item if exists
  function setPlayerTo(idxInOrder){
    const origIdx = order[idxInOrder];
    const url = urls[origIdx];
    const type = types[origIdx] || "";
    // hide both then show relevant
    videoEl.style.display = "none";
    audioEl.style.display = "none";
    if (type.startsWith("video/")){
      videoEl.src = url;
      videoEl.style.display = "block";
      // autoplay try
      videoEl.currentTime = 0;
      videoEl.play().catch(()=>{});
    } else {
      audioEl.src = url;
      audioEl.style.display = "block";
      audioEl.play().catch(()=>{});
    }
    status.textContent = `再生中：${LABELS[origIdx]} （${idxInOrder+1}/4）`;
    // mark played for this orig index when playback ends
    const onEnded = ()=>{
      playedFlags[origIdx] = 1;
      sessionStorage.setItem("cq_playedFlags", JSON.stringify(playedFlags));
      // update status
      const cnt = playedFlags.reduce((a,b)=>a+b,0);
      status.textContent = `再生済み：${cnt}/4`;
      // if reached end of sequence and idx was last, show review area
      if (idxInOrder >= 3){
        // show review area
        showReview();
      }
      // cleanup
      videoEl.removeEventListener("ended", onEnded);
      audioEl.removeEventListener("ended", onEnded);
    };
    videoEl.addEventListener("ended", onEnded);
    audioEl.addEventListener("ended", onEnded);
  }

  // show review area (任意再生). Called when all 4 played in sequence OR when user returns from answer
  function showReview(){
    reviewArea.style.display = "block";
    reviewButtons.innerHTML = "";
    // build buttons that show labels + thumb (if any)
    const thumbsArr = JSON.parse(sessionStorage.getItem("cq_thumbs") || "[]");
    for (let i=0;i<4;i++){
      const origIdx = i;
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.gap = "10px";
      btn.style.justifyContent = "flex-start";
      // left: label box
      const labelBox = document.createElement("div");
      labelBox.className = "choice-label";
      labelBox.textContent = LABELS[origIdx];
      // right: thumb or text
      const thumbImg = document.createElement("img");
      thumbImg.className = "choice-thumb";
      thumbImg.alt = LABELS[origIdx];
      if (thumbsArr[origIdx]){
        thumbImg.src = thumbsArr[origIdx];
      } else {
        // no thumb: show placeholder canvas or dark box
        thumbImg.src = "";
        thumbImg.style.background = "#040407";
      }
      btn.appendChild(labelBox);
      btn.appendChild(thumbImg);
      btn.onclick = ()=> {
        // play original file (origIdx)
        playOriginalIndex(origIdx);
      };
      reviewButtons.appendChild(btn);
    }
    // enable answer only if all played
    const flags = JSON.parse(sessionStorage.getItem("cq_playedFlags") || "[0,0,0,0]");
    const playedCount = flags.reduce((a,b)=>a+b,0);
    if (playedCount >= 4){
      toAnswerBtn.disabled = false;
    } else {
      toAnswerBtn.disabled = true;
    }
  }

  // play original item by original index (not order)
  function playOriginalIndex(origIdx){
    const url = urls[origIdx];
    const type = types[origIdx] || "";
    videoEl.style.display = "none";
    audioEl.style.display = "none";
    if (type.startsWith("video/")){
      videoEl.src = url;
      videoEl.style.display = "block";
      videoEl.currentTime = 0;
      videoEl.play().catch(()=>{});
    } else {
      audioEl.src = url;
      audioEl.style.display = "block";
      audioEl.currentTime = 0;
      audioEl.play().catch(()=>{});
    }
    status.textContent = `再生中：${LABELS[origIdx]}（任意再生）`;
  }

  // initial set to order[nowIndex]
  const currentIdx = parseInt(sessionStorage.getItem("cq_nowIndex") || "0");
  if (currentIdx < 4){
    nowIndex = currentIdx;
    setPlayerTo(nowIndex);
  } else {
    // already finished sequence: show review
    showReview();
    status.textContent = `すべて再生済み。任意で再生できます。`;
    document.getElementById("nextBtn").style.display = "none";
  }

  // implement nextVideo
  window.nextVideo = function(){
    // if currently playing last, move to next and if beyond end, reveal review area
    nowIndex++;
    sessionStorage.setItem("cq_nowIndex", nowIndex.toString());
    if (nowIndex < 4){
      setPlayerTo(nowIndex);
      // adjust next button enabled
      document.getElementById("nextBtn").disabled = false;
    } else {
      // reached beyond last: hide next and show review
      document.getElementById("nextBtn").style.display = "none";
      showReview();
      status.textContent = "すべて再生しました。任意再生できます。";
    }
  };

  // 'goAnswer' called when proceed to answer
  window.goAnswer = function(){
    // ensure all played
    const flags2 = JSON.parse(sessionStorage.getItem("cq_playedFlags") || "[0,0,0,0]");
    if (flags2.reduce((a,b)=>a+b,0) < 4){
      alert("まずは全て再生してください（1回ずつ）");
      return;
    }
    location.href = "answer.html";
  };

  // If user arrived here from answer.html (i.e., returned), we want to be in 'review' state (任意再生).
  // We detect via a flag 'fromAnswer' set when navigating back.
  const fromAnswer = sessionStorage.getItem("cq_fromAnswer") === "true";
  if (fromAnswer){
    // clear flag
    sessionStorage.setItem("cq_fromAnswer", "false");
    // ensure review is shown
    document.getElementById("nextBtn").style.display = "none";
    showReview();
    status.textContent = "（解答画面から戻りました）任意で再生できます。";
  }
}

// ---------- answer.html ロジック ----------
function initAnswer(){
  const urls = JSON.parse(sessionStorage.getItem("cq_urls") || "[]");
  if (!urls || urls.length !==4 ){
    alert("設定が見つかりません。最初からやり直してください。");
    location.href = "index.html";
    return;
  }
  const thumbs = JSON.parse(sessionStorage.getItem("cq_thumbs") || "[]");
  const types = JSON.parse(sessionStorage.getItem("cq_types") || "[]");
  const correct = parseInt(sessionStorage.getItem("cq_correct") || "0");
  const answered = sessionStorage.getItem("cq_answered") === "true";

  const choicesWrap = document.getElementById("choices");
  choicesWrap.innerHTML = "";

  for (let i=0;i<4;i++){
    const item = document.createElement("div");
    item.className = "choice-item";
    // label
    const labelBox = document.createElement("div");
    labelBox.className = "choice-label";
    labelBox.textContent = LABELS[i];
    item.appendChild(labelBox);
    // thumb or placeholder
    if (thumbs[i]){
      const img = document.createElement("img");
      img.className = "choice-thumb";
      img.src = thumbs[i];
      item.appendChild(img);
    } else {
      // no thumb: show text telling it's audio
      const t = document.createElement("div");
      t.style.color = "var(--glow)";
      t.style.opacity = "0.9";
      t.textContent = types[i] && types[i].startsWith("audio/") ? "音声ファイル" : "（プレビューなし）";
      item.appendChild(t);
    }

    // make clickable behavior with button-like overlay
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.marginTop = "8px";
    btn.textContent = "選択する";
    btn.onclick = (e)=>{
      // if already answered, ignore
      if (sessionStorage.getItem("cq_answered") === "true") return;
      // disable all choices now
      lockChoices(i, correct);
    };

    // container: left (label+thumb) + right (button)
    const outer = document.createElement("div");
    outer.style.display = "flex";
    outer.style.justifyContent = "space-between";
    outer.style.alignItems = "center";
    outer.appendChild(item);
    const rightWrap = document.createElement("div");
    rightWrap.style.minWidth = "140px";
    rightWrap.appendChild(btn);
    outer.appendChild(rightWrap);

    choicesWrap.appendChild(outer);
  }

  // Back button visibility: only enabled if not answered
  const backBtn = document.getElementById("backBtn");
  if (answered){
    backBtn.disabled = true;
    backBtn.style.opacity = 0.5;
  } else {
    backBtn.disabled = false;
    backBtn.style.opacity = 1;
  }
}

function lockChoices(chosenIndex, correctIndex){
  // mark answered
  sessionStorage.setItem("cq_answered", "true");
  // disable back ability
  // find all buttons and disable
  const allButtons = document.querySelectorAll("#choices button");
  allButtons.forEach(b=>{ b.disabled = true; b.style.opacity = 0.5; });

  // color the chosen and correct
  const choicesWrap = document.getElementById("choices");
  // choicesWrap contains multiple 'outer' elements. We can iterate children.
  const outerChildren = Array.from(choicesWrap.children);
  outerChildren.forEach((outer, idx)=>{
    // find the button inside
    const btn = outer.querySelector("button");
    if (!btn) return;
    if (idx === chosenIndex){
      if (chosenIndex === correctIndex){
        // correct
        btn.classList.add("correct");
        document.getElementById("result").textContent = "正解！🎉";
      } else {
        btn.classList.add("wrong");
        document.getElementById("result").textContent = `不正解…（正解は ${LABELS[correctIndex]}）`;
      }
    } else {
      // dim others
      btn.style.opacity = 0.4;
    }
  });

  // also disable back
  const backBtn = document.getElementById("backBtn");
  backBtn.disabled = true;
  backBtn.style.opacity = 0.5;

  // final: keep session flag so returning to quiz won't allow going back
  sessionStorage.setItem("cq_answered", "true");
}

// back to quiz (only allowed if not answered)
function backToQuiz(){
  const answered = sessionStorage.getItem("cq_answered") === "true";
  if (answered){
    // guard
    return;
  }
  // set a flag so quiz page knows we're returning from answer and should be in review state
  sessionStorage.setItem("cq_fromAnswer", "true");
  // go back to quiz
  location.href = "quiz.html";
}

function restart(){
  // clear session and go to index
  sessionStorage.removeItem("cq_urls");
  sessionStorage.removeItem("cq_types");
  sessionStorage.removeItem("cq_thumbs");
  sessionStorage.removeItem("cq_correct");
  sessionStorage.removeItem("cq_order");
  sessionStorage.removeItem("cq_nowIndex");
  sessionStorage.removeItem("cq_playedFlags");
  sessionStorage.removeItem("cq_answered");
  sessionStorage.removeItem("cq_fromAnswer");
  location.href = "index.html";
}
