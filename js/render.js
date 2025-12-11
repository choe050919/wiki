import {
  state,
  history,
  pinned,
  visitedTime,
  currentLeftTab,
  currentRightTab,
  pagesSortMode,
  draggedItem,
  setCurrentLeftTab,
  setCurrentRightTab,
  setPagesSortMode,
  setDraggedItem,
  preprocessWikiLinks,
  saveState,
  addHistory,
  addVisited,
  togglePin,
  updateLinkIndex,
  getBacklinks,
  savePinned
} from './state.js';

// ========== DOM 요소 ==========
const editorEl = document.getElementById("editor");
const previewEl = document.getElementById("preview");
const btnSave = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");

// ========== 모드 전환 ==========
export function setMode(mode, options = {}) {
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

// ========== 메인 렌더링 ==========
export function renderPreview() {
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
      buildSidebarLeft();
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

export function renderAllList() {
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

export function updatePreview() {
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

// ========== 히스토리 렌더링 ==========
export function renderHistory(pageName) {
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

export function renderHistoryDetail(idx) {
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

// ========== 내부 링크 처리 ==========
export function attachInternalLinkHandlers() {
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

// ========== 좌측 사이드바 ==========
export function buildSidebarLeft() {
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
      setCurrentLeftTab(btn.getAttribute("data-tab"));
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
        setPagesSortMode(btn.getAttribute("data-sort"));
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
        buildSidebarLeft();
      });
    });
  }, 0);
  
  return html;
}

function initDragAndDrop(list) {
  const items = list.querySelectorAll(".pages-item");
  
  items.forEach(item => {
    item.addEventListener("dragstart", (e) => {
      setDraggedItem(item);
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      setDraggedItem(null);
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
  // pinned 배열 직접 수정
  pinned.length = 0;
  newOrder.forEach(name => pinned.push(name));
  savePinned();
}

// ========== 우측 사이드바 ==========
export function buildSidebarRight() {
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
      setCurrentRightTab(btn.getAttribute("data-tab"));
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

// 기존 호환성을 위한 별칭
export function buildTOC() {
  buildSidebarRight();
  buildSidebarLeft();
}