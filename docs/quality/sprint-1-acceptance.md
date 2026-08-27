# Biên bản Nghiệm thu Sprint 1 — Quản lý Vòng đời Tài khoản Cư dân & Xác thực Phân quyền

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động, và ranh giới nghiệm thu cho Sprint 1 thuộc dự án **QuanLyKhuPho**, bao gồm các yêu cầu chức năng từ **FR-01** đến **FR-05** theo đặc tả kiến trúc và hợp đồng kỹ thuật `.ai-work/phase-contract.md`.

---

## 1. Mục đích & Phạm vi Sprint 1 (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện vòng đời tài khoản cư dân và phân quyền quản trị khu phố/phường trên cả giao diện Web UI (Next.js) và Backend API (NestJS), đảm bảo:
  - Xác thực bảo mật bằng OTP qua số điện thoại, quản lý phiên an toàn và chống tấn công brute-force.
  - Phân luồng đăng ký hồ sơ cư dân gắn liền với khu phố trực thuộc.
  - Cán bộ phường bổ nhiệm và quản lý nhân sự Trưởng khu phố.
  - Trưởng khu phố điều hành hàng đợi duyệt hồ sơ (`approve`/`reject`) và quản lý trạng thái tài khoản cư dân (`lock`/`unlock`) với đầy đủ lý do nghiệp vụ và cơ chế thu hồi phiên tức thì.
  - Thực thi nghiêm ngặt phân quyền RBAC và cô lập dữ liệu theo phạm vi địa bàn phụ trách ở tầng máy chủ.
- **Ranh giới công nghệ**: Next.js 16 App Router, TanStack Query, NestJS, Prisma ORM, PostgreSQL (`qlkp_e2e`), Redis (DB 15), RabbitMQ.

---

## 2. Ma trận Bằng chứng Chức năng Sprint 1 (FR-01 → FR-05)

| Mã Yêu cầu (SRS) | Tên Chức năng & Nội dung Nghiệp vụ | Trạng thái Nghiệm thu | Bằng chứng Kỹ thuật & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **FR-01** | **Xác thực OTP & Quản lý Phiên Đăng nhập**<br>• Gửi OTP 6 chữ số qua SMS, thời hạn sống 300 giây.<br>• Giới hạn tốc độ: tối đa 3 lần gửi/phút/số điện thoại.<br>• Khóa tạm 15 phút sau 3 lần nhập sai liên tiếp.<br>• Duy trì phiên đăng nhập 7 ngày qua cookie HTTP-Only an toàn. | **ĐẠT (Completed)** | • `apps/api/src/auth/otp.service.spec.ts`<br>• `apps/api/test/auth.e2e-spec.ts`<br>• `apps/web/src/components/auth/otp-step.tsx`<br>• `apps/web/src/components/auth/phone-step.tsx` |
| **FR-02** | **Đăng ký Tài khoản Cư dân & Gán Khu phố**<br>• Số điện thoại mới xác thực OTP thành công chuyển sang luồng nhập Họ tên, Địa chỉ, Khu phố trực thuộc.<br>• Khởi tạo tài khoản ở trạng thái `pending` (chờ duyệt).<br>• Hiển thị thông báo chờ phê duyệt rõ ràng cho cư dân. | **ĐẠT (Completed)** | • `apps/api/test/auth.e2e-spec.ts`<br>• `apps/web/src/components/auth/register-step.tsx`<br>• `apps/web/src/components/auth/account-status-modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 2) |
| **FR-03** | **Xét duyệt đăng ký cư dân**<br>• Trưởng khu phố chỉ thấy hồ sơ `pending` thuộc khu phố được phân công.<br>• Có thể duyệt hoặc từ chối; từ chối bắt buộc nhập lý do. | **ĐẠT (Completed)** | • `apps/api/src/users/users.service.spec.ts`<br>• `apps/api/test/auth.e2e-spec.ts`<br>• `apps/web/src/components/dashboard/leader-view.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 3) |
| **FR-04** | **Khóa và mở khóa tài khoản cư dân**<br>• Trưởng khu phố truy cập danh sách cư dân `active`/`locked` qua `GET /users/residents`, luôn bị giới hạn theo khu phố tại máy chủ.<br>• Khóa chỉ áp dụng cho tài khoản `active`, bắt buộc có lý do và thu hồi toàn bộ phiên.<br>• Mở khóa chỉ áp dụng cho tài khoản `locked`, chuyển về `active` và cho phép đăng nhập lại. | **ĐẠT (Completed)** | • `apps/api/src/users/users.service.ts`<br>• `apps/api/src/users/users.service.spec.ts`<br>• `apps/web/src/hooks/use-pending-residents.ts`<br>• `apps/web/src/components/dashboard/leader-view.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 7) |
| **FR-05** | **Cán bộ phường tạo tài khoản Trưởng khu phố**<br>• Cán bộ phường (`officer`) tạo tài khoản `leader` gắn với khu phố.<br>• Tài khoản được kích hoạt trực tiếp; hệ thống ngăn hai Trưởng khu phố đang hoạt động cùng phụ trách một khu phố. | **ĐẠT (Completed)** | • `apps/api/src/users/users.service.spec.ts`<br>• `apps/api/test/auth.e2e-spec.ts`<br>• `apps/web/src/components/dashboard/officer-view.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 1) |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

Hệ thống cung cấp các bộ kiểm thử tự động đa tầng kiểm chứng tính đúng đắn của toàn bộ chu trình Sprint 1:

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts`
   - **Lệnh chạy**: `pnpm e2e:fullstack` (sử dụng `playwright.fullstack.config.ts`)
   - **Kịch bản kiểm chứng**: Chuỗi tương tác người dùng qua 7 bước: Cán bộ tạo Trưởng KP → Cư dân đăng ký OTP (chờ duyệt) → Trưởng KP duyệt cư dân → Cư dân gửi kiến nghị → Trưởng KP giải quyết kiến nghị → Cán bộ giám sát toàn phường → Trưởng KP khóa cư dân (chặn đăng nhập) → Trưởng KP mở khóa → Cư dân đăng nhập thành công.

2. **Rào chắn Phân quyền Bảo mật & Chống IDOR (Security & IDOR Matrix)**:
   - **Tệp thực thi**: `apps/api/test/security.e2e-spec.ts`, `apps/api/test/security/authorization-idor.spec.ts`
   - **Lệnh chạy**: `pnpm security:api` (sử dụng `playwright.security.config.ts`)
   - **Kịch bản kiểm chứng**: 10 vùng kiểm thử phân quyền máy chủ, cô lập khu phố giữa KP-01 và KP-02, thu hồi phiên làm việc tức thời khi khóa tài khoản.

3. **Rào chắn Tích hợp API Xác thực & Người dùng (API Auth & Users Integration)**:
   - **Tệp thực thi**: `apps/api/test/auth.e2e-spec.ts`
   - **Kịch bản kiểm chứng**: Gửi/xác thực OTP, rate limiting, đăng ký, duyệt/từ chối/khóa/mở khóa tài khoản, thu hồi phiên Redis.

4. **Kiểm thử Đơn vị & Hợp đồng Dữ liệu (Unit & Contract Specs)**:
   - **Backend**: `apps/api/src/users/users.service.spec.ts`, `apps/api/src/users/users.controller.spec.ts`, `apps/api/src/auth/otp.service.spec.ts`.
   - **Frontend**: `apps/web/test/dashboard-navigation.test.ts`, `apps/web/test/api-client.test.ts`.

---

## 4. Các Hạng mục Hoãn lại Có chủ đích Ngoài Sprint 1 (Consciously Deferred Items)

Các tính năng sau đây được chủ động hoãn lại cho các Sprint tiếp theo theo đúng lộ trình phát triển:

1. **Phân trang phân đoạn (Pagination) & Tìm kiếm nâng cao**: Tra cứu danh sách cư dân theo từ khóa tự do, lọc nâng cao theo tiêu chí nhân khẩu học thuộc phạm vi Sprint 2+.
2. **Tác vụ Hàng loạt (Bulk Moderation)**: Duyệt hoặc khóa hàng loạt nhiều tài khoản cùng lúc.
3. **Tự động trích xuất CCCD bằng OCR**: Tích hợp bóc tách căn cước công dân tự động khi đăng ký.
4. **Xóa vĩnh viễn tài khoản (Hard Delete / Purge)**: Xóa tài khoản vật lý khỏi cơ sở dữ liệu (hiện tại sử dụng cơ chế khóa tài khoản `AccountStatus.LOCKED`).

---

## 5. Ranh giới Bằng chứng & Nghiệm thu (Acceptance Statement)

Tài liệu này ghi nhận hiện trạng mã nguồn và các bộ kiểm thử tự động của Sprint 1 trong repository.

Kết quả final gate ngày 27/08/2026 trên diff hiện tại:

- `pnpm lint`: đạt.
- `pnpm typecheck`: đạt.
- `pnpm test`: đạt — API 491, Web 108 và shared-types 38 bài kiểm thử.
- `pnpm test:ops`: đạt — 99 bài kiểm thử.
- `pnpm build`: đạt.
- `prisma validate`: đạt.
- `pnpm e2e:fullstack`: đạt — hành trình đa vai trò 7 bước, bao gồm khóa, chặn đăng nhập, mở khóa và đăng nhập lại; chạy trên PostgreSQL schema `qlkp_e2e` và Redis DB 15 cô lập.
