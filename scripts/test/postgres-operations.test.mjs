import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  PG_CUSTOM_FORMAT_MAGIC,
  DEFAULT_DB_NAME,
  DEFAULT_USER,
  isValidDatabaseName,
  isValidUserName,
  sanitizeLogOutput,
  verifyPgDumpHeader,
  parseArgs,
  createBackup,
  validateBackup,
  restoreBackup,
} from '../lib/postgres-operations.mjs';

describe('PostgreSQL Operations Module', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qlkp-ops-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Argument and Identifier Validation', () => {
    it('validates safe database names', () => {
      assert.strictEqual(isValidDatabaseName('quanlykhupho'), true);
      assert.strictEqual(isValidDatabaseName('mydb_123'), true);
      assert.strictEqual(isValidDatabaseName('postgres'), true);

      assert.strictEqual(isValidDatabaseName(''), false);
      assert.strictEqual(isValidDatabaseName('db; DROP TABLE accounts;'), false);
      assert.strictEqual(isValidDatabaseName('db-with-hyphen'), false);
      assert.strictEqual(isValidDatabaseName('db name with spaces'), false);
      assert.strictEqual(isValidDatabaseName('--option'), false);
      assert.strictEqual(isValidDatabaseName(null), false);
      assert.strictEqual(isValidDatabaseName(undefined), false);
    });

    it('validates safe database user names', () => {
      assert.strictEqual(isValidUserName('postgres'), true);
      assert.strictEqual(isValidUserName('qlkp_user'), true);

      assert.strictEqual(isValidUserName(''), false);
      assert.strictEqual(isValidUserName('user;--'), false);
      assert.strictEqual(isValidUserName('user name'), false);
    });

    it('sanitizes connection strings and passwords in log outputs', () => {
      const raw = 'Error connecting to postgresql://postgres:super_secret@localhost:5432/quanlykhupho with password=my_password123';
      const sanitized = sanitizeLogOutput(raw);

      assert.strictEqual(sanitized.includes('super_secret'), false);
      assert.strictEqual(sanitized.includes('my_password123'), false);
      assert.strictEqual(sanitized.includes('postgresql://***@localhost'), true);
      assert.strictEqual(sanitized.includes('password=***'), true);
    });

    it('parses CLI arguments correctly', () => {
      const args = [
        '--db=test_db',
        '--confirm-destructive',
        '--confirm-database=test_db',
        '--file=backups/test.dump',
        'positional_val',
      ];
      const parsed = parseArgs(args);

      assert.strictEqual(parsed.flags.db, 'test_db');
      assert.strictEqual(parsed.flags['confirm-destructive'], true);
      assert.strictEqual(parsed.flags['confirm-database'], 'test_db');
      assert.strictEqual(parsed.flags.file, 'backups/test.dump');
      assert.deepStrictEqual(parsed.positionals, ['positional_val']);
    });
  });

  describe('PostgreSQL Custom-Format Header Verification', () => {
    it('verifies valid PGDMP magic header', () => {
      const filePath = path.join(tempDir, 'valid.dump');
      const content = Buffer.concat([PG_CUSTOM_FORMAT_MAGIC, Buffer.from('extra archive data')]);
      fs.writeFileSync(filePath, content);

      assert.strictEqual(verifyPgDumpHeader(filePath), true);
    });

    it('rejects invalid or corrupted header', () => {
      const filePath = path.join(tempDir, 'invalid.dump');
      fs.writeFileSync(filePath, Buffer.from('SQL plain text dump'));

      assert.strictEqual(verifyPgDumpHeader(filePath), false);
    });

    it('handles non-existent or empty files safely', () => {
      assert.strictEqual(verifyPgDumpHeader(path.join(tempDir, 'nonexistent.dump')), false);

      const emptyPath = path.join(tempDir, 'empty.dump');
      fs.writeFileSync(emptyPath, Buffer.alloc(0));
      assert.strictEqual(verifyPgDumpHeader(emptyPath), false);
    });
  });

  describe('createBackup()', () => {
    it('creates a published .dump file atomically and cleans temporary artifacts', async () => {
      let runnerCalledWith = null;

      const fakeRunner = async ({ command, args, stdoutPath }) => {
        runnerCalledWith = { command, args, stdoutPath };
        // Simulate pg_dump writing valid custom dump
        const fakeDumpContent = Buffer.concat([PG_CUSTOM_FORMAT_MAGIC, Buffer.from('TOC_DATA')]);
        fs.writeFileSync(stdoutPath, fakeDumpContent);
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const result = await createBackup({
        db: 'quanlykhupho',
        user: 'postgres',
        outputDir: tempDir,
        runner: fakeRunner,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.db, 'quanlykhupho');
      assert.strictEqual(fs.existsSync(result.filePath), true);
      assert.strictEqual(result.filePath.endsWith('.dump'), true);
      assert.strictEqual(result.sizeBytes > 0, true);

      // Verify no temporary files remain in outputDir
      const remainingFiles = fs.readdirSync(tempDir);
      assert.strictEqual(remainingFiles.length, 1);
      assert.strictEqual(remainingFiles[0], result.fileName);

      // Verify docker command and arguments
      assert.strictEqual(runnerCalledWith.command, 'docker');
      assert.deepStrictEqual(runnerCalledWith.args, [
        'compose',
        '-f',
        'docker/docker-compose.yml',
        'exec',
        '-T',
        'postgres',
        'pg_dump',
        '-U',
        'postgres',
        '-d',
        'quanlykhupho',
        '-Fc',
        '--no-owner',
        '--no-privileges',
      ]);
    });

    it('cleans up temporary file and throws when process runner fails', async () => {
      const fakeRunner = async ({ stdoutPath }) => {
        // Write partial temp file
        fs.writeFileSync(stdoutPath, Buffer.from('partial incomplete data'));
        throw new Error('Process exited with code 1: pg_dump failed');
      };

      await assert.rejects(
        async () => {
          await createBackup({
            db: 'quanlykhupho',
            outputDir: tempDir,
            runner: fakeRunner,
          });
        },
        /pg_dump failed/
      );

      // Verify no temporary or published files remain
      const remainingFiles = fs.readdirSync(tempDir);
      assert.strictEqual(remainingFiles.length, 0);
    });

    it('rejects and cleans up when dump output missing PGDMP header', async () => {
      const fakeRunner = async ({ stdoutPath }) => {
        // Corrupt content without magic header
        fs.writeFileSync(stdoutPath, Buffer.from('INVALID_HEADER_DATA'));
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        async () => {
          await createBackup({
            db: 'quanlykhupho',
            outputDir: tempDir,
            runner: fakeRunner,
          });
        },
        /missing PostgreSQL custom format magic header/
      );

      const remainingFiles = fs.readdirSync(tempDir);
      assert.strictEqual(remainingFiles.length, 0);
    });

    it('rejects unsafe database names before running process', async () => {
      let runnerCalled = false;
      const fakeRunner = async () => {
        runnerCalled = true;
      };

      await assert.rejects(
        async () => {
          await createBackup({
            db: 'bad;db;name',
            outputDir: tempDir,
            runner: fakeRunner,
          });
        },
        /Invalid database name/
      );

      assert.strictEqual(runnerCalled, false);
    });
  });

  describe('validateBackup()', () => {
    it('validates a valid dump file and extracts TOC entries', async () => {
      const dumpPath = path.join(tempDir, 'sample.dump');
      fs.writeFileSync(dumpPath, Buffer.concat([PG_CUSTOM_FORMAT_MAGIC, Buffer.from('table_data')]));

      let runnerCalledWith = null;
      const fakeRunner = async ({ command, args, stdinPath }) => {
        runnerCalledWith = { command, args, stdinPath };
        return {
          exitCode: 0,
          stdout: '; Archive created by pg_dump\n1; 1259 16384 TABLE public accounts postgres\n2; 1259 16385 TABLE public neighborhoods postgres',
          stderr: '',
        };
      };

      const result = await validateBackup({
        file: dumpPath,
        runner: fakeRunner,
      });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.entryCount, 3);
      assert.strictEqual(runnerCalledWith.command, 'docker');
      assert.strictEqual(runnerCalledWith.stdinPath, dumpPath);
      assert.deepStrictEqual(runnerCalledWith.args, [
        'compose',
        '-f',
        'docker/docker-compose.yml',
        'exec',
        '-T',
        'postgres',
        'pg_restore',
        '--list',
      ]);
    });

    it('rejects non-existent file', async () => {
      await assert.rejects(
        async () => {
          await validateBackup({
            file: path.join(tempDir, 'does_not_exist.dump'),
          });
        },
        /not found/
      );
    });

    it('rejects file without .dump extension', async () => {
      const txtPath = path.join(tempDir, 'backup.sql');
      fs.writeFileSync(txtPath, 'test');

      await assert.rejects(
        async () => {
          await validateBackup({
            file: txtPath,
          });
        },
        /Must end with \.dump/
      );
    });

    it('rejects dump file with invalid header', async () => {
      const corruptPath = path.join(tempDir, 'corrupt.dump');
      fs.writeFileSync(corruptPath, Buffer.from('NOT_A_PG_DUMP_HEADER'));

      await assert.rejects(
        async () => {
          await validateBackup({
            file: corruptPath,
          });
        },
        /not a valid PostgreSQL custom-format dump/
      );
    });
  });

  describe('restoreBackup() Safety Guards & Execution', () => {
    let validDumpPath;

    beforeEach(() => {
      validDumpPath = path.join(tempDir, 'valid_restore.dump');
      fs.writeFileSync(validDumpPath, Buffer.concat([PG_CUSTOM_FORMAT_MAGIC, Buffer.from('VALID_DATA')]));
    });

    it('defaults to validation-only dry-run when confirmDestructive is false', async () => {
      let restoreExecuted = false;

      const fakeRunner = async ({ args }) => {
        if (args.includes('--list')) {
          return { exitCode: 0, stdout: '1; TABLE public accounts', stderr: '' };
        }
        if (args.includes('--clean')) {
          restoreExecuted = true;
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const result = await restoreBackup({
        file: validDumpPath,
        db: 'quanlykhupho',
        confirmDestructive: false,
        runner: fakeRunner,
      });

      assert.strictEqual(result.dryRun, true);
      assert.strictEqual(result.restored, false);
      assert.strictEqual(restoreExecuted, false);
      assert.strictEqual(result.validation.valid, true);
    });

    it('rejects destructive restore when confirmDatabase does not match target db', async () => {
      let restoreExecuted = false;

      const fakeRunner = async ({ args }) => {
        if (args.includes('--list')) {
          return { exitCode: 0, stdout: '1; TABLE public accounts', stderr: '' };
        }
        if (args.includes('--clean')) {
          restoreExecuted = true;
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        async () => {
          await restoreBackup({
            file: validDumpPath,
            db: 'quanlykhupho',
            confirmDestructive: true,
            confirmDatabase: 'wrong_db_name',
            runner: fakeRunner,
          });
        },
        /does not match target database "quanlykhupho"/
      );

      assert.strictEqual(restoreExecuted, false);
    });

    it('rejects destructive restore when confirmDatabase is omitted', async () => {
      let restoreExecuted = false;

      const fakeRunner = async ({ args }) => {
        if (args.includes('--list')) {
          return { exitCode: 0, stdout: '1; TABLE public accounts', stderr: '' };
        }
        if (args.includes('--clean')) {
          restoreExecuted = true;
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        async () => {
          await restoreBackup({
            file: validDumpPath,
            db: 'quanlykhupho',
            confirmDestructive: true,
            runner: fakeRunner,
          });
        },
        /Destructive restore rejected/
      );

      assert.strictEqual(restoreExecuted, false);
    });

    it('executes destructive restore when BOTH confirmDestructive and confirmDatabase match', async () => {
      const executedCommands = [];

      const fakeRunner = async ({ command, args }) => {
        executedCommands.push({ command, args });
        return { exitCode: 0, stdout: '1; TABLE public accounts', stderr: '' };
      };

      const result = await restoreBackup({
        file: validDumpPath,
        db: 'quanlykhupho',
        user: 'postgres',
        confirmDestructive: true,
        confirmDatabase: 'quanlykhupho',
        runner: fakeRunner,
      });

      assert.strictEqual(result.restored, true);
      assert.strictEqual(result.dryRun, false);
      assert.strictEqual(result.targetDatabase, 'quanlykhupho');

      // Check that 2 commands were called in order: validation (--list) then restore (--clean)
      assert.strictEqual(executedCommands.length, 2);
      assert.deepStrictEqual(executedCommands[0].args.slice(-2), ['pg_restore', '--list']);
      assert.deepStrictEqual(executedCommands[1].args, [
        'compose',
        '-f',
        'docker/docker-compose.yml',
        'exec',
        '-T',
        'postgres',
        'pg_restore',
        '-U',
        'postgres',
        '-d',
        'quanlykhupho',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
      ]);
    });
  });
});
