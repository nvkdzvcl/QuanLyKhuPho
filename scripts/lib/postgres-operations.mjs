import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const PG_CUSTOM_FORMAT_MAGIC = Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50]); // PGDMP
export const DEFAULT_COMPOSE_FILE = 'docker/docker-compose.yml';
export const DEFAULT_SERVICE = 'postgres';
export const DEFAULT_DB_NAME = 'quanlykhupho';
export const DEFAULT_USER = 'postgres';
export const DEFAULT_BACKUP_DIR = 'backups';

const DB_IDENTIFIER_REGEX = /^[a-zA-Z0-9_]{1,63}$/;

/**
 * Validate PostgreSQL database identifier to prevent injection and malformed input.
 */
export function isValidDatabaseName(name) {
  return typeof name === 'string' && DB_IDENTIFIER_REGEX.test(name);
}

/**
 * Validate PostgreSQL username identifier.
 */
export function isValidUserName(name) {
  return typeof name === 'string' && DB_IDENTIFIER_REGEX.test(name);
}

/**
 * Sanitize error messages and process outputs to avoid leaking sensitive connection data.
 */
export function sanitizeLogOutput(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/password=[^\s;]+/gi, 'password=***')
    .replace(/postgres:\/\/[^@]+@/gi, 'postgres://***@')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***@');
}

/**
 * Inspect file header to verify PostgreSQL custom-format magic bytes (PGDMP).
 */
export function verifyPgDumpHeader(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(5);
      const bytesRead = fs.readSync(fd, buffer, 0, 5, 0);
      if (bytesRead < 5) return false;
      return buffer.equals(PG_CUSTOM_FORMAT_MAGIC);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/**
 * Default process runner using child_process.spawn with argument arrays (no shell interpolation).
 */
export function defaultProcessRunner({ command, args, stdinPath, stdoutPath, captureOutput = true }) {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let settled = false;

    const resolveOnce = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const rejectOnce = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    let stdoutFd;
    try {
      if (stdoutPath) {
        stdoutFd = fs.openSync(stdoutPath, 'wx');
      }
    } catch (err) {
      rejectOnce(new Error(`Failed opening output file: ${err.message}`));
      return;
    }

    const proc = spawn(command, args, {
      stdio: ['pipe', stdoutFd ?? 'pipe', 'pipe'],
      shell: false,
    });

    if (stdoutFd !== undefined) {
      fs.closeSync(stdoutFd);
    } else if (captureOutput) {
      proc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });
    }

    if (stdinPath) {
      const stdinStream = fs.createReadStream(stdinPath);
      stdinStream.on('error', (err) => {
        proc.kill();
        rejectOnce(new Error(`Failed reading input file: ${err.message}`));
      });
      stdinStream.pipe(proc.stdin);
    } else {
      proc.stdin.end();
    }

    proc.stderr.on('data', (chunk) => {
      if (stderrData.length < 65536) {
        stderrData += chunk.toString();
      }
    });

    proc.on('error', (err) => {
      rejectOnce(new Error(`Failed to spawn process ${command}: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const sanitized = sanitizeLogOutput(stderrData.trim());
        rejectOnce(new Error(`Process exited with code ${code}${sanitized ? `: ${sanitized}` : ''}`));
      } else {
        resolveOnce({
          exitCode: code,
          stdout: stdoutData,
          stderr: sanitizeLogOutput(stderrData.trim()),
        });
      }
    });
  });
}

/**
 * Create a PostgreSQL custom-format backup atomically.
 */
export async function createBackup(options = {}) {
  const {
    db = process.env.POSTGRES_DB || DEFAULT_DB_NAME,
    user = process.env.POSTGRES_USER || DEFAULT_USER,
    composeFile = DEFAULT_COMPOSE_FILE,
    service = DEFAULT_SERVICE,
    outputDir = DEFAULT_BACKUP_DIR,
    outputFile,
    runner = defaultProcessRunner,
    now = new Date(),
  } = options;

  if (!isValidDatabaseName(db)) {
    throw new Error(`Invalid database name "${db}". Must contain 1-63 alphanumeric characters or underscores.`);
  }

  if (!isValidUserName(user)) {
    throw new Error(`Invalid database user "${user}". Must contain 1-63 alphanumeric characters or underscores.`);
  }

  const resolvedDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  let finalFileName;
  if (outputFile) {
    if (!outputFile.endsWith('.dump')) {
      throw new Error(`Invalid output filename "${outputFile}". Must end with .dump extension.`);
    }
    finalFileName = path.basename(outputFile);
  } else {
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
    finalFileName = `${db}-backup-${timestamp}.dump`;
  }

  const finalPath = path.resolve(resolvedDir, finalFileName);
  const tempFileName = `.${finalFileName}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`;
  const tempPath = path.join(resolvedDir, tempFileName);

  const command = 'docker';
  const args = [
    'compose',
    '-f',
    composeFile,
    'exec',
    '-T',
    service,
    'pg_dump',
    '-U',
    user,
    '-d',
    db,
    '-Fc',
    '--no-owner',
    '--no-privileges',
  ];

  try {
    await runner({
      command,
      args,
      stdoutPath: tempPath,
    });

    if (!fs.existsSync(tempPath)) {
      throw new Error('Backup failed: temporary dump file was not created.');
    }

    const stat = fs.statSync(tempPath);
    if (stat.size < 5) {
      throw new Error(`Backup failed: generated file size (${stat.size} bytes) is too small.`);
    }

    if (!verifyPgDumpHeader(tempPath)) {
      throw new Error('Backup failed: missing PostgreSQL custom format magic header (PGDMP).');
    }

    fs.renameSync(tempPath, finalPath);

    const finalStat = fs.statSync(finalPath);
    return {
      success: true,
      filePath: finalPath,
      fileName: finalFileName,
      sizeBytes: finalStat.size,
      db,
      timestamp: now.toISOString(),
    };
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Safe cleanup ignore
      }
    }
    throw err;
  }
}

/**
 * Safely validate a PostgreSQL custom-format dump file using pg_restore --list.
 */
export async function validateBackup(options = {}) {
  const {
    file,
    composeFile = DEFAULT_COMPOSE_FILE,
    service = DEFAULT_SERVICE,
    runner = defaultProcessRunner,
  } = options;

  if (!file || typeof file !== 'string') {
    throw new Error('Missing required backup file path.');
  }

  const resolvedPath = path.resolve(file);
  if (!resolvedPath.endsWith('.dump')) {
    throw new Error(`Invalid backup file extension for "${file}". Must end with .dump.`);
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file not found at "${resolvedPath}".`);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.size < 5) {
    throw new Error(`Backup file is too small or empty (${stat.size} bytes).`);
  }

  if (!verifyPgDumpHeader(resolvedPath)) {
    throw new Error(`File "${resolvedPath}" is not a valid PostgreSQL custom-format dump (missing PGDMP header).`);
  }

  const command = 'docker';
  const args = [
    'compose',
    '-f',
    composeFile,
    'exec',
    '-T',
    service,
    'pg_restore',
    '--list',
  ];

  const result = await runner({
    command,
    args,
    stdinPath: resolvedPath,
    captureOutput: true,
  });

  const lines = (result.stdout || '').split('\n').filter((l) => l.trim().length > 0);
  return {
    valid: true,
    filePath: resolvedPath,
    sizeBytes: stat.size,
    entryCount: lines.length,
    tocSummary: lines.slice(0, 10),
  };
}

/**
 * Validate or destructively restore a PostgreSQL custom-format dump file.
 * Requires both confirmDestructive === true and confirmDatabase === targetDb for actual restore.
 */
export async function restoreBackup(options = {}) {
  const {
    file,
    db = process.env.POSTGRES_DB || DEFAULT_DB_NAME,
    user = process.env.POSTGRES_USER || DEFAULT_USER,
    composeFile = DEFAULT_COMPOSE_FILE,
    service = DEFAULT_SERVICE,
    confirmDestructive = false,
    confirmDatabase,
    runner = defaultProcessRunner,
  } = options;

  if (!isValidDatabaseName(db)) {
    throw new Error(`Invalid target database name "${db}". Must contain 1-63 alphanumeric characters or underscores.`);
  }

  if (!isValidUserName(user)) {
    throw new Error(`Invalid database user "${user}". Must contain 1-63 alphanumeric characters or underscores.`);
  }

  // Always perform safe pre-validation of the dump file
  const validation = await validateBackup({
    file,
    composeFile,
    service,
    runner,
  });

  const isDestructiveConfirmed = Boolean(confirmDestructive);
  const isDatabaseConfirmed = confirmDatabase === db;

  // Validation-only default / safeguard
  if (!isDestructiveConfirmed || !isDatabaseConfirmed) {
    if (isDestructiveConfirmed && !isDatabaseConfirmed) {
      throw new Error(
        `Destructive restore rejected: --confirm-database value "${confirmDatabase || ''}" does not match target database "${db}". Exact match required.`
      );
    }

    return {
      restored: false,
      dryRun: true,
      validation,
      targetDatabase: db,
      message: `Validation succeeded. Destructive restore requires both --confirm-destructive and --confirm-database=${db}.`,
    };
  }

  const command = 'docker';
  const args = [
    'compose',
    '-f',
    composeFile,
    'exec',
    '-T',
    service,
    'pg_restore',
    '-U',
    user,
    '-d',
    db,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
  ];

  await runner({
    command,
    args,
    stdinPath: validation.filePath,
    captureOutput: true,
  });

  return {
    restored: true,
    dryRun: false,
    targetDatabase: db,
    filePath: validation.filePath,
    sizeBytes: validation.sizeBytes,
  };
}

/**
 * Parse CLI arguments into flags and positional values.
 */
export function parseArgs(rawArgs = process.argv.slice(2)) {
  const parsed = {
    flags: {},
    positionals: [],
  };

  for (const arg of rawArgs) {
    if (arg === '-h' || arg === '--help') {
      parsed.flags.help = true;
    } else if (arg.startsWith('--')) {
      const withoutPrefix = arg.slice(2);
      const eqIdx = withoutPrefix.indexOf('=');
      if (eqIdx !== -1) {
        const key = withoutPrefix.slice(0, eqIdx);
        const value = withoutPrefix.slice(eqIdx + 1);
        parsed.flags[key] = value;
      } else {
        parsed.flags[withoutPrefix] = true;
      }
    } else {
      parsed.positionals.push(arg);
    }
  }

  return parsed;
}
