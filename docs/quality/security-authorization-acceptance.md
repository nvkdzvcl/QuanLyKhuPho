# Sổ tay Nghiệm thu Bảo mật & Phân quyền (Security Authorization & IDOR Acceptance Runbook)

Tài liệu này quy định cấu hình kiểm thử, ma trận kiểm chứng phân quyền phía máy chủ, cơ chế cô lập dữ liệu theo khu phố, kiểm soát truy cập đối tượng (chống IDOR), thu hồi phiên làm việc tức thì, che mặt nạ dữ liệu xuất và ranh giới bằng chứng kỹ thuật cho bộ rào chắn bảo mật (**Security Authorization & IDOR Acceptance Gate**) trong dự án **QuanLyKhuPho**.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Cung cấp rào chắn nghiệm thu tự động (deterministic acceptance gate) để kiểm chứng các quy tắc bảo mật cốt lõi trong phạm vi ma trận bên dưới, bao gồm:
  - Phân quyền theo vai trò (`resident`, `leader`, `officer`) được thực thi nghiêm ngặt tại Backend API.
  - Cô lập phạm vi dữ liệu giữa các khu phố (`KP-01` và `KP-02`).
  - Kiểm soát quyền sở hữu đối tượng và chống tấn công tham chiếu trực tiếp không an toàn (IDOR) trên kiến nghị và tệp minh chứng.
  - Thu hồi phiên làm việc tức thì khi tài khoản bị khóa.
  - Bảo vệ dữ liệu nhạy cảm bằng cơ chế che mặt nạ (masking) khi xuất danh sách nhân khẩu.
- **Phạm vi kỹ thuật**:
  - Kiểm thử thuần HTTP request (`@playwright/test` request-only harness qua `playwright.security.config.ts`), không khởi chạy giao diện trình duyệt web, tối ưu thời gian thực thi trong CI.
  - Kiểm thử trên bản build production thực tế của Backend API (`apps/api/dist/main.js`) trên cổng `4100`.
  - Kết nối trực tiếp với hạ tầng thực tế gồm cơ sở dữ liệu PostgreSQL (schema cô lập `qlkp_e2e`), bộ nhớ đệm Redis (Database `15`), và hàng đợi tin nhắn RabbitMQ.
  - Thiết lập trạng thái ban đầu hoàn toàn qua các luồng HTTP hợp lệ (OTP Cán bộ phường, Cán bộ tạo Trưởng khu phố, Cư dân đăng ký OTP, Trưởng khu phố duyệt hồ sơ) trên 2 khu phố kiểm thử (`KP-01` và `KP-02`).

---

## 2. ⚠️ Tuyên bố Ranh giới Bằng chứng (Evidence Boundary Notice)

Việc thực thi thành công bộ kiểm thử `pnpm security:api` cung cấp **bằng chứng phòng thí nghiệm / tiền kiểm tra CI xác định (Deterministic Lab/CI Preflight Evidence)**. Bằng chứng này được phân định rõ ràng với các giới hạn sau:

1. **Không phải Chứng nhận Đánh giá Xâm nhập (Not a Penetration Test Certification)**:
   - Rào chắn kiểm thử tập trung vào tính đúng đắn của logic phân quyền RBAC và kiểm soát truy cập đối tượng (IDOR) theo đặc tả nghiệp vụ SRS.
   - Không chứng nhận khả năng chống đỡ các hình thức tấn công mạng nâng cao khác (zero-day exploits, binary exploitation, memory corruption, DDoS quy mô lớn, side-channel attacks).
2. **Không phải Chứng nhận Tuân thủ Pháp lý (Not a Legal Compliance Certification)**:
   - Không thay thế việc kiểm toán tuân thủ an toàn thông tin pháp lý chính thức, đánh giá ISO/IEC 27001, hoặc các quy chuẩn an toàn an ninh mạng của cơ quan quản lý nhà nước.
3. **Không phải Đánh giá Chứng chỉ SSL/TLS hay Hạ tầng Sản xuất (Not a Production HTTPS / Infrastructure Grade)**:
   - Môi trường kiểm thử chạy trên mạng loopback cục bộ / CI runner qua giao thức HTTP nội bộ (`http://localhost:4100`), không đánh giá cấu hình HTTPS/TLS termination, HSTS, WAF (Web Application Firewall), hay hạ tầng mạng sản xuất.
4. **Không đại diện cho Khả năng Quét Lỗ hổng Toàn diện (Not Exhaustive Vulnerability Coverage)**:
   - Bộ kiểm thử không thay thế các công cụ quét lỗ hổng động (DAST), quét mã nguồn tĩnh (SAST chuyên sâu), hay kiểm toán bảo mật độc lập từ bên thứ ba trước khi go-live.

---

## 3. Ma trận 10 Vùng Kiểm thử Phân quyền & Chống IDOR (10-Point Acceptance Matrix)

Bộ kiểm thử thực thi 10 bài kiểm tra xác định bao quát các tình huống phân quyền và sở hữu đối tượng:

| STT | Vùng kiểm thử (Matrix Area) | Vai trò thực hiện | Mã HTTP & Ngữ nghĩa mong đợi | Hành vi kiểm chứng (Behavioral Verification) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Truy cập tài nguyên bảo vệ khi chưa xác thực | Người dùng ẩn danh (Anonymous) | `401 UNAUTHORIZED` (`ErrorCode.UNAUTHORIZED`) | Toàn bộ các endpoint yêu cầu xác thực (`/api/auth/me`, `/api/users/pending`, `/api/petitions`, `/api/resident-profiles`, `/api/exports/residents`, `/api/dashboard/ward-overview`) từ chối truy cập khi không có cookie phiên hợp lệ. |
| 2 | Cư dân thao tác vượt quyền quản trị & xuất dữ liệu | Cư dân (`resident`) | `403 FORBIDDEN` (`ErrorCode.FORBIDDEN`) | Cư dân bị chặn hoàn toàn khi truy cập danh sách chờ duyệt, duyệt hồ sơ cư dân, tạo tài khoản Trưởng khu phố, cập nhật trạng thái kiến nghị, hoặc xuất dữ liệu nhân khẩu. |
| 3 | Cô lập danh sách chờ duyệt và thao tác giữa 2 khu phố | Trưởng KP 1 (`leader` KP-01) | `403 FORBIDDEN` (`ErrorCode.FORBIDDEN`) | Trưởng KP 1 không thể thấy cư dân chờ duyệt của KP 2 trong danh sách; mọi nỗ lực duyệt (`approve`), từ chối (`reject`) hoặc khóa (`lock`) cư dân KP 2 đều bị từ chối với mã 403; Trưởng KP 2 thao tác bình thường trên KP 2. |
| 4 | Tự sở hữu kiến nghị & che giấu tài nguyên chéo | Cư dân (`resident`) & Trưởng KP (`leader`) | `404 PETITION_NOT_FOUND` (`ErrorCode.PETITION_NOT_FOUND`) | Danh sách kiến nghị của Cư dân chỉ hiển thị kiến nghị do chính mình tạo. Khi Cư dân hoặc Trưởng KP truy cập chi tiết hoặc Cư dân hủy kiến nghị thuộc người dùng/khu phố khác, hệ thống che giấu sự tồn tại bằng mã 404 thay vì tiết lộ qua 403. |
| 5 | Trưởng khu phố sửa trạng thái kiến nghị ngoài địa bàn | Trưởng KP 1 (`leader` KP-01) | `403 FORBIDDEN` (`ErrorCode.FORBIDDEN`) | Trưởng KP 1 cố gắng chuyển trạng thái kiến nghị thuộc KP 2 bị từ chối nghiêm ngặt với mã 403. |
| 6 | Kiểm soát tải minh chứng kiến nghị (Evidence IDOR) | Cư dân (`resident`), Trưởng KP (`leader`), Cán bộ (`officer`) | `200 OK` (hợp lệ) / `404 PETITION_NOT_FOUND` (trái phép) | Tác giả kiến nghị, Trưởng khu phố phụ trách và Cán bộ phường tải thành công minh chứng nhị phân (PNG). Cư dân khu phố khác và Trưởng khu phố khác bị từ chối với 404, hoàn toàn không nhận được dữ liệu byte nội dung. |
| 7 | Quản lý hồ sơ nhân khẩu theo địa bàn | Cư dân (`resident`), Trưởng KP (`leader`), Cán bộ (`officer`) | `403 FORBIDDEN` (Cư dân & thao tác chéo KP) / `200 OK` (đúng phạm vi) | Cư dân bị cấm toàn bộ thao tác hồ sơ nhân khẩu (403). Trưởng KP tạo và quản lý hồ sơ trong khu phố của mình; tham số query không thể mở rộng phạm vi tra cứu; xem chi tiết hoặc sửa hồ sơ khu phố khác bị từ chối (403). Cán bộ phường thấy hồ sơ cả 2 khu phố. |
| 8 | Xuất danh sách nhân khẩu & che mặt nạ dữ liệu nhạy cảm | Cư dân (`resident`), Trưởng KP (`leader`), Cán bộ (`officer`) | `403 FORBIDDEN` (Cư dân) / `200 OK` (Trưởng KP & Cán bộ) | Cư dân bị cấm xuất dữ liệu (403). Trưởng KP 1 chỉ xuất dữ liệu KP 1 (bỏ qua query lọc KP 2). Cán bộ xuất dữ liệu cả 2 KP. Tệp CSV xuất ra tuyệt đối không chứa số CCCD và số điện thoại ở dạng rõ (được che mặt nạ an toàn). |
| 9 | Cán bộ phường quan sát kiến nghị toàn địa bàn | Cán bộ (`officer`) | `200 OK` | Danh sách kiến nghị của Cán bộ phường tổng hợp đầy đủ các kiến nghị từ tất cả các khu phố trên toàn địa bàn phường. |
| 10 | Thu hồi phiên làm việc tức thì khi tài khoản bị khóa | Cán bộ / Trưởng KP khóa Cư dân | `401 UNAUTHORIZED` (`ErrorCode.UNAUTHORIZED`) | Khi tài khoản Cư dân đang hoạt động bị Trưởng KP khóa (`AccountStatus.LOCKED`), cookie phiên hiện tại của Cư dân đó lập tức bị vô hiệu hóa; mọi request tiếp theo nhận ngay mã 401. |

---

## 4. Ngữ nghĩa Mã Lỗi & Quy tắc Phân quyền (Semantic Rules)

Hệ thống tuân thủ nghiêm ngặt các nguyên tắc thiết kế phản hồi bảo mật:

- **`401 UNAUTHORIZED`**: Áp dụng khi người dùng chưa cung cấp phiên đăng nhập hợp lệ, phiên làm việc đã hết hạn, hoặc phiên làm việc đã bị thu hồi do tài khoản bị khóa/từ chối.
- **`403 FORBIDDEN`**: Áp dụng khi người dùng đã xác thực nhưng không có thẩm quyền thực hiện hành động quản trị (ví dụ: Cư dân cố duyệt tài khoản, hoặc Trưởng KP cố thao tác trên tài khoản/kiến nghị/hồ sơ của khu phố khác).
- **`404 NOT FOUND` (`PETITION_NOT_FOUND`)**: Áp dụng khi truy cập tài nguyên kiến nghị hoặc tệp minh chứng ngoài phạm vi sở hữu/phụ trách. Việc trả về 404 thay vì 403 ngăn chặn hành vi dò quét định danh (Resource ID Enumeration) và bảo vệ quyền riêng tư về sự tồn tại của dữ liệu.

---

## 5. Cô lập Môi trường & Cảnh báo Dữ liệu (Environment & Destructive Safety Warning)

> [!CAUTION]
> **CẢNH BÁO AN TOÀN DỮ LIỆU CÔ LẬP**:
> Quy trình chuẩn bị kiểm thử (`apps/api/test/fullstack/prepare.mjs`) tự động thực hiện thao tác xóa và tái tạo schema PostgreSQL (`DROP SCHEMA IF EXISTS "qlkp_e2e" CASCADE`) và xóa toàn bộ dữ liệu trên Redis DB 15 (`FLUSHDB`).
> - Tuyệt đối không trỏ `E2E_DATABASE_URL` vào schema chứa dữ liệu quan trọng (như `public`).
> - Tuyệt đối không trỏ `E2E_REDIS_URL` vào database mặc định (DB 0) hoặc môi trường chia sẻ.
> - Cơ chế an toàn trong mã nguồn sẽ tự động từ chối chạy nếu URL trỏ ra ngoài địa chỉ loopback cục bộ (`localhost`, `127.0.0.1`, `::1`), hoặc schema khác `qlkp_e2e`, hoặc Redis DB khác `15`.

---

## 6. Bảo vệ Quyền riêng tư Báo cáo & Nhật ký (Report Privacy & Zero-Leak)

- **Vô hiệu hóa Trace Playwright (`trace: 'off'`)**: Cấu hình `playwright.security.config.ts` chủ động tắt tính năng ghi trace (`trace: 'off'`) để ngăn chặn việc lưu lại mã OTP, session cookie, token đăng ký hoặc payload nhạy cảm trong các tệp zip trace khi có kiểm thử thất bại.
- **Không in Dữ liệu Nhạy cảm ra Log**: Quá trình thực thi kiểm thử giao tiếp qua các định danh mờ đục (opaque command IDs) trong Dev SMS Inbox nội bộ; không in số điện thoại, mã xác thực OTP, hay thông tin định danh cá nhân (CCCD) ra console hoặc tệp đính kèm báo cáo.

---

## 7. Hướng dẫn Thực thi Cục bộ & Biến Môi trường (Local Execution & Environment Variables)

### Lệnh Thực thi Tiêu chuẩn

Từ thư mục gốc repository (yêu cầu Docker services PostgreSQL, Redis, RabbitMQ đang chạy):

```bash
pnpm security:api
```

Lệnh trên sẽ tự động:
1. Build các gói phụ thuộc cần thiết (`turbo run build --filter=@quanlykhupho/api...`).
2. Khởi tạo và làm sạch môi trường cô lập (`node apps/api/test/fullstack/prepare.mjs`).
3. Khởi động máy chủ API NestJS trên cổng `4100`.
4. Thực thi 10 bài kiểm thử bảo mật Playwright và xuất báo cáo.

### Thực thi với Biến Môi trường Tùy chỉnh

Nếu chạy hạ tầng trên cổng tùy chỉnh (ví dụ: PostgreSQL trên cổng 5432 hoặc 5433):

```bash
# Môi trường với PostgreSQL 5432 (Chuẩn CI)
E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quanlykhupho?schema=qlkp_e2e" \
E2E_REDIS_URL="redis://localhost:6379/15" \
E2E_RABBITMQ_URL="amqp://guest:guest@localhost:5672" \
pnpm security:api

# Môi trường với PostgreSQL 5433 (theo cấu hình root .env.example của repository)
E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quanlykhupho?schema=qlkp_e2e" \
E2E_REDIS_URL="redis://localhost:6379/15" \
E2E_RABBITMQ_URL="amqp://guest:guest@localhost:5672" \
pnpm security:api
```

---

## 8. Vị trí Báo cáo & Bằng chứng Kiểm thử (Artifacts)

Sau khi kiểm thử hoàn tất, các tệp báo cáo được lưu trữ tại:

- **Báo cáo HTML Playwright**: Thư mục `playwright-report-security/`
  - Xem báo cáo trực quan qua lệnh:
    ```bash
    pnpm exec playwright show-report playwright-report-security
    ```
- **Kết quả kiểm thử**: Thư mục `test-results-security/`. Tracing bị tắt nên không tạo tệp trace ZIP.

---

## 9. Xử lý Sự cố Thường gặp (Troubleshooting)

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
  3. Đảm bảo cổng PostgreSQL trong `E2E_DATABASE_URL` khớp với cấu hình container (5432 hoặc 5433).

### 2. Lỗi Kiểm tra An toàn Schema hoặc Redis DB
- **Nguyên nhân**: Script `prepare.mjs` từ chối thực thi do `DATABASE_URL` không có `schema=qlkp_e2e` hoặc `REDIS_URL` không trỏ vào DB `15`.
- **Khắc phục**: Đảm bảo chuỗi kết nối tuân thủ quy tắc cô lập:
  - `postgresql://postgres:postgres@localhost:5433/quanlykhupho?schema=qlkp_e2e`
  - `redis://localhost:6379/15`

### 3. Lỗi Cổng API Bị Chiếm Dụng (Port 4100 Conflict)
- **Nguyên nhân**: Một tiến trình API hoặc dịch vụ khác đang chiếm cổng `4100`.
- **Khắc phục**: Kiểm tra và dừng tiến trình đang sử dụng cổng 4100 trước khi chạy lại kiểm thử.

### 4. Lỗi Thiếu Bản Build API (`Built API entrypoint not found at: apps/api/dist/main.js`)
- **Nguyên nhân**: Mã nguồn NestJS chưa được biên dịch.
- **Khắc phục**: Chạy lệnh build trước khi kiểm thử:
  ```bash
  pnpm build
  ```
