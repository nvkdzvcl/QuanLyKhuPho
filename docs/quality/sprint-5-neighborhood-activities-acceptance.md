# Biên bản Nghiệm thu Sprint 5 — Sổ Hoạt động Khu phố (FR-23)

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động và ranh giới nghiệm thu cho phân hệ Sổ Hoạt động Khu phố (Quản lý Hoạt động Khu phố) thuộc dự án **QuanLyKhuPho**, đáp ứng đầy đủ yêu cầu chức năng **FR-23** theo đặc tả SRS.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện phân hệ Sổ Hoạt động Khu phố trên cả giao diện Web UI (Next.js) và Backend API (NestJS), bảo đảm:
  - **Quản lý Hoạt động Khu phố (FR-23)**:
    - Khởi tạo hoạt động với 5 chế độ trích xuất danh sách nhân khẩu: `all` (Tất cả nhân khẩu), `under_18` (Dưới 18 tuổi), `over_18` (Trên 18 tuổi), `party_member` (Đảng viên), và `custom` (Danh sách tùy chọn / nhận bàn giao trực tiếp từ bộ lọc nâng cao FR-24).
    - Tính toán độ tuổi theo lịch UTC (`calculateCalendarAge`) chuẩn xác tại ngày diễn ra hoạt động.
    - Chụp nhanh danh sách nhân khẩu cố định tại thời điểm tạo hoạt động (**fixed roster semantics**); các thay đổi hồ sơ cư dân sau đó không làm thay đổi danh sách tham gia đã thiết lập.
    - Điểm danh và xếp loại đánh giá: Hỗ trợ 3 trạng thái điểm danh (`attended`, `absent`, `unconfirmed`), 3 mức đánh giá (`good`, `fair`, `average`) và ghi chú đóng góp (tối đa 1.000 ký tự).
    - Cập nhật điểm danh và đánh giá nguyên tử (**atomic participant updates**), tự động tổng hợp các chỉ số thống kê (`attendedCount`, `absentCount`, `unconfirmedCount`, `totalParticipants`).
    - Cập nhật thông tin hoạt động (tên, ngày, người phụ trách, mô tả) mà không làm mất hoặc thay đổi danh sách người tham gia đã trích xuất.
    - Tra cứu danh sách hoạt động theo tháng (`YYYY-MM`) và khu phố, phân trang và hiển thị chi tiết hoạt động.
    - Bảo vệ dữ liệu riêng tư: Dữ liệu người tham gia chỉ trả về `id`, `residentProfileId`, `fullName`, trạng thái điểm danh, ghi chú và đánh giá; tuyệt đối không để lộ CCCD, SĐT, Email hay thông tin định danh nhạy cảm.
  - **Phân quyền & Phân vùng dữ liệu máy chủ (Server-Enforced Scoping)**:
    - *Trưởng khu phố (Leader)*: Giới hạn nghiêm ngặt trong phạm vi khu phố phụ trách (`neighborhoodId`). Chặn hoàn toàn quyền tạo, sửa, xem chi tiết hoặc điểm danh ở khu phố khác (403 Forbidden).
    - *Cán bộ phường (Officer)*: Có thẩm quyền tra cứu, tạo, cập nhật hoạt động trên toàn phường hoặc chọn theo từng khu phố.
    - *Cư dân (Resident)*: Bị chặn hoàn toàn quyền truy cập và thao tác trên phân hệ hoạt động (403 Forbidden).
- **Ranh giới an toàn & Môi trường kiểm thử E2E cô lập**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình người dùng thực tế từ Web UI Next.js đến API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp cơ sở dữ liệu.

---

## 2. Ma trận Bằng chứng Chức năng & Ánh xạ SRS (FR-23 Evidence Matrix)

| Thành phần Yêu cầu (SRS) | Quy tắc Nghiệp vụ & Ràng buộc Kỹ thuật | Trạng thái Nghiệm thu | Bằng chứng Triển khai & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **Tác nhân (Actors)** | • **Leader**: Bị giới hạn nghiêm ngặt theo `neighborhoodId` phụ trách; bị chặn 403 Forbidden khi thao tác ngoài khu phố.<br>• **Officer**: Thẩm quyền toàn phường hoặc chọn khu phố mục tiêu.<br>• **Resident**: Bị từ chối truy cập 403 Forbidden toàn bộ API và UI hoạt động. | **ĐẠT (Verified)** | • `apps/api/src/neighborhood-activities/neighborhood-activities.controller.ts`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.ts`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.spec.ts`<br>• `apps/api/test/neighborhood-activities.e2e-spec.ts` |
| **Dữ liệu Đầu vào (Inputs)** | • **Tạo hoạt động (`CreateNeighborhoodActivityDto`)**: `name` (chuỗi không rỗng, max 255 ký tự), `activityDate` (định dạng ngày hợp lệ), `description` (tùy chọn), `personInCharge` (tùy chọn, max 255 ký tự), `filterCondition` (5 enum), `customResidentIds` (mảng ID nhân khẩu), `neighborhoodId` (cho Officer).<br>• **Cập nhật hoạt động (`UpdateNeighborhoodActivityDto`)**: `name`, `activityDate`, `description`, `personInCharge`.<br>• **Cập nhật điểm danh (`BatchUpdateParticipantsDto`)**: Mảng `participants` gồm `participantId`, `attendance` (3 enum), `notes` (max 1.000 ký tự), `rating` (3 enum).<br>• **Truy vấn theo tháng (`NeighborhoodActivityMonthlyQueryDto`)**: `month` (`YYYY-MM`), `neighborhoodId`, `page`, `limit`. | **ĐẠT (Verified)** | • `packages/shared-types/src/neighborhood-activities.ts`<br>• `packages/shared-types/src/enums.ts`<br>• `apps/api/src/neighborhood-activities/dto/create-neighborhood-activity.dto.ts`<br>• `apps/api/src/neighborhood-activities/dto/update-neighborhood-activity.dto.ts`<br>• `apps/api/src/neighborhood-activities/dto/neighborhood-activity-monthly-query.dto.ts`<br>• `packages/shared-types/test/neighborhood-activities.test.ts` |
| **Luồng Chính: Khởi tạo & Trích xuất (Creation & Extraction)** | • Trích xuất danh sách nhân khẩu tức thời theo 5 điều kiện: tất cả, dưới 18 tuổi, trên 18 tuổi, Đảng viên, hoặc tùy chọn.<br>• Tính tuổi chính xác theo lịch UTC tại ngày diễn ra hoạt động (`calculateCalendarAge`).<br>• Tạo bản ghi hoạt động và người tham gia trong cùng một giao dịch toàn vẹn (`$transaction`), trạng thái ban đầu là `unconfirmed`.<br>• **Fixed Roster Semantics**: Chụp nhanh danh sách tham gia cố định, không biến động khi hồ sơ cư dân thay đổi sau này.<br>• Tiếp nhận bàn giao trực tiếp danh sách nhân khẩu từ bộ lọc nâng cao FR-24 (`ActivityCreationSeed`).<br>• Nếu không có nhân khẩu nào khớp điều kiện trích xuất, tạo hoạt động thành công kèm thông điệp cảnh báo `warning`. | **ĐẠT (Verified)** | • `apps/api/src/neighborhood-activities/neighborhood-activities.service.ts`<br>• `apps/api/prisma/migrations/20260823000005_sprint5a_neighborhood_activities/migration.sql`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.spec.ts`<br>• `apps/api/test/neighborhood-activities.e2e-spec.ts`<br>• `apps/web/src/components/neighborhood-activities/neighborhood-activity-management.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Luồng Chính: Điểm danh & Đánh giá (Attendance & Rating)** | • Cập nhật trạng thái điểm danh (`attended`, `absent`, `unconfirmed`), xếp loại (`good`, `fair`, `average`) và ghi chú đóng góp theo từng cá nhân.<br>• Cập nhật theo lô nguyên tử (**Atomic Updates**), tự động tính toán lại các chỉ số thống kê (`totalParticipants`, `attendedCount`, `absentCount`, `unconfirmedCount`).<br>• Kiểm tra xác thực từng người tham gia thuộc đúng hoạt động mục tiêu. | **ĐẠT (Verified)** | • `apps/api/src/neighborhood-activities/neighborhood-activities.service.ts`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.spec.ts`<br>• `apps/api/test/neighborhood-activities.e2e-spec.ts`<br>• `apps/web/src/components/neighborhood-activities/neighborhood-activity-management.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Luồng Chính: Cập nhật & Tra cứu theo Tháng (Update & Monthly Retrieval)** | • Chỉnh sửa thông tin hoạt động (tên, người phụ trách, mô tả) mà không làm mất danh sách người tham gia.<br>• Tra cứu danh sách hoạt động theo tháng (`YYYY-MM`) và khu phố, có phân trang.<br>• Điều hướng chọn tháng khác và quay lại, bảo đảm dữ liệu cập nhật và danh sách điểm danh được lưu trữ bền vững (full persistence). | **ĐẠT (Verified)** | • `apps/api/src/neighborhood-activities/neighborhood-activities.service.ts`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.controller.ts`<br>• `apps/api/test/neighborhood-activities.e2e-spec.ts`<br>• `apps/web/src/hooks/use-neighborhood-activities.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Ràng buộc & Xử lý Ngoại lệ (Validations & Exceptions)** | • Bắt buộc tên hoạt động: Ràng buộc CHECK constraint DB `char_length(trim(name)) > 0`, validation DTO và hiển thị phản hồi lỗi tiếng Việt trên Web UI khi để trống tên.<br>• Kiểm tra ngày hoạt động hợp lệ (`INVALID_ACTIVITY_DATE`).<br>• Ràng buộc duy nhất người tham gia trên mỗi hoạt động (`UNIQUE(activity_id, resident_profile_id)`).<br>• Kiểm tra người tham gia không thuộc hoạt động (`INVALID_PARTICIPANT`).<br>• Xử lý lỗi không tìm thấy hoạt động (`ACTIVITY_NOT_FOUND` - 404).<br>• Kiểm soát phân quyền: Chặn Resident và thao tác chéo khu phố (403 Forbidden). | **ĐẠT (Verified)** | • `apps/api/prisma/migrations/20260823000005_sprint5a_neighborhood_activities/migration.sql`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.ts`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.spec.ts`<br>• `apps/api/test/neighborhood-activities.e2e-spec.ts`<br>• `apps/web/src/components/neighborhood-activities/neighborhood-activity-management.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Dữ liệu Đầu ra & Bảo vệ Riêng tư (Outputs & Privacy)** | • DTO chi tiết (`NeighborhoodActivityDetailDto`), DTO tóm tắt (`NeighborhoodActivityDto`), danh sách phân trang (`NeighborhoodActivityListResponseDto`), phản hồi khởi tạo (`CreateNeighborhoodActivityResponseDto`).<br>• Bảo vệ thông tin nhạy cảm: Chỉ trả về `id` và `fullName` của người tham gia; không bao gồm CCCD, SĐT, Email hay thông tin mật trong payload và logs. | **ĐẠT (Verified)** | • `packages/shared-types/src/neighborhood-activities.ts`<br>• `apps/api/src/neighborhood-activities/neighborhood-activities.service.ts`<br>• `packages/shared-types/test/neighborhood-activities.test.ts`<br>• `apps/api/test/neighborhood-activities.e2e-spec.ts` |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts` (mục 5 FR-23)
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema cô lập `qlkp_e2e`, `Redis DB 15`, Chromium desktop, không sử dụng mock routes hay can thiệp trực tiếp DB.
   - **Các bước kiểm chứng thực tế**:
     1. Tiếp nhận bàn giao trực tiếp từ bộ lọc nâng cao FR-24 sang modal tạo hoạt động, nhận diện điều kiện `custom` và trích xuất đúng 1 nhân khẩu đã chọn.
     2. Gửi biểu mẫu với tên hoạt động rỗng, kiểm chứng hiển thị thông báo lỗi tiếng Việt bắt buộc nhập tên (`Vui lòng nhập tên hoạt động.`).
     3. Nhập dữ liệu hợp lệ và tạo hoạt động tháng 08/2026 với 1 nhân khẩu tham gia; nhận thông báo toast thành công.
     4. Trong modal điểm danh tự động mở, đánh dấu cư dân "Có mặt", chọn xếp loại "Tốt" (`GOOD`), nhập ghi chú đóng góp và lưu kết quả thành công.
     5. Kiểm tra dòng hoạt động hiển thị chỉ số có mặt `1 / 1`, mở modal chỉnh sửa thông tin hoạt động (tên, người phụ trách, mô tả) và cập nhật thành công mà không làm mất danh sách người tham gia.
     6. Sử dụng bộ chọn tháng để chuyển sang tháng khác (không thấy hoạt động) và chuyển lại tháng 08/2026 (hoạt động hiển thị đầy đủ thông tin cập nhật).
     7. Mở lại modal điểm danh/chi tiết để kiểm chứng toàn bộ thông tin mô tả, người phụ trách, trạng thái có mặt, xếp loại Tốt và ghi chú đóng góp đã được lưu trữ bền vững (**full persistence**).
     8. Tạo hoạt động thứ hai với điều kiện trích xuất Dưới 18 tuổi (`UNDER_18`), kiểm chứng thông báo cảnh báo không có nhân khẩu phù hợp và danh sách người tham gia trong modal chi tiết rỗng cùng nút lưu bị vô hiệu hóa.

2. **Rào chắn Kiểm thử Đơn vị & Tích hợp API Backend (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/neighborhood-activities/neighborhood-activities.service.spec.ts`: Kiểm thử logic tính tuổi theo lịch UTC, 5 chế độ trích xuất danh sách, cố định danh sách (fixed roster), cập nhật nguyên tử điểm danh và xếp loại, phân quyền RBAC và xử lý transaction cô lập.
     - `apps/api/test/neighborhood-activities.e2e-spec.ts`: Kiểm thử đầu cuối API HTTP bao gồm xác thực phiên, phân quyền máy chủ theo vai trò (Leader/Officer/Resident), chặn truy cập chéo khu phố, tạo hoạt động, điểm danh theo lô, cập nhật metadata, truy vấn phân trang theo tháng và bảo vệ dữ liệu định danh nhạy cảm.

3. **Rào chắn Kiểm thử Giao diện Web & Hợp đồng Kiểu Dùng chung (Focused Web & Shared Suites)**:
   - **Tệp thực thi**:
     - `packages/shared-types/test/neighborhood-activities.test.ts`: Kiểm thử hợp đồng cấu trúc DTO, các enum điều kiện trích xuất, trạng thái điểm danh, xếp loại đánh giá và mã lỗi nghiệp vụ.
     - `apps/web/test/neighborhood-activities.test.ts`: Kiểm thử nhãn tiếng Việt cho 5 điều kiện lọc, 3 trạng thái điểm danh, 3 mức đánh giá, hợp đồng DTO bàn giao và payload cập nhật theo lô.

---

## 4. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 4.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Kiểm thử Shared Types (`packages/shared-types`)**: Đạt **10/10** bài kiểm thử (`packages/shared-types/test/neighborhood-activities.test.ts`).
- **Bộ kiểm thử API chuyên biệt (`apps/api`)**: Đạt **39/39** bài kiểm thử (`apps/api/src/neighborhood-activities/neighborhood-activities.service.spec.ts` và `apps/api/test/neighborhood-activities.e2e-spec.ts`).
- **Bộ kiểm thử Web chuyên biệt (`apps/web`)**: Đạt **7/7** bài kiểm thử (`apps/web/test/neighborhood-activities.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web**: `ESLint` mục tiêu và `typecheck` Web đạt.
- **Hành trình trình duyệt Full-Stack E2E cô lập**: Đạt **1/1** hành trình (thời gian thực thi 1.9 phút) sử dụng schema PostgreSQL `qlkp_e2e` và Redis DB 15, không sử dụng mock routes hay can thiệp trực tiếp cơ sở dữ liệu.
- **Phân định phạm vi kiểm chứng**: Phân quyền máy chủ (Leader giới hạn theo khu phố, Officer quản lý toàn phường, Resident bị chặn 403), 5 chế độ trích xuất, cập nhật nguyên tử và tính toàn vẹn của danh sách cố định được thực thi và chứng minh qua bộ kiểm thử API; hành trình trình duyệt tập trung chứng minh toàn diện luồng tương tác thực tế của Trưởng khu phố.

### 4.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **PASSED (ĐẠT)**
- **Kết quả xác minh độc lập của Codex**:
  - `pnpm lint`: đạt, **5/5** tác vụ thành công.
  - `pnpm typecheck`: đạt, **5/5** tác vụ thành công.
  - `pnpm --filter @quanlykhupho/api exec prisma validate`: đạt, schema Prisma hợp lệ.
  - `pnpm test`: đạt, riêng API có **37/37** tệp và **569/569** bài kiểm thử; toàn bộ **4/4** tác vụ Turborepo thành công.
  - `pnpm test:ops`: đạt **99/99** bài kiểm thử vận hành.
  - `pnpm build`: đạt, **3/3** tác vụ build production thành công.
- **Kết luận**: Phân hệ Sổ Hoạt động Khu phố (FR-23) đã vượt qua rào chắn chức năng chuyên biệt, hành trình trình duyệt full-stack cô lập và toàn bộ rào chắn chất lượng cấp repository.
