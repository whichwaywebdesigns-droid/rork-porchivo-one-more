/**
 * Trust Engine Dashboard — the compliance command center.
 *
 * Shows the live compliance posture, the agentic monitoring loop status,
 * framework scores, control states, drift alerts, remediation actions,
 * and the evidence vault summary.
 *
 * Gated to Enterprise tier only (Scenario B). Non-Enterprise users see
 * an upgrade CTA explaining the Trust Engine value.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  FileText,
  Database,
  Zap,
  ChevronRight,
  CircleDot,
  Layers,
  TrendingUp,
  Clock,
  ArrowRight,
  Download,
} from 'lucide-react-native';
import { palette, space, radius, type as typeSizes, tabularNums } from '@/constants/theme';
import DarkRailHeader from '@/components/DarkRailHeader';
import RailBackButton from '@/components/RailBackButton';
import { useTrustEngine } from '@/store/TrustEngineContext';
import { useApp } from '@/store/AppContext';
import { useAnalytics } from '@/store/AnalyticsContext';
import {
  CONTROL_REGISTRY,
  type ControlState,
  type ControlDefinition,
  type LoopPhase,
  type CompliancePosture,
  type RemediationAction,
  type Framework,
} from '@/lib/trustEngine';
import { TRUST_ENGINE } from '@/config/app';
import { exportTrustEngineReport, type TrustEngineReportInput } from '@/lib/trustEngineReport';
import { log } from '@/lib/logger';

// ─── Phase display config ─────────────────────────────────────────────────────

const PHASE_CONFIG: Record<LoopPhase, { label: string; color: string; icon: typeof Activity }> = {
  idle:        { label: 'STANDBY',         color: '#6B7F99', icon: CircleDot },
  monitoring:  { label: 'MONITORING',      color: '#4A8FE8', icon: Activity },
  collecting:  { label: 'COLLECTING',      color: '#44D882', icon: Database },
  detecting:   { label: 'DETECTING DRIFT', color: '#E8C84A', icon: ShieldAlert },
  remedying:   { label: 'REMEDIATING',     color: '#F07840', icon: ShieldAlert },
  scoring:     { label: 'SCORING',         color: '#4A8FE8', icon: TrendingUp },
  complete:    { label: 'CYCLE COMPLETE',  color: '#44D882', icon: CheckCircle2 },
};

const PHASE_ORDER: LoopPhase[] = ['monitoring', 'collecting', 'detecting', 'remedying', 'scoring', 'complete'];

// ─── Posture score ring ───────────────────────────────────────────────────────

function PostureRing({ score, label }: { score: number; label: string }) {
  const animatedScore = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState<number>(0);

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 1200,
      useNativeDriver: false,
    }).start();
    const listener = animatedScore.addListener(({ value: v }) => setDisplayScore(Math.round(v)));
    return () => animatedScore.removeListener(listener);
  }, [score, animatedScore]);

  const scoreColor =
    label === 'healthy' ? palette.successGreen :
    label === 'warning' ? palette.gold :
    palette.danger;

  return (
    <View style={styles.ringContainer}>
      <View style={styles.ringOuter}>
        <View style={styles.ringInner}>
          <Text style={[styles.ringScore, { color: scoreColor }, tabularNums]}>{displayScore}</Text>
          <Text style={styles.ringLabel}>COMPLIANCE SCORE</Text>
        </View>
      </View>
      <View style={[styles.ringBadge, { backgroundColor: `${scoreColor}20`, borderColor: `${scoreColor}40` }]}>
        <View style={[styles.ringBadgeDot, { backgroundColor: scoreColor }]} />
        <Text style={[styles.ringBadgeText, { color: scoreColor }]}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ─── Phase progress stepper ───────────────────────────────────────────────────

function PhaseStepper({ currentPhase, isRunning }: { currentPhase: LoopPhase; isRunning: boolean }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);

  return (
    <View style={styles.stepperContainer}>
      {PHASE_ORDER.map((phase, idx) => {
        const config = PHASE_CONFIG[phase];
        const isActive = currentPhase === phase;
        const isPast = currentIdx > idx;
        const isUpcoming = currentIdx < idx && currentIdx >= 0;
        const color = isActive ? config.color : isPast ? palette.successGreen : palette.railBorder;

        return (
          <React.Fragment key={phase}>
            {idx > 0 && (
              <View style={[styles.stepperLine, { backgroundColor: isPast ? palette.successGreen : palette.railBorder }]} />
            )}
            <View style={styles.stepperStep}>
              <View style={[
                styles.stepperDot,
                {
                  backgroundColor: isActive ? `${color}25` : isPast ? `${palette.successGreen}20` : 'transparent',
                  borderColor: color,
                },
              ]}>
                {isActive ? (
                  <ActivityIndicator size="small" color={color} />
                ) : isPast ? (
                  <CheckCircle2 size={14} color={palette.successGreen} />
                ) : (
                  <View style={[styles.stepperDotInner, { backgroundColor: isUpcoming ? palette.railBorder : color }]} />
                )}
              </View>
              <Text style={[
                styles.stepperLabel,
                { color: isActive ? config.color : isPast ? palette.railTextMuted : palette.railBorder },
              ]} numberOfLines={1}>
                {config.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Icon size={16} color={color} />
      </View>
      <Text style={[styles.statValue, tabularNums]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Framework score bar ──────────────────────────────────────────────────────

function FrameworkBar({ framework, score }: { framework: Framework; score: number }) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState<`${number}%`>('0%');

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: score,
      duration: 800,
      useNativeDriver: false,
    }).start();
    const listener = barAnim.addListener(({ value: v }) => {
      setWidth(`${Math.round(v)}%`);
    });
    return () => barAnim.removeListener(listener);
  }, [score, barAnim]);

  const barColor = score >= 85 ? palette.successGreen : score >= 70 ? palette.gold : palette.danger;

  return (
    <View style={styles.frameworkRow}>
      <Text style={styles.frameworkName} numberOfLines={1}>{framework}</Text>
      <View style={styles.frameworkBarTrack}>
        <Animated.View style={[styles.frameworkBarFill, { width, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.frameworkScore, tabularNums]}>{score}%</Text>
    </View>
  );
}

// ─── Control row ──────────────────────────────────────────────────────────────

function ControlRow({ state, def }: { state: ControlState; def: ControlDefinition }) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const statusConfig = {
    pass: { icon: CheckCircle2, color: palette.successGreen, label: 'PASS' },
    fail: { icon: XCircle, color: palette.danger, label: 'FAIL' },
    warning: { icon: AlertTriangle, color: palette.gold, label: 'WARN' },
    unknown: { icon: CircleDot, color: palette.railTextMuted, label: 'UNKNOWN' },
  };
  const config = statusConfig[state.status];
  const StatusIcon = config.icon;

  return (
    <TouchableOpacity
      style={styles.controlRow}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setExpanded(!expanded);
      }}
      activeOpacity={0.8}
    >
      <View style={[styles.controlIcon, { backgroundColor: `${config.color}15` }]}>
        <StatusIcon size={14} color={config.color} />
      </View>
      <View style={styles.controlContent}>
        <Text style={styles.controlName} numberOfLines={expanded ? 0 : 1}>{def.name}</Text>
        <Text style={styles.controlRef}>{def.framework} · {def.controlRef}</Text>
        {expanded && (
          <View style={styles.controlDetailWrap}>
            <Text style={styles.controlDetailText}>{state.detail}</Text>
            {state.drifted && (
              <View style={styles.driftBadge}>
                <ShieldAlert size={11} color={palette.gold} />
                <Text style={styles.driftBadgeText}>DRIFTED</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={[styles.controlStatusPill, { backgroundColor: `${config.color}15`, borderColor: `${config.color}30` }]}>
        <Text style={[styles.controlStatusText, { color: config.color }]}>{config.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Remediation card ─────────────────────────────────────────────────────────

function RemediationCard({
  remediation,
  onAck,
}: {
  remediation: RemediationAction;
  onAck: (id: string) => void;
}) {
  const sevColor =
    remediation.severity === 'critical' ? palette.danger :
    remediation.severity === 'warning' ? palette.gold :
    palette.railTextMuted;

  return (
    <View style={[styles.remediationCard, { borderColor: `${sevColor}30` }]}>
      <View style={styles.remediationHeader}>
        <View style={[styles.remediationSev, { backgroundColor: `${sevColor}15` }]}>
          <ShieldAlert size={12} color={sevColor} />
          <Text style={[styles.remediationSevText, { color: sevColor }]}>{remediation.severity.toUpperCase()}</Text>
        </View>
        <Text style={styles.remediationTime}>
          {new Date(remediation.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.remediationDesc}>{remediation.description}</Text>
      <View style={styles.remediationSteps}>
        {remediation.steps.map((step, i) => (
          <View key={i} style={styles.remediationStep}>
            <View style={[styles.remediationStepNum, { backgroundColor: `${sevColor}15` }]}>
              <Text style={[styles.remediationStepNumText, { color: sevColor }]}>{i + 1}</Text>
            </View>
            <Text style={styles.remediationStepText}>{step}</Text>
          </View>
        ))}
      </View>
      {!remediation.acknowledged ? (
        <TouchableOpacity
          style={styles.remediationAckBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onAck(remediation.id);
          }}
          activeOpacity={0.8}
        >
          <CheckCircle2 size={14} color={palette.successGreen} />
          <Text style={styles.remediationAckText}>Acknowledge</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.remediationAcked}>
          <CheckCircle2 size={14} color={palette.successGreen} />
          <Text style={styles.remediationAckedText}>Acknowledged</Text>
        </View>
      )}
    </View>
  );
}

// ─── Locked screen (non-Enterprise) ───────────────────────────────────────────

function LockedScreen({ onUpgrade }: { onUpgrade: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.lockedContainer}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <LinearGradient
          colors={['#1A2B4A', '#122038', '#0A1428'] as [string, string, string]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.lockedHero}
        >
          <View style={styles.lockedIconWrap}>
            <Lock size={40} color={palette.gold} />
          </View>
          <Text style={styles.lockedTitle}>WhichWay Trust Engine</Text>
          <Text style={styles.lockedSubtitle}>
            Continuous compliance automation — SOC 2, HIPAA, ISO 27001, and PCI DSS
            monitoring with an agentic evidence collection loop.
          </Text>
          <Text style={styles.lockedTier}>Enterprise tier exclusive</Text>
        </LinearGradient>
      </Animated.View>

      <View style={styles.lockedFeatures}>
        {[
          { icon: Activity, label: 'Agentic monitoring loop — 24/7 control evaluation' },
          { icon: Database, label: 'Evidence Vault — hash-chained, audit-grade artifacts' },
          { icon: ShieldAlert, label: 'Real-time drift detection across your stack' },
          { icon: FileText, label: 'Auto-generated remediation actions' },
          { icon: TrendingUp, label: 'Live compliance posture score & framework breakdown' },
        ].map((feature, i) => (
          <View key={i} style={styles.lockedFeature}>
            <View style={styles.lockedFeatureIcon}>
              <feature.icon size={16} color={palette.gold} />
            </View>
            <Text style={styles.lockedFeatureText}>{feature.label}</Text>
            <CheckCircle2 size={14} color={palette.successGreen} />
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.lockedCTA} onPress={onUpgrade} activeOpacity={0.88}>
        <LinearGradient
          colors={['#C8941E', '#A87818'] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.lockedCTAGradient}
        >
          <Shield size={18} color="#FFFFFF" />
          <Text style={styles.lockedCTAText}>Upgrade to Enterprise</Text>
          <ArrowRight size={16} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
      <Text style={styles.lockedNote}>
        Enterprise starts at $3,000/yr — includes the Trust Engine, HOA-wide
        coverage, and the community dashboard.
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TrustEngineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { track } = useAnalytics();
  const {
    hasAccess,
    isRunning,
    phase,
    posture,
    controlStates,
    remediations,
    cycleHistory,
    evidenceCount,
    evidenceArtifacts,
    chainIntegrity,
    activeFramework,
    setActiveFramework,
    startLoop,
    stopLoop,
    runCycle,
    acknowledgeRemediation,
  } = useTrustEngine();

  const mountAnim = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<'overview' | 'controls' | 'evidence'>('overview');
  const [isManualRunning, setIsManualRunning] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Start the loop automatically when the screen mounts (if user has access)
  useEffect(() => {
    if (hasAccess) {
      startLoop();
      track('trust_engine_view', { tier: 'enterprise' });
    }
    Animated.timing(mountAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const handleManualCycle = useCallback(async () => {
    if (isManualRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsManualRunning(true);
    track('trust_engine_manual_cycle');
    try {
      await runCycle();
    } finally {
      setIsManualRunning(false);
    }
  }, [isManualRunning, runCycle, track]);

  const handleUpgrade = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track('trust_engine_upgrade_tap');
    router.push('/upgrade?trigger=trust_engine' as any);
  }, [router, track]);

  const handleExportReport = useCallback(async () => {
    if (!posture || isExporting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsExporting(true);
    track('trust_engine_report_export', { score: posture.overallScore, evidence: evidenceCount });
    try {
      const input: TrustEngineReportInput = {
        generatedAt: new Date().toISOString(),
        posture,
        controlStates,
        remediations,
        cycleHistory,
        evidence: evidenceArtifacts,
        chainIntegrity,
        lastCycle: cycleHistory[cycleHistory.length - 1],
      };
      await exportTrustEngineReport(input);
    } catch (e) {
      // Error is already logged in the report module; UI silently recovers.
      log('[TrustEngine] Report export failed', e);
    } finally {
      setIsExporting(false);
    }
  }, [posture, controlStates, remediations, cycleHistory, evidenceArtifacts, chainIntegrity, evidenceCount, isExporting, track]);

  // Filtered controls for active framework
  const frameworkControls = controlStates.filter((s) => {
    const def = CONTROL_REGISTRY.find((d) => d.id === s.controlId);
    return def?.framework === activeFramework;
  });

  // Unacknowledged remediations
  const openRemediations = remediations.filter((r) => !r.acknowledged);
  const ackedRemediations = remediations.filter((r) => r.acknowledged);

  // Last cycle
  const lastCycle = cycleHistory[cycleHistory.length - 1];

  // ── Locked screen for non-Enterprise users ──────────────────────────────
  if (!hasAccess) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DarkRailHeader status="LOCKED" dotColor={palette.gold} />
        <Animated.View style={[styles.topBar, { opacity: mountAnim }]}>
          <RailBackButton onPress={() => router.back()} testID="trust-engine-back" />
          <Text style={styles.screenTitle}>Trust Engine</Text>
          <View style={styles.topBarSpacer} />
        </Animated.View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <LockedScreen onUpgrade={handleUpgrade} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <DarkRailHeader
        status={
          isRunning ? (phase === 'idle' ? 'READY' : PHASE_CONFIG[phase]?.label ?? 'RUNNING') : 'STOPPED'
        }
        dotColor={
          phase === 'complete' ? palette.successGreen :
          phase === 'remedying' || phase === 'detecting' ? palette.gold :
          phase === 'monitoring' || phase === 'scoring' ? '#4A8FE8' :
          palette.railTextMuted
        }
      />

      <Animated.View style={[styles.topBar, { opacity: mountAnim }]}>
        <RailBackButton onPress={() => router.back()} testID="trust-engine-back" />
        <Text style={styles.screenTitle}>Trust Engine</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={isRunning ? stopLoop : startLoop}
            activeOpacity={0.7}
            style={styles.loopToggle}
          >
            <View style={[styles.loopToggleDot, { backgroundColor: isRunning ? palette.successGreen : palette.railTextMuted }]} />
            <Text style={styles.loopToggleText}>{isRunning ? 'LIVE' : 'OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExportReport}
            disabled={isExporting || !posture}
            activeOpacity={0.7}
            style={[styles.exportBtn, (isExporting || !posture) && styles.exportBtnDisabled]}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={palette.railTextMuted} />
            ) : (
              <Download size={14} color={palette.railText} />
            )}
            <Text style={styles.exportBtnText}>{isExporting ? 'Saving…' : 'Export'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isManualRunning}
            onRefresh={handleManualCycle}
            tintColor={palette.railText}
            colors={[palette.railAccent]}
          />
        }
      >
        {/* ── Posture Hero ────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: mountAnim }}>
          <LinearGradient
            colors={
              posture?.label === 'healthy'
                ? ['#0D2818', '#0A1F12', '#08170D'] as [string, string, string]
                : posture?.label === 'warning'
                ? ['#2A2310', '#1F1A08', '#161204'] as [string, string, string]
                : ['#2A0D0D', '#200808', '#180404'] as [string, string, string]
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.postureHero}
          >
            <View style={styles.postureHeaderRow}>
              <View style={styles.postureTitleWrap}>
                <ShieldCheck size={20} color={palette.railText} />
                <Text style={styles.postureTitle}>Compliance Posture</Text>
              </View>
              {lastCycle && (
                <Text style={styles.postureCycle}>Cycle #{lastCycle.cycleNumber}</Text>
              )}
            </View>

            {posture ? (
              <PostureRing score={posture.overallScore} label={posture.label} />
            ) : (
              <View style={styles.postureLoading}>
                <ActivityIndicator size="large" color={palette.railTextMuted} />
                <Text style={styles.postureLoadingText}>Initializing monitoring loop…</Text>
              </View>
            )}

            {/* Quick stats */}
            {posture && (
              <View style={styles.postureStatsRow}>
                <StatTile icon={CheckCircle2} label="Passing" value={posture.passingControls} color={palette.successGreen} />
                <StatTile icon={AlertTriangle} label="Warnings" value={posture.warningControls} color={palette.gold} />
                <StatTile icon={XCircle} label="Failing" value={posture.failingControls} color={palette.danger} />
                <StatTile icon={ShieldAlert} label="Drift" value={posture.driftEvents} color={palette.warmOrange} />
              </View>
            )}

            {/* Audit readiness + evidence count */}
            {posture && (
              <View style={styles.postureMetaRow}>
                <View style={styles.postureMetaItem}>
                  <Clock size={14} color={palette.railTextMuted} />
                  <Text style={styles.postureMetaLabel}>Audit ready in</Text>
                  <Text style={styles.postureMetaValue}>
                    {posture.daysToAuditReady === 0 ? 'Ready now' : `${posture.daysToAuditReady}d`}
                  </Text>
                </View>
                <View style={styles.postureMetaDivider} />
                <View style={styles.postureMetaItem}>
                  <Database size={14} color={palette.railTextMuted} />
                  <Text style={styles.postureMetaLabel}>Evidence</Text>
                  <Text style={styles.postureMetaValue}>{evidenceCount} artifacts</Text>
                </View>
                <View style={styles.postureMetaDivider} />
                <View style={styles.postureMetaItem}>
                  <Layers size={14} color={palette.railTextMuted} />
                  <Text style={styles.postureMetaLabel}>Controls</Text>
                  <Text style={styles.postureMetaValue}>{posture.totalControls} total</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── Agentic Loop Status ─────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>AGENTIC MONITORING LOOP</Text>
            <TouchableOpacity
              onPress={handleManualCycle}
              disabled={isManualRunning}
              activeOpacity={0.7}
              style={styles.runCycleBtn}
            >
              {isManualRunning ? (
                <ActivityIndicator size="small" color={palette.railTextMuted} />
              ) : (
                <RefreshCw size={13} color={palette.railTextMuted} />
              )}
              <Text style={styles.runCycleText}>{isManualRunning ? 'Running…' : 'Run cycle'}</Text>
            </TouchableOpacity>
          </View>
          <PhaseStepper currentPhase={phase} isRunning={isRunning} />
        </View>

        {/* ── Tab selector ─────────────────────────────────────────────── */}
        <View style={styles.tabSelector}>
          {(['overview', 'controls', 'evidence'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab(tab);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'overview' ? 'Overview' : tab === 'controls' ? 'Controls' : 'Evidence'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Framework scores */}
            {posture?.frameworkScores && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>FRAMEWORK SCORES</Text>
                <View style={styles.card}>
                  {TRUST_ENGINE.frameworks.map((fw) => (
                    <FrameworkBar
                      key={fw}
                      framework={fw}
                      score={posture.frameworkScores[fw] ?? 0}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Remediations */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  REMEDIATION ACTIONS {openRemediations.length > 0 && `(${openRemediations.length} OPEN)`}
                </Text>
              </View>
              {openRemediations.length > 0 ? (
                <View style={styles.remediationList}>
                  {openRemediations.slice(0, 5).map((rem) => (
                    <RemediationCard key={rem.id} remediation={rem} onAck={acknowledgeRemediation} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <CheckCircle2 size={24} color={palette.successGreen} />
                  <Text style={styles.emptyStateText}>All controls passing — no remediation needed.</Text>
                </View>
              )}
              {ackedRemediations.length > 0 && (
                <Text style={styles.ackedCount}>{ackedRemediations.length} acknowledged</Text>
              )}
            </View>

            {/* Recent cycles */}
            {cycleHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>RECENT CYCLES</Text>
                <View style={styles.card}>
                  {cycleHistory.slice(-5).reverse().map((cycle) => (
                    <View key={cycle.cycleNumber} style={styles.cycleRow}>
                      <Text style={styles.cycleNum}>#{cycle.cycleNumber}</Text>
                      <Text style={styles.cycleDetail}>
                        {cycle.controlsEvaluated} controls · {cycle.evidenceCollected} evidence
                      </Text>
                      {cycle.driftDetected > 0 && (
                        <View style={styles.cycleDriftBadge}>
                          <ShieldAlert size={10} color={palette.gold} />
                          <Text style={styles.cycleDriftText}>{cycle.driftDetected} drift</Text>
                        </View>
                      )}
                      <Text style={[styles.cycleScore, tabularNums]}>{cycle.postureScore}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── Controls tab ─────────────────────────────────────────────── */}
        {activeTab === 'controls' && (
          <View style={styles.section}>
            {/* Framework filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.frameworkFilterScroll}
              contentContainerStyle={styles.frameworkFilterContent}
            >
              {TRUST_ENGINE.frameworks.map((fw) => (
                <TouchableOpacity
                  key={fw}
                  style={[
                    styles.frameworkFilterChip,
                    activeFramework === fw && styles.frameworkFilterChipActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveFramework(fw);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.frameworkFilterText,
                    activeFramework === fw && styles.frameworkFilterTextActive,
                  ]}>
                    {fw}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Control list */}
            <View style={styles.card}>
              {frameworkControls.length > 0 ? (
                frameworkControls.map((state) => {
                  const def = CONTROL_REGISTRY.find((d) => d.id === state.controlId);
                  if (!def) return null;
                  return <ControlRow key={state.controlId} state={state} def={def} />;
                })
              ) : (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={palette.railTextMuted} />
                  <Text style={styles.emptyStateText}>Evaluating controls…</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Evidence tab ─────────────────────────────────────────────── */}
        {activeTab === 'evidence' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>EVIDENCE VAULT</Text>
              <Text style={styles.evidenceCount}>{evidenceCount} artifacts</Text>
            </View>
            <View style={styles.card}>
              {evidenceCount > 0 ? (
                controlStates
                  .filter((s) => s.status === 'pass')
                  .slice(0, 20)
                  .map((state) => {
                    const def = CONTROL_REGISTRY.find((d) => d.id === state.controlId);
                    if (!def) return null;
                    return (
                      <View key={state.controlId} style={styles.evidenceRow}>
                        <View style={styles.evidenceIcon}>
                          <Database size={14} color={palette.successGreen} />
                        </View>
                        <View style={styles.evidenceContent}>
                          <Text style={styles.evidenceName} numberOfLines={1}>{def.name}</Text>
                          <Text style={styles.evidenceTime}>
                            {def.framework} · {new Date(state.lastChecked).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={styles.evidenceHash}>
                          <Text style={styles.evidenceHashText}>VERIFIED</Text>
                        </View>
                      </View>
                    );
                  })
              ) : (
                <View style={styles.emptyState}>
                  <Database size={24} color={palette.railTextMuted} />
                  <Text style={styles.emptyStateText}>No evidence collected yet. Run a monitoring cycle to begin.</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.railBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    color: palette.railText,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  topBarSpacer: {
    width: 40,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.railBorder,
    backgroundColor: palette.railSurface,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    color: palette.railText,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  loopToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.railBorder,
    backgroundColor: palette.railSurface,
  },
  loopToggleDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
  },
  loopToggleText: {
    color: palette.railTextMuted,
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xl,
  },

  // Posture hero
  postureHero: {
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  postureHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  postureTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postureTitle: {
    color: palette.railText,
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  postureCycle: {
    color: palette.railTextMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  postureLoading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 30,
  },
  postureLoadingText: {
    color: palette.railTextMuted,
    fontSize: 13,
    fontWeight: '500' as const,
  },

  // Posture ring
  ringContainer: {
    alignItems: 'center',
    gap: 14,
  },
  ringOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringScore: {
    fontSize: 52,
    fontWeight: '900' as const,
    letterSpacing: -2,
  },
  ringLabel: {
    color: palette.railTextMuted,
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  ringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  ringBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
  },
  ringBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },

  // Posture stats
  postureStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    width: '100%',
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: palette.railText,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  statLabel: {
    color: palette.railTextMuted,
    fontSize: 9,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // Posture meta
  postureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  postureMetaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  postureMetaLabel: {
    color: palette.railTextMuted,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  postureMetaValue: {
    color: palette.railText,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  postureMetaDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Sections
  section: {
    gap: space.sm,
  },
  sectionLabel: {
    color: palette.railTextMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.railBorder,
    backgroundColor: palette.railSurface,
  },
  runCycleText: {
    color: palette.railTextMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },

  // Phase stepper
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepperStep: {
    alignItems: 'center',
    gap: 4,
  },
  stepperDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotInner: {
    width: 5,
    height: 5,
    borderRadius: 5,
  },
  stepperLabel: {
    fontSize: 8,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    maxWidth: 60,
    textAlign: 'center' as const,
  },
  stepperLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
    marginBottom: 14,
  },

  // Card
  card: {
    backgroundColor: palette.railSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.railBorder,
    overflow: 'hidden' as const,
  },

  // Framework bars
  frameworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  frameworkName: {
    flex: 1,
    color: palette.railText,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  frameworkBarTrack: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden' as const,
  },
  frameworkBarFill: {
    height: 6,
    borderRadius: 3,
  },
  frameworkScore: {
    color: palette.railText,
    fontSize: 13,
    fontWeight: '700' as const,
    minWidth: 40,
    textAlign: 'right' as const,
  },

  // Tabs
  tabSelector: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: palette.railSurface,
    borderWidth: 1,
    borderColor: palette.railBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabText: {
    color: palette.railTextMuted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  tabTextActive: {
    color: palette.railText,
    fontWeight: '700' as const,
  },

  // Control rows
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.railBorder,
  },
  controlIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlContent: {
    flex: 1,
    gap: 2,
  },
  controlName: {
    color: palette.railText,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  controlRef: {
    color: palette.railTextMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  controlDetailWrap: {
    marginTop: 6,
    gap: 6,
  },
  controlDetailText: {
    color: palette.railTextMuted,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 17,
  },
  driftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: `${palette.gold}15`,
  },
  driftBadgeText: {
    color: palette.gold,
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  controlStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  controlStatusText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },

  // Remediation
  remediationList: {
    gap: 10,
  },
  remediationCard: {
    backgroundColor: palette.railSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  remediationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remediationSev: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  remediationSevText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },
  remediationTime: {
    color: palette.railTextMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  remediationDesc: {
    color: palette.railText,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  remediationSteps: {
    gap: 8,
  },
  remediationStep: {
    flexDirection: 'row',
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  remediationStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  remediationStepNumText: {
    fontSize: 10,
    fontWeight: '800' as const,
  },
  remediationStepText: {
    flex: 1,
    color: palette.railTextMuted,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 17,
  },
  remediationAckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${palette.successGreen}30`,
    backgroundColor: `${palette.successGreen}08`,
  },
  remediationAckText: {
    color: palette.successGreen,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  remediationAcked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  remediationAckedText: {
    color: palette.railTextMuted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  ackedCount: {
    color: palette.railTextMuted,
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 8,
    textAlign: 'center' as const,
  },

  // Cycle history
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.railBorder,
  },
  cycleNum: {
    color: palette.railTextMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    minWidth: 36,
  },
  cycleDetail: {
    flex: 1,
    color: palette.railText,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  cycleDriftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cycleDriftText: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  cycleScore: {
    color: palette.railText,
    fontSize: 14,
    fontWeight: '800' as const,
  },

  // Framework filter
  frameworkFilterScroll: {
    flexGrow: 0,
  },
  frameworkFilterContent: {
    gap: 8,
    paddingRight: 16,
  },
  frameworkFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.railBorder,
    backgroundColor: palette.railSurface,
  },
  frameworkFilterChipActive: {
    borderColor: `${palette.railAccent}50`,
    backgroundColor: `${palette.railAccent}15`,
  },
  frameworkFilterText: {
    color: palette.railTextMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  frameworkFilterTextActive: {
    color: palette.railText,
    fontWeight: '700' as const,
  },

  // Evidence
  evidenceCount: {
    color: palette.railTextMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.railBorder,
  },
  evidenceIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.successGreen}12`,
  },
  evidenceContent: {
    flex: 1,
    gap: 2,
  },
  evidenceName: {
    color: palette.railText,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  evidenceTime: {
    color: palette.railTextMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  evidenceHash: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: `${palette.successGreen}12`,
  },
  evidenceHashText: {
    color: palette.successGreen,
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    color: palette.railTextMuted,
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    lineHeight: 18,
  },

  // Locked screen
  lockedContainer: {
    gap: space.xl,
    paddingTop: space.md,
  },
  lockedHero: {
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  lockedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.gold}15`,
    borderWidth: 1.5,
    borderColor: `${palette.gold}30`,
  },
  lockedTitle: {
    color: palette.railText,
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    textAlign: 'center' as const,
  },
  lockedSubtitle: {
    color: palette.railTextMuted,
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  lockedTier: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  lockedFeatures: {
    gap: 10,
  },
  lockedFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: palette.railSurface,
    borderWidth: 1,
    borderColor: palette.railBorder,
  },
  lockedFeatureIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.gold}12`,
  },
  lockedFeatureText: {
    flex: 1,
    color: palette.railText,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  lockedCTA: {
    borderRadius: radius.lg,
    overflow: 'hidden' as const,
  },
  lockedCTAGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
  },
  lockedCTAText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  lockedNote: {
    color: palette.railTextMuted,
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
