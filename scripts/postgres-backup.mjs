#!/usr/bin/env node
import { createBackup, parseArgs, DEFAULT_DB_NAME, DEFAULT_USER, DEFAULT_BACKUP_DIR } from './lib/postgres-operations.mjs';

async function main() {
  const { flags } = parseArgs();

  if (flags.help || flags.h) {
    console.log(`
QuanLyKhuPho - PostgreSQL Database Backup CLI

Cách dùng (Usage):
  node scripts/postgres-backup.mjs [options]
  pnpm db:backup

Tùy chọn (Options):
  --db=<name>           Tên cơ sở dữ liệu (mặc định: ${DEFAULT_DB_NAME} hoặc POSTGRES_DB)
  --user=<name>         Tên người dùng PostgreSQL (mặc định: ${DEFAULT_USER} hoặc POSTGRES_USER)
  --output-dir=<dir>    Thư mục chứa tệp sao lưu (mặc định: ${DEFAULT_BACKUP_DIR})
  --output-file=<file>  Tên tệp cụ thể (.dump)
  --compose-file=<path> Đường dẫn docker-compose.yml (mặc định: docker/docker-compose.yml)
  --service=<name>      Tên service trong Docker Compose (mặc định: postgres)
  --help, -h            Hiển thị trợ giúp
`);
    process.exit(0);
  }

  try {
    const result = await createBackup({
      db: flags.db || flags.database,
      user: flags.user || flags.username,
      outputDir: flags['output-dir'] || flags.outputDir || flags.output,
      outputFile: flags['output-file'] || flags.outputFile,
      composeFile: flags['compose-file'] || flags.composeFile,
      service: flags.service,
    });

    console.log('✅ Sao lưu cơ sở dữ liệu thành công!');
    console.log(`- Cơ sở dữ liệu : ${result.db}`);
    console.log(`- Tệp sao lưu   : ${result.filePath}`);
    console.log(`- Dung lượng    : ${(result.sizeBytes / 1024).toFixed(2)} KB (${result.sizeBytes} bytes)`);
    console.log(`- Thời gian     : ${result.timestamp}`);
  } catch (err) {
    console.error('❌ Lỗi khi sao lưu cơ sở dữ liệu:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
