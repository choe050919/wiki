const STORAGE_KEY = "miniWikiDocs";
const HISTORY_KEY = "miniWikiHistory";

// DOM 요소
const editorEl = document.getElementById("editor");
const previewEl = document.getElementById("preview");
const commandEl = document.getElementById("command");
const btnEdit = document.getElementById("btn-edit");
const btnSave = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");

// 상태
let state = {
  current: "Home",
  pages: {}
};

let history = []; // { page, time, content }

let isAllMode = false;
let isEditMode = false;
let isHistoryMode = false;

// 저장/불러오기
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = {
      current: "Home",
      pages: {
        "Home": [
          "# Home",
          "",
          "여기는 **로컬 미니 위키**입니다.",
          "",
          "- 상단 입력창에 문서 이름을 쓰고 Enter → 해당 문서로 이동 (없으면 생성)",
          '- 상단 입력창에 `"All"` 입력 후 Enter → 모든 문서 목록 보기',
          "",
          "예: ",
          "",
          "```md",
          "[Home으로 이동](Home)",
          "[새 문서](MyNote)",
          "[외부 링크](https://example.com)",
          "```"
        ].join("\n")
      }
    };
    saveState();
  } else {
    try {
      state = JSON.parse(raw);
    } catch (e) {
      console.error("저장된 데이터 파싱 실패, 초기화합니다.", e);
      state = {
        current: "Home",
        pages: {
          "Home": "# Home\n\n저장된 데이터를 불러오는 데 실패해서 초기화했습니다."
        }
      };
      saveState();
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw) {
    try {
      history = JSON.parse(raw);
    } catch (e) {
      history = [];
    }
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addHistory(pageName, content) {
  history.push({
    page: pageName,
    time: new Date().toISOString(),
    content: content
  });
  // 최대 100개만 유지
  if (history.length > 100) {
    history = history.slice(-100);
  }
  saveHistory();
}

// 모드 전환
function setEditMode(on) {
  isEditMode = on;
  if (isEditMode) {
    editorEl.value = state.pages[state.current] || "";
    editorEl.classList.remove("hidden");
    previewEl.classList.remove("fullwidth");
    btnEdit.classList.add("hidden");
    btnSave.classList.remove("hidden");
    btnCancel.classList.remove("hidden");
    updatePreview();
  } else {
    editorEl.classList.add("hidden");
    previewEl.classList.add("fullwidth");
    btnEdit.classList.remove("hidden");
    btnSave.classList.add("hidden");
    btnCancel.classList.add("hidden");
    renderPreview();
  }
}

function setAllMode(on) {
  isAllMode = on;
  if (isAllMode) {
    setEditMode(false);
    btnEdit.classList.add("hidden");
    btnHistory.classList.add("hidden");
    renderAllList();
  } else {
    btnEdit.classList.remove("hidden");
    btnHistory.classList.remove("hidden");
    renderCurrentPage();
  }
}

// 렌더링
function renderCurrentPage() {
  setEditMode(false);
}

function renderPreview() {
  const text = state.pages[state.current] || "";
  let html = '<div class="content-wrapper">';
  html += '<h1 class="page-title">' + state.current + '</h1>';
  html += marked.parse(text);
  html += '</div>';
  previewEl.innerHTML = html;
  attachInternalLinkHandlers();
  buildTOC();
}

function renderAllList() {
  const names = Object.keys(state.pages).sort((a, b) => a.localeCompare(b, "ko"));

  let html = '<div class="content-wrapper">';
  html += '<h1 class="page-title">All Documents</h1>';
  if (names.length === 0) {
    html += "<p>아직 문서가 없습니다.</p>";
  } else {
    html += "<ul class='doc-list'>";
    for (const name of names) {
      html += "<li><a href='#' class='doc-link' data-name='" +
        encodeURIComponent(name) +
        "'><span class='doc-name'>" + name + "</span></a></li>";
    }
    html += "</ul>";
  }
  html += "<p style='margin-top:12px; font-size:13px; color:var(--text-muted);'>문서 이름을 클릭하면 해당 문서로 이동합니다.</p>";
  html += '</div>';

  previewEl.innerHTML = html;

  document.querySelectorAll(".doc-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const name = decodeURIComponent(a.getAttribute("data-name"));
      state.current = name;
      setAllMode(false);
      saveState();
    });
  });

  buildTOC();
}

function updatePreview() {
  if (isAllMode || isHistoryMode || !isEditMode) {
    return;
  }
  const text = editorEl.value;
  let html = '<div class="content-wrapper">';
  html += '<h1 class="page-title">' + state.current + '</h1>';
  html += marked.parse(text);
  html += '</div>';
  previewEl.innerHTML = html;
  attachInternalLinkHandlers();
  buildTOC();
}

function renderHistory(pageName) {
  isHistoryMode = true;
  isAllMode = false;
  setEditMode(false);
  btnEdit.classList.add("hidden");
  btnHistory.classList.add("hidden");

  // 해당 페이지 기록만 필터링하되, 원본 인덱스도 함께 저장
  const pageHistory = history
    .map((h, idx) => ({ ...h, originalIdx: idx }))
    .filter(h => h.page === pageName)
    .reverse(); // 최신순

  let html = '<div class="content-wrapper">';
  html += '<h1 class="page-title">History: ' + pageName + '</h1>';
  
  if (pageHistory.length === 0) {
    html += "<p>수정 기록이 없습니다.</p>";
  } else {
    html += "<ul class='doc-list'>";
    pageHistory.forEach((h) => {
      const date = new Date(h.time);
      const timeStr = date.toLocaleString("ko-KR");
      html += "<li><a href='#' class='history-link' data-idx='" + h.originalIdx + "'>" + timeStr + "</a></li>";
    });
    html += "</ul>";
  }
  
  html += "<p style='margin-top:12px; font-size:13px; color:var(--text-muted);'>항목을 클릭하면 해당 버전을 볼 수 있습니다.</p>";
  html += "<p style='font-size:13px; color:var(--text-muted);'><a href='#' id='back-to-page'>← 문서로 돌아가기</a></p>";
  html += '</div>';

  previewEl.innerHTML = html;

  // 히스토리 항목 클릭
  document.querySelectorAll(".history-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const idx = parseInt(a.getAttribute("data-idx"));
      renderHistoryDetail(idx);
    });
  });

  // 돌아가기 링크
  document.getElementById("back-to-page").addEventListener("click", (e) => {
    e.preventDefault();
    isHistoryMode = false;
    state.current = pageName;
    setAllMode(false);
    saveState();
  });

  buildTOC();
}

function renderHistoryDetail(idx) {
  const h = history[idx];
  if (!h) return;

  const timeStr = new Date(h.time).toLocaleString("ko-KR");

  let html = '<div class="content-wrapper">';
  html += '<h1 class="page-title">History: ' + h.page + '</h1>';
  html += '<p class="history-timestamp">' + timeStr + '</p>';
  html += marked.parse(h.content);
  html += "<hr style='border-color:var(--border); margin: 20px 0;'>";
  html += "<p style='font-size:13px; color:var(--text-muted);'>";
  html += "<a href='#' id='restore-version'>이 버전으로 복원</a> | ";
  html += "<a href='#' id='back-to-history'>← 기록 목록으로</a>";
  html += "</p>";
  html += '</div>';

  previewEl.innerHTML = html;

  document.getElementById("restore-version").addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("이 버전으로 복원하시겠습니까?")) {
      state.pages[h.page] = h.content;
      addHistory(h.page, h.content); // 복원도 기록
      saveState();
      isHistoryMode = false;
      state.current = h.page;
      setAllMode(false);
    }
  });

  document.getElementById("back-to-history").addEventListener("click", (e) => {
    e.preventDefault();
    renderHistory(h.page);
  });

  buildTOC();
}

// 우측 사이드바 탭 시스템
let currentRightTab = "toc"; // "toc" | "backlinks"

function buildSidebarRight() {
  const sidebarRight = document.getElementById("sidebar-right");
  if (!sidebarRight) return;

  // 탭 헤더 생성
  let html = '<div class="sidebar-tabs">';
  html += `<button class="sidebar-tab ${currentRightTab === 'toc' ? 'active' : ''}" data-tab="toc">목차</button>`;
  html += `<button class="sidebar-tab ${currentRightTab === 'backlinks' ? 'active' : ''}" data-tab="backlinks">백링크</button>`;
  html += '</div>';

  // 탭 내용
  html += '<div class="sidebar-tab-content">';
  if (currentRightTab === "toc") {
    html += buildTOCContent();
  } else if (currentRightTab === "backlinks") {
    html += buildBacklinksContent();
  }
  html += '</div>';

  sidebarRight.innerHTML = html;

  // 탭 버튼 이벤트
  sidebarRight.querySelectorAll(".sidebar-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      currentRightTab = btn.getAttribute("data-tab");
      buildSidebarRight();
    });
  });
}

function buildTOCContent() {
  // All 모드, History 모드에서는 목차 비우기
  if (isAllMode || isHistoryMode) {
    return '<p class="sidebar-empty">목차 없음</p>';
  }

  // 페이지 제목 요소
  const pageTitle = previewEl.querySelector(".page-title");
  
  // 헤딩 수집 (page-title 제외)
  const headings = previewEl.querySelectorAll("h1:not(.page-title), h2, h3, h4, h5, h6");
  
  let html = '<ul class="toc-list">';
  
  // 제목을 맨 위에 번호 없이 추가
  if (pageTitle) {
    pageTitle.id = "toc-page-title";
    html += `<li class="toc-item toc-title-item">`;
    html += `<a href="#toc-page-title" class="toc-link toc-title-link">`;
    html += `<span class="toc-text">${state.current}</span>`;
    html += `</a></li>`;
  }
  
  if (headings.length === 0) {
    html += '</ul>';
    return html;
  }

  // 헤딩 정보 추출
  const items = [];
  headings.forEach((h, idx) => {
    const level = parseInt(h.tagName.charAt(1));
    const text = h.textContent;
    const id = "toc-heading-" + idx;
    h.id = id;
    items.push({ level, text, id });
  });

  // 최소 레벨 찾기
  const minLevel = Math.min(...items.map(i => i.level));

  // 나무위키 스타일 번호 생성
  const counters = [0, 0, 0, 0, 0, 0];
  const tocItems = items.map(item => {
    const depth = item.level - minLevel;
    counters[depth]++;
    for (let i = depth + 1; i < 6; i++) {
      counters[i] = 0;
    }
    const numberParts = [];
    for (let i = 0; i <= depth; i++) {
      numberParts.push(counters[i]);
    }
    const number = numberParts.join(".");
    return { number, text: item.text, id: item.id, depth };
  });

  tocItems.forEach(item => {
    html += `<li class="toc-item toc-depth-${item.depth}">`;
    html += `<a href="#${item.id}" class="toc-link">`;
    html += `<span class="toc-number">${item.number}.</span> `;
    html += `<span class="toc-text">${item.text}</span>`;
    html += `</a></li>`;
  });
  html += '</ul>';
  
  return html;
}

function buildBacklinksContent() {
  if (isAllMode || isHistoryMode) {
    return '<p class="sidebar-empty">백링크 없음</p>';
  }

  const currentPage = state.current;
  const backlinks = [];

  // 모든 페이지에서 현재 페이지를 링크하는 것 찾기
  for (const [pageName, content] of Object.entries(state.pages)) {
    if (pageName === currentPage) continue;
    
    // 마크다운 링크 패턴: [텍스트](링크)
    // 현재 페이지를 가리키는 링크 찾기
    const linkPattern = new RegExp(`\\[([^\\]]+)\\]\\(${escapeRegExp(currentPage)}\\)`, 'g');
    if (linkPattern.test(content)) {
      backlinks.push(pageName);
    }
  }

  if (backlinks.length === 0) {
    return '<p class="sidebar-empty">이 문서를 링크한 문서가 없습니다</p>';
  }

  let html = '<ul class="backlink-list">';
  backlinks.sort((a, b) => a.localeCompare(b, "ko")).forEach(name => {
    html += `<li class="backlink-item">`;
    html += `<a href="#" class="backlink-link" data-page="${encodeURIComponent(name)}">${name}</a>`;
    html += `</li>`;
  });
  html += '</ul>';

  // 이벤트는 buildSidebarRight에서 처리하기 어려우니 setTimeout으로
  setTimeout(() => {
    document.querySelectorAll(".backlink-link").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const name = decodeURIComponent(a.getAttribute("data-page"));
        state.current = name;
        isHistoryMode = false;
        setAllMode(false);
        saveState();
      });
    });
  }, 0);

  return html;
}

// 정규식 특수문자 이스케이프
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 기존 호환성을 위한 별칭
function buildTOC() {
  buildSidebarRight();
}

// 내부 링크 처리
function attachInternalLinkHandlers() {
  const links = previewEl.querySelectorAll("a");
  links.forEach(link => {
    if (link.classList.contains("doc-link")) return;

    const href = link.getAttribute("href");
    if (!href) return;

    const trimmed = href.trim();

    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("#")
    ) {
      return;
    }

    link.addEventListener("click", (e) => {
      e.preventDefault();
      let name = trimmed || "Home";

      try {
        name = decodeURIComponent(name);
      } catch (err) {}

      if (!state.pages[name]) {
        state.pages[name] = "# " + name + "\n\n새 문서를 작성하세요.";
        saveState();
      }
      state.current = name;
      setAllMode(false);
      saveState();
    });
  });
}

const btnTheme = document.getElementById("btn-theme");
const btnHistory = document.getElementById("btn-history");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const importFileEl = document.getElementById("import-file");

// 내보내기 함수
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

// 가져오기 함수
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
        history = data.history;
      } else {
        history = [];
      }
      
      saveState();
      saveHistory();
      
      // 화면 갱신
      isHistoryMode = false;
      setAllMode(false);
      
      alert("가져오기 완료!");
    } catch (err) {
      alert("파일을 읽는 중 오류가 발생했습니다: " + err.message);
    }
  };
  
  reader.readAsText(file);
}

// 이벤트 리스너
btnEdit.addEventListener("click", () => {
  if (!isAllMode) {
    setEditMode(true);
  }
});

btnSave.addEventListener("click", () => {
  const newContent = editorEl.value;
  addHistory(state.current, newContent);
  state.pages[state.current] = newContent;
  saveState();
  setEditMode(false);
});

btnCancel.addEventListener("click", () => {
  setEditMode(false);
});

btnHistory.addEventListener("click", () => {
  if (!isAllMode && !isHistoryMode) {
    renderHistory(state.current);
  }
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

    if (isEditMode) {
      state.pages[state.current] = editorEl.value;
      saveState();
    }

    // :history 명령어
    if (cmd.toLowerCase().startsWith(":history")) {
      const parts = cmd.split(" ");
      const pageName = parts.slice(1).join(" ") || state.current;
      renderHistory(pageName);
      commandEl.value = "";
      return;
    }

    if (cmd.toLowerCase() === "all") {
      isHistoryMode = false;
      setAllMode(true);
    } else {
      isHistoryMode = false;
      setAllMode(false);
      if (!state.pages[cmd]) {
        state.pages[cmd] = "# " + cmd + "\n\n새 문서를 작성하세요.";
      }
      state.current = cmd;
      saveState();
      renderCurrentPage();
    }

    commandEl.value = "";
  }
});

editorEl.addEventListener("input", updatePreview);

// 초기화
loadState();
loadHistory();
setAllMode(false);

// 저장된 테마 적용
if (localStorage.getItem("wikiTheme") === "light") {
  document.documentElement.classList.add("light");
  btnTheme.textContent = "🌙";
}
