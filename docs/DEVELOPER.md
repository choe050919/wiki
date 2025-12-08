# 개발자 가이드 (Developer Guide)

이 문서는 **Mini Wiki Dark**의 코드 구조 및 내부 동작 원리에 대해 설명합니다.

## 📂 프로젝트 구조

```text
.
├── index.html      # 앱의 진입점, 레이아웃 구조 (Topbar, Main, Sidebars)
├── style.css       # 전체 스타일링, CSS 변수(테마), 반응형 처리
├── script.js       # 핵심 로직 (상태 관리, 라우팅, 스토리지, 이벤트 처리)
└── README.md       # 사용자 매뉴얼
````

## 🏗 아키텍처 및 상태 관리

이 앱은 바닐라 자바스크립트로 작성된 **SPA(Single Page Application)** 형태입니다.  
`script.js` 내의 `state` 객체가 앱의 모든 상태를 관리하며, 변경 사항은 즉시 `localStorage`에 동기화됩니다.

### 1\. 주요 상수 (Storage Keys)

  * `miniWikiDocs`: 문서 데이터 객체 저장.
  * `miniWikiHistory`: 문서 수정 내역 배열 저장.
  * `miniWikiVisited`: 최근 방문 기록 저장.
  * `miniWikiPinned`: 사이드바에 고정된 문서 목록 저장.

### 2\. State 객체 구조

```javascript
let state = {
  current: "Home",       // 현재 보고 있는 문서의 제목 (String)
  pages: {               // 모든 문서 데이터 (Object)
    "Home": "# Home\n 내용...",
    "AnotherPage": "..."
  },
  mode: "view",          // 현재 UI 모드 (view | edit | list | history | historyDetail)
  historyPage: null,     // 히스토리 모드에서 보고 있는 대상 문서명
  historyIdx: null       // 히스토리 상세 보기 시 선택된 인덱스
};
```

### 3\. 모드 시스템 (`setMode`)

UI는 `state.mode`에 따라 렌더링이 달라집니다.

  * **view**: 마크다운 렌더링 화면 (`previewEl` 표시, `editorEl` 숨김).
  * **edit**: 텍스트 에디터 화면 (`editorEl` 표시).
  * **list**: 전체 문서 목록 렌더링.
  * **history**: 특정 문서의 수정 이력 목록.
  * **historyDetail**: 특정 시점의 문서 내용 미리보기 및 복원 기능.

## 🧩 주요 기능 구현 상세

### 사이드바 (Sidebars)

  * **좌측 (Sidebar Left)**:
      * **전체 탭**: `state.pages` 키를 기반으로 가나다순(`alpha`) 또는 최근 방문순(`recent`) 정렬.
      * **고정 탭**: `pinned` 배열을 기반으로 렌더링하며, HTML5 Drag & Drop API를 사용하여 순서 변경 가능.
  * **우측 (Sidebar Right)**:
      * **목차 (TOC)**: 렌더링된 HTML의 `h1`\~`h6` 태그를 파싱하여 동적으로 생성. 나무위키 스타일의 넘버링 로직 포함.
      * **백링크 (Backlinks)**: 전체 문서를 순회하며 정규식(`\[.*?\]\(현재문서명\)`)을 통해 역참조 링크를 탐색.

### 히스토리 (History)

  * 문서 저장(`Ctrl+S` 또는 버튼 클릭) 시 `addHistory()` 함수가 호출됩니다.
  * `history` 배열에 `{ page, time, content }` 객체를 추가합니다.
  * 최대 **100개**의 최신 기록만 유지하도록 슬라이싱 처리되어 있습니다.

### 마크다운 렌더링

  * `marked.parse(text)`를 사용하여 HTML로 변환합니다.
  * **내부 링크 처리**: 렌더링 후 `attachInternalLinkHandlers()`를 통해 `<a>` 태그를 가로채서, 외부 링크가 아닌 경우 SPA 내부 라우팅으로 처리합니다.

## 🎨 스타일링 (Theming)

`style.css`의 `:root` 가상 클래스에서 CSS 변수를 정의하여 다크 모드를 기본으로 설정했습니다.
`.light` 클래스가 `<html>` 태그에 붙으면 변수 값이 재정의되어 라이트 모드로 전환됩니다.

## ⚠️ 개발 시 유의사항

1.  **로컬 스토리지 용량**: 브라우저마다 다르지만 보통 5MB\~10MB 제한이 있습니다. 이미지를 Base64로 직접 넣는 것은 권장하지 않습니다.
2.  **동시성**: 동기적으로 작동하므로 대량의 데이터 처리 시 UI 블로킹이 발생할 수 있습니다 (현재 구조상 큰 문제는 없음).
3.  **보안**: `marked.js`를 사용하나 별도의 Sanitize(소독) 과정이 포함되어 있지 않습니다. 로컬 전용 앱이라 XSS 위험은 낮으나, 외부 데이터를 Import 할 때는 주의가 필요합니다.
