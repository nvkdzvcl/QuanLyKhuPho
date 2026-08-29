# Biên bản Nghiệm thu Sprint 4B — Quản lý Thông tin Chính trị & Xã hội Cư dân (FR-22)

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động và ranh giới nghiệm thu cho phân hệ Quản lý Thông tin Chính trị - Xã hội của Cư dân thuộc dự án **QuanLyKhuPho**, đáp ứng yêu cầu chức năng **FR-22** theo đặc tả SRS.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện phân hệ quản lý thông tin chính trị, trình độ học vấn, chuyên môn, nghề nghiệp, sở trường và ghi chú của cư dân trên cả giao diện Web UI (Next.js) và Backend API (NestJS), đảm bảo:
  - **Quản lý Thông tin Chính trị - Xã hội (FR-22)**:
    - Lưu trữ và cập nhật các trường thông tin: Tình trạng Đảng (`partyStatus`), Ngày vào Đảng (`partyAdmissionDate`), Trình độ học vấn cao nhất (`highestEducation`), Chuyên môn/Chuyên ngành (`specialty`), Nghề nghiệp/Vị trí công tác (`officialOccupation`), Sở trường/Kỹ năng nổi bật (`strengths`), và Ghi chú bổ sung (`notes`).
    - Quy tắc ràng buộc toàn vẹn dữ liệu: Ngày vào Đảng là bắt buộc đối với Đảng viên (`party_member`), phải ở quá khứ hoặc hiện tại, không được trước ngày sinh nhân khẩu; tự động chuyển về `null` khi chuyển sang trạng thái chưa vào Đảng hoặc đang xem xét. Ràng buộc cấp cơ sở dữ liệu (`CHECK constraint`) bảo đảm tính nhất quán này.
    - Tìm kiếm và lọc danh sách: Tìm kiếm theo họ tên cư dân hoặc mã hộ khẩu; lọc theo trạng thái Đảng (`party_member`, `under_consideration`, `not_member`, `not_updated`).
    - Bảo vệ quyền riêng tư: Endpoint danh sách chính trị - xã hội lược bỏ toàn bộ số định danh (CCCD, SĐT, Email) để tránh lộ lọt thông tin cá nhân.
  - **Phân quyền & Cô lập phạm vi dữ liệu máy chủ (Server-Enforced Scoping)**:
    - *Trưởng khu phố (Leader)*: Giới hạn nghiêm ngặt trong phạm vi khu phố phụ trách (`neighborhoodId`). Chặn truy cập hoặc cập nhật chéo khu phố (403 Forbidden).
    - *Cán bộ phường (Officer)*: Có thẩm quyền tra cứu, cập nhật và lọc dữ liệu trên toàn phường hoặc theo từng khu phố.
    - *Cư dân (Resident)*: Bị chặn hoàn toàn quyền truy cập và cập nhật thông tin chính trị - xã hội (403 Forbidden).
- **Ranh giới an toàn & Môi trường kiểm thử E2E**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình người dùng thực tế từ Web UI Next.js đến Backend API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp cơ sở dữ liệu.

---

## 2. Ma trận Bằng chứng Chức năng (FR-22)

| Mã Yêu cầu (SRS) | Tên Chức năng & Nội dung Nghiệp vụ | Trạng thái Nghiệm thu | Bằng chứng Kỹ thuật & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **FR-22** | **Quản lý Thông tin Chính trị - Xã hội Cư dân**<br>• **Các trường dữ liệu**: Quản lý `partyStatus`, `partyAdmissionDate`, `highestEducation`, `specialty`, `officialOccupation`, `strengths`, `notes`.<br>• **Quy tắc & Ràng buộc nghiệp vụ**: Bắt buộc ngày vào Đảng khi là Đảng viên; kiểm tra ngày vào Đảng không ở tương lai và không trước ngày sinh; tự động làm sạch ngày vào Đảng khi không phải Đảng viên; kiểm tra độ dài tối đa chuỗi ký tự; bảo đảm ràng buộc CHECK constraint và khóa ngoại tại DB.<br>• **Tìm kiếm & Trích lọc**: Tra cứu theo họ tên hoặc mã hộ khẩu; lọc theo tình trạng Đảng kết hợp phân trang.<br>• **Bảo vệ quyền riêng tư**: Không hiển thị các trường định danh nhạy cảm trong danh sách tổng hợp.<br>• **Phân quyền máy chủ**: Leader giới hạn trong khu phố; Officer quản lý toàn phường; Resident bị từ chối truy cập (403 Forbidden). Quyền phân vùng được kiểm chứng độc lập và chặt chẽ ở tầng API. | **ĐẠT (Verified)** | • `packages/shared-types/src/political-social-profiles.ts`<br>• `packages/shared-types/src/enums.ts`<br>• `packages/shared-types/test/political-social-profiles.test.ts`<br>• `apps/api/src/political-social-profiles/political-social-profiles.module.ts`<br>• `apps/api/src/political-social-profiles/political-social-profiles.controller.ts`<br>• `apps/api/src/political-social-profiles/political-social-profiles.service.ts`<br>• `apps/api/src/political-social-profiles/dto/upsert-political-social-profile.dto.ts`<br>• `apps/api/src/political-social-profiles/dto/political-social-query.dto.ts`<br>• `apps/api/prisma/migrations/20260823000004_sprint4b_political_social_profiles/migration.sql`<br>• `apps/api/src/political-social-profiles/political-social-profiles.service.spec.ts`<br>• `apps/api/test/political-social-profiles.e2e-spec.ts`<br>• `apps/web/src/components/political-social-profiles/political-social-management.tsx`<br>• `apps/web/src/hooks/use-political-social-profiles.ts`<br>• `apps/web/test/political-social-profiles.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts`
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema `qlkp_e2e`, `Redis DB 15`.
   - **Kiểm chứng thực tế**:
     - Trưởng khu phố điều hướng tới phân hệ Chính trị - Xã hội, tìm kiếm nhân khẩu theo họ tên.
     - Mở modal thiết lập thông tin, kiểm chứng phản hồi lỗi trực quan khi chọn Đảng viên nhưng bỏ trống ngày vào Đảng (`Ngày vào Đảng là bắt buộc đối với Đảng viên.`).
     - Nhập đầy đủ và hợp lệ tất cả các trường FR-22, gửi biểu mẫu thành công và nhận thông báo toast phản hồi.
     - Lọc danh sách theo trạng thái Đảng viên, xác minh thông tin hiển thị trên bảng dữ liệu.
     - Mở lại modal cập nhật để xác thực toàn bộ giá trị FR-22 đã được lưu trữ bền vững và chính xác.

2. **Rào chắn Kiểm thử Tích hợp & Đơn vị Backend API (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/political-social-profiles/political-social-profiles.service.spec.ts` (Kiểm thử logic nghiệp vụ, phân quyền RBAC, kiểm tra ngày vào Đảng hợp lệ, xử lý transaction cô lập Serializable, kiểm tra giới hạn độ dài chuỗi).
     - `apps/api/test/political-social-profiles.e2e-spec.ts` (Kiểm thử đầu cuối API HTTP: xác thực, phân quyền máy chủ theo vai trò Leader/Officer/Resident, kiểm tra chặn truy cập chéo khu phố, bảo vệ riêng tư dữ liệu định danh, upsert và trích lọc dữ liệu).

3. **Rào chắn Kiểm thử Giao diện Web & Kiểu dùng chung (Focused Web & Shared Suites)**:
   - **Tệp thực thi**:
     - `packages/shared-types/test/political-social-profiles.test.ts` (Kiểm thử hợp đồng cấu trúc DTO, enum trạng thái Đảng, enum học vấn, mã lỗi nghiệp vụ).
     - `apps/web/test/political-social-profiles.test.ts` (Kiểm thử nhãn tiếng Việt giao diện Web, hợp đồng dữ liệu DTO và cấu trúc payload cập nhật).

---

## 4. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 4.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Kiểm thử Shared Types (`packages/shared-types`)**: Đạt **6/6** bài kiểm thử (`packages/shared-types/test/political-social-profiles.test.ts`).
- **Bộ kiểm thử API chuyên biệt (`apps/api`)**: Đạt **29/29** bài kiểm thử (`apps/api/src/political-social-profiles/political-social-profiles.service.spec.ts` và `apps/api/test/political-social-profiles.e2e-spec.ts`).
- **Bộ kiểm thử Web chuyên biệt (`apps/web`)**: Đạt **4/4** bài kiểm thử (`apps/web/test/political-social-profiles.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web**: `ESLint` trên tệp E2E mục tiêu và `typecheck` Web đạt.
- **Hành trình trình duyệt Full-Stack E2E cô lập**: Đạt **1/1** hành trình (thời gian thực thi 1.4 phút) sử dụng schema PostgreSQL `qlkp_e2e` và Redis DB 15, không dùng mock routes hay can thiệp trực tiếp DB.
- **Phân định phạm vi kiểm chứng**: Phân quyền máy chủ (Leader giới hạn theo khu phố, Officer quản lý toàn phường, Resident bị chặn 403) được thực thi và chứng minh qua bộ kiểm thử API; hành trình trình duyệt tập trung chứng minh luồng tương tác thực tế của Trưởng khu phố.

### 4.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **PASSED (Đã được Codex kiểm chứng)**
- Các lệnh đã chạy thành công:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm --filter @quanlykhupho/api exec prisma validate`
  - `pnpm test`
  - `pnpm test:ops`
  - `pnpm build`
- **Kết quả**: Lint và typecheck toàn repository đạt; Prisma schema hợp lệ; toàn bộ test đạt; bộ kiểm thử vận hành đạt **99/99**; build production đạt. Hành trình E2E full-stack cô lập đã đạt **1/1** sau thay đổi FR-22.
- **Kết luận nghiệm thu**: Phân hệ Quản lý Thông tin Chính trị - Xã hội Cư dân (FR-22) đã hoàn thành đầy đủ bằng chứng kiểm thử và vượt qua rào chắn nghiệm thu toàn diện repository.
