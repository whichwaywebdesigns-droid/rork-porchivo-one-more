/**
 * TrustEngineContext — manages the agentic monitoring loop lifecycle
 * and exposes compliance posture to the app.
 *
 * The loop starts automatically when an Enterprise-tier user opens the
 * Trust Engine dashboard, and stops when they navigate away. The provider
 * holds the TrustEngineLoop instance and exposes reactive state to consumers.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useApp } from '@/store/AppContext';
import { capabilitiesForTier } from '@/lib/tiers';
import {
  TrustEngineLoop,
  EvidenceVault,
  type LoopPhase,
  type CompliancePosture,
  type ControlState,
  type RemediationAction,
  type LoopCycleResult,
  type EvidenceArtifact,
  type Framework,
  type PostureLabel,
} from '@/lib/trustEngine';
import { TRUST_ENGINE } from '@/config/app';
import { log } from '@/lib/logger';

export const [TrustEngineProvider, useTrustEngine] = createContextHook(() => {
  const { tier } = useApp();
  const capabilities = capabilitiesForTier(tier);

  const loopRef = useRef<TrustEngineLoop | null>(null);
  const vaultRef = useRef<EvidenceVault | null>(null);

  // Initialize the loop and vault once
  if (!loopRef.current) {
    vaultRef.current = new EvidenceVault();
    loopRef.current = new TrustEngineLoop(vaultRef.current);
  }

  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [posture, setPosture] = useState<CompliancePosture | null>(null);
  const [controlStates, setControlStates] = useState<ControlState[]>([]);
  const [remediations, setRemediations] = useState<RemediationAction[]>([]);
  const [cycleHistory, setCycleHistory] = useState<LoopCycleResult[]>([]);
  const [activeFramework, setActiveFramework] = useState<Framework>(TRUST_ENGINE.defaultFramework);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [evidenceArtifacts, setEvidenceArtifacts] = useState<EvidenceArtifact[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<boolean>(true);

  // Subscribe to phase changes from the loop
  useEffect(() => {
    const loop = loopRef.current;
    if (!loop) return;

    const unsubscribe = loop.onPhaseChange((newPhase, data) => {
      setPhase(newPhase);

      if (newPhase === 'complete' && data && typeof data === 'object') {
        const result = data as {
          result: LoopCycleResult;
          posture: CompliancePosture;
          controlStates: ControlState[];
          remediations: RemediationAction[];
        };
        setPosture(result.posture);
        setControlStates(result.controlStates);
        setRemediations(result.remediations);
        setCycleHistory((prev) => [...prev, result.result].slice(-100));
        setEvidenceCount(loop.getVault().count());
        setEvidenceArtifacts(loop.getVault().getArtifacts({ limit: 200 }));
        setChainIntegrity(loop.getVault().verifyChain());
      }
    });

    return unsubscribe;
  }, []);

  /** Starts the monitoring loop */
  const startLoop = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.start();
    setIsRunning(true);
  }, []);

  /** Stops the monitoring loop */
  const stopLoop = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.stop();
    setIsRunning(false);
    setPhase('idle');
  }, []);

  /** Manually triggers a single cycle */
  const runCycle = useCallback(async () => {
    const loop = loopRef.current;
    if (!loop) return;
    await loop.runCycle();
    // Sync state after manual cycle
    setPosture(loop.getPosture());
    setControlStates(loop.getControlStates());
    setRemediations(loop.getRemediations());
    setCycleHistory(loop.getCycleHistory());
    setEvidenceCount(loop.getVault().count());
    setEvidenceArtifacts(loop.getVault().getArtifacts({ limit: 200 }));
    setChainIntegrity(loop.getVault().verifyChain());
  }, []);

  /** Acknowledges a remediation action */
  const acknowledgeRemediation = useCallback((id: string) => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.acknowledgeRemediation(id);
    setRemediations(loop.getRemediations());
  }, []);

  /** Returns evidence artifacts, optionally filtered */
  const getEvidence = useCallback((filter?: {
    controlId?: string;
    framework?: Framework;
    limit?: number;
  }): EvidenceArtifact[] => {
    const vault = vaultRef.current;
    if (!vault) return [];
    return vault.getArtifacts(filter);
  }, []);

  // Derived: whether the user has access to the Trust Engine
  const hasAccess = capabilities.trustEngine;

  // Derived: posture label color
  const postureLabel: PostureLabel | null = posture?.label ?? null;

  // Derived: filtered control states by active framework
  const frameworkControlStates = useMemo(() => {
    return controlStates.filter((s) => {
      // Map control ID to framework via the control registry
      // We import lazily to avoid circular deps
      return true; // Filter happens in the component via CONTROL_REGISTRY
    });
  }, [controlStates]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      loopRef.current?.stop();
    };
  }, []);

  return {
    hasAccess,
    isRunning,
    phase,
    posture,
    postureLabel,
    controlStates,
    remediations,
    cycleHistory,
    activeFramework,
    evidenceCount,
    evidenceArtifacts,
    chainIntegrity,
    setActiveFramework,
    startLoop,
    stopLoop,
    runCycle,
    acknowledgeRemediation,
    getEvidence,
  };
});
