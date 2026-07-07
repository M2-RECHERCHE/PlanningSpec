export type PageOrientation = 'portrait' | 'landscape';
export type ReportPageSize = 'A4' | 'A3' | 'LETTER';
export type FontFamily = 'Helvetica' | 'Times-Roman' | 'Courier';
export type TableStyle = 'striped' | 'bordered' | 'minimal';
export type HeaderStyle = 'filled' | 'outline' | 'underline';
export type PageMargin = 'tight' | 'normal' | 'wide';

export interface ReportDesignOptions {
  // Page
  pageSize: ReportPageSize;
  orientation: PageOrientation;
  pageMargin: PageMargin;

  // Content
  title: string;
  subtitle: string;
  footerText: string;
  showCoverPage: boolean;
  showCalendar: boolean;
  showDetailTable: boolean;
  showResourcesView: boolean;
  showSolveTime: boolean;
  showWarnings: boolean;
  showPageNumbers: boolean;

  // Typography
  font: FontFamily;
  bodyFontSize: number;      // 8–12
  headerFontSize: number;    // 11–18

  // Theme
  primaryColor: string;
  accentColor: string;
  coverBg: string;
  rowEvenColor: string;
  tableBorderColor: string;

  // Table style
  tableStyle: TableStyle;
  headerStyle: HeaderStyle;

  // Activity colors
  activityColors: Record<string, string>;
}

export const DEFAULT_OPTIONS: ReportDesignOptions = {
  pageSize: 'A4' as ReportPageSize,
  orientation: 'portrait',
  pageMargin: 'normal',

  title: '',
  subtitle: '',
  footerText: '',
  showCoverPage: true,
  showCalendar: true,
  showDetailTable: true,
  showResourcesView: true,
  showSolveTime: true,
  showWarnings: false,
  showPageNumbers: true,

  font: 'Helvetica',
  bodyFontSize: 9,
  headerFontSize: 13,

  primaryColor: '#1e3a5f',
  accentColor: '#3b82f6',
  coverBg: '#ffffff',
  rowEvenColor: '#f8fafc',
  tableBorderColor: '#e2e8f0',

  tableStyle: 'striped',
  headerStyle: 'filled',

  activityColors: {},
};
