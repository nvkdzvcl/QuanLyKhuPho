# Sổ tay Diễn tập Triển khai Địa bàn (Locality Deployment Rehearsal Runbook)

Tài liệu này quy định cấu hình, quy trình thực thi, ma trận kiểm chứng runtime, cơ chế cô lập tài nguyên, dọn dẹp đảm bảo và ranh giới pháp lý cho công cụ diễn tập triển khai địa bàn (**Locality Deployment Rehearsal Runner**) trong dự án **QuanLyKhuPho**.

---

## 1. Mục đích & Phạm vi Diễn tập (Purpose & Scope)

- **Mục đích**: Cung cấp cơ chế diễn tập kỹ thuật tự động xác định (deterministic automated deployment rehearsal) nhằm chứng minh gói cấu hình địa bàn dự thảo (mặc định: Phường Chợ Quán, `deployments/cho-quan/deployment.json`) có thể di trú cơ sở dữ liệu, khởi tạo thành công qua dịch vụ khởi tạo (`locality-init`) và phục vụ chính xác toàn bộ giao ước runtime công khai trong môi trường Docker Compose hoàn toàn cô lập.
- **Phạm vi kỹ thuật**:
  - Thực thi trên cụm dịch vụ Docker Compose sản xuất (`docker/docker-compose.production.yml`) kết hợp cấu hình override diễn tập (`docker/docker-compose.locality-rehearsal.yml`).
  - Kiểm tra cổng an toàn bản nháp nguồn (**Strict Draft Safety Gate**): từ chối diễn tập nếu gói nguồn trong kho mã nguồn không phải là bản nháp chưa xác nhận (`confirmed: false`, không có `confirmedAt`/`confirmedBy`).
  - Sử dụng cơ chế sao chép tạm thời (**Temporary Test-Only Clone**) ngoài kho mã nguồn, chỉ được nạp vào cơ sở dữ liệu kiểm thử cô lập và tự động xóa bỏ sau khi hoàn tất.
  - Khởi chạy một container khởi tạo dùng một lần (`locality-init`) thực thi lệnh `deployment:init --apply --profile=<slug>` sau khi di chuyển schema (`migrate`) thành công và trước khi API khởi động.
  - Kiểm chứng trạng thái hoạt động của 8 dịch vụ: `postgres`, `redis`, `rabbitmq`, `migrate` (thoát mã 0), `locality-init` (thoát mã 0), `api` (healthy), `sms-worker` (chạy liên tục với 0 restarts), và `web` (healthy).
  - Kiểm chứng 6 giao ước HTTP/HTTPS runtime sau khởi tạo: từ chối plain HTTP (`403`), chấp nhận HTTPS liveness (`200`), phản hồi HTTPS readiness sẵn sàng phục vụ (`200 OK` với `deployment: ok`), trả về hồ sơ địa bàn công khai (`initialized: true`, đúng thông tin hành chính, không rò rỉ mã nội bộ/bí mật), trả về danh sách chính xác 25 khu phố (`GET /api/neighborhoods`), và phục vụ trang chủ Web (`200`).
  - Kiểm chứng ranh giới bằng chứng: tệp cấu hình nguồn trong repository được bảo toàn nguyên vẹn từng byte (byte-for-byte unchanged) sau diễn tập.

---

## 2. ⚠️ Tuyên bố Ranh giới Bằng chứng & Pháp lý (Evidence & Legal Boundary Notice)

Việc thực thi thành công lệnh `pnpm locality:rehearsal` cung cấp **bằng chứng kiểm thử kỹ thuật trong môi trường cô lập (Technical Verification Evidence)**. Bằng chứng này có ranh giới phân định rõ ràng và **tuyệt đối không thay thế các điều kiện pháp lý và vận hành sau**:

1. **Bản sao Tạm thời là Cơ chế Kỹ thuật Thuần túy (Temporary Clone is a Technical Mechanism Only)**:
   - Runner tự động tạo một bản sao tạm thời có cờ xác nhận kỹ thuật (`confirmed: true`, `confirmedBy: Automated Locality Rehearsal (Technical Verification Only - NOT Operational Approval)`) trong thư mục tạm hệ thống (`os.tmpdir()`) để nạp vào CSDL kiểm thử.
   - Bản sao tạm thời này **không phải là sự phê duyệt pháp lý, không phải là sự chấp thuận vận hành (not operational approval)**, và **không phải là gói triển khai sản xuất có thể tái sử dụng**.
2. **Không Chứng minh Danh sách Khu phố đã có Quyết định Pháp lý Cuối cùng (Not Proof of Final Legal Decision)**:
   - Việc hệ thống khởi tạo và phục vụ thành công 25 khu phố trong môi trường kiểm thử **không cấu thành bằng chứng** rằng danh mục 25 khu phố là phương án pháp lý cuối cùng sau khi hoàn tất đề án sắp xếp khu phố của địa phương.
   - Tuyệt đối không suy diễn kết quả diễn tập kỹ thuật thành thẩm quyền kích hoạt hệ thống sản xuất thực tế khi cơ quan nhà nước có thẩm quyền chưa ban hành Nghị quyết/Quyết định chính thức.
3. **Bảo vệ Tính Bất biến của Gói Cấu hình Nguồn (Source Package Remains Fail-Closed)**:
   - Tệp `deployments/cho-quan/deployment.json` trong kho mã nguồn duy trì trạng thái `confirmed: false`, không có `confirmedAt`/`confirmedBy`.
   - Cơ chế fail-closed ngăn chặn hoàn toàn việc vô tình áp dụng gói cấu hình dự thảo vào cơ sở dữ liệu sản xuất.
4. **Không phải Bằng chứng Kết nối Hạ tầng Viễn thông / Web Push Thực tế**:
   - Tương tự môi trường smoke test, các lệnh diễn tập chạy với webhook HTTPS bất hoạt và không gửi tin nhắn SMS ra nhà mạng hay push notification qua APNs/FCM.

---

## 3. Quy trình 8 Giai đoạn Thực thi & Ma trận Kiểm chứng Runtime (Acceptance Matrix)

### Quy trình 8 Giai đoạn Thực thi Tuần tự của Runner

Bộ điều phối diễn tập (`scripts/locality-deployment-rehearsal.mjs`) thực thi tuần tự 8 giai đoạn nghiêm ngặt:

| Giai đoạn | Hành động kiểm chứng | Tiêu chuẩn vượt qua |
| :--- | :--- | :--- |
| **1/8 Loading & verifying draft source package** | Đọc và kiểm tra tệp gói cấu hình nguồn trong `deployments/<slug>/deployment.json` | Gói nguồn phải tồn tại, hợp lệ theo schemaVersion=1, bắt buộc có `confirmed: false` và **không được chứa** các trường `confirmedAt` hay `confirmedBy`. |
| **2/8 Materializing temporary test-only clone** | Tạo thư mục tạm tại `os.tmpdir()`, ghi tệp marker an toàn và bản sao `deployment.json` với cờ xác nhận kiểm thử kỹ thuật | Bản sao tạm thời được tạo thành công với quyền `0600`, chứa `confirmed: true` kèm ghi chú kỹ thuật rõ ràng; gói nguồn trong repo không bị chỉnh sửa. |
| **3/8 Validating Compose configuration** | Phân tích cấu hình Compose hợp nhất (`docker compose config --format json`) | Tên project chứa `rehearsal`, toàn bộ container/volume/network mang hậu tố `rehearsal`, dịch vụ `locality-init` mount thư mục deployments tạm ở chế độ chỉ đọc (`:ro`), và các cổng host chỉ bind vào `127.0.0.1`. |
| **4/8 Building / Reusing container images** | Đóng gói container images hoặc tái sử dụng images có sẵn (khi truyền `--no-build`) | Chế độ mặc định build thành công; ở chế độ `--no-build`, tái sử dụng image có sẵn với tag chỉ định (ví dụ: `verify` hoặc `ci-test`). |
| **5/8 Starting rehearsal stack containers** | Khởi động toàn bộ stack 8 dịch vụ (`docker compose up -d`) | Lệnh khởi chạy thành công; đăng ký cờ dọn dẹp tài nguyên bắt buộc trong khối `finally`. |
| **6/8 Waiting for locality initialization and service readiness** | Thăm dò chu kỳ (`docker compose ps -a --format json`) trong giới hạn timeout | Container `migrate` thoát với mã `0`; container `locality-init` thoát với mã `0`; `sms-worker` chạy liên tục với `Restarts: 0`; 5 dịch vụ còn lại (`postgres`, `redis`, `rabbitmq`, `api`, `web`) đạt trạng thái `healthy`. |
| **7/8 Asserting runtime contracts** | Gửi các HTTP request kiểm chứng giao ước mạng và phản hồi ứng dụng sau khởi tạo | Đạt 100% cả 6 giao ước runtime bên dưới. |
| **8/8 Verifying evidence boundary** | Đọc lại tệp gói cấu hình nguồn trong kho mã nguồn | Tệp nguồn trong `deployments/<slug>/deployment.json` hoàn toàn trùng khớp từng byte so với trước khi diễn tập. |

---

### Ma trận 6 Giao ước Runtime HTTP/HTTPS Sau Khởi tạo Địa bàn

Sau khi stack đạt trạng thái sẵn sàng, runner thực hiện 6 bài kiểm tra giao ước mạng:

| STT | Giao thức & Endpoint | Header truyền vào | Mã HTTP mong đợi | Ngữ nghĩa & Hành vi kiểm chứng |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET http://127.0.0.1:<API_PORT>/api/health/live` | *(Không có `X-Forwarded-Proto`)* | `403 FORBIDDEN` | **Từ chối Plain HTTP**: Khẳng định API từ chối phục vụ khi request không đi qua kết nối bảo mật HTTPS từ reverse proxy. |
| 2 | `GET http://127.0.0.1:<API_PORT>/api/health/live` | `X-Forwarded-Proto: https` | `200 OK` | **HTTPS Liveness**: Khẳng định máy chủ API đang hoạt động bình thường, trả về `{ "status": "ok" }`. |
| 3 | `GET http://127.0.0.1:<API_PORT>/api/health/ready` | `X-Forwarded-Proto: https` | `200 OK` | **Post-locality Readiness**: Khẳng định sau khi `locality-init` hoàn tất, hệ thống đã nạp hồ sơ địa bàn và sẵn sàng phục vụ. Toàn bộ `database`, `redis`, `rabbitmq`, và `deployment` đều đạt trạng thái `ok`. |
| 4 | `GET http://127.0.0.1:<API_PORT>/api/deployment-profile` | `X-Forwarded-Proto: https` | `200 OK` | **Public Deployment Profile**: Khẳng định hồ sơ địa bàn công khai trả về `initialized: true`, đúng `slug` (`cho-quan`), đúng mã địa bàn (`27301`), đúng tên địa bàn (`Phường Chợ Quán`), và `confirmed: true` trong CSDL diễn tập. Đồng thời kiểm chứng **không rò rỉ** các trường nội bộ như `singletonKey`, `id`, hay `confirmedBy`. |
| 5 | `GET http://127.0.0.1:<API_PORT>/api/neighborhoods` | `X-Forwarded-Proto: https` | `200 OK` | **Neighborhoods Contract**: Khẳng định danh sách khu phố trả về chính xác **25 khu phố**, khớp toàn bộ mã kỹ thuật (`KP-01` đến `KP-25`), tên hiển thị (`Khu phố 1` đến `Khu phố 25`), và tên phường (`Phường Chợ Quán`). |
| 6 | `GET http://127.0.0.1:<WEB_PORT>/` | *(Mặc định)* | `200 OK` | **Web Root**: Khẳng định máy chủ Next.js Standalone phản hồi thành công giao diện web trên cổng loopback diễn tập. |

---

## 4. Cơ chế Cô lập Tài nguyên, Tuần tự hóa & Dọn dẹp Đảm bảo (Resource Isolation & Cleanup)

### 1. Phân định Danh tính Tài nguyên Cô lập (Identity Scoping)
- **Tên Project Compose**: `quanlykhupho-locality-rehearsal` (hoàn toàn tách biệt với `quanlykhupho-production`, `quanlykhupho-production-smoke` và `quanlykhupho` phát triển).
- **Tên Containers**: `quanlykhupho-postgres-rehearsal`, `quanlykhupho-redis-rehearsal`, `quanlykhupho-rabbitmq-rehearsal`, `quanlykhupho-migrate-rehearsal`, `quanlykhupho-locality-init-rehearsal`, `quanlykhupho-api-rehearsal`, `quanlykhupho-worker-rehearsal`, `quanlykhupho-web-rehearsal`.
- **Tên Named Volumes**: `quanlykhupho_postgres_rehearsal_data`, `quanlykhupho_redis_rehearsal_data`, `quanlykhupho_rabbitmq_rehearsal_data`, `quanlykhupho_uploads_rehearsal_data`.
- **Tên Networks**: `quanlykhupho_application_rehearsal`, `quanlykhupho_data_rehearsal` (mạng dữ liệu cô lập nội bộ `internal: true`).
- **Cổng Loopback Host Cố định**: Mặc định sử dụng cổng `127.0.0.1:4011` (API) và `127.0.0.1:3011` (Web), tách biệt khỏi cổng phát triển (`4000`/`3000`) và cổng smoke test (`4010`/`3010`).

### 2. Tuần tự hóa Tài nguyên Cố định (Fixed Resource Serialization)
- Vì môi trường diễn tập sử dụng một bộ định danh Compose và cổng loopback cố định (`4011`/`3011`), các phiên diễn tập **không được chạy song song đồng thời trên cùng một Docker daemon** nhằm tránh xung đột tài nguyên hoặc tranh chấp container/volume.

### 3. Quản lý Tệp Môi trường & Bản sao Tạm thời (Ephemeral Artifacts Management)
- **Tệp `.env` Tạm thời**: Sinh ngẫu nhiên các khóa mật mã độc lập (`PHONE_ENCRYPTION_KEY`, `PHONE_HASH_KEY`, `SMS_QUEUE_ENCRYPTION_KEY`, `OTP_PEPPER`) và mật khẩu PostgreSQL/RabbitMQ riêng biệt; lưu trong `os.tmpdir()` với phân quyền `0600`.
- **Thư mục Bản sao Địa bàn Tạm thời**: Được tạo với tiền tố `locality-rehearsal-` trong `os.tmpdir()`, gắn tệp marker định danh `.quanlykhupho-locality-rehearsal`. Dịch vụ `locality-init` mount thư mục này vào `/app/deployments` ở chế độ chỉ đọc (`:ro`), đảm bảo container không thể ghi đè hay sửa đổi ngược lại tệp cấu hình.

### 4. Dọn dẹp Đảm bảo trong Khối `finally` (Guaranteed Cleanup)
- Dù diễn tập thành công hay thất bại, khối `finally` luôn thực thi đầy đủ 3 bước dọn dẹp theo thứ tự:
  1. Dừng và xóa toàn bộ container, mạng và volume diễn tập (`docker compose down -v`).
  2. Xóa tệp môi trường tạm thời `.env`.
  3. Kiểm tra tệp marker định danh và xóa toàn bộ thư mục bản sao tạm thời.
- Nếu bất kỳ bước dọn dẹp nào thất bại, runner ghi nhận lỗi và chuyển trạng thái thành thất bại đóng (`fail closed`).
- **Không sử dụng `--remove-orphans`**: Tránh vô tình dừng các container khác trên hệ thống.
- **Không thực hiện `docker system prune`**: Bảo vệ tài nguyên và bộ nhớ đệm phát triển cục bộ.

---

## 5. Hướng dẫn Sử dụng CLI & Tham số (CLI Usage & Options)

### Điều kiện tiên quyết

- Chạy từ thư mục gốc repository bằng Node.js và pnpm đúng phiên bản khai báo trong `package.json`.
- Docker Engine/Desktop phải đang hoạt động và hỗ trợ Docker Compose v2.
- Cổng loopback mặc định `4011` và `3011` phải trống, hoặc truyền cổng khác qua CLI.
- Chế độ `--no-build` yêu cầu cả hai image `quanlykhupho-api:<tag>` và `quanlykhupho-web:<tag>` đã tồn tại trên cùng Docker daemon.

### Lệnh Thực thi Tiêu chuẩn

```bash
# 1. Chế độ Mặc định (Tự động build images và chạy diễn tập địa bàn Chợ Quán)
pnpm locality:rehearsal

# 2. Chế độ Tái sử dụng Images đã build sẵn (Bỏ qua bước build - tối ưu cho kiểm thử lặp lại)
pnpm locality:rehearsal -- --no-build --tag=verify

# 3. Chỉ định slug địa bàn khác (khi có gói dự thảo khác)
pnpm locality:rehearsal -- --profile=cho-quan

# 4. Chạy với cổng tùy chỉnh khi bị trùng cổng 4011/3011
pnpm locality:rehearsal -- --no-build --tag=verify --api-port=4021 --web-port=3021

# 5. Tăng thời gian chờ cho máy trạm cấu hình thấp
pnpm locality:rehearsal -- --no-build --tag=verify --timeout=180000 --poll-interval=2000
```

### Bảng Tham số Dòng lệnh

| Cờ / Tham số | Kiểu dữ liệu | Giá trị mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| `--build` | Boolean | `true` (mặc định) | Yêu cầu Compose build lại container images trước khi khởi động. |
| `--no-build` | Boolean | `false` | Bỏ qua bước build image của Compose; sử dụng container images có sẵn trong Docker daemon. |
| `--tag=<tag>` | Chuỗi | `verify` (hoặc `APP_IMAGE_TAG`) | Tag của image cần kiểm thử (ví dụ: `verify`, `ci-test`). |
| `--profile=<slug>` | Chuỗi | `cho-quan` | Slug hồ sơ địa bàn cần diễn tập (tương ứng thư mục `deployments/<slug>/`). |
| `--api-port=<port>` | Số nguyên | `4011` | Cổng loopback host bind tới container API. |
| `--web-port=<port>` | Số nguyên | `3011` | Cổng loopback host bind tới container Web. |
| `--timeout=<ms>` | Số nguyên | `120000` (120 giây) | Thời gian chờ tối đa để toàn bộ stack đạt trạng thái sẵn sàng. |
| `--poll-interval=<ms>` | Số nguyên | `1000` (1 giây) | Chu kỳ thăm dò trạng thái container qua `docker compose ps`. |
| `--help, -h` | Boolean | `false` | Hiển thị hướng dẫn sử dụng dòng lệnh. |

---

## 6. Chẩn đoán Sự cố & Che giấu Dữ liệu Nhạy cảm (Troubleshooting & Redaction)

Khi có bất kỳ lỗi nào xảy ra trong quá trình diễn tập, runner tự động thu thập nhật ký chẩn đoán từ `docker compose ps -a` và `docker compose logs --tail=50` trước khi tiến hành dọn dẹp tài nguyên. Mọi dữ liệu nhạy cảm (mật khẩu CSDL, chuỗi kết nối, khóa mã hóa điện thoại/hàng đợi, OTP pepper, API key) đều được che giấu tự động (`***REDACTED***`) trước khi xuất ra console.

### Các Sự cố Thường gặp & Biện pháp Khắc phục

#### 1. Lỗi Khởi tạo Địa bàn (`locality-init container exited with error code 1`)
- **Nguyên nhân**: Tệp cấu hình địa bàn bị lỗi cú pháp, vi phạm schema, hoặc có lỗi xung đột trong quá trình ghi CSDL.
- **Khắc phục**: Kiểm tra nhật ký container `locality-init` trong phần chẩn đoán; kiểm tra tính hợp lệ của tệp `deployment.json` qua lệnh dry-run `pnpm deployment:init -- --profile cho-quan`.

#### 2. Lỗi Cổng Bản Nháp Bị Vi Phạm (`Rehearsal safety gate violation: source package must be an unconfirmed draft`)
- **Nguyên nhân**: Tệp `deployments/<slug>/deployment.json` trong kho mã nguồn đã bị đặt `confirmed: true` hoặc có chứa trường `confirmedAt`/`confirmedBy`.
- **Khắc phục**: Khôi phục tệp cấu hình nguồn về trạng thái bản nháp (`confirmed: false`, xóa bỏ `confirmedAt` và `confirmedBy`). Diễn tập kỹ thuật chỉ chấp nhận gói cấu hình nguồn ở trạng thái dự thảo.

#### 3. Lỗi Di chuyển Cơ sở Dữ liệu (`migrate container exited with error code 1`)
- **Nguyên nhân**: Prisma schema không tương thích hoặc tệp SQL migration bị lỗi cú pháp.
- **Khắc phục**: Kiểm tra lại các migration trong `apps/api/prisma/migrations/` và chạy `pnpm --filter @quanlykhupho/api exec prisma validate`.

#### 4. Lỗi Trùng Cổng Loopback Host (`port is already allocated` hoặc Port collision)
- **Nguyên nhân**: Cổng `4011` hoặc `3011` đang bị chiếm bởi một tiến trình khác trên máy host.
- **Khắc phục**: Chỉ định cổng thay thế qua cờ `--api-port` và `--web-port`:
  ```bash
  pnpm locality:rehearsal -- --no-build --tag=verify --api-port=4025 --web-port=3025
  ```

#### 5. Lỗi Quá Thời gian Chờ (`Timeout waiting for rehearsal services readiness`)
- **Nguyên nhân**: Máy trạm bị quá tải khiến các container cần nhiều thời gian hơn để hoàn tất migration và healthcheck.
- **Khắc phục**: Tăng thời gian chờ qua cờ `--timeout`:
  ```bash
  pnpm locality:rehearsal -- --no-build --tag=verify --timeout=180000
  ```

#### 6. Lỗi Thiếu Image Khi Chạy Chế độ `--no-build` (`image not found`)
- **Nguyên nhân**: Chưa đóng gói image với tag tương ứng trước khi gọi runner với cờ `--no-build`.
- **Khắc phục**: Đóng gói image trước hoặc bỏ cờ `--no-build` để runner tự động thực hiện build:
  ```bash
  docker build -f docker/Dockerfile.api -t quanlykhupho-api:verify .
  docker build -f docker/Dockerfile.web --build-arg NEXT_PUBLIC_API_URL=https://example.invalid/api -t quanlykhupho-web:verify .
  pnpm locality:rehearsal -- --no-build --tag=verify
  ```
