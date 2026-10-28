// Readiness should expose no credentials, paths or database contents.
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || '3000'}/readyz`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) process.exitCode = 1;
} catch { process.exitCode = 1; }
