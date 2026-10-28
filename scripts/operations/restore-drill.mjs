import { mkdtemp, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { command, compose, identifier, restoreName, sql, tableCounts, tableChecksums, verifiedManifest } from './ops-common.mjs';
import { extractEvidenceArchive } from './archive.mjs';
import { measuredRun, recoveryTargets, recoveryObservations } from './dr-observations.mjs';

async function main() {
  const measurement = measuredRun(), targets = recoveryTargets();
  const directory = process.argv[2];
  if (!directory || !path.isAbsolute(directory)) throw new Error('Provide an absolute completed backup directory');
  const manifest = await measurement.phase('verifyBackupDigests', () => verifiedManifest(directory));
  const database = restoreName(`sers_restore_${randomBytes(12).toString('hex')}`);
  const evidence = await mkdtemp(path.join(tmpdir(), 'sers-restore-'));
  const drillUser = `sersdrill_${randomBytes(8).toString('hex')}`;
  const drillPassword = randomBytes(32).toString('hex');
  let created = false, userCreated = false, result;
  try {
    await measurement.phase('databaseSetup', async () => {
    await sql(`CREATE DATABASE ${identifier(database)} CHARACTER SET utf8mb4;`);
    created = true;
    await sql(`CREATE USER '${drillUser}'@'localhost' IDENTIFIED BY '${drillPassword}';`);
    userCreated = true;
    await sql(`GRANT ALL ON ${identifier(database)}.* TO '${drillUser}'@'localhost';`);
    });
    // Import through a user that has no rights on the source database. Even an
    // altered dump cannot drop or overwrite staging/production tables.
    await measurement.phase('databaseImport', () => compose(['exec', '-T', 'mysql', 'sh', '-c', `IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql --binary-mode=1 --local-infile=0 -u${drillUser} --database=${database}`], { inputFile: path.join(directory, 'database.sql'), inputPrefix: drillPassword + '\n' }));
    const restored = await measurement.phase('restoredCounts', () => tableCounts(database));
    if (JSON.stringify(restored) !== JSON.stringify(manifest.tableCounts)) throw new Error('Restored table counts do not match the backup');
    if (JSON.stringify(await measurement.phase('restoredChecksums', () => tableChecksums(database, restored))) !== JSON.stringify(manifest.tableChecksums)) throw new Error('Restored row checksums do not match the backup');
    // Extract into a fresh throwaway directory. Reject links/devices/traversal.
    await measurement.phase('archiveExtraction', () => extractEvidenceArchive(path.join(directory, 'evidence.tar.gz'), evidence));
    const verified = await measurement.phase('privateContentVerification', async () => {
    const uploads = await sql("SELECT JSON_OBJECT('kind','upload','key',i.objectKey,'assetKey',a.storageKey,'version',i.objectVersion,'bytes',i.actualBytes,'sha256',i.sha256) FROM upload_intents i LEFT JOIN assets a ON a.id=i.assetId WHERE i.state='ready' ORDER BY i.id LIMIT 100001;", database);
    const outputs = await sql("SELECT JSON_OBJECT('kind','output','storageKey',storageKey) FROM outputs WHERE visibility='private' AND type IN ('pdf','docx') AND storageKey IS NOT NULL AND revokedAt IS NULL ORDER BY id LIMIT 100001;", database);
      return JSON.parse(await command(process.execPath, ['--import', 'tsx', 'scripts/operations/verify-restored-evidence.mts', evidence], { input: uploads + '\n' + outputs }));
    });
    result = { sourceDatabase: manifest.sourceDatabase, restoredTables: Object.keys(restored).length, dataIntegrityPassed: true, dataCountsMatch: true, rowChecksumsMatch: true, archiveIntegrityVerified: true, privateContentVerified: verified, productionDatabaseModified: false };
  } finally {
    const cleanup = await measurement.phase('cleanup', () => Promise.allSettled([
      ...(userCreated ? [sql(`DROP USER '${drillUser}'@'localhost';`)] : []),
      ...(created ? [sql(`DROP DATABASE ${identifier(restoreName(database))};`)] : []),
      rm(evidence, { recursive: true, force: true }),
    ]));
    if (cleanup.some(result => result.status === 'rejected')) throw new Error('Restore drill cleanup failed; inspect disposable sers_restore databases and sersdrill users');
  }
  const observations = recoveryObservations(manifest, measurement.startedAt, measurement.elapsedMs(), targets);
  const passed = Object.values(observations.checks).every(value => value !== false);
  console.log(JSON.stringify({ passed, ...result, measurement: { startedAt: measurement.startedAt, completedAt: new Date().toISOString(), phasesMs: measurement.phasesMs }, recoveryObservations: observations }));
  if (!passed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
