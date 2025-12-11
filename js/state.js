// ========== 상수 ==========
export const STORAGE_KEY = "miniWikiDocs";
export const HISTORY_KEY = "miniWikiHistory";
export const VISITED_KEY = "miniWikiVisited";
export const PINNED_KEY = "miniWikiPinned";
export const LINKS_KEY = "miniWikiLinks";

// ========== 앱 상태 (데이터) ==========
export let state = {
  current: "Home",
  pages: {},
  mode: "view", // "view" | "edit" | "list" | "history" | "historyDetail"
  historyPage: null,
  historyIdx: null
};
export let history = [];      // { page, time, content }
export let pinned = [];       // 고정된 문서 목록
export let visitedTime = {};  // { pageName: timestamp }
export let linkIndex = {};    // { pageName: [linkedPage1, linkedPage2, ...] }

// ========== UI 상태 ==========
export let currentLeftTab = "all";    // "all" | "pinned"
export let currentRightTab = "toc";   // "toc" | "backlinks"
export let pagesSortMode = "alpha";   // "alpha" | "recent"
export let draggedItem = null;        // 드래그 중인 요소

// 상태 변경 함수들 (let 변수는 직접 재할당 불가하므로)
export function setCurrentLeftTab(value) { currentLeftTab = value; }
export function setCurrentRightTab(value) { currentRightTab = value; }
export function setPagesSortMode(value) { pagesSortMode = value; }
export function setDraggedItem(value) { draggedItem = value; }
export function setHistory(value) { history = value; }
export function setPinned(value) { pinned = value; }
export function setVisitedTime(value) { visitedTime = value; }
export function setLinkIndex(value) { linkIndex = value; }

// ========== 마크다운 전처리 ==========
export function preprocessWikiLinks(text) {
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
export function parseLinks(text) {
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

export function loadLinkIndex() {
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

export function saveLinkIndex() {
  localStorage.setItem(LINKS_KEY, JSON.stringify(linkIndex));
}

export function updateLinkIndex(pageName) {
  const content = state.pages[pageName] || "";
  linkIndex[pageName] = parseLinks(content);
  saveLinkIndex();
}

export function getBacklinks(pageName) {
  const backlinks = [];
  for (const [page, links] of Object.entries(linkIndex)) {
    if (page !== pageName && links.includes(pageName)) {
      backlinks.push(page);
    }
  }
  return backlinks.sort((a, b) => a.localeCompare(b, "ko"));
}

export function rebuildLinkIndex() {
  linkIndex = {};
  for (const pageName of Object.keys(state.pages)) {
    linkIndex[pageName] = parseLinks(state.pages[pageName]);
  }
  saveLinkIndex();
}

// ========== 저장/불러오기 ==========
export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.current = "Home";
    state.pages = {
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
    };
    state.mode = "view";
    state.historyPage = null;
    state.historyIdx = null;
    saveState();
  } else {
    try {
      const parsed = JSON.parse(raw);
      state.current = parsed.current;
      state.pages = parsed.pages;
      state.mode = parsed.mode || "view";
      state.historyPage = parsed.historyPage || null;
      state.historyIdx = parsed.historyIdx || null;
    } catch (e) {
      console.error("저장된 데이터 파싱 실패, 초기화합니다.", e);
      state.current = "Home";
      state.pages = {
        "Home": "# Home\n\n저장된 데이터를 불러오는 데 실패해서 초기화했습니다."
      };
      state.mode = "view";
      state.historyPage = null;
      state.historyIdx = null;
      saveState();
    }
  }
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw) {
    try {
      history = JSON.parse(raw);
    } catch (e) {
      history = [];
    }
  }
}

export function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function addHistory(pageName, content) {
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

export function loadVisited() {
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

export function saveVisited() {
  localStorage.setItem(VISITED_KEY, JSON.stringify(visitedTime));
}

export function addVisited(pageName) {
  visitedTime[pageName] = Date.now();
  saveVisited();
}

export function loadPinned() {
  const raw = localStorage.getItem(PINNED_KEY);
  if (raw) {
    try {
      pinned = JSON.parse(raw);
    } catch (e) {
      pinned = [];
    }
  }
}

export function savePinned() {
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
}

export function togglePin(pageName) {
  const idx = pinned.indexOf(pageName);
  if (idx === -1) {
    pinned.push(pageName);
  } else {
    pinned.splice(idx, 1);
  }
  savePinned();
}

// 정규식 특수문자 이스케이프
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}