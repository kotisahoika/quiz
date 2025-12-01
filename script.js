// A B C D のラベル
const LABELS = ["A", "B", "C", "D"];

// =====================================================================
// 1. 設定画面：動画セレクター生成 + サムネ表示
// =====================================================================
function createFileSelectors() {
  const container = document.getElementById("inputs");
  container.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const label = LABELS[i];

    container.innerHTML += `
      <h2>${label}</h2>
      <input type="file" id="file${i}" accept="video/*"><br>
      <video id="thumb${i}" class="thumbnail" controls style="display:none"></video>
    `;
  }

  // サムネ更新
  for (let i = 0; i < 4; i++) {
    document.getElementById("file"+i).addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const v = document.getElementById("thumb"+i);
      v.src = url;
      v.style.display = "block";
    });
  }
}

// =====================================================================
// 2. クイズ開始
// =====================================================================
function startQuiz() {
  const files = [];
  for (let i = 0; i < 4; i++) {
    const f = document.getElementById("file"+i).files[0];
    if (!f) {
      alert("A〜Dすべての動画を選んでください");
      return;
    }
    files.push(f);
  }

  const urls = files.map(f => URL.createObjectURL(f));
  const correct = parseInt(document.querySelector('input[name="correct"]:checked').value);

  sessionStorage.setItem("urls", JSON.stringify(urls));
  sessionStorage.setItem("correct", correct);

  location.href = "quiz.html";
}

// =====================================================================
// 3. クイズ画面
// =====================================================================
let playOrder = [];
let nowIndex = 0;
let videoUrls = [];

function initQuiz() {
  videoUrls = JSON.parse(sessionStorage.getItem("urls"));
  playOrder = shuffle([...Array(4).keys()]);
  nowIndex = 0;

  setupReplayButtons();
  playCurrent();
}

function playCurrent() {
  const player = document.getElementById("player");
  player.src = videoUrls[playOrder[nowIndex]];
}

function nextVideo() {
  if (nowIndex < 3) {
    nowIndex++;
    playCurrent();
  } else {
    alert("すべて再生しました！");
  }
}

// リピートボタン
function setupReplayButtons() {
  const wrap = document.getElementById("replayButtons");
  wrap.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const label = LABELS[i];
    wrap.innerHTML += `
      <button class="choice-btn" onclick="replay(${i})">${label} をもう一度</button>
    `;
  }
}

function replay(i) {
  document.getElementById("player").src = videoUrls[i];
}

function goAnswer() {
  location.href = "answer.html";
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =====================================================================
// 4. 回答画面
// =====================================================================
function initAnswer() {
  const wrap = document.getElementById("choices");
  wrap.innerHTML = "";
  const correct = parseInt(sessionStorage.getItem("correct"));

  for (let i = 0; i < 4; i++) {
    wrap.innerHTML += `
      <button class="choice-btn" onclick="checkAnswer(${i})">${LABELS[i]}</button>
    `;
  }
}

function checkAnswer(i) {
  const correct = parseInt(sessionStorage.getItem("correct"));
  const result = document.getElementById("result");

  if (i === correct) {
    result.innerHTML = "⭕ 正解！";
    result.style.color = "#00ff9f";
  } else {
    result.innerHTML = "❌ 不正解…（正解は " + LABELS[correct] + " ）";
    result.style.color = "#ff0059";
  }
}
