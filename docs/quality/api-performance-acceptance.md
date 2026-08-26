# Sổ tay Nghiệm thu Hiệu năng API (API Performance Acceptance Runbook)

Tài liệu này quy định cấu hình kiểm thử, ma trận đo lường, công thức phân vị xác định, cơ chế cô lập dữ liệu và ranh giới bằng chứng kỹ thuật cho bộ rào chắn nghiệm thu độ trễ API (**SRS NFR-03: API latency p95 < 500ms**) trong dự án **QuanLyKhuPho**.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Cung cấp rào chắn nghiệm thu tự động (deterministic acceptance gate) đo lường độ trễ phản hồi thực tế của máy chủ API (NestJS) kết nối trực tiếp với cơ sở dữ liệu PostgreSQL, bộ nhớ đệm Redis và hàng đợi RabbitMQ.
- **Phạm vi kỹ thuật**:
  - Kiểm thử thuần request HTTP (`@playwright/test` request-only harness qua `playwright.performance.config.ts`), không khởi chạy giao diện trình duyệt web, tối ưu thời gian thực thi trong CI.
  - Đo lường trên bản build production thực tế của Backend API (`apps/api/dist/main.js`).
  - Khẳng định không có lỗi HTTP/envelope và độ trễ phân vị $p95 < 500\text{ ms}$ cho từng endpoint đại diện cũng như trên toàn bộ tập mẫu đo gộp (Aggregate).

---

## 2. ⚠️ Tuyên bố Ranh giới Bằng chứng (Evidence Boundary Notice)

Việc thực thi thành công bộ kiểm thử `pnpm perf:api` cung cấp **bằng chứng phòng thí nghiệm / tiền kiểm tra CI xác định (Deterministic Lab/CI Preflight Evidence)**. Bằng chứng này được phân định rõ ràng với các giới hạn sau:

1. **Không phải Kiểm thử Tải Chịu tải Sản xuất (Not a Production Load / Stress Test)**:
   - Bộ kiểm thử sử dụng độ đồng thời giới hạn ($N=5$) để đánh giá độ trễ xử lý nghiệp vụ chuẩn trong điều kiện có tải nhẹ.
   - Không mô phỏng hàng ngàn người dùng truy cập đồng thời, không ngâm tải thời gian dài (soak test) và không kiểm tra giới hạn phá hủy hạ tầng.
2. **Không phải Bằng chứng Giám sát APM Thời gian Thực (Not APM Production Proof)**:
   - Môi trường đo lường chạy trên mạng loopback cục bộ / CI runner, không bao gồm độ trễ đường truyền Internet thực tế, mất gói, định tuyến mạng diện rộng (WAN), hay hiện tượng nghẽn mạng từ phía nhà mạng di động.
   - Cần thiết lập hệ thống APM (OpenTelemetry / Prometheus) trên môi trường Staging/Production để giám sát p95 thực tế khi vận hành.
3. **Không phải Cam kết Năng lực Quy mô (Not a Capacity Claim)**:
   - Kết quả đo lường không đại diện cho thông lượng tối đa (throughput / RPS limit) của cụm máy chủ sản xuất.
4. **Không phải Bằng chứng Điểm số Google PageSpeed (Not a PageSpeed Proof)**:
   - Điểm số Google PageSpeed Insights $\ge 80$ theo SRS NFR-03 là chỉ số hiệu năng phía frontend trên mạng Internet và bắt buộc phải đo lường độc lập trên URL production.

---

## 3. Danh sách Endpoints Đại diện & Ma trận Đo lường

Bộ kiểm thử thực hiện đo lường trên 5 GET endpoints đại diện cho các luồng dữ liệu cốt lõi của hệ thống (từ công khai đến phân quyền Cán bộ phường toàn địa bàn):

| STT | Phương thức & Endpoint | Quyền hạn truy cập | Mục đích kiểm chứng hiệu năng |
| :--- | :--- | :--- | :--- |
| 1 | `GET /api/deployment-profile` | Công khai (Public) | Đọc cấu hình hồ sơ địa bàn đang hoạt động từ cơ sở dữ liệu |
| 2 | `GET /api/neighborhoods` | Công khai (Public) | Truy vấn danh sách toàn bộ khu phố / tổ dân phố trực thuộc địa bàn |
| 3 | `GET /api/auth/me` | Cán bộ (`officer`) | Kiểm tra tính hợp lệ của phiên làm việc Redis (sliding TTL 7 ngày) và truy vấn thông tin tài khoản |
| 4 | `GET /api/dashboard/ward-overview` | Cán bộ (`officer`) | Tổng hợp số liệu thống kê toàn phường từ nhiều bảng dữ liệu PostgreSQL |
| 5 | `GET /api/petitions` | Cán bộ (`officer`) | Truy vấn danh sách kiến nghị phản ánh phân trang phạm vi toàn phường |

### Cấu hình Thực thi Đo lường

- **Khởi động (Warm-up)**: Thực hiện **5 requests** khởi động trước mỗi endpoint để làm ấm trình biên dịch JIT của Node.js, khởi tạo connection pool của Prisma (PostgreSQL) và kết nối Redis/RabbitMQ. Dữ liệu warm-up không tính vào mẫu đo lường.
- **Số lượng mẫu đo (Sample Count)**: Thu thập **30 requests** đo lường độc lập cho mỗi endpoint (tổng cộng **150 requests** cho toàn bộ 5 endpoints).
- **Độ đồng thời (Bounded Concurrency)**: Duy trì chính xác **5 workers** gửi request đồng thời (`concurrency = 5`), mô phỏng tải song song có kiểm soát.
- **Phương pháp tính Phân vị (Nearest-Rank Percentile)**:
  - Cho mảng $L = [l_0, l_1, \dots, l_{N-1}]$ là danh sách $N$ mẫu độ trễ đã sắp xếp tăng dần.
  - Với phân vị $P \in (0, 100]$:
    $$\text{rank} = \left\lceil \frac{P}{100} \times N \right\rceil$$
    $$\text{index} = \max(0, \min(N - 1, \text{rank} - 1))$$
    $$\text{Percentile}(P) = L[\text{index}]$$
  - Phương pháp Nearest-Rank đảm bảo tính **xác định (deterministic)**, giá trị trả về là **giá trị đo thực tế**, và có tính **đơn điệu** ($p50 \le p95 \le p99$).

---

## 4. Tiêu chuẩn Nghiệm thu Nghiêm ngặt (Acceptance Criteria)

Bộ kiểm thử tự động áp dụng các tiêu chí nghiệm thu nghiêm ngặt không thỏa hiệp:

1. **Không có Bất kỳ Lỗi nào (Zero-Error)**:
   - 100% mẫu request phải trả về mã HTTP `200 OK`.
   - Cấu trúc response envelope bắt buộc có `success === true`.
   - Bất kỳ lỗi HTTP (4xx, 5xx), lỗi envelope, timeout hoặc exception mạng nào đều tính là thất bại (`failureCount > 0`) và làm trượt bộ kiểm thử ngay lập tức.
2. **Ngưỡng p95 Nghiêm ngặt (Strict p95 < 500ms)**:
   - Phân vị $p95 < 500\text{ ms}$ cho từng endpoint riêng biệt trong số 5 endpoints.
   - Phân vị $p95 < 500\text{ ms}$ trên toàn bộ tập mẫu đo gộp 150 requests (Aggregate $p95$).
3. **Bảo mật Thông tin Tuyệt đối (Privacy & Zero-Leak)**:
   - Toàn bộ quá trình đo lường không in số điện thoại, mã OTP, session cookie, auth token hoặc payload nhạy cảm ra màn hình console hay tệp báo cáo đính kèm.

---

## 5. Cô lập Môi trường & Khởi tạo Dữ liệu (Environment & Data Isolation)

Trước khi chạy đo lường, quy trình chuẩn bị (`apps/api/test/fullstack/prepare.mjs`) tự động thiết lập môi trường dữ liệu cách ly an toàn:

1. **Kiểm tra An toàn Địa chỉ Cục bộ (Loopback Safety Check)**:
   - Bắt buộc `DATABASE_URL` và `REDIS_URL` phải trỏ về máy chủ loopback cục bộ (`localhost`, `127.0.0.1`, `::1`). Từ chối chạy nếu trỏ tới IP từ xa.
2. **Cô lập Schema PostgreSQL (`qlkp_e2e`)**:
   - Chỉ thao tác trên schema `qlkp_e2e` (`DATABASE_URL=...schema=qlkp_e2e`).
   - Xóa schema cũ (`DROP SCHEMA IF EXISTS "qlkp_e2e" CASCADE`) và tạo mới (`CREATE SCHEMA "qlkp_e2e"`).
   - Tuyệt đối không can thiệp vào schema `public` chứa dữ liệu phát triển hoặc sản xuất.
   - Chạy Prisma migration deploy để thiết lập cấu trúc bảng mới nhất.
3. **Cô lập Cơ sở Dữ liệu Redis (Redis DB 15)**:
   - Bắt buộc URL Redis phải chỉ định Database 15 (`redis://localhost:6379/15`).
   - Xóa sạch dữ liệu cũ (`FLUSHDB`) trên DB 15, hoàn toàn không ảnh hưởng tới DB 0 dùng cho phát triển.
4. **Khởi tạo Hồ sơ Địa bàn & Tài khoản Cán bộ**:
   - Áp dụng gói địa bàn kiểm thử `e2e` đã xác nhận (`--deployment-init --profile e2e --apply`).
   - Khởi tạo tài khoản Cán bộ phường giả lập (`0901234567`).
   - Đăng nhập Cán bộ qua cơ chế Dev SMS Inbox nội bộ (`/api/dev/sms-inbox`) trên bộ nhớ máy chủ, không gửi SMS thật ra bên ngoài.

---

## 6. Hướng dẫn Thực thi Cục bộ & Biến Môi trường

### Lệnh Thực thi Tiêu chuẩn

Từ thư mục gốc repository (yêu cầu Docker services PostgreSQL, Redis, RabbitMQ đang chạy):

```bash
pnpm perf:api
```

Lệnh trên sẽ tự động:
1. Build các gói phụ thuộc cần thiết (`turbo run build --filter=@quanlykhupho/api...`).
2. Khởi tạo và làm sạch môi trường cô lập (`node apps/api/test/fullstack/prepare.mjs`).
3. Khởi động máy chủ API NestJS trên cổng `4000`.
4. Thực thi 6 bài kiểm thử hiệu năng Playwright và xuất báo cáo.

### Thực thi với Biến Môi trường E2E Tùy chỉnh

Nếu chạy hạ tầng trên cổng tùy chỉnh (ví dụ: PostgreSQL trên cổng 5432 hoặc 5433):

```bash
# Môi trường với PostgreSQL 5432 (Chuẩn CI)
E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quanlykhupho?schema=qlkp_e2e" \
E2E_REDIS_URL="redis://localhost:6379/15" \
E2E_RABBITMQ_URL="amqp://guest:guest@localhost:5672" \
pnpm perf:api

# Môi trường với PostgreSQL 5433 (theo cấu hình root .env.example của repository)
E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quanlykhupho?schema=qlkp_e2e" \
E2E_REDIS_URL="redis://localhost:6379/15" \
E2E_RABBITMQ_URL="amqp://guest:guest@localhost:5672" \
pnpm perf:api
```

---

## 7. Vị trí Báo cáo & Bằng chứng Kiểm thử (Artifacts)

Sau khi kiểm thử hoàn tất, các tệp báo cáo được lưu trữ tại:

- **Báo cáo HTML Playwright**: Thư mục `playwright-report-performance/`
  - Xem báo cáo trực quan qua lệnh:
    ```bash
    pnpm exec playwright show-report playwright-report-performance
    ```
- **Kết quả Kiểm thử & Traces**: Thư mục `test-results-performance/` (tự động ghi trace khi có kiểm thử thất bại).
- **Bản Tóm tắt Bảng Phân phối Độ trễ (Summary Table)**: Tệp `api-latency-acceptance-summary.txt` được đính kèm vào Playwright test runner và in trực tiếp ra console, ví dụ:

```text
+----------------------------------------+-----------+------------+-------------+-------------+-------------+----------+
| Endpoint                               |   Samples |   Failures |    p50 (ms) |    p95 (ms) |    p99 (ms) |   Status |
+----------------------------------------+-----------+------------+-------------+-------------+-------------+----------+
| GET /api/deployment-profile            |        30 |          0 |        4.12 |        8.45 |       12.30 |     PASS |
| GET /api/neighborhoods                 |        30 |          0 |        5.20 |       10.15 |       14.80 |     PASS |
| GET /api/auth/me                       |        30 |          0 |        6.80 |       12.40 |       18.10 |     PASS |
| GET /api/dashboard/ward-overview       |        30 |          0 |       15.30 |       35.60 |       48.20 |     PASS |
| GET /api/petitions                     |        30 |          0 |       18.40 |       42.10 |       55.90 |     PASS |
+----------------------------------------+-----------+------------+-------------+-------------+-------------+----------+
| AGGREGATE (5 endpoints)                |       150 |          0 |        8.90 |       38.50 |       52.40 |     PASS |
+----------------------------------------+-----------+------------+-------------+-------------+-------------+----------+
```

---

## 8. Xử lý Sự cố Thường gặp (Troubleshooting)

### 1. Lỗi Kết nối Hạ tầng (`Connection Refused` hoặc `E2E Postgres/Redis validation failed`)
- **Nguyên nhân**: Docker containers chưa được khởi động hoặc cổng dịch vụ không khớp.
- **Khắc phục**:
  1. Kiểm tra trạng thái hạ tầng:
     ```bash
     docker compose -f docker/docker-compose.yml ps
     ```
  2. Khởi động lại các dịch vụ:
     ```bash
     docker compose -f docker/docker-compose.yml up -d
     ```
  3. Kiểm tra cổng PostgreSQL: Docker Compose dùng cổng host `5432` khi không đặt `POSTGRES_PORT`; tệp root `.env.example` của repository đặt `POSTGRES_PORT=5433`. Hãy truyền `E2E_DATABASE_URL` khớp với cấu hình môi trường đang dùng.

### 2. Lỗi Kiểm tra An toàn Schema hoặc Redis DB
- **Nguyên nhân**: Script `prepare.mjs` từ chối thực thi do `DATABASE_URL` không có `schema=qlkp_e2e` hoặc `REDIS_URL` không trỏ vào DB `15`.
- **Khắc phục**: Đảm bảo chuỗi kết nối tuân thủ quy tắc cô lập, ví dụ:
  - `postgresql://postgres:postgres@localhost:5433/quanlykhupho?schema=qlkp_e2e`
  - `redis://localhost:6379/15`

### 3. Lỗi Thiếu Bản Build API (`Built API entrypoint not found at: apps/api/dist/main.js`)
- **Nguyên nhân**: Mã nguồn NestJS chưa được biên dịch.
- **Khắc phục**: Chạy lệnh build toàn bộ dự án trước khi chạy kiểm thử:
  ```bash
  pnpm build
  ```

### 4. Lỗi Độ trễ Vượt Ngưỡng ($p95 \ge 500\text{ ms}$)
- **Nguyên nhân**: Máy trạm bị nghẽn tài nguyên CPU/RAM, cơ sở dữ liệu xử lý truy vấn chậm, hoặc connection pool bị quá tải.
- **Khắc phục**:
  1. Kiểm tra tải CPU/RAM trên máy chủ hoặc runner CI trong quá trình đo lường.
  2. Xem chi tiết bảng phân phối độ trễ từng endpoint để xác định endpoint cụ thể bị chậm.
  3. Kiểm tra log NestJS và các câu truy vấn Prisma (ví dụ: thiếu index hoặc truy vấn N+1).
