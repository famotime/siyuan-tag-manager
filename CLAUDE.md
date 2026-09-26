# CLAUDE.md · Quick Reference for Claude Code

This guide provides essential development instructions and architectural context for `siyuan-tag-manager`.

## Commands

- **Run all tests**: `pnpm test` (Uses Vitest; 14 test suites, 69 tests)
- **Run specific test**: `pnpm test -- tests/<filename>.spec.ts`
- **Build plugin**: `pnpm build` (Bundles to `dist/` and archives into `package.zip`)
- **Type check**: `pnpm typecheck` (`tsc --noEmit`)
- **Watch mode**: `pnpm dev`

## Architecture Structure

- **Presentation (`src/components/`, `src/App.vue`)**:
  - `src/App.vue`: Main workbench shell with header and tab router.
  - `src/components/tabs/`: 4 views (`TagTreeView`, `TagFilterView`, `TagGraphView`, `TagHygieneView`).
  - `src/components/dialogs/`: Modals (`TagStyleModal`, `TagSaveViewModal`, `TagBatchModal`, `TagMergeModal`, `TagRowMenu`).
  - `src/components/SiyuanTheme/`: `SyLineIcon.vue` and `icons.ts` (Explicit line icons with anti-pollution SVG styles).
- **Composables (`src/composables/`)**:
  - `useTagData.ts`: Tag items, metadata storage, delete & doc conversion.
  - `useTagFilter.ts`: Faceted boolean filters, card queries, smart views.
  - `useTagHygiene.ts`: Health score inspection and automated fixes.
- **Domain Services (`src/services/`)**:
  - Pure TypeScript logic (`TagTreeService`, `TagFilterEngine`, `TagCooccurrenceService`, `TagGovernanceService`, etc.) and `TagApiClient` (SiYuan kernel HTTP adapter).
- **Design System (`src/styles/`, `src/index.scss`)**:
  - Dual-theme high-contrast variables (WCAG AA+) in `src/index.scss`.
  - Component layouts in `src/styles/components.scss`.

## Code Guidelines

- **Icons**: Always use `<SyLineIcon name="..." />` to prevent SiYuan global CSS fill-color bleed.
- **Theme Variables**: Use CSS variables `--tm-badge-*` for chips and indicators across light/dark themes.
- **Commit Messages**: Follow conventional commits in Chinese: `<type>(<scope>): <简要说明增加的特性或解决的具体问题>`.
