#!/usr/bin/env node
import { restoreBackup, parseArgs, DEFAULT_DB_NAME, DEFAULT_USER } from './lib/postgres-operations.mjs';

async function main() {
  const { flags, positionals } = parseArgs();

  const file = flags.file || positionals[0];

  if (flags.help || flags.h || !file) {
    console.log(`
QuanLyKhuPho - PostgreSQL Restore & Validation CLI

Cách dùng (Usage):
  1. Kiểm tra tính toàn vẹn tệp sao lưu (Mặc định / Dry-run / Validate only):
     node scripts/postgres-restore.mjs --file=backups/<file>.dump
     pnpm db:restore -- --file=backups/<file>.dump

  2. Thực thi phục hồi thực tế (BẮT BUỘC cả 2 cờ xác nhận an toàn):
     node scripts/postgres-restore.mjs --file=backups/<file>.dump --confirm-destructive --confirm-database=${DEFAULT_DB_NAME}

Tùy chọn (Options):
  --file=<path>                 Đường dẫn tệp .dump cần kiểm tra hoặc phục hồi (bắt buộc)
  --db=<name>                   Tên cơ sở dữ liệu đích (mặc định: ${DEFAULT_DB_NAME})
  --user=<name>                 Tên người dùng PostgreSQL (mặc định: ${DEFAULT_USER})
  --confirm-destructive         Cờ xác nhận cho phép thao tác ghi đè có tính phá hủy
  --confirm-database=<name>     Tên cơ sở dữ liệu xác nhận (phải khớp chính xác với --db)
  --compose-file=<path>         Đường dẫn docker-compose.yml (mặc định: docker/docker-compose.yml)
  --service=<name>              Tên service trong Docker Compose (mặc định: postgres)
  --help, -h                    Hiển thị trợ giúp

Cảnh báo an toàn (Safety notice):
  Mặc định lệnh chỉ chạy pg_restore --list để kiểm tra định dạng mà không thay đổi dữ liệu.
  Để phục hồi thực sự, bạn PHẢI chỉ định cả --confirm-destructive và --confirm-database=<tên_db_chính_xác>.
`);
    if (!file && !flags.help && !flags.h) {
      console.error('❌ Lỗi: Vui lòng cung cấp đường dẫn tệp sao lưu qua --file=<path>');
      process.exit(1);
    }
    process.exit(0);
  }

  try {
    const result = await restoreBackup({
      file,
      db: flags.db || flags.database,
      user: flags.user || flags.username,
      confirmDestructive: flags['confirm-destructive'] === true,
      confirmDatabase: flags['confirm-database'],
      composeFile: flags['compose-file'] || flags.composeFile,
      service: flags.service,
    });

    if (result.dryRun) {
      console.log('🔍 Kiểm tra tính toàn vẹn tệp sao lưu thành công (Chế độ chỉ kiểm tra / Dry-run):');
      console.log(`- Tệp kiểm tra  : ${result.validation.filePath}`);
      console.log(`- Dung lượng    : ${(result.validation.sizeBytes / 1024).toFixed(2)} KB`);
      console.log(`- Số mục TOC    : ${result.validation.entryCount}`);
      console.log(`- Trạng thái    : ${result.message}`);
    } else {
      console.log('✅ Phục hồi cơ sở dữ liệu thành công!');
      console.log(`- Cơ sở dữ liệu : ${result.targetDatabase}`);
      console.log(`- Nguồn tệp     : ${result.filePath}`);
      console.log(`- Dung lượng    : ${(result.sizeBytes / 1024).toFixed(2)} KB`);
    }
  } catch (err) {
    console.error('❌ Lỗi thao tác phục hồi / kiểm tra cơ sở dữ liệu:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
