# Mini Wiki Dark 📚

[👉 Use directly on the web (Live Demo)](https://choe050919.github.io/wiki/)

**Mini Wiki Dark** is an ultra-lightweight personal wiki that operates without a server, using the browser's Local Storage. It supports Markdown syntax, wiki-style inter-document linking, version control, dark mode, and more.

> **Note**: Documents you create by accessing the link above are safely stored in your browser and are not transmitted to any server.

## ✨ Key Features

*   **No Server Required**: Can be used immediately by simply running `index.html` without any separate backend installation.
*   **Data Privacy**: All data is stored only within the browser (Local Storage).
*   **Markdown Editor**: Supports real-time Markdown rendering using `marked.js`.
*   **File Drag and Drop**: Supports dragging image (.png, .jpg, .gif) and text (.txt, .md) files directly into the editor. Images are embedded as Base64 data URLs, and text files are inserted as their content.
*   **Wiki Links**: Free movement and creation of documents using the `[DocumentName](DocumentName)` format.
*   **Bi-directional Links**: Automatic generation of a document's **Table of Contents (TOC)** and **Backlinks** that mention this document.
*   **Rename Document**: Allows changing a document's title via the Command Bar (`:rename`), with all backlinks automatically updated.
*   **History Management**: Saves document revision history and allows restoration to a specific version.
*   **Sidebar Features**:
    *   Left: Full document list (alphabetical/recent order), Pinned document management (Drag & Drop sorting and pin/unpin functionality).
    *   Right: Current document TOC, Backlinks.
*   **Data Backup**: Supports exporting/importing data in JSON format.
*   **Theme Support**: Dark mode and light mode switching (Light mode is now the default theme for new users).

## 🚀 Getting Started

### Method 1: Use Directly on the Web (Recommended)
You can use it immediately without installation via the link below.
*   **URL**: https://choe050919.github.io/wiki/

### Method 2: Run Locally
If you want to use it as a local file without an internet connection, follow these steps.

1.  Clone this repository or [download as ZIP](https://github.com/choe050919/wiki/archive/refs/heads/main.zip).
2.  Open the `index.html` file in the unzipped folder with a web browser (Chrome, Edge, Firefox, etc.).
3.  Start using it right away!

## 📖 How to Use

### 1. Navigate and Create Documents
*   Enter a document title in the top **Input Bar (Command Bar)** and press `Enter`.
*   If the document exists, you will navigate to it; otherwise, a **new document** will be created.
*   Enter `All` to see a list of all documents.

### 2. Editing Syntax
Follows general Markdown syntax.
*   **Internal Link**: `[Link Document Name](Link Document Name)` (e.g., `[Home](Home)`)
*   **External Link**: `[Google](https://google.com)`

### 3. Commands (Input Bar)
*   `Document Name`: Navigate to/create the document
*   `All`: View all documents list
*   `:history`: View current document's history
*   `:rename`: Renames the current document.

### 4. File Drag and Drop
*   To use, simply drag a supported file type (images: `.png`, `.jpg`, `.gif` / text: `.txt`, `.md`) into the editor area. Images will be embedded as Base64 data URLs, and text files will have their content inserted into the document.

### 5. Keyboard Shortcuts
| Shortcut     | Action              |
| :----------- | :------------------ |
| **Ctrl + E** | Toggle edit mode    |
| **Ctrl + S** | Save (in edit mode) |
| **Ctrl + H** | View history        |
| **Esc**      | Cancel / Return to view mode |

## 💾 Backup and Recovery
Since data is stored in the browser, clearing your browser's cache may delete your data.
Please regularly back up your data as a `.json` file by clicking the **Export** button in the top menu.

## 🛠 Tech Stack
*   **HTML5 / CSS3** (Flexbox layout, CSS Variables)
*   **Vanilla JavaScript** (ES6+)
*   **Library**: [marked.js](https://github.com/markedjs/marked) (Markdown Parsing)

## 📄 License
MIT License