# Sổ tay Vận hành: Triển khai Production & Khắc phục Sự cố (Production Deployment Runbook)

Tài liệu này hướng dẫn quy trình vận hành, đóng gói container, kiểm tra cấu hình, khởi tạo cơ sở dữ liệu, khởi chạy hệ thống, cập nhật phiên bản và quay lui khi có sự cố cho nền tảng **QuanLyKhuPho** trên môi trường tự lưu trữ (self-hosted).

---

## 1. Kiến trúc & Ranh giới Hạ tầng (Architecture & Infrastructure Topology)

Hệ thống production được tổ chức thành cụm dịch vụ tự đóng gói bằng Docker Compose (`docker/docker-compose.production.yml`), bao gồm 7 dịch vụ:

1. **`postgres`**: Cơ sở dữ liệu quan hệ PostgreSQL 16 Alpine, dữ liệu lưu trên named volume `quanlykhupho_postgres_prod_data`.
2. **`redis`**: Lưu trữ phiên làm việc 7 ngày (renewable sessions) và rate-limiting OTP/SMS Redis 7 Alpine, kích hoạt ghi đĩa AOF (`--appendonly yes`) trên named volume `quanlykhupho_redis_prod_data`.
3. **`rabbitmq`**: Hàng đợi tin nhắn SMS bất đồng bộ RabbitMQ 3.13 Alpine, dữ liệu lưu trên named volume `quanlykhupho_rabbitmq_prod_data`.
4. **`migrate`**: Dịch vụ one-shot thực thi `prisma migrate deploy` độc lập, hoàn tất thành công trước khi API và Worker khởi động.
5. **`api`**: Máy chủ NestJS Backend API (Node 22 non-root, cổng nội bộ 4000), gắn kết thư mục đính kèm trên named volume `quanlykhupho_uploads_prod_data`.
6. **`sms-worker`**: Tiến trình worker xử lý gửi SMS bất đồng bộ (`node apps/api/dist/main.js --worker`), chạy cùng image runtime với API, có chính sách tự khởi động lại và không mở cổng mạng.
7. **`web`**: Máy chủ giao diện Next.js Standalone (Node 22 non-root, cổng nội bộ 3000).

```text
[ Trình duyệt Cư dân / Cán bộ ]
              │
              ▼ (HTTPS / 443)
┌─────────────────────────────────────────────────────────────┐
│      External TLS Reverse Proxy (Nginx / Caddy / Envoy)     │
│   (Xử lý chứng chỉ SSL/TLS, gán header X-Forwarded-Proto)   │
└──────────────┬───────────────────────────────┬──────────────┘
               │ (127.0.0.1:3000)              │ (127.0.0.1:4000)
               ▼                               ▼
      ┌─────────────────┐             ┌─────────────────┐
      │   web (Next)    │             │   api (NestJS)  │
      └─────────────────┘             └────────┬────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             │                                 │                                 │
             ▼                                 ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐               ┌─────────────────┐
    │    postgres     │               │      redis      │               │    rabbitmq     │
    │ (PostgreSQL 16) │               │     (Redis 7)   │               │ (RabbitMQ 3.13) │
    └─────────────────┘               └─────────────────┘               └────────┬────────┘
             ▲                                                                   │
             │ (one-shot migration)                                              ▼
    ┌─────────────────┐                                                 ┌─────────────────┐
    │     migrate     │                                                 │   sms-worker    │
    └─────────────────┘                                                 └─────────────────┘
```

### Ranh giới Cô lập & An toàn Mạng (Network & Security Boundaries)

- **Hạ tầng hoàn toàn cô lập**: Các dịch vụ `postgres`, `redis`, `rabbitmq`, `migrate`, `sms-worker` **tuyệt đối không mở port ra máy chủ host** (`ports:` không tồn tại). PostgreSQL, Redis, RabbitMQ và migration chỉ tham gia mạng `data` nội bộ; Web chỉ tham gia mạng `application`; API và Worker nối hai mạng để truy cập dữ liệu trong khi vẫn có đường ra nhà cung cấp SMS/Web Push.
- **Cổng ứng dụng Loopback-Only**: Dịch vụ `api` và `web` chỉ bind vào địa chỉ loopback cục bộ của host (`127.0.0.1:4000` và `127.0.0.1:3000`), không lắng nghe trên `0.0.0.0` hay giao diện mạng công khai.
- **Ranh giới TLS Ngoại vi (External TLS Boundary)**: Compose topology không đóng gói sẵn chứng chỉ TLS hay reverse proxy công khai. Người vận hành **bắt buộc** phải thiết lập một Reverse Proxy riêng biệt bên ngoài máy chủ (Nginx, Caddy, HAProxy, AWS ALB, Cloudflare Tunnel...) để:
  1. Chấm dứt TLS và cung cấp chứng chỉ HTTPS hợp lệ.
  2. Chuyển tiếp header bắt buộc: `X-Forwarded-Proto: https` và `X-Forwarded-For`.
  3. Với topology tài liệu này, API thiết lập `TRUST_PROXY=1` vì reverse proxy trên host đi qua đúng một Docker bridge hop. Nếu topology khác, phải cấu hình IP/CIDR hoặc hop count tương ứng; không dùng wildcard.

### Phân định Build-time vs Runtime Variables

- **`NEXT_PUBLIC_API_URL` (Build-time Public URL)**: Địa chỉ URL công khai của API (ví dụ: `https://khupho.example.gov.vn/api`) được nhúng trực tiếp vào mã JavaScript client của Web Frontend tại thời điểm build image (`ARG NEXT_PUBLIC_API_URL`). Biến này là thông tin công khai đối với trình duyệt người dùng.
- **Bí mật & Khóa Mã hóa (Runtime-Only Secrets)**: Tất cả mật khẩu cơ sở dữ liệu, khóa mã hóa (`PHONE_ENCRYPTION_KEY`, `PHONE_HASH_KEY`, `SMS_QUEUE_ENCRYPTION_KEY`), `OTP_PEPPER`, và API key của nhà cung cấp SMS là cấu hình **Runtime-only**. Tuyệt đối không đưa các biến này vào tham số build image (`ARG` / Dockerfile) hoặc commit lên kho mã nguồn.

---

## 2. Yêu cầu Tiền đề & Chuẩn bị Môi trường (Prerequisites & Environment Setup)

### Yêu cầu Hệ thống
- **Hệ điều hành**: Linux (Ubuntu 22.04 LTS / Debian 12 khuyến nghị) hoặc máy chủ container tương thích.
- **Docker Engine**: `>= 26.0.0`
- **Docker Compose**: `>= 2.20.0`
- **Công cụ**: `openssl`, `curl`
- **Tài nguyên tối thiểu**: 2 vCPU, 4 GB RAM, 20 GB dung lượng đĩa SSD.

### Bước 1: Chuẩn bị Tệp Môi trường Production

Tạo tệp môi trường bảo mật trên máy chủ từ mẫu template:

```bash
cp docker/.env.production.example docker/.env.production
chmod 600 docker/.env.production
```

### Bước 2: Sinh Khóa Mật mã & Mật khẩu Độc lập

Tất cả khóa mật mã phải được sinh độc lập cho từng môi trường (không dùng lại khóa từ dev/test):

```bash
# 1. Sinh khóa mã hóa số điện thoại (AES-256-GCM - 32 bytes hex)
openssl rand -hex 32

# 2. Sinh khóa hash số điện thoại (HMAC-SHA-256 - 32 bytes hex)
openssl rand -hex 32

# 3. Sinh khóa mã hóa hàng đợi SMS (AES-256-GCM - 32 bytes hex)
openssl rand -hex 32

# 4. Sinh pepper cho mã OTP (Base64 chuỗi ngẫu nhiên >= 32 ký tự)
openssl rand -base64 32

# 5. Sinh mật khẩu mạnh cho PostgreSQL và RabbitMQ
openssl rand -hex 24
```

Điền các giá trị vừa tạo vào `docker/.env.production`:
- Thiết lập `POSTGRES_PASSWORD` và hoàn thiện `DATABASE_URL=postgresql://quanlykhupho_app:<POSTGRES_PASSWORD>@postgres:5432/quanlykhupho?schema=public`.
- Thiết lập `RABBITMQ_PASSWORD` và hoàn thiện `RABBITMQ_URL=amqp://quanlykhupho_broker:<RABBITMQ_PASSWORD>@rabbitmq:5672`.
- Thiết lập `CORS_ORIGIN=https://khupho.example.gov.vn`.
- Thiết lập `NEXT_PUBLIC_API_URL=https://khupho.example.gov.vn/api`.
- Thiết lập `APP_IMAGE_TAG` bằng một mã release bất biến (ví dụ `2026.08.27-1`), không tái sử dụng tag cho nội dung image khác.
- Thiết lập thông tin SMS Provider: `SMS_PROVIDER=webhook`, `SMS_PROVIDER_WEBHOOK_URL` và `SMS_PROVIDER_API_KEY`.

### Bước 3: Kiểm tra Tính Hợp lệ của Cấu hình (Dry-run Validation)

Kiểm tra cấu hình Compose đã hoàn chỉnh và không còn biến bắt buộc nào bị thiếu:

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml config --quiet
```

Nếu lệnh trả về mã thoát `0` không có lỗi, cấu hình đã sẵn sàng.

---

## 3. Quy trình Triển khai Chuẩn (Standard Deployment Sequence)

Người vận hành thực hiện tuần tự theo quy trình 4 bước:

### Bước 1: Build Docker Container Images

Xây dựng các image production từ mã nguồn cục bộ:

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml build
```

Quá trình này sẽ:
- Đóng gói image API đa tầng (`quanlykhupho-api:<APP_IMAGE_TAG>`), biên dịch mã TypeScript và tạo Prisma Client.
- Đóng gói image Web standalone (`quanlykhupho-web:<APP_IMAGE_TAG>`) với `NEXT_PUBLIC_API_URL` được truyền qua build argument.

### Bước 2: Khởi động Hạ tầng Cơ sở Dữ liệu & Chạy Migration

Khởi động trước các dịch vụ lưu trữ để đạt trạng thái healthy, sau đó thực thi migration schema:

```bash
# 1. Khởi động PostgreSQL, Redis, RabbitMQ
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml up -d postgres redis rabbitmq

# 2. Chờ hạ tầng đạt healthy và thực thi one-shot migration
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml up migrate
```

Kiểm tra mã thoát của `migrate` để đảm bảo toàn bộ bảng cơ sở dữ liệu đã được khởi tạo thành công.

### Bước 3: Khởi chạy Toàn bộ Dịch vụ Ứng dụng

Khởi động các tiến trình API, SMS Worker và Web Frontend:

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml up -d
```

### Bước 4: Kiểm tra Trạng thái Hoạt động & Healthcheck

Kiểm tra danh sách container và trạng thái sức khỏe:

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml ps
```

Tất cả các dịch vụ `postgres`, `redis`, `rabbitmq`, `api`, `sms-worker`, `web` phải ở trạng thái `running` (các dịch vụ có HTTP/infrastructure healthcheck phải `healthy`). Container `migrate` ở trạng thái `exited (0)`. Trên cơ sở dữ liệu mới, `/api/health/ready` trả `503` với nguyên nhân `Deployment profile is not initialized` là đúng thiết kế cho tới khi hoàn tất Mục 4.

---

## 4. Khởi tạo Địa bàn & Cán bộ Đầu tiên (Initial Locality & Officer Bootstrap)

Sau lần triển khai đầu tiên trên một cơ sở dữ liệu mới, bắt buộc thực hiện khởi tạo hồ sơ địa bàn và tài khoản cán bộ phường quản trị viên theo quy chuẩn tại [`docs/operations/locality-deployment.md`](./locality-deployment.md).

### Bước 1: Kiểm tra Gói Địa bàn ở Chế độ Dry-Run

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml \
  exec api node apps/api/dist/main.js --deployment-init --profile <slug>
```

### Bước 2: Áp dụng Gói Địa bàn Chính thức (`--apply`)

Chỉ thực hiện khi hồ sơ địa bàn đã được đối soát văn bản pháp lý và có `confirmed: true`:

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml \
  exec api node apps/api/dist/main.js --deployment-init --profile <slug> --apply
```

Sau khi áp dụng, xác nhận readiness toàn hệ thống trả HTTP `200`:

```bash
curl -s -i -H "X-Forwarded-Proto: https" http://127.0.0.1:4000/api/health/ready
```

### Bước 3: Khởi tạo Tài khoản Cán bộ Phường Quản trị viên Đầu tiên

```bash
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml \
  exec -e BOOTSTRAP_OFFICER_PHONE="0901234567" -e BOOTSTRAP_OFFICER_FULL_NAME="Nguyễn Văn Cán Bộ" \
  api node apps/api/dist/main.js --bootstrap-officer
```

### Bước 4: Tạo Bản Sao Lưu Cơ sở Dữ liệu Ban đầu

Tạo bản snapshot CSDL ngay sau khi khởi tạo hoàn tất:

```bash
pnpm db:backup
# Hoặc sử dụng pg_dump trực tiếp từ container postgres:
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml \
  exec postgres pg_dump -U quanlykhupho_app -d quanlykhupho -Fc > backups/initial_bootstrap.dump
```

---

## 5. Kiểm thử Khói Vận hành (Production Smoke Testing)

Thực hiện các kiểm tra khói xác thực tính sẵn sàng của hệ thống thông qua proxy cục bộ:

```bash
# 1. Kiểm tra API Live Health Probe (yêu cầu header x-forwarded-proto)
curl -s -i -H "X-Forwarded-Proto: https" http://127.0.0.1:4000/api/health/live

# 2. Kiểm tra API Deployment Profile công khai
curl -s -H "X-Forwarded-Proto: https" http://127.0.0.1:4000/api/deployment-profile

# 3. Kiểm tra API Readiness (200 sau khi khởi tạo địa bàn; 503 có lý do rõ ràng trước khi khởi tạo)
curl -s -i -H "X-Forwarded-Proto: https" http://127.0.0.1:4000/api/health/ready

# 4. Kiểm tra Web Frontend HTTP 200 Root Response
curl -s -i http://127.0.0.1:3000/

# 5. Kiểm tra nhật ký khởi động của SMS Worker
docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml \
  logs --tail=50 sms-worker
```

Bên cạnh kiểm thử khói thủ công trên môi trường đang chạy, quy trình CI và tiền phát hành sử dụng công cụ tự động hóa cô lập `pnpm production:acceptance` để kiểm chứng toàn bộ stack container trước khi triển khai chính thức. Chi tiết được quy định tại [Sổ tay Nghiệm thu Phát hành Sản xuất (Production Release Acceptance)](../quality/production-release-acceptance.md).

---

## 6. Quy trình Cập nhật & Quay lui (Update & Rollback Procedure)

### Quy trình Cập nhật Phiên bản (Rolling Update)

1. **Sao lưu dữ liệu**: Luôn tạo một bản sao lưu CSDL trước khi thực hiện nâng cấp (`pnpm db:backup`).
2. **Kéo mã nguồn mới, đặt `APP_IMAGE_TAG` mới & Build**:
   ```bash
   git pull origin main
   docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml build
   ```
3. **Thực thi Database Migration**:
   ```bash
   docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml up migrate
   ```
4. **Khởi động lại các dịch vụ ứng dụng**:
   ```bash
   docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml up -d --no-deps api sms-worker web
   ```
5. **Thực hiện kiểm thử khói** theo Mục 5.

### Quy trình Quay lui Khẩn cấp (Emergency Rollback)

Khi phiên bản mới phát sinh lỗi nghiêm trọng sau khi triển khai:

1. **Chuyển Reverse Proxy sang trang bảo trì** để ngăn người dùng thao tác ghi dữ liệu mới.
2. **Quay về mã nguồn / commit ổn định trước đó và đặt lại `APP_IMAGE_TAG` tương ứng**:
   ```bash
   git checkout <previous-release-tag-or-commit>
   docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml build
   ```
3. **Đánh giá tình trạng Cơ sở dữ liệu**:
   - *Trường hợp migration có tính tương thích ngược*: Không cần rollback DB, chỉ cần khởi động lại `api`, `sms-worker`, `web` với image cũ.
   - *Trường hợp migration làm thay đổi cấu trúc không tương thích*: Thực hiện phục hồi cơ sở dữ liệu từ bản sao lưu trước khi cập nhật theo quy trình phục hồi có kiểm soát tại [`docs/operations/database-backup-restore.md`](./database-backup-restore.md):
     ```bash
     # Kiểm tra tính toàn vẹn bản dump
     pnpm db:restore -- --file=backups/<ten_tep_truoc_cap_nhat>.dump

     # Phục hồi thực tế vào database
     node scripts/postgres-restore.mjs \
       --file=backups/<ten_tep_truoc_cap_nhat>.dump \
       --confirm-destructive \
       --confirm-database=quanlykhupho
     ```
4. **Khởi động lại hệ thống**:
   ```bash
   docker compose --env-file docker/.env.production -f docker/docker-compose.production.yml up -d
   ```
5. **Kiểm tra dữ liệu và mở lại cổng Reverse Proxy**.

---

## 7. Ranh giới Bằng chứng Kỹ thuật & Quản trị Rủi ro (Evidence Boundaries)

- **Ranh giới Môi trường Container Cục bộ**: Việc cấu hình Docker Compose và kiểm thử CI thành công chứng minh tính tương thích của mã nguồn, khả năng đóng gói image và luồng khởi động tuần tự trong điều kiện kiểm thử cô lập.
- **Không cấu thành Cam kết HTTPS/SLA & Off-host Backup (NFR-01 / NFR-08)**: Việc tồn tại của `docker-compose.production.yml` **không tự động chứng minh chứng chỉ HTTPS đạt yêu cầu NFR-01, uptime 99% hay sao lưu định kỳ theo NFR-08**. Để đạt các tiêu chuẩn này trong thực tế sản xuất, đơn vị vận hành bắt buộc phải:
  1. Cấu hình cron scheduler hạ tầng độc lập để gọi lệnh `pnpm db:backup` hằng ngày.
  2. Thiết lập quy trình mã hóa và đồng bộ tệp sao lưu tới kho lưu trữ ngoài máy chủ (S3/GCS/KMS) qua TLS.
  3. Cài đặt hệ thống giám sát tải, cảnh báo sự cố (Prometheus/Grafana/Uptime Kuma) và quy trình ứng cứu trực 24/7.
  4. Thực hiện định kỳ diễn tập phục hồi sandbox theo quý.
