import React, { useMemo } from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PlanningReport, ActivityInstance } from '../../../lib/reportApi';
import type { ReportDesignOptions } from './types';

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#f97316',
];

function getColor(baseName: string, opts: ReportDesignOptions, idx: number): string {
  return opts.activityColors[baseName] ?? PALETTE[idx % PALETTE.length];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m} min ${s} s`;
}

const MARGIN_MAP: Record<string, number> = { tight: 24, normal: 40, wide: 56 };

function makeStyles(opts: ReportDesignOptions) {
  const margin = MARGIN_MAP[opts.pageMargin] ?? 40;
  const fs = opts.bodyFontSize;
  const hfs = opts.headerFontSize;
  const border = opts.tableBorderColor;
  const even = opts.tableStyle === 'minimal' ? 'transparent' : opts.rowEvenColor;
  const thBg = opts.headerStyle === 'filled' ? opts.primaryColor
    : opts.headerStyle === 'outline' ? 'transparent'
    : 'transparent';
  const thColor = opts.headerStyle === 'filled' ? '#fff' : opts.primaryColor;
  const thBorderBottom = opts.headerStyle === 'underline' ? 2 : 0;
  const thBorderColor = opts.headerStyle === 'underline' ? opts.accentColor : 'transparent';
  const thBorderLeft = opts.headerStyle === 'outline' ? 1 : 0;

  return StyleSheet.create({
    page: {
      fontFamily: opts.font,
      fontSize: fs,
      color: '#1a1a1a',
      paddingTop: margin,
      paddingBottom: margin,
      paddingHorizontal: margin,
      backgroundColor: '#ffffff',
    },
    coverPage: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      backgroundColor: opts.coverBg,
    },
    coverAccentBar: {
      width: 64,
      height: 5,
      backgroundColor: opts.accentColor,
      marginBottom: 24,
      borderRadius: 3,
    },
    coverTitle: {
      fontSize: hfs + 10,
      fontWeight: 'bold',
      color: opts.primaryColor,
      textAlign: 'center',
      marginBottom: 10,
    },
    coverSubtitle: {
      fontSize: hfs - 2,
      color: '#475569',
      textAlign: 'center',
      marginBottom: 8,
    },
    coverMeta: {
      fontSize: fs - 1,
      color: '#94a3b8',
      textAlign: 'center',
      marginTop: 4,
    },
    coverStatsRow: {
      flexDirection: 'row',
      gap: 24,
      marginTop: 32,
      padding: '14 24',
      backgroundColor: opts.coverBg === '#ffffff' ? '#f8fafc' : opts.primaryColor + '12',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: opts.accentColor + '30',
      borderStyle: 'solid',
    },
    coverStatItem: {
      alignItems: 'center',
      minWidth: 52,
    },
    coverStatValue: {
      fontSize: hfs + 6,
      fontWeight: 'bold',
      color: opts.primaryColor,
    },
    coverStatLabel: {
      fontSize: fs - 2,
      color: '#64748b',
      marginTop: 3,
    },
    sectionHeader: {
      fontSize: hfs,
      fontWeight: 'bold',
      color: opts.primaryColor,
      marginBottom: 8,
      marginTop: 14,
      paddingBottom: 5,
      borderBottomWidth: 2,
      borderBottomColor: opts.accentColor,
      borderBottomStyle: 'solid',
    },
    table: {
      width: '100%',
      marginBottom: 8,
      borderWidth: opts.tableStyle === 'bordered' ? 1 : 0,
      borderColor: border,
      borderStyle: 'solid',
      borderRadius: opts.tableStyle === 'bordered' ? 3 : 0,
    },
    tableRow: {
      flexDirection: 'row',
    },
    tableRowEven: {
      flexDirection: 'row',
      backgroundColor: even,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: thBg,
      borderRadius: opts.headerStyle === 'filled' ? 3 : 0,
      marginBottom: opts.headerStyle === 'underline' ? 0 : 2,
      borderBottomWidth: thBorderBottom,
      borderBottomColor: thBorderColor,
      borderBottomStyle: 'solid',
    },
    thCell: {
      padding: `${fs - 4} ${fs - 3}`,
      fontSize: fs - 2,
      fontWeight: 'bold',
      color: thColor,
      textTransform: 'uppercase',
      borderLeftWidth: thBorderLeft,
      borderLeftColor: opts.accentColor + '40',
      borderLeftStyle: 'solid',
    },
    tdCell: {
      padding: `${fs - 4} ${fs - 3}`,
      fontSize: fs,
      borderBottomWidth: opts.tableStyle === 'minimal' ? 0 : 1,
      borderBottomColor: border,
      borderBottomStyle: 'solid',
      borderLeftWidth: opts.tableStyle === 'bordered' ? 1 : 0,
      borderLeftColor: border,
      borderLeftStyle: 'solid',
    },
    tdCellCenter: {
      padding: `${fs - 4} ${fs - 3}`,
      fontSize: fs,
      textAlign: 'center',
      borderBottomWidth: opts.tableStyle === 'minimal' ? 0 : 1,
      borderBottomColor: border,
      borderBottomStyle: 'solid',
    },
    pill: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 3,
      fontSize: fs - 1,
      fontWeight: 'bold',
    },
    slotLabel: {
      width: 26,
      padding: `${fs - 5} 4`,
      fontSize: fs - 2,
      textAlign: 'center',
      color: '#94a3b8',
      fontWeight: 'bold',
      borderRightWidth: 1,
      borderRightColor: border,
      borderRightStyle: 'solid',
    },
    resourceCard: {
      marginBottom: 8,
      borderWidth: 1,
      borderColor: border,
      borderStyle: 'solid',
      borderRadius: 4,
      overflow: 'hidden',
    },
    resourceCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: `6 10`,
      backgroundColor: opts.rowEvenColor,
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderBottomStyle: 'solid',
    },
    resourceName: {
      fontSize: fs + 1,
      fontWeight: 'bold',
      color: opts.primaryColor,
    },
    resourceCount: {
      marginLeft: 'auto',
      fontSize: fs - 2,
      color: '#64748b',
    },
    resourceEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: `4 10`,
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderBottomStyle: 'solid',
    },
    resourceEntryDate: {
      width: 80,
      fontSize: fs,
      color: '#475569',
    },
    resourceEntryRole: {
      fontSize: fs - 2,
      color: '#64748b',
      marginLeft: 8,
      paddingHorizontal: 5,
      paddingVertical: 1,
      backgroundColor: opts.rowEvenColor,
      borderRadius: 2,
    },
    warningBox: {
      marginTop: 12,
      padding: `8 10`,
      backgroundColor: '#fef3c7',
      borderLeftWidth: 3,
      borderLeftColor: '#f59e0b',
      borderLeftStyle: 'solid',
      borderRadius: 3,
    },
    warningTitle: {
      fontSize: fs - 1,
      fontWeight: 'bold',
      color: '#92400e',
      marginBottom: 4,
    },
    warningItem: {
      fontSize: fs - 1,
      color: '#92400e',
      marginBottom: 2,
    },
    footer: {
      position: 'absolute',
      bottom: Math.floor(margin / 2),
      left: margin,
      right: margin,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: fs - 2,
      color: '#94a3b8',
      borderTopWidth: 1,
      borderTopColor: border,
      borderTopStyle: 'solid',
      paddingTop: 4,
    },
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type Styles = ReturnType<typeof makeStyles>;

const Footer: React.FC<{ opts: ReportDesignOptions; styles: Styles }> = ({ opts, styles }) => (
  <View style={styles.footer}>
    <Text>{opts.footerText || opts.title}</Text>
    {opts.showPageNumbers && (
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    )}
  </View>
);

const CoverPage: React.FC<{ report: PlanningReport; opts: ReportDesignOptions; styles: Styles }> = ({
  report, opts, styles,
}) => {
  const date = new Date(report.generatedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return (
    <Page size={opts.pageSize as any} orientation={opts.orientation} style={[styles.page, { backgroundColor: opts.coverBg }]}>
      <View style={styles.coverPage}>
        <View style={styles.coverAccentBar} />
        <Text style={styles.coverTitle}>{opts.title || report.title}</Text>
        {(opts.subtitle || report.stats.activityTypes.join(', ')) ? (
          <Text style={styles.coverSubtitle}>
            {opts.subtitle || report.stats.activityTypes.join(', ')}
          </Text>
        ) : null}
        <Text style={styles.coverMeta}>Généré le {date}</Text>
        {opts.showSolveTime && report.solveTimeMs !== undefined && (
          <Text style={styles.coverMeta}>Temps de résolution : {formatMs(report.solveTimeMs)}</Text>
        )}
        <View style={styles.coverStatsRow}>
          {[
            { value: report.stats.totalInstances, label: 'instances' },
            { value: report.stats.activityTypes.length, label: 'types' },
            { value: report.stats.totalDays, label: 'jours' },
            { value: report.stats.assignedResources.length, label: 'ressources' },
          ].map(s => (
            <View key={s.label} style={styles.coverStatItem}>
              <Text style={styles.coverStatValue}>{s.value}</Text>
              <Text style={styles.coverStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
};

const CalendarPage: React.FC<{
  report: PlanningReport; opts: ReportDesignOptions;
  styles: Styles; colorIndex: Record<string, number>;
}> = ({ report, opts, styles, colorIndex }) => {
  const { activities, days, slotsPerDay } = report;
  const activeDays = days.length > 0 ? days : Array.from({ length: report.stats.totalDays }, (_, i) => `Jour ${i + 1}`);
  const maxSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot), 1);

  const grid: Record<string, ActivityInstance[]> = {};
  for (const act of activities) {
    const k = `${act.day}-${act.localSlot}`;
    (grid[k] ??= []).push(act);
  }

  return (
    <Page size={opts.pageSize as any} orientation={opts.orientation} style={styles.page}>
      <Text style={styles.sectionHeader}>Calendrier</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.thCell, width: 26 }}>Cr.</Text>
          {activeDays.map((d, i) => (
            <Text key={i} style={{ ...styles.thCell, flex: 1, textAlign: 'center' }}>{d}</Text>
          ))}
        </View>
        {Array.from({ length: maxSlot }, (_, i) => i + 1).map(slot => (
          <View key={slot} style={slot % 2 === 0 ? styles.tableRowEven : styles.tableRow}>
            <Text style={styles.slotLabel}>{slot}</Text>
            {activeDays.map((_, di) => {
              const acts = grid[`${di + 1}-${slot}`] ?? [];
              return (
                <View key={di} style={{
                  flex: 1, padding: '2 4',
                  borderRightWidth: 1,
                  borderRightColor: opts.tableBorderColor + '60',
                  borderRightStyle: 'solid',
                }}>
                  {acts.map(act => {
                    const c = getColor(act.baseName, opts, colorIndex[act.baseName] ?? 0);
                    return (
                      <View key={act.instance} style={{
                        backgroundColor: c + '22',
                        borderLeftWidth: 2,
                        borderLeftColor: c,
                        borderLeftStyle: 'solid',
                        borderRadius: 2,
                        padding: '2 4',
                        marginBottom: 2,
                      }}>
                        <Text style={{ fontSize: opts.bodyFontSize - 1, fontWeight: 'bold', color: c }}>{act.instance}</Text>
                        {act.roles.length > 0 ? (
                          <Text style={{ fontSize: opts.bodyFontSize - 2, color: '#475569' }}>
                            {act.roles.map(r => r.resource).join(', ')}
                          </Text>
                        ) : act.assignments.length > 0 ? (
                          <Text style={{ fontSize: opts.bodyFontSize - 2, color: '#475569' }}>
                            {act.assignments.join(', ')}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Footer opts={opts} styles={styles} />
    </Page>
  );
};

const DetailTablePage: React.FC<{
  report: PlanningReport; opts: ReportDesignOptions;
  styles: Styles; colorIndex: Record<string, number>;
}> = ({ report, opts, styles, colorIndex }) => {
  const { activities } = report;
  const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);
  const fs = opts.bodyFontSize;

  return (
    <Page size={opts.pageSize as any} orientation={opts.orientation} style={styles.page}>
      <Text style={styles.sectionHeader}>Détail des instances</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.thCell, width: 70 }}>Instance</Text>
          <Text style={{ ...styles.thCell, width: 60 }}>Activité</Text>
          <Text style={{ ...styles.thCell, width: 55 }}>Jour</Text>
          <Text style={{ ...styles.thCell, width: 35 }}>Crén.</Text>
          {hasAssignments && <Text style={{ ...styles.thCell, flex: 1 }}>Ressources</Text>}
          {hasAssignments && <Text style={{ ...styles.thCell, flex: 1 }}>Rôles</Text>}
        </View>
        {activities.map((act, idx) => {
          const c = getColor(act.baseName, opts, colorIndex[act.baseName] ?? 0);
          return (
            <View key={act.instance} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowEven}>
              <View style={{ width: 70, ...styles.tdCell }}>
                <View style={{ backgroundColor: c + '22', borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: fs - 1, fontWeight: 'bold', color: c }}>{act.instance}</Text>
                </View>
              </View>
              <Text style={{ ...styles.tdCell, width: 60 }}>{act.baseName}</Text>
              <Text style={{ ...styles.tdCell, width: 55 }}>{act.dayName}</Text>
              <Text style={{ ...styles.tdCellCenter, width: 35 }}>{act.localSlot}</Text>
              {hasAssignments && (
                <Text style={{ ...styles.tdCell, flex: 1 }}>
                  {act.assignments.length > 0 ? act.assignments.join(', ') : '—'}
                </Text>
              )}
              {hasAssignments && (
                <Text style={{ ...styles.tdCell, flex: 1 }}>
                  {act.roles.length > 0 ? act.roles.map(r => `${r.role} → ${r.resource}`).join('\n') : '—'}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <Footer opts={opts} styles={styles} />
    </Page>
  );
};

const ResourcesPage: React.FC<{
  report: PlanningReport; opts: ReportDesignOptions;
  styles: Styles; colorIndex: Record<string, number>;
}> = ({ report, opts, styles, colorIndex }) => {
  const byResource = new Map<string, Array<{ act: ActivityInstance; role?: string }>>();
  for (const act of report.activities) {
    if (act.roles.length > 0) {
      for (const rr of act.roles) {
        (byResource.get(rr.resource) ?? byResource.set(rr.resource, []).get(rr.resource))!.push({ act, role: rr.role });
      }
    } else {
      for (const r of act.assignments) {
        (byResource.get(r) ?? byResource.set(r, []).get(r))!.push({ act });
      }
    }
  }

  if (byResource.size === 0) return null;

  return (
    <Page size={opts.pageSize as any} orientation={opts.orientation} style={styles.page}>
      <Text style={styles.sectionHeader}>Affectations par ressource</Text>
      {Array.from(byResource.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([resource, entries]) => {
          const sorted = [...entries].sort((a, b) =>
            a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot,
          );
          return (
            <View key={resource} style={styles.resourceCard}>
              <View style={styles.resourceCardHeader}>
                <Text style={styles.resourceName}>{resource}</Text>
                <Text style={styles.resourceCount}>{entries.length} affectation{entries.length > 1 ? 's' : ''}</Text>
              </View>
              {sorted.map((e, i) => {
                const c = getColor(e.act.baseName, opts, colorIndex[e.act.baseName] ?? 0);
                return (
                  <View key={i} style={styles.resourceEntry}>
                    <Text style={styles.resourceEntryDate}>{e.act.dayName} · Cr. {e.act.localSlot}</Text>
                    <View style={{
                      backgroundColor: c + '22',
                      borderLeftWidth: 2,
                      borderLeftColor: c,
                      borderLeftStyle: 'solid',
                      borderRadius: 2,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}>
                      <Text style={{ fontSize: opts.bodyFontSize - 1, fontWeight: 'bold', color: c }}>{e.act.instance}</Text>
                    </View>
                    {e.role && <Text style={styles.resourceEntryRole}>{e.role}</Text>}
                  </View>
                );
              })}
            </View>
          );
        })}
      {opts.showWarnings && report.warnings.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠ Avertissements du solveur</Text>
          {report.warnings.map((w, i) => (
            <Text key={i} style={styles.warningItem}>• {w}</Text>
          ))}
        </View>
      )}
      <Footer opts={opts} styles={styles} />
    </Page>
  );
};

// ─── Main document ────────────────────────────────────────────────────────────

interface Props {
  report: PlanningReport;
  opts: ReportDesignOptions;
}

export const ReportDocument: React.FC<Props> = ({ report, opts }) => {
  const styles = useMemo(() => makeStyles(opts), [
    opts.font, opts.bodyFontSize, opts.headerFontSize, opts.pageMargin,
    opts.primaryColor, opts.accentColor, opts.coverBg, opts.rowEvenColor,
    opts.tableBorderColor, opts.tableStyle, opts.headerStyle,
  ]);

  const colorIndex: Record<string, number> = {};
  report.stats.activityTypes.forEach((name, i) => { colorIndex[name] = i; });

  return (
    <Document title={opts.title || report.title} author="Planify" creator="Planify">
      {opts.showCoverPage && (
        <CoverPage report={report} opts={opts} styles={styles} />
      )}
      {opts.showCalendar && report.activities.length > 0 && (
        <CalendarPage report={report} opts={opts} styles={styles} colorIndex={colorIndex} />
      )}
      {opts.showDetailTable && report.activities.length > 0 && (
        <DetailTablePage report={report} opts={opts} styles={styles} colorIndex={colorIndex} />
      )}
      {opts.showResourcesView && (
        <ResourcesPage report={report} opts={opts} styles={styles} colorIndex={colorIndex} />
      )}
    </Document>
  );
};
