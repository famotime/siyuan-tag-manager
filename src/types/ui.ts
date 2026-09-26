import type { IColorPreset } from '../styles/palette';

export type TabType = 'tree' | 'filter' | 'graph' | 'hygiene';

export interface ITabItem {
  id: TabType;
  name: string;
  iconName: string;
  badge?: number;
}

export interface IRowMenuState {
  visible: boolean;
  label: string;
  top: number;
  left: number;
}

export interface IStyleModalState {
  visible: boolean;
  label: string;
  presetId: string;
  backgroundColor: string;
  textColor: string;
  darkBackgroundColor: string;
  darkTextColor: string;
  icon: string;
  aliasesText: string;
}

export interface ISaveViewModalState {
  visible: boolean;
  title: string;
}

export interface IBatchModalState {
  visible: boolean;
  docIdsText: string;
  tagsText: string;
  executing: boolean;
}

export interface IMergeModalState {
  visible: boolean;
  sourceLabel: string;
  targetLabel: string;
  setAsAlias: boolean;
  executing: boolean;
}
