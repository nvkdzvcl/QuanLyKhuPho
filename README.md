# QuanLyKhuPho (Quản Lý Khu Phố)

Nền tảng số hoá quản lý khu phố và tổ dân phố phục vụ Cư dân (Resident), Trưởng khu phố (Leader) và Cán bộ phường (Officer).

---

## 🏗 Cấu trúc Monorepo (Monorepo Architecture)

Dự án được xây dựng dưới dạng monorepo sử dụng **pnpm workspaces** và **Turborepo**:

```text
QuanLyKhuPho/
├── apps/
│   ├── api/                    # NestJS Backend API (Global prefix: /api, Port: 4000)
│   │   ├── prisma/             # Prisma 6 schema & deterministic PostgreSQL migrations
│   │   └── src/
│   │       ├── auth/           # OTP & 7-day Renewable Redis Session Management
│   │       ├── users/          # Resident Moderation & Leader Assignment
│   │       ├── neighborhoods/  # Neighborhood lookup & local-development seed
│   │       ├── security/       # Phone normalization, AES-256-GCM, HMAC Hashing, CSRF & RBAC Guards
│   │       ├── rabbitmq/       # Encrypted SMS Queue Publisher (AES-256-GCM)
│   │       └── redis/          # Atomic Lua scripts for rate-limiting & lockouts
│   └── web/                    # Next.js App Router Frontend (Port: 3000)
│       └── src/
│           ├── components/     # Vietnamese Mobile-first Auth & Role-based Dashboard Views
│           └── lib/            # Axios API client & AuthContext session management
├── packages/
│   ├── shared-types/           # Contracts, DTOs và enums (UserRole, AccountStatus, ErrorCode)
│   ├── ui/                     # Accessible UI components (Button, Input, Select, Modal, Badge, Toast, Card)
│   ├── typescript-config/      # Cấu hình tsconfig dùng chung
│   └── eslint-config/          # Cấu hình ESLint 9 dùng chung
├── docker/
│   └── docker-compose.yml      # Hạ tầng cục bộ (PostgreSQL 16, Redis 7, RabbitMQ 3.13)
├── .github/
│   └── workflows/ci.yml        # CI Pipeline kiểm tra lint, typecheck, test, build
└── turbo.json                  # Cấu hình pipeline Turborepo
```

---

## ⚙️ Yêu cầu môi trường (Prerequisites)

- **Node.js**: `>= 22.0.0` (Khuyến nghị `v22.19.0+`)
- **pnpm**: `>= 10.0.0` (Được ghim tại `10.28.0` theo `packageManager`)
- **Docker & Docker Compose**: Docker `>= 26.0` và Docker Compose `>= 2.20`

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### 1. Cài đặt Dependencies

Tại thư mục gốc của repository:

```bash
pnpm install
```

### 2. Thiết lập Biến môi trường (Environment Variables)

Sao chép tệp mẫu môi trường:

```bash
# Biến môi trường tổng thể / mặc định
cp .env.example .env

# Biến môi trường cho API
cp apps/api/.env.example apps/api/.env

# Biến môi trường cho Web
cp apps/web/.env.example apps/web/.env
```

Trong production, bắt buộc điền `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`,
hai khóa độc lập `PHONE_ENCRYPTION_KEY`/`PHONE_HASH_KEY` (mỗi khóa 64 ký tự hex)
và `OTP_PEPPER` dài ít nhất 32 ký tự. Không dùng lại giá trị giữa các môi trường;
không commit các giá trị này. Development có fallback cục bộ để chạy test, nhưng
production sẽ dừng khởi động nếu thiếu hạ tầng hoặc khóa hợp lệ.

### 3. Khởi chạy Hạ tầng Cục bộ (Local Infrastructure)

Khởi động các dịch vụ PostgreSQL 16, Redis 7 và RabbitMQ 3.13:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Kiểm tra trạng thái healthcheck các container:

```bash
docker compose -f docker/docker-compose.yml ps
```

### 4. Áp dụng Database Migrations (Prisma Migration)

Chạy migration để khởi tạo cấu trúc bảng `neighborhoods` và `accounts` trong PostgreSQL:

```bash
pnpm --filter @quanlykhupho/api prisma:migrate
```

### 5. Chạy chế độ Phát triển (Development Mode)

Chạy đồng thời tất cả ứng dụng qua Turborepo:

```bash
pnpm dev
```

Ứng dụng sẽ sẵn sàng tại:
- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000/api](http://localhost:4000/api)
- **RabbitMQ Management UI**: [http://localhost:15672](http://localhost:15672) (guest / guest)

---

## 🔒 Kiến trúc Bảo mật & Quy tắc Nghiệp vụ (Sprint 1A & 1B Security Architecture)

1. **Mã hóa Số điện thoại & Blind Indexing**:
   - Số điện thoại được lưu trữ trong PostgreSQL dưới dạng mã hóa **AES-256-GCM** (sử dụng IV 12-byte ngẫu nhiên cho mỗi bản ghi).
   - Tra cứu số điện thoại qua trường `phone_hash` tạo bởi thuật toán **HMAC-SHA-256** với khóa bí mật riêng (`PHONE_HASH_KEY`), ngăn chặn rò rỉ dữ liệu khi bị dump cơ sở dữ liệu.
   - Số điện thoại chỉ hiển thị dưới định dạng che mặt nạ (`091***5678`) trên API DTO và giao diện người dùng.

2. **Cơ chế Xác thực OTP Không Mật khẩu & Dọn dẹp Thất bại**:
   - Mã OTP gồm 6 chữ số, thời hạn hiệu lực chính xác **300 giây**.
   - Lưu trữ trong Redis dưới dạng hash HMAC-SHA-256 có pepper (`OTP_PEPPER`).
   - Giới hạn chống spam (Rate Limit): Tối đa **3 lần gửi trong 60 giây** theo từng số điện thoại (lần thứ 4 trả về `429 RATE_LIMIT_EXCEEDED`).
   - Khóa bảo vệ tự động: Nhập sai **3 lần liên tiếp** sẽ khóa quyền xác thực trong **15 phút** (`403 OTP_LOCKED`).
   - Xác thực đúng sẽ tự động xóa OTP hash và reset bộ đếm số lần thử sai.
   - Nếu việc đẩy tin nhắn vào RabbitMQ thất bại, mã OTP hash vừa tạo sẽ được dọn dẹp ngay khỏi Redis để không tồn tại mã không gửi được nhưng vẫn giữ nguyên bộ đếm rate-limit.

3. **Phiên Đăng nhập Tái tạo (7-Day Renewable Sessions)**:
   - Phiên làm việc được quản lý tập trung trên Redis với TTL **7 ngày** (604,800 giây).
   - Truyền qua cookie bảo mật `qlkp_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`).
   - Phiên tự động được gia hạn (sliding window) mỗi khi người dùng thực hiện thao tác hợp lệ.
   - Trạng thái tài khoản trong DB được kiểm tra theo thời gian thực tại `AuthGuard`: nếu tài khoản bị khóa (`locked`) hoặc từ chối (`rejected`), toàn bộ phiên làm việc của tài khoản đó trên mọi thiết bị sẽ bị thu hồi ngay lập tức.

4. **Hàng đợi SMS Mã hóa, Worker Bền vững & Idempotency (Sprint 1B)**:
   - Lệnh gửi SMS đẩy vào RabbitMQ (`sms_commands`) sử dụng khóa mã hóa riêng biệt `SMS_QUEUE_ENCRYPTION_KEY` (32 bytes) tách biệt hoàn toàn với khóa điện thoại hay OTP pepper.
   - Envelope được định danh theo phiên bản (version 1), mang `commandId` ngẫu nhiên mờ đục, kiểu lệnh, thời gian tạo và payload mã hóa AES-256-GCM.
   - Tuyệt đối không lưu plaintext số điện thoại, OTP, lý do hay nội dung thông báo trên queue hoặc log hệ thống.
   - **SMS Worker**: Tiến trình worker riêng biệt (`pnpm --filter @quanlykhupho/api worker`) tiêu thụ hàng đợi `sms_commands`, kiểm tra Idempotency trên Redis (`sms:idempotent:<commandId>`), render mẫu tiếng Việt và gọi SMS Provider.
   - **Webhook Provider**: Gửi HTTPS POST với `Authorization: Bearer <token>`, header `Idempotency-Key: <commandId>` và timeout có giới hạn.
   - **Topology RabbitMQ**: Hàng đợi chính (`sms_commands`), hàng đợi thử lại trễ (`sms_commands_retry` với message TTL 5s và DLX) và hàng đợi Dead Letter (`sms_commands_dlq`). Lỗi tạm thời (5xx/429/timeout) được thử lại tối đa 3 lần; lỗi vĩnh viễn (4xx) hoặc tin độc (poison message) chuyển thẳng tới DLQ.

5. **Khởi tạo Cán bộ Phường Đầu tiên (Bootstrap Officer Command)**:
   - Lệnh one-time CLI: `pnpm --filter @quanlykhupho/api bootstrap:officer` (sử dụng biến `BOOTSTRAP_OFFICER_PHONE` và `BOOTSTRAP_OFFICER_FULL_NAME`).
   - Chuẩn hóa số điện thoại Việt Nam, mã hóa và lưu vào DB với vai trò `officer`, trạng thái `active`.
   - Đảm bảo an toàn đồng thời (serializable transaction), có tính idempotent khi chạy lại cùng danh tính, và từ chối tạo nếu đã có Cán bộ phường khác hoặc số điện thoại đã thuộc vai trò khác.

---

## 📡 Danh sách API Endpoints

### Xác thực & Phiên làm việc (Authentication - Sprint 1A)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/send-otp` | Public | Gửi mã OTP 6 số (3 lần/60s) |
| `POST` | `/api/auth/verify-otp` | Public | Xác thực mã OTP. Đăng nhập hoặc cấp `registerToken` |
| `POST` | `/api/auth/register` | Public | Đăng ký cư dân bằng `registerToken` (trạng thái: `pending`) |
| `GET` | `/api/auth/me` | Authenticated | Lấy thông tin tài khoản người dùng hiện tại |
| `POST` | `/api/auth/logout` | Authenticated | Thu hồi phiên làm việc và xóa cookie |

### Quản trị Người dùng & Phê duyệt (User Moderation & Leader Assignment - Sprint 1A)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/pending` | Leader / Officer | Danh sách cư dân chờ duyệt (Leader chỉ thấy khu phố của mình) |
| `PATCH` | `/api/users/:id/approve` | Leader / Officer | Phê duyệt hồ sơ cư dân thành `active` |
| `PATCH` | `/api/users/:id/reject` | Leader / Officer | Từ chối hồ sơ cư dân (yêu cầu lý do `reason`) |
| `PATCH` | `/api/users/:id/lock` | Leader / Officer | Khóa tài khoản cư dân (yêu cầu lý do `reason`, thu hồi phiên) |
| `PATCH` | `/api/users/:id/unlock` | Leader / Officer | Mở khóa tài khoản cư dân |
| `POST` | `/api/users/leaders` | Officer | Cán bộ phường tạo tài khoản Trưởng khu phố |

### Bảng tin, Thông báo & Tệp đính kèm (Announcements & Attachments - Sprint 2A)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/announcements` | Authenticated | Bảng tin thông báo theo phân quyền và bộ lọc phạm vi |
| `GET` | `/api/announcements/:id` | Authenticated | Chi tiết thông báo, tệp đính kèm và bình luận |
| `POST` | `/api/announcements` | Leader / Officer | Đăng thông báo mới (kèm tối đa 5 tệp, <= 10 MiB/tệp) |
| `PATCH` | `/api/announcements/:id` | Creator / Officer | Chỉnh sửa tiêu đề hoặc nội dung thông báo |
| `DELETE` | `/api/announcements/:id` | Creator / Officer | Gỡ bỏ thông báo (soft-remove, giữ lịch sử và bình luận) |
| `GET` | `/api/announcements/:id/attachments/:attachmentId` | Authenticated | Tải tệp đính kèm an toàn sau khi xác thực quyền xem |

### Bình luận & Kiểm duyệt (Comments & Moderation - Sprint 2A)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/announcements/:id/comments` | Authenticated | Đăng bình luận trên thông báo công khai (tối đa 1000 ký tự) |
| `PATCH` | `/api/announcements/:id/comments/:commentId/moderate` | Leader / Officer | Kiểm duyệt hoặc mở lại bình luận (Leader theo khu phố, Officer toàn phường) |

### Thông báo Trong Ứng Dụng & Web Push (Notifications & Push - Sprint 2A)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Authenticated | Danh sách thông báo trong ứng dụng của người dùng |
| `GET` | `/api/notifications/unread-count` | Authenticated | Số lượng thông báo chưa đọc |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Đánh dấu thông báo cụ thể là đã đọc |
| `POST` | `/api/notifications/mark-all-read` | Authenticated | Đánh dấu tất cả thông báo là đã đọc |
| `GET` | `/api/notifications/push/vapid-public-key` | Authenticated | Lấy VAPID public key cho Web Push |
| `POST` | `/api/notifications/push/subscribe` | Authenticated | Đăng ký subscription thông báo đẩy trình duyệt |
| `POST` | `/api/notifications/push/unsubscribe` | Authenticated | Hủy đăng ký subscription thông báo đẩy |

### Kiến nghị & Phản ánh (Petitions & Workflows - Sprint 2B)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/petitions` | Resident | Gửi kiến nghị mới (kèm tối đa 5 hình ảnh minh chứng JPEG/PNG/WebP, <= 10 MiB/ảnh) |
| `GET` | `/api/petitions` | Authenticated | Danh sách kiến nghị theo phân quyền (Cư dân: của mình; Trưởng KP: khu phố; Cán bộ: toàn phường) |
| `GET` | `/api/petitions/:id` | Authenticated | Chi tiết kiến nghị, hình ảnh minh chứng và tiến trình lịch sử trạng thái bất biến |
| `GET` | `/api/petitions/:id/evidence/:evidenceId` | Authenticated | Xem/tải hình ảnh minh chứng an toàn sau khi xác thực quyền truy cập |
| `PATCH` | `/api/petitions/:id/status` | Leader / Officer | Xử lý chuyển trạng thái (`reviewing -> processing -> resolved \| rejected`, từ chối yêu cầu lý do) |
| `PATCH` | `/api/petitions/:id/cancel` | Resident (Author) | Cư dân tác giả hủy kiến nghị khi đang ở trạng thái chờ tiếp nhận (`reviewing`) |

### Địa bàn & Khu phố (Neighborhoods)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/neighborhoods` | Public | Danh sách các khu phố / tổ dân phố |

---

## 🛠️ Lệnh Vận hành & CLI (Operations & CLI Commands)

```bash
# Khởi chạy SMS Delivery Worker
pnpm --filter @quanlykhupho/api worker

# Khởi tạo Cán bộ phường đầu tiên (One-time Initial Officer Bootstrap)
BOOTSTRAP_OFFICER_PHONE="0901234567" BOOTSTRAP_OFFICER_FULL_NAME="Nguyễn Văn Cán Bộ" pnpm --filter @quanlykhupho/api bootstrap:officer
```

---

## 🧪 Kiểm tra & Đảm bảo chất lượng (Verification & Quality Assurance)

Chạy toàn bộ các quy trình kiểm thử và chất lượng mã nguồn:

```bash
# 1. Kiểm tra Linter (ESLint 9 - Zero warnings/errors)
pnpm lint

# 2. Kiểm tra Kiểu dữ liệu TypeScript (Strict Typecheck)
pnpm typecheck

# 3. Chạy Toàn bộ Bộ kiểm thử Tự động (Unit & E2E Tests via Vitest)
pnpm test

# 4. Build Toàn bộ Packages & Applications
pnpm build

# 5. Kiểm tra tính hợp lệ của Docker Compose
docker compose -f docker/docker-compose.yml config --quiet
```

---

## 🔒 Quy tắc & Bất biến Dự án (Invariants)

- **Strict TypeScript**: Không sử dụng `any`, `@ts-ignore`, hoặc tắt linting tùy tiện.
- **Bảo mật Thông tin**: Tuyệt đối không commit tệp `.env` thực tế hoặc lộ bí mật mã hóa. Không in số điện thoại hoặc mã OTP ở dạng rõ trong log.
- **Tiêu chuẩn Ngôn ngữ**: Giao diện và thông báo người dùng sử dụng tiếng Việt chuẩn.
- **Phân quyền Phía Server**: Đảm bảo phân quyền 3 cấp (`resident`, `leader`, `officer`) và cô lập khu phố (Leader chỉ quản lý khu phố được phân công) luôn được thực thi nghiêm ngặt tại Backend.
- **Dữ liệu Đính kèm & Tải về**: Kiểm tra định dạng bằng magic bytes thực tế, lưu trữ bằng tên ngẫu nhiên ngoài web root, ngăn chặn path traversal, dọn dẹp file khi DB lỗi và kiểm tra quyền trước khi cho phép tải xuống.
- **Thông báo Bền vững**: Thông báo trong ứng dụng luôn được tạo đồng bộ trong transaction; Web Push hoạt động theo cơ chế best-effort và tự động dọn dẹp subscription hết hạn mà không làm gián đoạn luồng chính.
