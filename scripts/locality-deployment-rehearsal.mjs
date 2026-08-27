#!/usr/bin/env node
import { runLocalityDeploymentRehearsal, parseArgs } from './lib/locality-deployment-rehearsal.mjs';

async function main() {
  const { flags } = parseArgs();

  if (flags.help || flags.h) {
    console.log(`
QuanLyKhuPho - Locality Deployment Rehearsal Runner (LDR)

Cách dùng (Usage):
  node scripts/locality-deployment-rehearsal.mjs [options]
  pnpm locality:rehearsal

Mô tả (Description):
  Thực hiện diễn tập khởi tạo và triển khai gói cấu hình địa bàn (mặc định: Phường Chợ Quán)
  trong một môi trường Compose hoàn toàn cô lập, sử dụng bản sao tạm thời (temporary test clone).
  Đảm bảo kiểm tra toàn bộ luồng migration, initialization và runtime contracts mà không thay đổi
  trạng thái dự thảo (confirmed=false) của gói cấu hình gốc trong kho mã nguồn.

Tùy chọn (Options):
  --build               Thực hiện build container images trước khi khởi chạy diễn tập (mặc định)
  --no-build            Bỏ qua bước build image (sử dụng container images có sẵn trong CI/local)
  --tag=<tag>           Tag của container images (mặc định: verify hoặc APP_IMAGE_TAG)
  --profile=<slug>      Slug hoặc đường dẫn hồ sơ địa bàn (mặc định: cho-quan)
  --api-port=<port>     Cổng loopback 127.0.0.1 của API (mặc định: 4011)
  --web-port=<port>     Cổng loopback 127.0.0.1 của Web (mặc định: 3011)
  --timeout=<ms>        Thời gian chờ tối đa cho stack sẵn sàng (mặc định: 120000ms)
  --poll-interval=<ms>  Khoảng thời gian giữa các lần thăm dò trạng thái (mặc định: 1000ms)
  --help, -h            Hiển thị trợ giúp

Ranh giới Bằng chứng & Pháp lý (Evidence Boundary):
  Diễn tập kỹ thuật này (Technical Rehearsal) chỉ chứng minh khả năng di trú CSDL, khởi tạo
  và phục vụ hợp đồng dữ liệu của gói phần mềm trong điều kiện kiểm thử cô lập.
  Việc diễn tập thành công KHÔNG cấu thành sự phê duyệt pháp lý hoặc vận hành (operational approval),
  và KHÔNG cho phép kích hoạt hệ thống thực tế khi chưa có quyết định chính thức từ cơ quan nhà nước.
`);
    process.exit(0);
  }

  try {
    const parseNumericFlag = (val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'boolean') return NaN;
      return Number(val);
    };

    const result = await runLocalityDeploymentRehearsal({
      noBuild: Boolean(flags['no-build'] || flags.noBuild),
      build: Boolean(flags.build),
      imageTag: flags.tag || flags['image-tag'] || flags.imageTag,
      profile: flags.profile,
      apiPort: parseNumericFlag(flags['api-port'] ?? flags.apiPort),
      webPort: parseNumericFlag(flags['web-port'] ?? flags.webPort),
      timeoutMs: parseNumericFlag(flags.timeout ?? flags.timeoutMs),
      pollIntervalMs: parseNumericFlag(flags['poll-interval'] ?? flags.pollInterval ?? flags.pollIntervalMs),
    });

    console.log('\n✅ Diễn tập triển khai địa bàn (Locality Deployment Rehearsal) THÀNH CÔNG!');
    console.log(`- Project Name       : ${result.projectName}`);
    console.log(`- Image Tag          : ${result.imageTag}`);
    console.log(`- Profile Slug       : ${result.profile}`);
    console.log(`- Locality Name      : ${result.localityName}`);
    console.log(`- Neighborhoods Count: ${result.neighborhoodsCount}`);
    console.log(`- API Port           : ${result.apiPort}`);
    console.log(`- Web Port           : ${result.webPort}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Diễn tập triển khai địa bàn (Locality Deployment Rehearsal) THẤT BẠI:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
