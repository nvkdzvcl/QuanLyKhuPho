# Biên bản Nghiệm thu Sprint 2 — Phân hệ Dashboard Giám sát & Báo cáo Định kỳ Toàn Phường

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động, và ranh giới nghiệm thu cho Sprint 2 thuộc dự án **QuanLyKhuPho**, bao gồm các yêu cầu chức năng từ **FR-17** đến **FR-20** theo đặc tả SRS và hợp đồng kỹ thuật `.ai-work/phase-contract.md`.

---

## 1. Mục đích & Phạm vi Sprint 2 (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện phân hệ bảng điều khiển giám sát địa bàn, phân tích chi tiết khu phố, thống kê nhóm kiến nghị và lập báo cáo định kỳ trên cả giao diện Web UI (Next.js) và Backend API (NestJS), đáp ứng các yêu cầu nghiệp vụ:
  - **Tổng quan Địa bàn Toàn Phường (FR-17)**: Cán bộ phường theo dõi toàn diện các chỉ số vận hành tổng hợp (số lượng khu phố, tổng cư dân theo trạng thái hoạt động/chờ duyệt, tổng kiến nghị theo từng trạng thái xử lý, thông báo trong tháng); bảng tổng hợp danh sách từng khu phố với các chỉ số thống kê và đánh giá trạng thái vận hành (`Đang tốt`, `Trung bình`, `Cần chú ý`). Phân quyền nghiêm ngặt: chỉ Cán bộ phường có quyền truy cập; Trưởng khu phố và Cư dân bị từ chối truy cập ở tầng máy chủ (403 Forbidden).
  - **Phân tích Chi tiết Từng Khu phố (FR-18)**: Cung cấp góc nhìn chuyên sâu (drill-down) cho từng khu phố: thông tin định danh, số liệu nhân khẩu/tài khoản, thông báo đã đăng, thống kê kiến nghị và danh sách các thông báo/kiến nghị phát sinh gần nhất. Xử lý an toàn các trường hợp ID khu phố không hợp lệ hoặc không tồn tại (400 Bad Request / 404 Not Found).
  - **Thống kê Nhóm Kiến nghị & Bộ lọc Đa tiêu chí (FR-19)**: Tổng hợp kiến nghị theo 4 nhóm danh mục chuẩn (`INFRASTRUCTURE`, `SANITATION`, `SECURITY`, `OTHER`) kèm tỷ lệ phần trăm và số lượng đã giải quyết. Hỗ trợ lọc kết hợp theo khu phố (`neighborhoodId`) và khoảng thời gian tạo (`startDate`, `endDate`). Luôn trả về đủ 4 danh mục (zero-fill an toàn) kể cả khi không có dữ liệu; xử lý an toàn lỗi khoảng ngày không hợp lệ (`startDate > endDate`).
  - **Xem trước & Xuất Báo cáo Định kỳ CSV An toàn (FR-20)**: Hỗ trợ xem trước và xuất dữ liệu báo cáo định kỳ theo Tháng (1..12) hoặc theo Quý (1..4) cho một năm xác định. Báo cáo tổng hợp số liệu toàn phường và bảng chi tiết theo từng khu phố; đánh giá tính đầy đủ của dữ liệu (`isDataSufficient`) kèm cảnh báo nếu kỳ báo cáo chưa kết thúc hoặc chưa có hoạt động; hỗ trợ xuất tệp CSV tương thích chuẩn UTF-8 (kèm UTF-8 BOM), ngăn chặn tấn công formula injection (`=`, `+`, `-`, `@`), và tuyệt đối không làm lộ dữ liệu nhạy cảm cấp cá nhân (số điện thoại, CCCD/CMND, tên đầy đủ cá nhân). Chức năng gửi báo cáo tự động qua email hoãn lại có chủ đích và được đáp ứng đầy đủ qua luồng xuất báo cáo CSV trực tiếp.
- **Ranh giới an toàn & Môi trường kiểm thử E2E**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình người dùng thực tế từ Web UI Next.js đến API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp vào DB.

---

## 2. Ma trận Bằng chứng Chức năng Sprint 2 (FR-17 → FR-20)

| Mã Yêu cầu (SRS) | Tên Chức năng & Nội dung Nghiệp vụ | Trạng thái Nghiệm thu | Bằng chứng Kỹ thuật & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **FR-17** | **Tổng quan Chỉ số Toàn Phường & Danh sách Địa bàn**<br>• Cán bộ phường theo dõi chỉ số tổng hợp toàn phường: số khu phố, số cư dân (hoạt động/chờ duyệt), số kiến nghị (tổng số và chi tiết theo 5 trạng thái), số thông báo tháng hiện tại.<br>• Bảng danh sách chi tiết các khu phố với số liệu nhân khẩu, thông báo, kiến nghị và phân loại trạng thái.<br>• Phân quyền RBAC nghiêm ngặt: Trưởng khu phố và Cư dân bị chặn truy cập (403 Forbidden).<br>• Trả về trạng thái rỗng an toàn (zero counts) khi chưa có dữ liệu phát sinh. | **ĐẠT** | • `apps/api/src/dashboard/dashboard.service.ts`<br>• `apps/api/src/dashboard/dashboard.controller.ts`<br>• `apps/api/src/dashboard/dashboard.service.spec.ts`<br>• `apps/api/test/dashboard.e2e-spec.ts`<br>• `apps/web/src/components/dashboard/officer-overview.tsx`<br>• `apps/web/src/components/dashboard/ward-overview-stats.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 8) |
| **FR-18** | **Xem Chi tiết & Chỉ số Vận hành Từng Khu phố (Drill-Down)**<br>• Hiển thị số liệu thống kê chi tiết theo khu phố được chọn: thông tin khu phố, số cư dân, tài khoản hoạt động/chờ duyệt, thông báo đã đăng, kiến nghị theo trạng thái.<br>• Danh sách thông báo gần đây và kiến nghị gần đây của khu phố.<br>• Phân quyền: Chỉ Cán bộ phường có quyền truy cập.<br>• Xử lý an toàn trường hợp mã định danh khu phố không đúng định dạng UUID (400 Bad Request) hoặc không tồn tại trong hệ thống (404 Not Found). | **ĐẠT** | • `apps/api/src/dashboard/dashboard.service.ts`<br>• `apps/api/src/dashboard/dashboard.controller.ts`<br>• `apps/api/src/dashboard/dashboard.service.spec.ts`<br>• `apps/api/test/dashboard.e2e-spec.ts`<br>• `apps/web/src/components/dashboard/ward-overview-stats.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 8) |
| **FR-19** | **Phân tích Nhóm Kiến nghị & Bộ lọc Đa tiêu chí**<br>• Thống kê kiến nghị theo 4 nhóm danh mục chuẩn (`INFRASTRUCTURE`, `SANITATION`, `SECURITY`, `OTHER`) kèm tỷ lệ % và số kiến nghị đã giải quyết.<br>• Hỗ trợ bộ lọc linh hoạt theo khu phố (`neighborhoodId`), ngày bắt đầu (`startDate`) và ngày kết thúc (`endDate`).<br>• Tính toán biên ngày chính xác bằng mốc loại trừ đầu ngày kế tiếp.<br>• Luôn hiển thị đầy đủ 4 danh mục (zero-fill an toàn) kể cả khi một nhóm hoặc toàn bộ phạm vi không có kiến nghị.<br>• Kiểm tra tính hợp lệ của tham số: từ chối khoảng ngày đảo ngược (`startDate > endDate`) với mã lỗi 400. | **ĐẠT** | • `apps/api/src/dashboard/dashboard.service.ts`<br>• `apps/api/src/dashboard/dashboard.controller.ts`<br>• `apps/api/src/dashboard/dto/dashboard-petition-categories-query.dto.ts`<br>• `apps/api/src/dashboard/dashboard.service.spec.ts`<br>• `apps/api/test/dashboard.e2e-spec.ts`<br>• `apps/web/src/components/dashboard/ward-overview-stats.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 8) |
| **FR-20** | **Xem trước & Xuất Báo cáo Định kỳ Toàn Phường (CSV UTF-8)**<br>• Hỗ trợ kỳ báo cáo theo Tháng (1..12) hoặc theo Quý (1..4) cho một năm nhất định.<br>• Xác định chính xác biên thời gian bắt đầu và kết thúc kỳ theo chuẩn UTC.<br>• Cung cấp chỉ số đánh giá tính đầy đủ của dữ liệu (`isDataSufficient`) và danh sách cảnh báo (`warnings`) khi kỳ báo cáo chưa kết thúc hoặc chưa ghi nhận hoạt động.<br>• Tổng hợp chỉ số toàn phường và bảng số liệu phân rã chi tiết theo từng khu phố trực thuộc.<br>• Xuất tệp CSV an toàn: mã hóa UTF-8 kèm UTF-8 BOM (`\uFEFF`), tên tệp chuẩn hóa (`bao-cao-khu-pho-thang-MM-YYYY.csv`), phòng chống formula injection, và bảo vệ quyền riêng tư.<br>• Nhánh xuất file trong yêu cầu “xuất hoặc gửi” đã được triển khai; gửi email chưa thuộc phạm vi phase này. | **ĐẠT** | • `apps/api/src/dashboard/dashboard.service.ts`<br>• `apps/api/src/dashboard/dashboard.controller.ts`<br>• `apps/api/src/dashboard/dto/periodic-report-query.dto.ts`<br>• `apps/api/src/dashboard/dashboard.service.spec.ts`<br>• `apps/api/test/dashboard.e2e-spec.ts`<br>• `apps/web/src/components/dashboard/periodic-report-card.tsx`<br>• `apps/web/src/lib/periodic-report-csv.ts`<br>• `apps/web/test/periodic-report-csv.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 8) |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

Hệ thống thiết lập các rào chắn kiểm thử tự động đa tầng nhằm chứng minh tính toàn vẹn và độ tin cậy của phân hệ Dashboard & Báo cáo:

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts`
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema `qlkp_e2e`, `Redis DB 15`.
   - **Kịch bản kiểm chứng thực tế (Step 8)**:
     - Cán bộ phường đăng nhập qua dev OTP; xác nhận chỉ số tổng quan toàn phường (khu phố, cư dân, kiến nghị, hồ sơ chờ duyệt) và bảng tình hình các khu phố từ API thực.
     - Mở xem chi tiết khu phố (drill-down KP-01); đối soát định danh khu phố, chỉ số cư dân hoạt động, thông báo đã đăng và danh sách kiến nghị gần đây; đóng modal chi tiết.
     - Thực thi bộ lọc phân tích nhóm kiến nghị theo khu phố KP-01; thực thi bộ lọc theo khoảng ngày quá khứ để kiểm chứng trạng thái rỗng an toàn (0 kiến nghị); xóa lọc để khôi phục trạng thái ban đầu mà không bỏ qua UI.
     - Chuyển sang mục Báo cáo; thực thi xem trước báo cáo định kỳ; kiểm tra thanh metadata phạm vi thời gian, trạng thái dữ liệu, khối tổng hợp toàn phường và bảng chi tiết từng khu phố.
     - Tải tệp CSV; xác thực sự kiện download, kiểm tra tên tệp chuẩn hóa, chữ ký UTF-8 BOM, cấu trúc các khối dữ liệu tổng hợp và kiểm tra nghiêm ngặt việc không làm lộ các trường thông tin nhạy cảm cá nhân.

2. **Rào chắn Kiểm thử Tích hợp & Đơn vị Backend API (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/dashboard/dashboard.service.spec.ts` (23 bài kiểm thử: logic tổng hợp toàn phường, drill-down khu phố, thống kê danh mục kiến nghị zero-fill, báo cáo tháng/quý UTC, cảnh báo dữ liệu, phòng chống lỗi khoảng ngày).
     - `apps/api/test/dashboard.e2e-spec.ts` (28 bài kiểm thử: phân quyền RBAC 403 cho Resident/Leader, xác thực tham số DTO 400, kiểm tra toàn diện các endpoint `/api/dashboard/ward-overview`, `/api/dashboard/neighborhoods/:id`, `/api/dashboard/petition-categories`, `/api/dashboard/periodic-report`).

3. **Rào chắn Kiểm thử Hợp đồng & Xử lý Giao diện Web (Focused Web Suites)**:
   - **Tệp thực thi**:
     - `apps/web/test/periodic-report-csv.test.ts` (12 bài kiểm thử: sinh tên tệp theo tháng/quý, chống tấn công formula injection, escape ký tự đặc biệt, sinh dòng CSV, xuất UTF-8 BOM, đối soát dữ liệu tổng hợp và loại bỏ trường nhạy cảm).
     - `apps/web/test/dashboard-navigation.test.ts` (31 bài kiểm thử: phân quyền điều hướng các vai trò, chuẩn hóa section alias, xử lý badge số lượng).

---

## 4. Các Ranh giới Kiến trúc & Hạng mục Hoãn lại Có chủ đích (Architectural Invariants & Intentional Boundaries)

1. **Phân quyền dữ liệu cấp máy chủ (Server-Side Scoping & RBAC Invariants)**:
   - Các API thuộc phân hệ Dashboard và Báo cáo định kỳ toàn phường (`/api/dashboard/*`) chỉ cho phép vai trò Cán bộ phường (`UserRole.OFFICER`) truy cập.
   - Cư dân và Trưởng khu phố bị từ chối truy cập ở tầng guard (`RolesGuard`) với mã phản hồi 403 Forbidden.
2. **Biên thời gian & Tổng hợp dữ liệu chuẩn xác (Stable UTC Date Boundaries)**:
   - Khoảng thời gian báo cáo tháng/quý được xác định chính xác theo mốc UTC đầu tháng/quý (`startDate`) và mốc kết thúc loại trừ (`endDateExclusive`).
   - Bộ lọc ngày phân tích kiến nghị bao hàm toàn bộ ngày kết thúc (`<= 23:59:59.999Z`).
3. **An toàn xuất dữ liệu & Bảo vệ quyền riêng tư (CSV Security & Privacy)**:
   - Tệp CSV xuất ra được gán tiền tố UTF-8 BOM (`\uFEFF`) để tương thích hiển thị ký tự tiếng Việt có dấu trên Microsoft Excel và các trình đọc bảng tính.
   - Các ô dữ liệu bắt đầu bằng các ký tự nguy hiểm (`=`, `+`, `-`, `@`) được tự động thêm tiền tố dấu nháy đơn (`'`) để vô hiệu hóa formula injection.
   - Báo cáo định kỳ chỉ tổng hợp dữ liệu thống kê mức độ tập hợp (aggregate data); tuyệt đối không xuất các trường nhạy cảm cấp cá nhân (số điện thoại, CCCD/CMND, mật khẩu, token).
4. **Các hạng mục ngoài phạm vi phase này (Intentional Boundaries)**:
   - Gửi báo cáo tự động qua email: Hoãn lại có chủ đích; đặc tả FR-20 được đáp ứng hoàn chỉnh qua luồng xuất báo cáo định kỳ dạng CSV trên giao diện.
   - Tùy biến công thức tính điểm phức tạp ngoài các chỉ số tổng hợp hiện hành.

---

## 5. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 5.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Bộ kiểm thử API chuyên biệt (Slice 1)**: Đạt 51/51 bài kiểm thử (23 service tests tại `dashboard.service.spec.ts`, 28 HTTP e2e tests tại `test/dashboard.e2e-spec.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu API**: `lint` và `typecheck` cho API đạt.
- **Bộ kiểm thử Web chuyên biệt (Slice 2)**: Đạt 43/43 bài kiểm thử (12 tests tại `periodic-report-csv.test.ts`, 31 tests tại `dashboard-navigation.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web**: `lint` và `typecheck` cho Web UI đạt.
- **Hành trình trình duyệt Full-Stack E2E (Slice 3)**: Đạt 1/1 hành trình đa vai trò 8 bước trên Chromium desktop trong 1,3 phút, dùng PostgreSQL schema `qlkp_e2e`, Redis DB 15 và RabbitMQ thật; không dùng mock route hoặc đọc DB trực tiếp từ Playwright.

### 5.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **ĐẠT (28/08/2026)**
- `pnpm lint`: Đạt trên toàn monorepo.
- `pnpm typecheck`: Đạt trên toàn monorepo.
- `pnpm --filter @quanlykhupho/api exec prisma validate`: Đạt.
- `pnpm test`: Đạt trên toàn monorepo.
- `pnpm test:ops`: Đạt các bài kiểm thử vận hành.
- `pnpm build`: Đạt các tác vụ build monorepo.
- `pnpm e2e:fullstack`: Đạt 1/1 hành trình đa vai trò 8 bước trên Chromium desktop, bao gồm tải và kiểm tra nội dung CSV tổng hợp.
- **Kết luận nghiệm thu**: Phân hệ Dashboard & Báo cáo định kỳ đáp ứng các tiêu chuẩn nghiệm thu cho FR-17 đến FR-20; không còn lỗi mở trong phạm vi phase này.
