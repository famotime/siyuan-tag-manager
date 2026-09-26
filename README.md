# 🏷️ SiYuan Note · Tag Manager

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/famotime/siyuan-tag-manager)
[![SiYuan](https://img.shields.io/badge/SiYuan->=v3.8.5-6366f1.svg)](https://b3log.org/siyuan/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**English** | [简体中文](./README_zh_CN.md)

> **A professional-grade workspace for tag asset management, multidimensional faceted search, knowledge co-occurrence graphs, and health hygiene in SiYuan Note.**

---

## 💡 Why Tag Manager?

In personal knowledge management systems (PKMS), **bi-directional links** form micro neural connections, while **tags** maintain macro multidimensional categorizations and analytical slices.

As notes and tags grow over time, SiYuan's native tag mechanism presents critical limitations in daily usage:
* ❌ **Naming Fragmentation & Case Sensitivity Conflicts**: Ad-hoc tagging creates duplicates like `Prompt` (23) vs `prompt` (2), or `Python` (20) vs `python` (1). Identical concepts are split across separate tags with no easy way to merge or normalize them.
* ❌ **Explosion of Low-Frequency & Orphan Tags**: Lists get cluttered with dozens of one-off tags (`tag (1)`) and orphan tags, creating serious "tag debt".
* ❌ **Disruptive Search Flow**: Clicking a native tag forces open a full-screen global search window, disrupting your active reading or writing context.
* ❌ **Lack of Faceted Intersection Filtering**: Finding blocks matching "*has `#AI#` AND `#Prompt#`, but NOT `#Deprecated#`*" is frustratingly difficult without writing complex SQL queries.
* ❌ **High Friction in Daily Tagging**: Finding tags is slow without fuzzy/pinyin search, and tagging multiple documents requires tedious manual edits.

**Tag Manager** is purpose-built to solve these pain points, delivering a unified, seamless workspace for **tag asset discovery, multi-tag faceted filtering, automated health hygiene, co-occurrence exploration, and batch management**.

---

## ✨ Key Features & User Scenarios

### 1. 🗂️ Tag Asset Overview & Fast Search
- **Pinyin Initial & Alias Fuzzy Matching**: Instantly find `#YouTube#` by typing `ytb`, or match Chinese tags with pinyin initials in milliseconds.
- **Hierarchical Tree & Real-time Metrics**: Clear tree visualization with nesting, collapse/expand states, and accurate reference counts.
- **Flexible Sorting**: Sort by reference count (descending/ascending) or alphabetical/pinyin order (A-Z / Z-A).

### 2. ⚡ Multidimensional Faceted Search & Card Stream
- **Visual Boolean Filter**:
  - `AND` (Include): Multi-tag intersection;
  - `NOT` (Exclude): Filter out unwanted or deprecated topics;
- **Non-disruptive Card Stream**: Results render in an instant drawer beside your workspace, preserving your reading and writing flow.
- **One-click Smooth Navigation**: Click any result card to jump directly to the target block with highlight.

### 3. 🩺 Tag Hygiene & Health Inspection Dashboard
- **Knowledge Base Health Score**: Get an instant health evaluation of your entire tag taxonomy.
- **Automated Issue Diagnosis**:
  - ⚠️ **Case Conflicts**: Detects pairs like `Prompt` vs `prompt` and resolves them with **one-click smart merge**;
  - ℹ️ **Low-frequency Cleanup**: Highlights isolated tags used only once, helping you prune noise;
  - 🗑️ **Orphan Tag Detection**: Scans and removes leftover tags with zero references.

### 4. 🕸️ Knowledge Co-occurrence Graph & Association
- **Co-occurrence Metrics**: Calculates Jaccard similarity and companion weights to reveal which concepts frequently appear together.
- **Discovery of Hidden Connections**: Focus on any core tag to uncover its closest companion topics and launch cross-filtering with one click.

### 5. 📑 Batch Tagging & Smart Refactoring
- **Batch Document Tagging**: Paste multiple document IDs to apply tags in bulk, eliminating repetitive manual work.
- **Seamless Merge & Aliasing**: Merge legacy tags into new taxonomy structures without breaking references, while preserving old names as aliases.

---

## 🚀 Getting Started

### How to Open the Workspace
* **Top Bar Icon**: Click the `Tag Manager` icon in SiYuan's top navigation bar to toggle the drawer.
* **Global Shortcut**: Press `Alt + Shift + T` (or `⌥ + ⇧ + T` on macOS).

### Recommended Workflow
```
[Capture & Tag Notes] ──> [Health Check: Merge Case Conflicts] ──> [Fuzzy Search / Faceted AND+NOT Slice] ──> [Co-occurrence Graph Insights]
```

1. **Daily Retrieval**: Press `Alt+Shift+T` and quickly locate tags via fuzzy search.
2. **Deep Slice**: Add tags to the filter via the `🔍` button, adjust `AND` / `NOT` conditions, and browse matching cards.
3. **Periodic Maintenance**: Open the `Health Hygiene` tab, review your health score, and perform one-click normalization and pruning.

---

## 📋 Comparison with Native Tagging

| Dimension | SiYuan Native Tags | 🏷️ Tag Manager | User Value |
| :--- | :--- | :--- | :--- |
| **Search Experience** | Single tag only, forces global search popup | **In-context card stream, fuzzy pinyin lookup & multi-tag filtering** | Immersive & uninterrupted workflow |
| **Boolean Filtering** | Not supported without complex manual SQL | **Visual point-and-click `AND` (Include) & `NOT` (Exclude)** | Effortless cross-dimensional knowledge slicing |
| **Naming Consistency** | Strict case sensitivity leading to duplicates (`Prompt/prompt`) | **Automated detection & 1-click normalization with alias support** | Eliminates fragmentation and messy taxonomies |
| **Maintenance** | No health checks; manual single rename/delete only | **Health score, case conflict diagnosis, low-frequency pruning** | Keeps your knowledge base clean and sustainable |
| **Concept Associations** | No co-occurrence awareness | **Co-occurrence network analysis & Jaccard association metrics** | Uncovers hidden concept connections & sparks ideas |
| **Bulk Operations** | Manual document-by-document tagging | **Batch document tagging & global tag migration** | 10x faster batch taxonomy management |

---

## ⚙️ Compatibility & Requirements

- **SiYuan Note**: `>= v3.8.5`
- **Supported Platforms**: Windows / macOS / Linux / Docker / Desktop Web
- **Data Safety**: All actions strictly adhere to official SiYuan kernel APIs without direct disk tampering, fully compatible with official cloud sync.

---

## 🛠️ Architecture & Development
This project adopts modern decoupled frontend architecture conforming to Single Responsibility Principle (SRP):
- **Modular Presentation**: Main workbench decomposed into 4 Tab views, 5 dialogs/menus, and 3 shared reactive Composables (`useTagData`, `useTagFilter`, `useTagHygiene`).
- **Comprehensive Testing**: 14 Vitest automated test suites with 69 tests passing (100% pass rate).
- **Design System**: Fully compliant with WCAG 2.1 AA+ contrast ratios and explicit anti-pollution line SVG icons.

```bash
# Run unit tests (14 test suites, 69 tests)
pnpm test

# Build for production (outputs to dist/ and creates package.zip)
pnpm build

# Static TypeScript check
pnpm typecheck
```

Detailed design and refactor documentation:
- [Project Architecture & Structure (docs/project-structure.md)](./docs/project-structure.md)
- [Code Refactor Plan & Execution Log (docs/refactor-plan.md)](./docs/refactor-plan.md)
- [Documentation Index (docs/README.md)](./docs/README.md)

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
