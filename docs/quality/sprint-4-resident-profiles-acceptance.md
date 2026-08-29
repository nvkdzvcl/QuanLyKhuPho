# Biên bản Nghiệm thu Sprint 4 — Quản lý Hồ sơ Cư dân & Trích lọc Nâng cao (FR-21 & FR-24)

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động, và ranh giới nghiệm thu cho phân hệ Quản lý Hồ sơ Cư dân (Nhân khẩu) và Trích lọc Nâng cao thuộc dự án **QuanLyKhuPho**, bao gồm các yêu cầu chức năng **FR-21** và **FR-24** theo đặc tả SRS.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện phân hệ quản lý hồ sơ nhân khẩu/cư dân và tìm kiếm, trích lọc nâng cao trên cả giao diện Web UI (Next.js) và Backend API (NestJS), đảm bảo:
  - **Quản lý Hồ sơ Cư dân / Nhân khẩu (FR-21)**: Tạo mới, cập nhật, xem chi tiết và lập danh sách hồ sơ nhân khẩu gắn liền với mã hộ khẩu; kiểm tra định dạng CCCD chuẩn Việt Nam (12 chữ số) và tính duy nhất; mã hóa dữ liệu nhạy cảm ở tầng lưu trữ; che mặt nạ dữ liệu cá nhân (CCCD, SĐT, Email) khi hiển thị danh sách và chỉ giải mã đầy đủ cho người dùng có thẩm quyền.
  - **Tìm kiếm, Trích lọc Nâng cao & Bàn giao Hoạt động (FR-24)**: Hỗ trợ tìm kiếm theo họ tên, mã hộ khẩu hoặc CCCD chính xác, kết hợp bộ lọc đa tiêu chí (độ tuổi, giới tính, quan hệ với chủ hộ, tình trạng Đảng, học vấn, nghề nghiệp, phường/xã và khu phố); phân định rõ ràng trạng thái rỗng chưa lọc (hướng dẫn khởi tạo) và trạng thái rỗng do bộ lọc (gợi ý đổi tiêu chí); hỗ trợ bàn giao trực tiếp hồ sơ nhân khẩu được chọn sang phân hệ Quản lý Hoạt động Khu phố (FR-23).
  - **Phân quyền & Phân vùng dữ liệu máy chủ (Server-Enforced Scoping)**:
    - *Trưởng khu phố (Leader)*: Giới hạn toàn bộ quyền tạo, sửa, tra cứu và xem chi tiết trong phạm vi khu phố được phân công phụ trách (`neighborhoodId`). Chặn truy cập chéo khu phố (403 Forbidden).
    - *Cán bộ phường (Officer)*: Có thẩm quyền tra cứu, trích lọc và xem chi tiết hồ sơ trên toàn phường hoặc lọc theo từng khu phố.
    - *Cư dân (Resident)*: Bị chặn quyền truy cập vào các giao diện và API quản lý hồ sơ nhân khẩu (403 Forbidden).
- **Ranh giới an toàn & Môi trường kiểm thử E2E**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình người dùng thực tế từ Web UI Next.js đến API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp vào DB.

---

## 2. Ma trận Bằng chứng Chức năng (FR-21 & FR-24)

| Mã Yêu cầu (SRS) | Tên Chức năng & Nội dung Nghiệp vụ | Trạng thái Nghiệm thu | Bằng chứng Kỹ thuật & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **FR-21** | **Quản lý Hồ sơ Cư dân / Nhân khẩu**<br>• Tạo mới hồ sơ nhân khẩu (`CreateResidentProfileDto`) gắn với mã hộ khẩu (`householdCode`), họ tên, CCCD, ngày sinh, giới tính, nơi sinh, địa chỉ thường trú/hiện tại, quan hệ với chủ hộ, nghề nghiệp, thông tin liên hệ, phường/xã và tỉnh/thành phố.<br>• Kiểm tra tính hợp lệ của CCCD (12 chữ số) và tính duy nhất (`CITIZEN_ID_ALREADY_EXISTS`).<br>• Bảo vệ dữ liệu nhạy cảm: CCCD và thông tin liên lạc được mã hóa ở tầng lưu trữ (`citizenIdEncrypted`, `phoneEncrypted`, `emailEncrypted`), tìm kiếm CCCD chính xác qua mã băm bảo mật (`citizenIdHash`).<br>• Che mặt nạ định danh (`maskedCitizenId`, `maskedPhone`, `maskedEmail`) trên danh sách; giải mã đầy đủ (`ResidentProfileDetailDto`) khi xem chi tiết với quyền hợp lệ.<br>• Cập nhật thông tin hồ sơ nhân khẩu (`UpdateResidentProfileDto`) và xác minh giá trị đã lưu qua UI thật.<br>• Phân quyền và cô lập phạm vi dữ liệu máy chủ: Trưởng khu phố chỉ thao tác trong khu phố phụ trách; Cán bộ phường quản lý toàn phường; Cư dân bị chặn (403 Forbidden). | **ĐẠT (Verified)** | • `packages/shared-types/src/resident-profiles.ts`<br>• `packages/shared-types/src/enums.ts`<br>• `packages/shared-types/test/resident-profiles.test.ts`<br>• `apps/api/src/resident-profiles/resident-profiles.module.ts`<br>• `apps/api/src/resident-profiles/resident-profiles.controller.ts`<br>• `apps/api/src/resident-profiles/resident-profiles.service.ts`<br>• `apps/api/src/resident-profiles/dto/create-resident-profile.dto.ts`<br>• `apps/api/src/resident-profiles/dto/update-resident-profile.dto.ts`<br>• `apps/api/src/security/crypto.service.ts`<br>• `apps/api/prisma/schema.prisma`<br>• `apps/api/src/resident-profiles/resident-profiles.service.spec.ts`<br>• `apps/api/test/resident-profiles.e2e-spec.ts`<br>• `apps/web/src/components/resident-profiles/resident-profile-management.tsx`<br>• `apps/web/src/hooks/use-resident-profiles.ts`<br>• `apps/web/test/resident-profiles.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **FR-24** | **Tìm kiếm, Trích lọc Nâng cao Hồ sơ Cư dân & Bàn giao FR-23**<br>• Tìm kiếm họ tên, mã hộ khẩu hoặc CCCD chính xác; kết hợp đồng thời giới tính, khoảng tuổi (`ageFrom`–`ageTo`), quan hệ với chủ hộ, tình trạng Đảng, trình độ học vấn tối thiểu, nghề nghiệp, phường/xã và khu phố theo logic AND.<br>• Phân định và hiển thị trạng thái rỗng chính xác:<br>  - Trạng thái chưa lọc (unfiltered empty state): Thông báo hướng dẫn lập sổ bộ cư dân mới.<br>  - Trạng thái có bộ lọc (filtered empty state): Thông báo không tìm thấy kết quả phù hợp và hướng dẫn đổi tiêu chí.<br>• Endpoint trích xuất chỉ trả `id` và `fullName`, sau đó bàn giao trực tiếp danh sách đã lọc sang form khởi tạo hoạt động FR-23 (`onSeedActivity`). | **ĐẠT (Verified)** | • `packages/shared-types/src/resident-profiles.ts`<br>• `packages/shared-types/test/resident-profiles.test.ts`<br>• `apps/api/src/resident-profiles/resident-profiles.service.ts`<br>• `apps/api/src/resident-profiles/dto/resident-profile-query.dto.ts`<br>• `apps/api/src/resident-profiles/resident-profile-filter.utils.ts`<br>• `apps/api/src/resident-profiles/resident-profiles.service.spec.ts`<br>• `apps/api/test/resident-profiles.e2e-spec.ts`<br>• `apps/web/src/components/resident-profiles/resident-profile-management.tsx`<br>• `apps/web/src/hooks/use-resident-profiles.ts`<br>• `apps/web/test/resident-profiles.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts`
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema `qlkp_e2e`, `Redis DB 15`.
   - **Kiểm chứng thực tế**:
     - Trưởng khu phố tạo mới hồ sơ cư dân (nhân khẩu), xem danh sách được che mặt nạ an toàn, mở xem chi tiết giải mã đầy đủ theo thẩm quyền và thực hiện cập nhật thông tin hồ sơ.
     - Kiểm thử đồng thời 5 tiêu chí trên trình duyệt (giới tính, khoảng tuổi, quan hệ chủ hộ, nghề nghiệp và phường/xã), xác minh trạng thái rỗng khi một tiêu chí không khớp; các điều kiện tình trạng Đảng và học vấn tối thiểu được bao phủ ở bộ test API tập trung.
     - Thực hiện bàn giao trực tiếp một nhân khẩu sang luồng khởi tạo hoạt động khu phố FR-23.

2. **Rào chắn Kiểm thử Tích hợp & Đơn vị Backend API (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/resident-profiles/resident-profiles.service.spec.ts` (Kiểm thử logic nghiệp vụ, phân quyền RBAC, mã hóa/giải mã, kiểm tra tính duy nhất CCCD, băm định danh và trích lọc nâng cao).
     - `apps/api/test/resident-profiles.e2e-spec.ts` (Kiểm thử đầu cuối API HTTP cho các endpoint tạo, sửa, xem chi tiết, lọc, phân trang, phân quyền khu phố và bàn giao trích xuất nhân khẩu).

3. **Rào chắn Kiểm thử Giao diện Web & Kiểu dùng chung (Focused Web & Shared Suites)**:
   - **Tệp thực thi**:
     - `packages/shared-types/test/resident-profiles.test.ts` (Kiểm thử hợp đồng cấu trúc DTO, enum giới tính, mã lỗi nghiệp vụ và kiểu trích lọc).
     - `apps/web/test/resident-profiles.test.ts` (Kiểm thử hợp đồng giao diện Web, xử lý các tổ hợp bộ lọc, kiểm tra logic nhận diện bộ lọc hoạt động và thông điệp trạng thái rỗng).

---

## 4. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 4.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Kiểm thử Shared Types (`packages/shared-types`)**: Đạt **6/6** bài kiểm thử (`packages/shared-types/test/resident-profiles.test.ts`).
- **Bộ kiểm thử API chuyên biệt (`apps/api`)**: Đạt **39/39** bài kiểm thử (`apps/api/src/resident-profiles/resident-profiles.service.spec.ts` và `apps/api/test/resident-profiles.e2e-spec.ts`).
- **Bộ kiểm thử Web chuyên biệt (`apps/web`)**: Đạt **6/6** bài kiểm thử (`apps/web/test/resident-profiles.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web**: `lint` và `typecheck` cho Web UI đạt.
- **Hành trình trình duyệt Full-Stack E2E cô lập**: Đạt **1/1** hành trình (thời gian thực thi 1.4 phút) sử dụng schema PostgreSQL `qlkp_e2e` và Redis DB 15, không sử dụng mock routes hay can thiệp trực tiếp cơ sở dữ liệu.
- **Xác nhận hành trình trình duyệt**: Chứng minh đầy đủ luồng Trưởng khu phố tạo hồ sơ, xem chi tiết giải mã theo quyền, cập nhật hồ sơ, áp dụng 5 bộ lọc kết hợp, kiểm tra trạng thái rỗng khi lọc và bàn giao trực tiếp một nhân khẩu sang FR-23.

### 4.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **ĐẠT (29/08/2026)**
- `pnpm lint`: Đạt trên toàn monorepo.
- `pnpm typecheck`: Đạt trên toàn monorepo.
- `pnpm --filter @quanlykhupho/api exec prisma validate`: Đạt.
- `pnpm test`: Đạt trên toàn monorepo.
- `pnpm test:ops`: Đạt **99/99** bài kiểm thử vận hành.
- `pnpm build`: Đạt **3/3** tác vụ build.
- `pnpm e2e:fullstack`: Đạt **1/1** hành trình đa vai trò trên Chromium desktop, dùng PostgreSQL schema `qlkp_e2e`, Redis DB 15 và các dịch vụ Docker thật.
- **Kết luận nghiệm thu**: Phân hệ hồ sơ cư dân và trích lọc nâng cao đáp ứng rào chắn acceptance cho FR-21 và FR-24; không còn lỗi mở trong phạm vi phase này.
