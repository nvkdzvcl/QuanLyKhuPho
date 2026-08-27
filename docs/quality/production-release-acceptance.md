# Sổ tay Nghiệm thu Phát hành Sản xuất (Production Release Acceptance Runbook)

Tài liệu này quy định cấu hình, quy trình thực thi, ma trận kiểm chứng runtime, cơ chế cô lập tài nguyên và ranh giới bằng chứng kỹ thuật cho cổng nghiệm thu phát hành sản xuất (**Production Release Acceptance Gate**) trong dự án **QuanLyKhuPho**.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Cung cấp rào chắn nghiệm thu tự động xác định (deterministic automated acceptance gate) trước khi phát hành, nhằm kiểm chứng tính sẵn sàng và khả năng khởi động đồng bộ của toàn bộ cụm container production (`postgres`, `redis`, `rabbitmq`, `migrate`, `api`, `sms-worker`, `web`) trong môi trường biệt lập mà không tác động tới môi trường phát triển hay tài nguyên sản xuất thực tế.
- **Phạm vi kỹ thuật**:
  - Thực thi trên cụm dịch vụ Docker Compose sản xuất (`docker/docker-compose.production.yml`) kết hợp cấu hình override kiểm thử khói (`docker/docker-compose.production-smoke.yml`).
  - Kiểm tra tính hợp lệ của cấu hình Compose đã kết xuất (project name, tên container, volumes, networks, và cổng loopback host).
  - Kiểm chứng dịch vụ di chuyển cơ sở dữ liệu (`migrate`) thực thi thành công và thoát với mã `0` trước khi các dịch vụ phụ thuộc khởi chạy.
  - Kiểm chứng trạng thái `healthy` của hạ tầng lưu trữ (PostgreSQL 16, Redis 7, RabbitMQ 3.13) và ứng dụng (NestJS API, Next.js Web).
  - Kiểm chứng tiến trình worker xử lý tin nhắn SMS (`sms-worker`) hoạt động liên tục và không bị khởi động lại (`Restarts: 0`).
  - Kiểm chứng 4 giao ước HTTP/HTTPS runtime cốt lõi: từ chối plain HTTP (`403`), chấp nhận HTTPS forwarded liveness (`200`), phản hồi trạng thái sẵn sàng tiền khởi tạo địa bàn có kiểm soát (`503`), và phục vụ trang chủ Web (`200`).

---

## 2. ⚠️ Tuyên bố Ranh giới Bằng chứng Kỹ thuật (Evidence Boundary Notice)

Việc thực thi thành công lệnh `pnpm production:acceptance` (cục bộ hoặc trong CI pipeline) cung cấp **bằng chứng phòng thí nghiệm / tiền kiểm tra phát hành xác định (Deterministic Preflight Lab/CI Evidence)**. Bằng chứng này có ranh giới rõ ràng và không thay thế các điều kiện vận hành sản xuất sau:

1. **Không phải Bằng chứng Chứng chỉ SSL/TLS hay Reverse Proxy Công khai (Not Real TLS / External Ingress Proof)**:
   - Rào chắn kiểm thử xác nhận API thực thi đúng chính sách yêu cầu bảo mật HTTPS qua header `X-Forwarded-Proto: https` và từ chối request HTTP trực tiếp (`403 Forbidden`).
   - Kiểm thử này chạy trên giao diện loopback cục bộ (`127.0.0.1`), **không cấu thành bằng chứng** rằng máy chủ đã cấu hình chứng chỉ TLS hợp lệ, chuỗi tin cậy CA, HSTS, WAF hoặc reverse proxy công khai đạt yêu cầu **SRS NFR-01**.
2. **Không phải Cam kết Uptime / SLA Sản xuất (Not Production Uptime / SLA Proof)**:
   - Việc toàn bộ 7 container đạt trạng thái healthy trong bài kiểm tra khói xác nhận tính tương thích khởi động và không bị crash loop tức thời.
   - Không cấu thành cam kết độ sẵn sàng 99% hay khả năng chịu tải liên tục dài hạn (soak test) trong môi trường sản xuất thực tế.
3. **Không phải Kiểm thử Gửi Tin nhắn SMS hay Web Push Thực tế (Not Real Provider Delivery Proof)**:
   - Môi trường kiểm thử cấu hình một webhook HTTPS bất hoạt và không tạo lệnh SMS, do đó không kết nối tới cổng viễn thông SMS thực tế và không gửi Web Push qua hạ tầng APNs/FCM của trình duyệt người dùng.
4. **Không cấu thành Bằng chứng Sao lưu Định kỳ Ngoài Máy chủ (Not Off-Host Backup Proof - NFR-08)**:
   - Dữ liệu trong bài kiểm thử khói được lưu trữ trên các volume tạm thời và được xóa sạch sau khi hoàn tất.
   - Không thay thế việc thiết lập cron scheduler hạ tầng độc lập cho lệnh `pnpm db:backup` và quy trình mã hóa đồng bộ bản sao lưu ra kho lưu trữ ngoài máy chủ (S3/GCS/KMS).

---

## 3. Ma trận 5 Bước Thực thi & 4 Giao ước Runtime (Acceptance Matrix)

### Quy trình 5 Giai đoạn Thực thi của Runner

Bộ điều phối nghiệm thu (`scripts/production-release-acceptance.mjs`) thực thi tuần tự 5 giai đoạn nghiêm ngặt:

| Giai đoạn | Hành động kiểm chứng | Tiêu chuẩn vượt qua |
| :--- | :--- | :--- |
| **1/5 Validating Compose configuration** | Phân tích cấu hình Compose hợp nhất (`docker compose config --format json`) | Tên project chứa `smoke`, toàn bộ container/volume/network mang hậu tố `smoke`, không chứa định danh `prod`, và các cổng host chỉ bind vào `127.0.0.1`. |
| **2/5 Building / Reusing container images** | Đóng gói container images hoặc tái sử dụng images có sẵn (khi truyền `--no-build`) | Chế độ mặc định build thành công; ở chế độ `--no-build`, bước khởi động tiếp theo sẽ fail nếu thiếu image tương ứng. |
| **3/5 Starting smoke stack containers** | Khởi động toàn bộ stack 7 dịch vụ (`docker compose up -d`) | Lệnh khởi chạy thành công; đăng ký cờ dọn dẹp tài nguyên bắt buộc trong khối `finally`. |
| **4/5 Waiting for service readiness** | Thăm dò chu kỳ (`docker compose ps -a --format json`) trong giới hạn timeout | Container `migrate` thoát với mã `0`; `sms-worker` chạy với `Restarts: 0`; 5 dịch vụ còn lại (`postgres`, `redis`, `rabbitmq`, `api`, `web`) đạt trạng thái `healthy`. |
| **5/5 Asserting runtime contracts** | Gửi các HTTP request kiểm chứng giao ước mạng và phản hồi ứng dụng | Đạt 100% cả 4 giao ước runtime bên dưới. |

---

### Ma trận 4 Giao ước Runtime HTTP/HTTPS

Sau khi stack đạt trạng thái sẵn sàng, runner thực hiện 4 bài kiểm tra giao ước mạng:

| STT | Giao thức & Endpoint | Header truyền vào | Mã HTTP mong đợi | Ngữ nghĩa & Hành vi kiểm chứng |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET http://127.0.0.1:<API_PORT>/api/health/live` | *(Không có `X-Forwarded-Proto`)* | `403 FORBIDDEN` | **Từ chối Plain HTTP**: Khẳng định API từ chối phục vụ khi không đi qua kết nối bảo mật HTTPS từ reverse proxy. |
| 2 | `GET http://127.0.0.1:<API_PORT>/api/health/live` | `X-Forwarded-Proto: https` | `200 OK` | **HTTPS Liveness**: Khẳng định máy chủ API đang hoạt động bình thường, trả về `{ "status": "ok" }` (hỗ trợ cả unwrap response envelope). |
| 3 | `GET http://127.0.0.1:<API_PORT>/api/health/ready` | `X-Forwarded-Proto: https` | `503 SERVICE UNAVAILABLE` | **Pre-locality Readiness**: Khẳng định cơ sở dữ liệu mới migrate xong nhưng chưa được nạp hồ sơ địa bàn (`deployment profile`). Trả về chi tiết `status: "down"` với `database: ok`, `redis: ok`, `rabbitmq: ok`, và `deployment: { status: "down", message: "Deployment profile is not initialized" }`. |
| 4 | `GET http://127.0.0.1:<WEB_PORT>/` | *(Mặc định)* | `200 OK` | **Web Root**: Khẳng định máy chủ Next.js Standalone phản hồi thành công giao diện web trên cổng loopback. |

> [!IMPORTANT]
> **Quy tắc Nghiêm ngặt về HTTP 503**: Phản hồi 503 chỉ được công nhận là hợp lệ khi nguyên nhân duy nhất là hồ sơ địa bàn chưa khởi tạo (`Deployment profile is not initialized`) và cả 3 dịch vụ cơ sở (`database`, `redis`, `rabbitmq`) đều đạt trạng thái `ok`. Tuyệt đối không bình thường hóa mã 503 do lỗi sập kết nối cơ sở dữ liệu, lỗi Redis, RabbitMQ hay crash ứng dụng.

---

## 4. Cơ chế Cô lập Tài nguyên & Dọn dẹp Đảm bảo (Resource Isolation & Cleanup)

Để giảm thiểu rủi ro tác động chéo, runner áp dụng các nguyên tắc cách ly tài nguyên sau. Không chạy đồng thời nhiều phiên smoke trên cùng một Docker daemon vì các phiên dùng chung bộ tên tài nguyên smoke cố định.

### 1. Phân định Danh tính Tài nguyên (Identity Scoping)
- **Tên Project Compose**: `quanlykhupho-production-smoke` (hoàn toàn tách biệt với `quanlykhupho-production` và `quanlykhupho` phát triển).
- **Tên Containers**: `quanlykhupho-postgres-smoke`, `quanlykhupho-redis-smoke`, `quanlykhupho-rabbitmq-smoke`, `quanlykhupho-migrate-smoke`, `quanlykhupho-api-smoke`, `quanlykhupho-worker-smoke`, `quanlykhupho-web-smoke`.
- **Tên Named Volumes**: `quanlykhupho_postgres_smoke_data`, `quanlykhupho_redis_smoke_data`, `quanlykhupho_rabbitmq_smoke_data`, `quanlykhupho_uploads_smoke_data`.
- **Tên Networks**: `quanlykhupho_application_smoke`, `quanlykhupho_data_smoke`.
- **Cổng Loopback Host**: Mặc định sử dụng cổng `127.0.0.1:4010` (API) và `127.0.0.1:3010` (Web), tránh xung đột trực tiếp với cổng phát triển `4000` và `3000`.

### 2. Quản lý Tệp Môi trường Tạm thời (Ephemeral Environment File)
- Runner sinh tệp môi trường tạm ngẫu nhiên chứa các khóa mật mã độc lập (`PHONE_ENCRYPTION_KEY`, `PHONE_HASH_KEY`, `SMS_QUEUE_ENCRYPTION_KEY`, `OTP_PEPPER`) và mật khẩu ngẫu nhiên cho PostgreSQL/RabbitMQ.
- Tệp `.env` tạm thời được lưu trong thư mục tạm hệ thống (`os.tmpdir()`), thiết lập phân quyền `0600`, và được tự động xóa trong khối `finally`.

### 3. Dọn dẹp Đảm bảo trong Khối `finally` (Guaranteed Cleanup)
- Dù quy trình kiểm thử thành công hay thất bại, khối `finally` luôn thực thi lệnh tương đương dưới đây khi tệp môi trường tạm vẫn còn hiệu lực:
  ```bash
  docker compose --project-name quanlykhupho-production-smoke --env-file <temporary-smoke-env> -f docker/docker-compose.production.yml -f docker/docker-compose.production-smoke.yml down -v
  ```
- Nếu cleanup container/volume hoặc xóa tệp môi trường tạm thất bại, gate thất bại đóng (`fail closed`) thay vì báo nghiệm thu thành công.
- **Không sử dụng `--remove-orphans`**: Tránh vô tình dừng hoặc xóa các container khác đang chạy trên máy chủ.
- **Không thực hiện `docker system prune`**: Bảo vệ bộ nhớ đệm build và các tài nguyên phát triển cục bộ.

---

## 5. Hướng dẫn Sử dụng CLI & Tham số (CLI Usage & Options)

### Lệnh Thực thi Cục bộ Tiêu chuẩn

```bash
# 1. Chế độ Mặc định (Tự động build images và chạy smoke test)
pnpm production:acceptance

# 2. Chế độ Tái sử dụng Images đã build sẵn (Bỏ qua bước build - giống CI)
pnpm production:acceptance -- --no-build --tag=verify

# 3. Chạy với cổng tùy chỉnh khi bị trùng cổng 4010/3010
pnpm production:acceptance -- --no-build --tag=verify --api-port=4020 --web-port=3020

# 4. Tăng thời gian chờ cho môi trường máy trạm cấu hình thấp
pnpm production:acceptance -- --no-build --tag=verify --timeout=180000 --poll-interval=2000
```

### Bảng Tham số Dòng lệnh

| Cờ / Tham số | Kiểu dữ liệu | Giá trị mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| `--build` | Boolean | `true` (mặc định) | Yêu cầu Compose build lại images trước khi khởi động. |
| `--no-build` | Boolean | `false` | Bỏ qua bước build image của Compose; sử dụng image có sẵn trong Docker daemon. |
| `--tag=<tag>` | Chuỗi | `verify` (hoặc `APP_IMAGE_TAG`) | Tag của image cần kiểm thử (ví dụ: `verify`, `ci-test`, `2026.08.27-1`). |
| `--api-port=<port>` | Số nguyên | `4010` | Cổng loopback host bind tới container API. |
| `--web-port=<port>` | Số nguyên | `3010` | Cổng loopback host bind tới container Web. |
| `--timeout=<ms>` | Số nguyên | `120000` (120 giây) | Thời gian chờ tối đa để toàn bộ stack đạt trạng thái sẵn sàng. |
| `--poll-interval=<ms>` | Số nguyên | `1000` (1 giây) | Chu kỳ thăm dò trạng thái qua `docker compose ps`. |
| `--help, -h` | Boolean | `false` | Hiển thị hướng dẫn sử dụng. |

---

## 6. Tích hợp Pipeline CI (GitHub Actions CI Integration)

Trong luồng CI (`.github/workflows/ci.yml`), job `container-build` kết hợp việc đóng gói image và nghiệm thu phát hành trong cùng một job duy nhất:

```yaml
  container-build:
    name: Production Container Images Build & Release Acceptance
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.28.0

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build API production image
        run: docker build -f docker/Dockerfile.api -t quanlykhupho-api:ci-test .

      - name: Build Web production image
        run: docker build -f docker/Dockerfile.web --build-arg NEXT_PUBLIC_API_URL=https://example.invalid/api -t quanlykhupho-web:ci-test .

      - name: Run Production Release Acceptance Smoke Gate
        run: pnpm production:acceptance -- --no-build --tag=ci-test
```

### Nguyên tắc Vận hành trong CI:
- **Build một lần duy nhất (Single-Build Principle)**: Images được build tường minh một lần với tag `ci-test`. Runner sau đó được gọi với cờ `--no-build --tag=ci-test`, tuyệt đối không build lại image.
- **Không đẩy lên Registry (Zero Push)**: Quá trình kiểm thử thực thi hoàn toàn trên Docker daemon nội bộ của CI runner, không đẩy image lên bất kỳ registry nào.
- **Không sử dụng Bí mật Thật (Zero Real Secrets)**: Runner tự động sinh thông tin xác thực ngẫu nhiên trong bộ nhớ phiên làm việc của job.
- **Không lưu trữ Artifacts Chứa Dữ liệu Nhạy cảm**: Không tải lên artifact chứa tệp môi trường hay nhật ký thô.

---

## 7. Chẩn đoán Sự cố & Che giấu Dữ liệu Nhạy cảm (Troubleshooting)

Khi có bất kỳ lỗi nào xảy ra trong quá trình kiểm thử, runner tự động thu thập nhật ký chẩn đoán từ `docker compose ps -a` và `docker compose logs --tail=50` trước khi thực hiện dọn dẹp. Mọi thông tin nhạy cảm (mật khẩu CSDL, URL kết nối, khóa mã hóa, API keys) đều được che giấu (`***REDACTED***`) trước khi in ra màn hình.

### Các Sự cố Thường gặp & Biện pháp Khắc phục

#### 1. Lỗi Di chuyển Cơ sở Dữ liệu (`migrate container exited with error code 1`)
- **Nguyên nhân**: Prisma schema không tương thích với cơ sở dữ liệu hoặc tệp SQL migration bị lỗi cú pháp.
- **Khắc phục**: Kiểm tra lại các tệp migration trong `apps/api/prisma/migrations/` và chạy `pnpm --filter @quanlykhupho/api exec prisma validate`.

#### 2. Lỗi SMS Worker Bị Khởi động Lại (`sms-worker has restarted N time(s)`)
- **Nguyên nhân**: Worker gặp sự cố khi kết nối tới RabbitMQ hoặc Redis, hoặc throw uncaught exception khi khởi động.
- **Khắc phục**: Xem chi tiết log được in ra trong phần chẩn đoán của runner; kiểm tra tính tương thích của biến môi trường và kết nối hàng đợi.

#### 3. Lỗi Trùng Cổng Loopback Host (`port is already allocated` hoặc Port collision)
- **Nguyên nhân**: Cổng `4010` hoặc `3010` đang bị chiếm bởi một tiến trình khác trên máy host.
- **Khắc phục**: Chỉ định cổng thay thế qua cờ dòng lệnh:
  ```bash
  pnpm production:acceptance -- --no-build --tag=verify --api-port=4025 --web-port=3025
  ```

#### 4. Lỗi Quá Thời gian Chờ (`Timeout waiting for smoke services readiness`)
- **Nguyên nhân**: Máy trạm hoặc runner CI bị quá tải khiến các dịch vụ container cần nhiều thời gian hơn để hoàn tất healthcheck.
- **Khắc phục**: Tăng giới hạn thời gian chờ qua cờ `--timeout`:
  ```bash
  pnpm production:acceptance -- --no-build --tag=verify --timeout=180000
  ```

#### 5. Lỗi Thiếu Image Khi Chạy Chế độ `--no-build` (`image not found`)
- **Nguyên nhân**: Chưa đóng gói image với tag tương ứng trước khi gọi runner với cờ `--no-build`.
- **Khắc phục**: Đóng gói image trước hoặc bỏ cờ `--no-build` để runner tự động thực hiện build:
  ```bash
  docker build -f docker/Dockerfile.api -t quanlykhupho-api:verify .
  docker build -f docker/Dockerfile.web --build-arg NEXT_PUBLIC_API_URL=https://example.invalid/api -t quanlykhupho-web:verify .
  pnpm production:acceptance -- --no-build --tag=verify
  ```
