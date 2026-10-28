import { performance } from 'node:perf_hooks';

export function measuredRun() {
  const start = performance.now(), startedAt = new Date().toISOString(), phasesMs = {};
  return {
    startedAt, phasesMs,
    elapsedMs: () => Math.max(0, Math.round(performance.now() - start)),
    async phase(name, operation) {
      const began = performance.now();
      try { return await operation(); }
      finally { phasesMs[name] = Math.max(0, Math.round(performance.now() - began)); }
    },
  };
}
export function recoveryTargets(env = process.env) {
  const setting = name => {
    if (env[name] === undefined || env[name] === '') return null;
    if (!/^[1-9][0-9]*$/.test(env[name]) || !Number.isSafeInteger(Number(env[name])) || Number(env[name]) > 604800) throw new Error('DR targets must be positive whole seconds up to seven days');
    return Number(env[name]) * 1000;
  };
  return { isolatedRestoreTargetMs: setting('SERS_DR_TARGET_RESTORE_SECONDS'), backupFreshnessTargetMs: setting('SERS_DR_TARGET_BACKUP_AGE_SECONDS'), source: 'operator-configured targets; not production guarantees' };
}
export function recoveryObservations(manifest, startedAt, durationMs, targets = recoveryTargets()) {
  const start = Date.parse(startedAt), snapshot = Date.parse(manifest.measurement?.quiescenceObservedAt || manifest.createdAt);
  if (!Number.isFinite(start) || !Number.isFinite(snapshot) || snapshot > start + 5000 || !Number.isSafeInteger(durationMs) || durationMs < 0) throw new Error('Invalid recovery measurement timestamps or duration');
  const backupAgeAtRestoreStartMs = Math.max(0, start - snapshot);
  return {
    scope: manifest.sourceDatabase === 'sers_demo' ? 'synthetic fixture' : 'staging dataset',
    restorableSnapshotObservedAt: new Date(snapshot).toISOString(),
    backupAgeAtRestoreStartMs,
    isolatedRestoreDurationMs: durationMs,
    actualLostCommits: null,
    fullServiceRtoMeasured: false,
    limitations: 'Backup age measures freshness, not actual lost writes. Restore duration excludes incident detection, provisioning, traffic cutover and OAuth validation.',
    targets,
    checks: {
      isolatedRestoreWithinTarget: targets.isolatedRestoreTargetMs === null ? null : durationMs <= targets.isolatedRestoreTargetMs,
      backupFreshnessWithinTarget: targets.backupFreshnessTargetMs === null ? null : backupAgeAtRestoreStartMs <= targets.backupFreshnessTargetMs,
    },
  };
}
