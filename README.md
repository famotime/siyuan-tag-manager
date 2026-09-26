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

### 5. 📑 Tag Groups & Multi-document Batch Tagging
- **Tag Groups**: Package frequently paired tags into reusable bundles (e.g. Frontend Stack, Book Summary) and apply them to current docs or blocks in 1 click.
- **Native DocTree Context Menu**: Multi-select documents in SiYuan's native file tree and right-click `🏷️ Batch Tagging (X docs)` for instant batch tagging.
- **Interactive Multi-source Selector**: Fuzzy search doc titles, load entire notebooks, or paste IDs to safely apply tags with automated deduplication.

### 6. 🩺 Smart Reference Promotion (Ref to Tag)
- **Bridging Bi-directional Links & Tags**: Scans block/doc references in notes and matches anchor text, target titles, names, and aliases against existing tags to recommend 1-click promotion.
- **Instant & Global Hygiene**: Diagnose current active notes or run vault-wide scans with source badges (`[Name]`, `[Alias]`, `[Title]`, `[Ref]`).

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

## 📚 Advanced Documentation & User Guides

- 📖 **[User Guide: Tag Groups, Batch Tagging & Ref Promotion](./docs/user-guide-groups-batch-and-ref.md)**: In-depth user scenarios, native tree workflow, fuzzy matching rules, and best practices.
- 🎨 **[Tag Styling & Alias Engine Guide](./docs/tag-style-and-alias-guide.md)**: WCAG AA+ dual theme palette, real-time DOM decorator, and pinyin abbreviation search.
- 🏛️ **[Project Architecture & Code Structure](./docs/project-structure.md)**: Layered design, service responsibilities, and data contracts.


