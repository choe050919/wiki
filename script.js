// ========== 상수 ==========
const STORAGE_KEY = "miniWikiDocs";
const HISTORY_KEY = "miniWikiHistory";
const VISITED_KEY = "miniWikiVisited";
const PINNED_KEY = "miniWikiPinned";
const LINKS_KEY = "miniWikiLinks";

// ========== 앱 상태 (데이터) ==========
let state = {
  current: "Home",
  pages: {},
  mode: "view", // "view" | "edit" | "list" | "history" | "historyDetail"
  historyPage: null,
  historyIdx: null
};
let history = [];      // { page, time, content }
let pinned = [];       // 고정된 문서 목록
let visitedTime = {};  // { pageName: timestamp }
let linkIndex = {};    // { pageName: [linkedPage1, linkedPage2, ...] }

// ========== UI 상태 ==========
let currentLeftTab = "all";    // "all" | "pinned"
let currentRightTab = "toc";   // "toc" | "backlinks"
let pagesSortMode = "alpha";   // "alpha" | "recent"
let draggedItem = null;        // 드래그 중인 요소

// ========== DOM 요소 ==========
const editorEl = document.getElementById("editor");
const previewEl = document.getElementById("preview");
const commandEl = document.getElementById("command");
const btnSave = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");
const btnTheme = document.getElementById("btn-theme");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const importFileEl = document.getElementById("import-file");

// ========== 마크다운 전처리 ==========
function preprocessWikiLinks(text) {
  // [[문서|표시텍스트]] 형태
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, page, label) => {
    return `[${label}](<${encodeURIComponent(page)}>)`;
  });
  // [[문서]] 형태
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, page) => {
    return `[${page}](<${encodeURIComponent(page)}>)`;
  });
  return text;
}

// ========== 링크 인덱스 ==========
function parseLinks(text) {
  const links = new Set();
  
  // 위키링크: [[문서]] 또는 [[문서|표시텍스트]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = wikiLinkRegex.exec(text)) !== null) {
    links.add(match[1]);
  }
  
  // 마크다운 링크: [텍스트](링크) - 외부 링크 제외
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = mdLinkRegex.exec(text)) !== null) {
    const href = match[2].trim();
    // 외부 링크, mailto, 앵커 제외
    if (!href.startsWith('http://') && 
        !href.startsWith('https://') && 
        !href.startsWith('mailto:') && 
        !href.startsWith('#')) {
      // <문서명> 형태에서 꺾쇠 제거
      let pageName = href.replace(/^<|>$/g, '');
      try {
        pageName = decodeURIComponent(pageName);
      } catch (e) {}
      links.add(pageName);
    }
  }
  
  return Array.from(links);
}

function loadLinkIndex() {
  const raw = localStorage.getItem(LINKS_KEY);
  if (raw) {
    try {
      linkIndex = JSON.parse(raw);
    } catch (e) {
      linkIndex = {};
      rebuildLinkIndex();
    }
  } else {
    // 인덱스 없으면 전체 문서에서 빌드
    rebuildLinkIndex();
  }
}

function saveLinkIndex() {
  localStorage.setItem(LINKS_KEY, JSON.stringify(linkIndex));
}

function updateLinkIndex(pageName) {
  const content = state.pages[pageName] || "";
  linkIndex[pageName] = parseLinks(content);
  saveLinkIndex();
}

function getBacklinks(pageName) {
  const backlinks = [];
  for (const [page, links] of Object.entries(linkIndex)) {
    if (page !== pageName && links.includes(pageName)) {
      backlinks.push(page);
    }
  }
  return backlinks.sort((a, b) => a.localeCompare(b, "ko"));
}

function rebuildLinkIndex() {
  linkIndex = {};
  for (const pageName of Object.keys(state.pages)) {
    linkIndex[pageName] = parseLinks(state.pages[pageName]);
  }
  saveLinkIndex();
}


// ========== 저장/불러오기 ==========
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = {
      current: "Home",
      pages: {
        "Home": [
          "# Home",
          "",
          "개인용 로컬 위키에 오신 걸 환영합니다.",
          "",
          "## 시작하기",
          "",
          "문서를 만들어 보세요: [[첫 번째 메모]], [[아이디어 노트]]",
          "",
          "상단 입력창에 문서 이름을 입력하고 Enter를 누르면 해당 문서로 이동하거나 새로 생성됩니다. `All`을 입력하면 전체 문서 목록을 볼 수 있어요.",
          "",
          "## 단축키",
          "",
          "- **Ctrl + E**: 편집 모드",
          "- **Ctrl + S**: 저장",
          "- **Esc**: 취소",
          "",
          "## 참고",
          "",
          "모든 데이터는 이 브라우저에만 저장됩니다. 상단의 **내보내기** 버튼으로 주기적으로 백업하세요."
        ].join("\n")
      },
      mode: "view",
      historyPage: null,
      historyIdx: null
    };
    saveState();
  } else {
    try {
      state = JSON.parse(raw);
      // mode가 없으면 추가 (기존 데이터 호환)
      if (!state.mode) {
        state.mode = "view";
        state.historyPage = null;
        state.historyIdx = null;
      }
    } catch (e) {
      console.error("저장된 데이터 파싱 실패, 초기화합니다.", e);
      state = {
        current: "Home",
        pages: {
          "Home": "# Home\n\n저장된 데이터를 불러오는 데 실패해서 초기화했습니다."
        },
        mode: "view",
        historyPage: null,
        historyIdx: null
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
function setMode(mode, options = {}) {
  state.mode = mode;
  
  // 옵션 처리
  if (options.historyPage !== undefined) state.historyPage = options.historyPage;
  if (options.historyIdx !== undefined) state.historyIdx = options.historyIdx;
  
  // UI 업데이트
  switch (mode) {
    case "edit":
      editorEl.value = state.pages[state.current] || "";
      editorEl.classList.remove("hidden");
      previewEl.classList.remove("fullwidth");
      btnSave.classList.remove("hidden");
      btnCancel.classList.remove("hidden");
      updatePreview();
      break;
      
    case "view":
      editorEl.classList.add("hidden");
      previewEl.classList.add("fullwidth");
      btnSave.classList.add("hidden");
      btnCancel.classList.add("hidden");
      renderPreview();
      break;
      
    case "list":
      editorEl.classList.add("hidden");
      previewEl.classList.add("fullwidth");
      btnSave.classList.add("hidden");
      btnCancel.classList.add("hidden");
      renderAllList();
      break;
      
    case "history":
      editorEl.classList.add("hidden");
      previewEl.classList.add("fullwidth");
      btnSave.classList.add("hidden");
      btnCancel.classList.add("hidden");
      renderHistory(state.historyPage || state.current);
      break;
      
    case "historyDetail":
      editorEl.classList.add("hidden");
      previewEl.classList.add("fullwidth");
      btnSave.classList.add("hidden");
      btnCancel.classList.add("hidden");
      renderHistoryDetail(state.historyIdx);
      break;
  }
  
  buildTOC();
}

function renderPreview() {
  const text = state.pages[state.current] || "";
  const isPinned = pinned.includes(state.current);
  
  let html = '<div class="content-wrapper">';
  html += '<div class="page-title-row">';
  html += '<h1 class="page-title">' + state.current + '</h1>';
  html += '<div class="title-actions">';
  html += `<button class="title-btn" id="title-btn-edit" title="편집">편집</button>`;
  html += `<button class="title-btn" id="title-btn-history" title="역사">역사</button>`;
  html += `<button class="title-pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? '고정 해제' : '고정'}">📌</button>`;
  html += '</div>';
  html += '</div>';
  html += marked.parse(preprocessWikiLinks(text));
  html += '</div>';
  previewEl.innerHTML = html;
  attachInternalLinkHandlers();
  attachTitleButtonHandlers();
  addVisited(state.current);
}

function attachTitleButtonHandlers() {
  const pinBtn = previewEl.querySelector(".title-pin-btn");
  const editBtn = previewEl.querySelector("#title-btn-edit");
  const historyBtn = previewEl.querySelector("#title-btn-history");
  
  if (pinBtn) {
    pinBtn.addEventListener("click", () => {
      togglePin(state.current);
      const isPinned = pinned.includes(state.current);
      pinBtn.classList.toggle("pinned", isPinned);
      pinBtn.title = isPinned ? "고정 해제" : "고정";
    });
  }
  
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      setMode("edit");
    });
  }
  
  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      setMode("history", { historyPage: state.current });
    });
  }
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
      saveState();
      setMode("view");
    });
  });
}

function updatePreview() {
  if (state.mode !== "edit") {
    return;
  }
  const text = editorEl.value;
  let html = '<div class="content-wrapper">';
  html += '<h1 class="page-title">' + state.current + '</h1>';
  html += marked.parse(preprocessWikiLinks(text));
  html += '</div>';
  previewEl.innerHTML = html;
  attachInternalLinkHandlers();
}

function renderHistory(pageName) {
  // 해당 페이지 기록만 필터링하되, 원본 인덱스도 함께 저장
  const pageHistory = history
    .map((h, idx) => ({ ...h, originalIdx: idx }))
    .filter(h => h.page === pageName)
    .reverse(); // 최신순

  let html = '<div class="content-wrapper">';
  html += '<div class="page-title-row">';
  html += '<h1 class="page-title">역사: ' + pageName + '</h1>';
  html += '<div class="title-actions">';
  html += '<button class="title-btn" id="back-to-page">← 문서로</button>';
  html += '</div>';
  html += '</div>';
  
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
  html += '</div>';

  previewEl.innerHTML = html;

  // 히스토리 항목 클릭
  document.querySelectorAll(".history-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const idx = parseInt(a.getAttribute("data-idx"));
      setMode("historyDetail", { historyIdx: idx });
    });
  });

  // 돌아가기 버튼
  document.getElementById("back-to-page").addEventListener("click", (e) => {
    e.preventDefault();
    state.current = pageName;
    saveState();
    setMode("view");
  });
}

function renderHistoryDetail(idx) {
  const h = history[idx];
  if (!h) return;

  const timeStr = new Date(h.time).toLocaleString("ko-KR");

  let html = '<div class="content-wrapper">';
  html += '<div class="page-title-row">';
  html += '<h1 class="page-title">역사: ' + h.page + '</h1>';
  html += '<div class="title-actions">';
  html += '<button class="title-btn" id="restore-version">이 버전으로 복원</button>';
  html += '<button class="title-btn" id="back-to-history">← 목록으로</button>';
  html += '</div>';
  html += '</div>';
  html += '<p class="history-timestamp">' + timeStr + '</p>';
  html += marked.parse(preprocessWikiLinks(h.content));
  html += '</div>';

  previewEl.innerHTML = html;

  document.getElementById("restore-version").addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("이 버전으로 복원하시겠습니까?")) {
      state.pages[h.page] = h.content;
      addHistory(h.page, h.content); // 복원도 기록
      state.current = h.page;
      saveState();
      setMode("view");
    }
  });

  document.getElementById("back-to-history").addEventListener("click", (e) => {
    e.preventDefault();
    setMode("history", { historyPage: h.page });
  });
}

// ========== 우측 사이드바 ==========

function loadVisited() {
  const raw = localStorage.getItem(VISITED_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // 마이그레이션: 배열이면 객체로 변환
      if (Array.isArray(parsed)) {
        visitedTime = {};
        parsed.forEach((name, idx) => {
          visitedTime[name] = Date.now() - idx * 1000;
        });
        saveVisited();
      } else {
        visitedTime = parsed;
      }
    } catch (e) {
      visitedTime = {};
    }
  }
}

function saveVisited() {
  localStorage.setItem(VISITED_KEY, JSON.stringify(visitedTime));
}

function addVisited(pageName) {
  visitedTime[pageName] = Date.now();
  saveVisited();
}

function loadPinned() {
  const raw = localStorage.getItem(PINNED_KEY);
  if (raw) {
    try {
      pinned = JSON.parse(raw);
    } catch (e) {
      pinned = [];
    }
  }
}

function savePinned() {
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
}

function togglePin(pageName) {
  const idx = pinned.indexOf(pageName);
  if (idx === -1) {
    pinned.push(pageName);
  } else {
    pinned.splice(idx, 1);
  }
  savePinned();
  buildSidebarLeft();
}

function buildSidebarLeft() {
  const sidebarLeft = document.getElementById("sidebar-left");
  if (!sidebarLeft) return;

  // 유효한 고정 문서 수 (삭제된 문서 제외)
  const validPinnedCount = pinned.filter(name => state.pages[name]).length;

  // 탭 헤더
  let html = '<div class="sidebar-tabs">';
  html += `<button class="sidebar-tab ${currentLeftTab === 'all' ? 'active' : ''}" data-tab="all">전체</button>`;
  html += `<button class="sidebar-tab ${currentLeftTab === 'pinned' ? 'active' : ''}" data-tab="pinned">고정${validPinnedCount > 0 ? ' ' + validPinnedCount : ''}</button>`;
  html += '</div>';

  // 탭 내용
  html += '<div class="sidebar-tab-content">';
  if (currentLeftTab === "all") {
    html += buildAllPagesContent();
  } else if (currentLeftTab === "pinned") {
    html += buildPinnedContent();
  }
  html += '</div>';

  sidebarLeft.innerHTML = html;

  // 탭 버튼 이벤트
  sidebarLeft.querySelectorAll(".sidebar-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      currentLeftTab = btn.getAttribute("data-tab");
      buildSidebarLeft();
    });
  });
}

function buildAllPagesContent() {
  let names = Object.keys(state.pages);
  
  if (pagesSortMode === "alpha") {
    names.sort((a, b) => a.localeCompare(b, "ko"));
  } else if (pagesSortMode === "recent") {
    names.sort((a, b) => {
      const timeA = visitedTime[a] || 0;
      const timeB = visitedTime[b] || 0;
      return timeB - timeA;
    });
  }
  
  // 정렬 토글
  let html = '<div class="sort-toggle-row">';
  html += `<button class="sort-btn ${pagesSortMode === 'alpha' ? 'active' : ''}" data-sort="alpha">가나다</button>`;
  html += `<button class="sort-btn ${pagesSortMode === 'recent' ? 'active' : ''}" data-sort="recent">최근</button>`;
  html += '</div>';
  
  html += '<div class="pages-filter">';
  html += '<input type="text" id="pages-filter-input" placeholder="문서 필터..." />';
  html += '</div>';
  
  html += '<ul class="pages-list">';
  for (const name of names) {
    const isActive = name === state.current && state.mode === "view";
    html += `<li class="pages-item ${isActive ? 'active' : ''}" data-name="${encodeURIComponent(name)}">`;
    html += `<a href="#" class="pages-link">${name}</a>`;
    html += '</li>';
  }
  html += '</ul>';
  
  setTimeout(() => {
    // 정렬 버튼 이벤트
    document.querySelectorAll(".sort-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        pagesSortMode = btn.getAttribute("data-sort");
        buildSidebarLeft();
      });
    });
    
    const filterInput = document.getElementById("pages-filter-input");
    const items = document.querySelectorAll(".pages-item");
    
    if (filterInput) {
      filterInput.addEventListener("input", () => {
        const query = filterInput.value.toLowerCase().trim();
        items.forEach(item => {
          const name = decodeURIComponent(item.getAttribute("data-name")).toLowerCase();
          item.style.display = name.includes(query) ? "" : "none";
        });
      });
    }
    
    items.forEach(item => {
      item.querySelector(".pages-link").addEventListener("click", (e) => {
        e.preventDefault();
        const name = decodeURIComponent(item.getAttribute("data-name"));
        state.current = name;
        saveState();
        setMode("view");
      });
    });
  }, 0);
  
  return html;
}

function buildPinnedContent() {
  const validPinned = pinned.filter(name => state.pages[name]);
  
  if (validPinned.length === 0) {
    return '<p class="sidebar-empty">고정된 문서가 없습니다.<br><span style="font-size:11px;">문서 제목 옆 📌 버튼을 눌러 고정하세요.</span></p>';
  }
  
  let html = '<ul class="pages-list pinned-list">';
  for (const name of validPinned) {
    const isActive = name === state.current && state.mode === "view";
    html += `<li class="pages-item ${isActive ? 'active' : ''}" data-name="${encodeURIComponent(name)}" draggable="true">`;
    html += `<span class="drag-handle">⋮⋮</span>`;
    html += `<a href="#" class="pages-link">${name}</a>`;
    html += `<button class="pin-btn pinned" title="고정 해제">📌</button>`;
    html += '</li>';
  }
  html += '</ul>';
  
  setTimeout(() => {
    const list = document.querySelector(".pinned-list");
    if (list) {
      initDragAndDrop(list);
    }
    
    document.querySelectorAll("#sidebar-left .pages-item").forEach(item => {
      item.querySelector(".pages-link").addEventListener("click", (e) => {
        e.preventDefault();
        const name = decodeURIComponent(item.getAttribute("data-name"));
        state.current = name;
        saveState();
        setMode("view");
      });
      
      item.querySelector(".pin-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = decodeURIComponent(item.getAttribute("data-name"));
        togglePin(name);
      });
    });
  }, 0);
  
  return html;
}

function initDragAndDrop(list) {
  const items = list.querySelectorAll(".pages-item");
  
  items.forEach(item => {
    item.addEventListener("dragstart", (e) => {
      draggedItem = item;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      draggedItem = null;
      // 새 순서 저장
      updatePinnedOrder(list);
    });
    
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === item) return;
      
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      if (e.clientY < midY) {
        list.insertBefore(draggedItem, item);
      } else {
        list.insertBefore(draggedItem, item.nextSibling);
      }
    });
  });
}

function updatePinnedOrder(list) {
  const newOrder = [];
  list.querySelectorAll(".pages-item").forEach(item => {
    const name = decodeURIComponent(item.getAttribute("data-name"));
    newOrder.push(name);
  });
  pinned = newOrder;
  savePinned();
}

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
  // view, edit 모드에서만 목차 표시
  if (state.mode !== "view" && state.mode !== "edit") {
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
  if (state.mode !== "view") {
    return '<p class="sidebar-empty">백링크 없음</p>';
  }

  const currentPage = state.current;
  const backlinks = getBacklinks(currentPage);

  if (backlinks.length === 0) {
    return '<p class="sidebar-empty">이 문서를 링크한 문서가 없습니다</p>';
  }

  let html = '<ul class="backlink-list">';
  backlinks.forEach(name => {
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
        saveState();
        setMode("view");
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
  buildSidebarLeft();
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

      // <문서명> 형태에서 꺾쇠 제거
      name = name.replace(/^<|>$/g, '');

      try {
        name = decodeURIComponent(name);
      } catch (err) {}

      if (!state.pages[name]) {
        state.pages[name] = "# " + name + "\n\n새 문서를 작성하세요.";
        saveState();
        updateLinkIndex(name);
      }
      state.current = name;
      saveState();
      setMode("view");
    });
  });
}

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

// 이벤트 리스너
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

// 초기화
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
