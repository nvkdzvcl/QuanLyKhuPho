#!/usr/bin/env node
import { runProductionReleaseAcceptance, parseArgs } from './lib/production-release-acceptance.mjs';

async function main() {
  const { flags } = parseArgs();

  if (flags.help || flags.h) {
    console.log(`
QuanLyKhuPho - Production Release Acceptance Gate CLI

Cách dùng (Usage):
  node scripts/production-release-acceptance.mjs [options]
  pnpm production:acceptance

Tùy chọn (Options):
  --no-build            Bỏ qua bước build image (dùng images có sẵn trong CI/local)
  --build               Thực hiện build images trước khi khởi chạy smoke (mặc định)
  --tag=<tag>           Tag của container images (mặc định: verify hoặc APP_IMAGE_TAG)
  --api-port=<port>     Cổng loopback của API (mặc định: 4010)
  --web-port=<port>     Cổng loopback của Web (mặc định: 3010)
  --timeout=<ms>        Thời gian chờ tối đa cho stack sẵn sàng (mặc định: 120000ms)
  --poll-interval=<ms>  Khoảng thời gian giữa các lần thăm dò (mặc định: 1000ms)
  --help, -h            Hiển thị trợ giúp
`);
    process.exit(0);
  }

  try {
    const parseNumericFlag = (val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'boolean') return NaN;
      return Number(val);
    };

    const result = await runProductionReleaseAcceptance({
      noBuild: Boolean(flags['no-build'] || flags.noBuild),
      build: Boolean(flags.build),
      imageTag: flags.tag || flags['image-tag'] || flags.imageTag,
      apiPort: parseNumericFlag(flags['api-port'] ?? flags.apiPort),
      webPort: parseNumericFlag(flags['web-port'] ?? flags.webPort),
      timeoutMs: parseNumericFlag(flags.timeout ?? flags.timeoutMs),
      pollIntervalMs: parseNumericFlag(flags['poll-interval'] ?? flags.pollInterval ?? flags.pollIntervalMs),
    });

    console.log('\n✅ Cổng nghiệm thu phát hành sản xuất (Production Release Acceptance) THÀNH CÔNG!');
    console.log(`- Project Name  : ${result.projectName}`);
    console.log(`- Image Tag     : ${result.imageTag}`);
    console.log(`- API Port      : ${result.apiPort}`);
    console.log(`- Web Port      : ${result.webPort}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Cổng nghiệm thu phát hành sản xuất (Production Release Acceptance) THẤT BẠI:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
