# 🏷️ SiYuan Note · Tag Manager

[![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)](https://github.com/famotime/siyuan-tag-manager)
[![SiYuan](https://img.shields.io/badge/SiYuan->=v3.8.5-6366f1.svg)](https://b3log.org/siyuan/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Theme](https://img.shields.io/badge/theme-Dark%20%7C%20Light%20Adaptive-teal.svg)](https://github.com/famotime/siyuan-tag-manager)

**English** | [简体中文](./README_zh_CN.md)

> **Consolidate tag assets, streamline knowledge networks, conquer tag debt, and bridge cognitive connections.**  
> A professional-grade workspace for tag asset management, multidimensional faceted search, cognitive co-occurrence graphs, and automated health hygiene in SiYuan Note.

---

## 💡 Why Tag Manager?

In personal knowledge management (PKM / Second Brain) workflows, **bi-directional links** act like neural synapses connecting micro nodes, while **tags** serve as macro coordinates and multidimensional slicing tools across notebooks and domains.

However, as notes and tags accumulate over time, SiYuan's native tag mechanism presents significant pain points and cognitive overhead in daily usage:

| Daily Workflow | Real-world Frustrations & Pain Points | Tag Manager Solutions & Value |
| :--- | :--- | :--- |
| **Ad-hoc Tagging** | Forgetting existing tags; case sensitivity creating duplicate splits like `Prompt` vs `prompt`, `Python` vs `python`, or typographic variants like `web-dev` vs `web_dev`. | **Pinyin / abbreviation fuzzy lookup**; **automated conflict detection** and 1-click normalization with aliases to ensure future searches always hit. |
| **Reading & Retrieval** | Clicking a tag inside a note forces open a full-screen/half-screen search modal, immediately obscuring your active reading context and disrupting your flow. | **In-context side drawer card stream** with zero screen takeover; click any card to smoothly scroll and highlight the target block. |
| **Complex Faceted Slicing** | Needing to query blocks matching "*has `#Vue3#` AND `#Architecture#`, OR `#React#`, but NOT `#Deprecated#`*" requires writing cumbersome manual multi-table SQL queries. | **Visual `AND` / `OR` / `NOT` 3-state Boolean filter pool**—click to slice cross-dimensional knowledge in seconds. |
| **Batch Organizing** | Importing dozens or hundreds of external documents or restructuring a project requires tedious, manual document-by-document opening and tagging. | **Native DocTree right-click context menu** + **interactive multi-source selector** with recursive "include sub-docs" support. |
| **Bi-link & Tag Silos** | Notes contain extensive references like `((Vue 3 Architecture))`, but these documents remain completely invisible from a tag categorization perspective. | **Smart Reference Promotion (Ref to Tag)**: scans bi-links, anchor texts, titles, names, and aliases to recommend 1-click promotion to tags. |
| **Long-term Maintenance** | Hundreds of one-off orphan tags accumulate with zero references, creating severe "tag debt" with no way to safely audit or clean them up. | **100-point Health Score Dashboard**: 1-click diagnosis of case conflicts, punctuation variants, malformed tags, and orphan tags with batch cleanup. |

---

## ✨ Key Features & User Scenarios

### 1. 🗂️ Tag Asset Overview & Reusable Tag Groups
> **Pain Point Solved**: Deep tag hierarchies and massive tag lists are slow to navigate, and repeatedly typing fixed combinations of tags is exhausting.

- **Pinyin Abbreviation & Alias Fuzzy Lookup**:
  - Instant matching without switching input methods.
  - Type `ytb` to match `#YouTube#`, `wz` to match `#微服务#`, or `ff` to match `#方法论#`.
- **Hierarchical Path Folding & Real-time Metrics**:
  - Clear multi-level nested tag tree (e.g. `#Tech/Frontend/Vue#`) with precise reference counters for every branch.
  - Toggle sorting by **reference count (descending/ascending)** or **alphabetical order (A-Z / Z-A)**.
- **🏷️ One-click Tag Groups**:
  - Bundle frequently paired tags into reusable preset suites (e.g., [Frontend Core: `vue`, `typescript`, `vite`], [Deep Reading: `reading-notes`, `cognitive-science`, `mental-models`]).
  - **1-Click Apply**: Click "Apply" in the sidebar to instantly inject the preset tags into the active document's native IAL attributes—**zero document pollution, keeping your note format clean and pure**.

---

### 2. ⚡ Multidimensional Faceted Search & In-Context Card Stream
> **Pain Point Solved**: Eliminates disruptive full-screen search popups and brings effortless intersection, union, and difference filtering.

- **Visual 3-State Boolean Filtering (`AND` / `OR` / `NOT`)**:
  - 🟢 **AND (Must Include)**: Intersection of all required core topics;
  - 🟡 **OR (Optional)**: Union expansion matching any selected topics;
  - 🔴 **NOT (Exclude)**: Accurately strips noise (e.g., exclude `#draft#`, `#archived#`, `#deprecated#`).
  - Seamlessly cycle through states with single clicks.
- **In-Pool Pinyin & Keyword Search-to-Add**:
  - Quickly search through extensive tag collections and add new filter conditions without endlessly scrolling.
- **Drawer-based Instant Card Stream**:
  - Search results display directly in the side drawer with rich context snippets and document breadcrumbs.
  - **Immersive Flow**: Clicking any card smoothly navigates to and highlights the target block in the main editor without taking over your screen.
- **Saved Views**:
  - Save frequently used complex filters (such as "Weekly Review Queue" or "High-Priority Tech Debt") into named views to reopen your customized slice in one click.

---

### 3. 📑 Multi-Document Batch Tagging & Taxonomy Setup
> **Pain Point Solved**: Eliminates mechanical repetition when importing libraries, organizing projects, or classifying folders.

- **Native DocTree Right-Click Access**:
  - Select a single document or multi-select with `Ctrl` / `Shift` directly in SiYuan's native document tree.
  - Right-click and choose **「🏷️ Batch Tagging (X docs)」** for seamless, native-feeling efficiency.
- **Recursive "Include Sub-documents" Support**:
  - Check "Include sub-documents" to automatically apply tags across entire notebook trees or nested folders in a single step.
- **Interactive Multi-Source Selector**:
  - Fuzzy-search document titles with quick check-boxes;
  - Load entire notebooks in one go;
  - Manually paste lists of document IDs with automated deduplication and safety verification.

---

### 4. 🩺 Tag Hygiene & Automated Health Governance
> **Pain Point Solved**: Overcomes messy knowledge bases plagued by typos, case discrepancies, and low-frequency orphan tags.

- **100-Point Health Score Dashboard**:
  - Perform instant vault-wide audits to review the health index and structural integrity of your tag taxonomy.
- **Diagnosis of 4 Core Sub-Health Issues**:
  - ⚠️ **Case Conflicts**: Identifies pairs like `Prompt` vs `prompt`, `Python` vs `python`;
  - 🔤 **Punctuation & Typographic Variants**: Detects variants using hyphens, underscores, or similar affixes (e.g., `web-dev` vs `web_dev`);
  - 🧹 **Low-Frequency & Orphan Tags**: Scans isolated tags used only once, as well as dead tags with 0 references left behind by deleted blocks;
  - 🚫 **Malformed & Non-standard Symbols**: Flags unsemantic symbols and formatting glitches.
- **One-Click Normalization with "Archive as Alias"**:
  - When merging conflicting tags, check "Save original name as alias" to unify your database under standard terminology while preserving historical search habits.

---

### 5. 🔗 Smart Reference Promotion (Ref to Tag)
> **Pain Point Solved**: Bridges the gap between bi-directional links and the tag system, integrating micro references into macro taxonomy.

- **Cross-Layer Intelligent Scanning**:
  - Scans block references and document links throughout your notes.
  - Matches **anchor texts**, **target titles**, **document names**, and **aliases** against existing tags.
- **1-Click Tag Promotion**:
  - Clearly displays match origins (e.g., `[Name]`, `[Alias]`, `[Title]`, `[Ref]`).
  - Supports active-document diagnosis or vault-wide audits, promoting references into structured tags in one click.

---

### 6. 🕸️ Cognitive Co-Occurrence Graph & Associative Insights
> **Pain Point Solved**: Uncovers latent conceptual connections between seemingly unrelated topics to spark insights.

- **Co-Occurrence Weights & Jaccard Similarity**:
  - Dynamically calculates which concepts frequently co-occur within the same blocks or documents.
- **Focus on Core Topics & Companions**:
  - Click any tag to spotlight its closest companion topics and understand your shifting areas of focus.
- **From Associative Insights to Tag Groups**:
  - Discovered a strong cluster of co-occurring topics? Save the entire multi-tag cluster as a **reusable Tag Group** in one click.

---

### 7. 🎨 Tag Styler & Visual Cognitive Acceleration
> **Pain Point Solved**: Eliminates monotonous grey/blue tag appearance to bring visual hierarchy to priorities, domains, and statuses.

- **Dual-Theme 8 Fine-Tuned Palettes**:
  - Tech Blue, Mint Green, Amber Gold, Rose Red, Sky Blue, Purple Violet, Warm Orange, and Slate Grey.
  - Engineered around **WCAG AA 4.5:1+** contrast standards for glare-free readability in both light and dark modes.
- **Emoji Prefixes for Instant Recognition**:
  - Pair tags with visual emojis (e.g., `#Ideas#` with 💡, `#Todo#` with 📌, `#Review#` with 🎯).
  - Renders as high-fidelity capsule pills in the editor, allowing instant scanning of paragraph themes.
- **1-Click Style Reset While Retaining Metadata**:
  - Revert custom background colors back to system defaults with one click while keeping your configured emojis and alias dictionaries intact.
- **Zero Document Pollution**:
  - Rendered purely via dynamic CSS rules and runtime DOM attributes. **No proprietary markdown syntax or data residue is written to your files**.

---

### 8. 📄 1-Click Promotion to Entity Document (Tag to Doc)
> **Pain Point Solved**: When a tag accumulates dozens of knowledge snippets, turn it into a structured Topic Map of Content (MOC).

- Right-click any tag in the tree and select **「Promote to Document」**;
- Automatically creates a dedicated summary document in your target notebook;
- Generates a **real-time dynamic SQL query embed** alongside static reference snapshots, bootstrapping your topic hub.

---

## 📋 Comparison Matrix (SiYuan Native vs Tag Manager)

| Dimension | SiYuan Native Tags | 🏷️ Tag Manager | Core User Value |
| :--- | :--- | :--- | :--- |
| **Search Experience** | Single tag only, forces open a full-screen search popup | **In-context side drawer card stream, pinyin abbreviation lookup, smooth jump & highlight** | Uninterrupted flow and focused reading |
| **Boolean Filtering** | Not supported without complex manual SQL queries | **Visual `AND` (include), `OR` (optional), and `NOT` (exclude) 3-state filter pool** | Effortless multi-dimensional knowledge slicing |
| **Naming Consistency** | Strict case sensitivity causes fragmentation (`Prompt/prompt`) | **Automated detection of case & punctuation variants, 1-click merge with alias preservation** | Eliminates duplicates and taxonomy disorder |
| **Maintenance** | No health checks; manual single rename/delete only | **100-point Health Score, case conflict diagnosis, orphan/low-frequency pruning** | Automated maintenance for long-term health |
| **Batch Operations** | Must open and edit notes one by one | **Native DocTree right-click batch tagging with recursive sub-document support** | 10x faster taxonomy organization |
| **Tagging Acceleration** | Manual `#` character typing every single time | **1-click reusable Tag Groups applied to active docs via IAL attributes (zero format pollution)** | Fast, consistent, and frictionless tagging |
| **Bi-link Integration** | Links and tags exist in isolated silos | **Scans link anchors, titles, names, and aliases to recommend 1-click promotion to tags** | Bridges micro links with macro taxonomy |
| **Associative Discovery** | No awareness of conceptual relationships | **Dynamic co-occurrence network, Jaccard similarity, and 1-click save to Tag Group** | Sparks unexpected creative connections |
| **Visual Styling** | Monotonous plain tags without priority or domain cues | **8 WCAG AA+ dual-theme palettes, emoji pills, zero markdown residue** | High visual contrast and fast scan reading |

---

## 🚀 30-Second Quick Start

### 1. Opening the Workspace
* **Top Bar Icon**: Click the `Tag Manager` icon in SiYuan's top navigation bar;
* **Global Shortcut**: Press `Alt + Shift + T` (macOS: `⌥ + ⇧ + T`) to toggle the drawer anytime.

### 2. Recommended 3-Step Routine

```
Step 1: Vault Audit ───────────────> Step 2: Daily Retrieval ───────────────> Step 3: Fast Tagging
[Hygiene] 1-Click Merge Conflicts     [Tree/Filter] Pinyin & Boolean Slice    [Tag Groups] 1-Click Doc Tagging
```

1. **Step 1 · Clear Legacy Debt**:
   - Open the **Health Hygiene** tab and run a full audit;
   - Review "Case & Typographic Conflicts", click "1-Click Merge", and enable alias archiving.
2. **Step 2 · Enjoy Immersive Search**:
   - While reading or researching, press `Alt + Shift + T`;
   - Type pinyin or abbreviation initials (e.g. `js` or `ts`) to locate tags;
   - Click `🔍` to add tags to the multi-dimensional filter, cycle between `AND` / `NOT`, and click cards to jump smoothly.
3. **Step 3 · Build Reusable Tag Suites**:
   - In the "Tag Tree" tab, expand **Tag Groups** at the top and create presets for your recurring workflows (e.g. Weekly Review, Reading Notes, Project Sprint);
   - When finishing a note, click "Apply" once in the sidebar to complete document classification instantly!

---

## 🔒 Privacy & Safety Guarantee

- **100% Local Execution**: All pinyin lookups, SQL queries, health inspections, and graph algorithms run locally inside your SiYuan desktop client. Zero note data is ever sent to external servers;
- **Zero Format Pollution**:
  - Tag styling uses dynamic CSS rules and runtime DOM attributes, leaving no non-standard markup in your Markdown files;
  - Batch tagging and tag groups inject metadata directly into SiYuan's native document IAL attributes, preserving clean text formatting;
- **Defensive Safeguards**: Tag merges and batch updates include safety confirmations and deduplication checks to protect your knowledge assets.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE). Feel free to submit feedback and suggestions on [GitHub Issues](https://github.com/famotime/siyuan-tag-manager/issues)!
