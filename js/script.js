import {
  state,
  history,
  loadState,
  saveState,
  loadHistory,
  loadVisited,
  loadPinned,
  loadLinkIndex,
  addHistory,
  updateLinkIndex,
  rebuildLinkIndex
} from './state.js';

import {
  setMode,
  updatePreview
} from './render.js';

// ========== DOM 요소 ==========
const editorEl = document.getElementById("editor");
const commandEl = document.getElementById("command");
const btnSave = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");
const btnTheme = document.getElementById("btn-theme");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const importFileEl = document.getElementById("import-file");

// ========== 내보내기/가져오기 ==========
function exportData() {
  const data = {
    pages: state.pages,
    history: history,
    exportedAt: new Date().toISOString()
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "mini-wiki-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      if (!data.pages || typeof data.pages !== "object") {
        alert("올바른 백업 파일이 아닙니다.");
        return;
      }
      
      if (!confirm("기존 데이터를 모두 덮어씁니다. 계속하시겠습니까?")) {
        return;
      }
      
      // 데이터 교체
      state.pages = data.pages;
      state.current = Object.keys(data.pages)[0] || "Home";
      
      if (Array.isArray(data.history)) {
        // history 배열 직접 수정
        history.length = 0;
        data.history.forEach(h => history.push(h));
      } else {
        history.length = 0;
      }
      
      saveState();
      // saveHistory는 state.js에서 export 안 했으므로 직접 저장
      localStorage.setItem("miniWikiHistory", JSON.stringify(history));
      rebuildLinkIndex();
      
      // 화면 갱신
      setMode("view");
      
      alert("가져오기 완료!");
    } catch (err) {
      alert("파일을 읽는 중 오류가 발생했습니다: " + err.message);
    }
  };
  
  reader.readAsText(file);
}

// ========== 이벤트 리스너 ==========
btnSave.addEventListener("click", () => {
  const newContent = editorEl.value;
  addHistory(state.current, newContent);
  state.pages[state.current] = newContent;
  saveState();
  updateLinkIndex(state.current);
  setMode("view");
});

btnCancel.addEventListener("click", () => {
  setMode("view");
});

btnTheme.addEventListener("click", () => {
  const isLight = document.documentElement.classList.toggle("light");
  btnTheme.textContent = isLight ? "🌙" : "☀️";
  localStorage.setItem("wikiTheme", isLight ? "light" : "dark");
});

btnExport.addEventListener("click", exportData);

btnImport.addEventListener("click", () => {
  importFileEl.click();
});

importFileEl.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    importData(file);
    importFileEl.value = ""; // 같은 파일 다시 선택 가능하도록
  }
});

commandEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const cmd = commandEl.value.trim();
    if (!cmd) return;

    if (state.mode === "edit") {
      state.pages[state.current] = editorEl.value;
      saveState();
    }

    // :history 명령어
    if (cmd.toLowerCase().startsWith(":history")) {
      const parts = cmd.split(" ");
      const pageName = parts.slice(1).join(" ") || state.current;
      setMode("history", { historyPage: pageName });
      commandEl.value = "";
      return;
    }

    if (cmd.toLowerCase() === "all") {
      setMode("list");
    } else {
      if (!state.pages[cmd]) {
        state.pages[cmd] = "# " + cmd + "\n\n새 문서를 작성하세요.";
        updateLinkIndex(cmd);
      }
      state.current = cmd;
      saveState();
      setMode("view");
    }

    commandEl.value = "";
  }
});

editorEl.addEventListener("input", updatePreview);

// 단축키
document.addEventListener("keydown", (e) => {
  // Ctrl+E: 편집 모드 진입
  if (e.ctrlKey && e.key === "e") {
    e.preventDefault();
    if (state.mode === "view") {
      setMode("edit");
    }
  }
  
  // Ctrl+S: 저장
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    if (state.mode === "edit") {
      const newContent = editorEl.value;
      addHistory(state.current, newContent);
      state.pages[state.current] = newContent;
      saveState();
      updateLinkIndex(state.current);
      setMode("view");
    }
  }
  
  // Esc: 편집 취소 / 모드 나가기
  if (e.key === "Escape") {
    switch (state.mode) {
      case "edit":
        setMode("view");
        break;
      case "history":
      case "historyDetail":
        setMode("view");
        break;
      case "list":
        setMode("view");
        break;
    }
  }
  
  // Ctrl+H: 히스토리 보기
  if (e.ctrlKey && e.key === "h") {
    e.preventDefault();
    if (state.mode === "view") {
      setMode("history", { historyPage: state.current });
    }
  }
});

// ========== 초기화 ==========
loadState();
loadHistory();
loadVisited();
loadPinned();
loadLinkIndex();
setMode("view");

// 저장된 테마 적용
if (localStorage.getItem("wikiTheme") === "light") {
  document.documentElement.classList.add("light");
  btnTheme.textContent = "🌙";
}