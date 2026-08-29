# Biên bản Nghiệm thu Sprint 5B — Xuất dữ liệu CSV/Excel (FR-25)

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động và ranh giới nghiệm thu cho phân hệ Xuất dữ liệu Báo cáo & Quản lý (CSV / Microsoft Excel) thuộc dự án **QuanLyKhuPho**, đáp ứng đầy đủ yêu cầu chức năng **FR-25** theo đặc tả SRS.

---

## 1. Mục đích & Phạm vi Nghiệm thu (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện phân hệ Xuất dữ liệu báo cáo và quản lý trên cả giao diện Web UI (Next.js) và Backend API (NestJS), bảo đảm:
  - **Xuất dữ liệu Đa phân hệ & Đa định dạng (FR-25)**:
    - Hỗ trợ 4 tập dữ liệu nghiệp vụ cốt lõi: `residents` (Danh sách Cư dân / Nhân khẩu), `political_social` (Thông tin Chính trị - Xã hội), `activities` (Sổ hoạt động Khu phố), và `petitions` (Danh sách Kiến nghị & Phản ánh).
    - Hỗ trợ 2 định dạng xuất tiêu chuẩn:
      - **CSV (UTF-8 with BOM)**: Thêm tiền tố UTF-8 Byte Order Mark (`\uFEFF`) bảo đảm hiển thị chính xác toàn bộ ký tự tiếng Việt có dấu khi mở trực tiếp trong Microsoft Excel và các phần mềm bảng tính.
      - **Microsoft Excel (.xlsx)**: Tạo sổ tính nhị phân chuẩn OpenXML, có hàng tiêu đề cố định (frozen header) và tự động căn chỉnh độ rộng cột dựa theo độ dài nội dung.
    - Áp dụng các tiêu chí lọc linh hoạt kết hợp đồng thời (khu phố, giới tính, khoảng độ tuổi, quan hệ chủ hộ, tình trạng Đảng, trình độ học vấn tối thiểu, nghề nghiệp, phường/xã, tháng hoạt động, trạng thái kiến nghị, danh mục kiến nghị, khoảng thời gian gửi kiến nghị, từ khóa tìm kiếm).
  - **Bảo mật, Phòng vệ & Bảo vệ Dữ liệu Cá nhân (Security, Defense & Privacy)**:
    - *Giới hạn số dòng tối đa (Hard Row Cap)*: Khống chế tối đa 10.000 dòng (`MAX_EXPORT_ROWS`). Trả về mã lỗi `EXPORT_LIMIT_EXCEEDED` (HTTP 400 Bad Request) kèm thông điệp tiếng Việt hướng dẫn thu hẹp bộ lọc khi vượt ngưỡng.
    - *Phòng chống tấn công Formula Injection (CSV Formula Defense)*: Tự động phát hiện và thoát chuỗi an toàn (thêm tiền tố dấu nháy đơn `'`) đối với các ô dữ liệu bắt đầu bằng các ký tự công thức nguy hiểm (`=`, `+`, `-`, `@`), kể cả khi có khoảng trắng đứng trước.
    - *Che mặt nạ dữ liệu định danh (Data Masking)*: Tự động áp dụng quy tắc che mặt nạ bảo mật đối với số CCCD (`079******123`), số điện thoại (`090***5432`), email (`p***u@example.com`). Tuyệt đối không xuất hiện CCCD/SĐT/Email dạng plaintext thô; không chứa mã OTP, token phiên, mật khẩu hay dữ liệu bí mật.
    - *Header chống lưu đệm (Anti-caching Headers)*: Toàn bộ phản hồi xuất dữ liệu được đính kèm các header bắt buộc `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`.
    - *Đặt tên tệp an toàn (Safe File Naming)*: Tiêu đề `Content-Disposition` tuân thủ chuẩn RFC 5987 (`filename*=UTF-8''...`), tạo tên tệp chuẩn hóa không dấu và an toàn theo ngày/tháng (`danh-sach-nhan-khau-YYYY-MM-DD.csv`, `so-tay-hoat-dong-YYYY-MM.xlsx`, v.v.).
  - **Phân quyền & Phân vùng dữ liệu máy chủ (Server-Enforced Scoping)**:
    - *Trưởng khu phố (Leader)*: Giới hạn nghiêm ngặt trong phạm vi khu phố phụ trách (`neighborhoodId`). Máy chủ tự động áp đặt điều kiện lọc khu phố của Leader mà không phụ thuộc vào tham số gửi từ client; chặn hoàn toàn thao tác ngoài khu phố phụ trách.
    - *Cán bộ phường (Officer)*: Có thẩm quyền xuất dữ liệu trên toàn phường hoặc tùy chọn lọc theo từng khu phố trực thuộc.
    - *Cư dân (Resident)*: Bị từ chối truy cập và chặn 403 Forbidden toàn bộ API và giao diện xuất dữ liệu.
- **Ranh giới an toàn & Môi trường kiểm thử E2E cô lập**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình người dùng thực tế từ Web UI Next.js đến API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp cơ sở dữ liệu.

---

## 2. Ma trận Bằng chứng Chức năng & Ánh xạ SRS (FR-25 Evidence Matrix)

| Thành phần Yêu cầu (SRS) | Quy tắc Nghiệp vụ & Ràng buộc Kỹ thuật | Trạng thái Nghiệm thu | Bằng chứng Triển khai & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **Tác nhân (Actors)** | • **Leader**: Bị giới hạn nghiêm ngặt theo `neighborhoodId` phụ trách; máy chủ tự động ép phạm vi khu phố; bị chặn 403 Forbidden khi thao tác ngoài thẩm quyền.<br>• **Officer**: Thẩm quyền xuất dữ liệu toàn phường hoặc lọc theo từng khu phố mục tiêu.<br>• **Resident**: Bị từ chối truy cập 403 Forbidden toàn bộ API và giao diện xuất dữ liệu. | **ĐẠT (Verified)** | • `apps/api/src/exports/exports.controller.ts`<br>• `apps/api/src/exports/exports.service.ts`<br>• `apps/api/src/exports/exports.service.spec.ts`<br>• `apps/api/test/exports.e2e-spec.ts`<br>• `apps/api/test/security/authorization-idor.spec.ts` |
| **Dữ liệu Đầu vào (Inputs)** | • **Tập dữ liệu (`ExportDataset`)**: 4 enum (`residents`, `political_social`, `activities`, `petitions`).<br>• **Định dạng (`ExportFormat`)**: 2 enum (`csv`, `xlsx`).<br>• **Bộ lọc truy vấn (`ExportQueryDto`)**: `format`, `neighborhoodId`, `gender`, `ageFrom`, `ageTo`, `relationshipToHead`, `partyStatus`, `minEducation`, `occupation`, `ward`, `month`, `status`, `category`, `startDate`, `endDate`, `search`.<br>• Hỗ trợ tuần tự hóa tham số không làm rơi giá trị số 0 (`ageFrom=0`). | **ĐẠT (Verified)** | • `packages/shared-types/src/exports.ts`<br>• `packages/shared-types/src/enums.ts`<br>• `apps/api/src/exports/dto/export-query.dto.ts`<br>• `packages/shared-types/test/exports.test.ts`<br>• `apps/web/src/hooks/use-exports.ts`<br>• `apps/web/test/exports.test.ts` |
| **Giao diện Modal & Điều khiển Tải về (UI Modal & Format Controls)** | • Hiển thị 4 nút khởi chạy trực quan trong mục Báo cáo & Xuất dữ liệu của Trưởng khu phố.<br>• `ExportModal` cung cấp dropdown lựa chọn 4 loại dữ liệu và 2 nút chọn định dạng.<br>• Thuộc tính trợ năng WAI-ARIA (`aria-pressed`, `type="button"`, `disabled` khi đang xuất).<br>• Tự động đặt lại định dạng về CSV khi đóng và mở lại cho tập dữ liệu khác (**modal reset lifecycle**).<br>• Tải xuống tệp qua cơ chế Blob URL và dọn dẹp tài nguyên sau khi tải. | **ĐẠT (Verified)** | • `apps/web/src/components/exports/export-modal.tsx`<br>• `apps/web/src/components/dashboard/leader-view.tsx`<br>• `apps/web/src/hooks/use-exports.ts`<br>• `apps/web/test/exports.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Xuất Dữ liệu CSV (CSV Exports & Formatting)** | • Tiền tố UTF-8 BOM (`\uFEFF`) hỗ trợ tiếng Việt có dấu chuẩn xác trong Excel.<br>• Tiêu đề các cột dữ liệu được chuẩn hóa tiếng Việt rõ ràng, đầy đủ theo từng phân hệ.<br>• Thoát chuỗi và phòng chống công thức độc hại (Formula Injection Defense).<br>• Đính kèm header `Content-Type: text/csv; charset=utf-8` và `Content-Disposition`. | **ĐẠT (Verified)** | • `apps/api/src/exports/helpers/csv-exporter.ts`<br>• `apps/api/src/exports/exports.service.ts`<br>• `apps/api/src/exports/exports.service.spec.ts`<br>• `apps/api/test/exports.e2e-spec.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Xuất Dữ liệu Excel XLSX (XLSX Exports & Formatting)** | • Sổ tính binary OpenXML hợp lệ với chữ ký ZIP chuẩn `50 4B 03 04`.<br>• Cố định hàng tiêu đề (frozen header) giúp theo dõi bảng tính thuận tiện.<br>• Tự động căn chỉnh độ rộng cột dựa theo độ dài nội dung (auto column width).<br>• Đính kèm header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. | **ĐẠT (Verified)** | • `apps/api/src/exports/helpers/xlsx-exporter.ts`<br>• `apps/api/src/exports/exports.service.ts`<br>• `apps/api/src/exports/exports.service.spec.ts`<br>• `apps/api/test/exports.e2e-spec.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Ràng buộc & Giới hạn Máy chủ (Scoping & Limit Constraints)** | • Giới hạn cứng 10.000 dòng (`MAX_EXPORT_ROWS`), bảo vệ hiệu năng máy chủ và ngăn cạn kiệt bộ nhớ.<br>• Lỗi `EXPORT_LIMIT_EXCEEDED` (HTTP 400) thông báo bằng tiếng Việt khi dữ liệu vượt ngưỡng.<br>• Kiểm tra tính hợp lệ của loại dữ liệu xuất (`INVALID_EXPORT_DATASET` - 400).<br>• Kiểm tra tính hợp lệ của định dạng tệp (`INVALID_EXPORT_FORMAT` - 400).<br>• Header chống lưu đệm (`no-store`, `no-cache`, `must-revalidate`, `Pragma: no-cache`, `Expires: 0`). | **ĐẠT (Verified)** | • `apps/api/src/exports/exports.service.ts`<br>• `apps/api/src/exports/exports.service.spec.ts`<br>• `apps/api/test/exports.e2e-spec.ts`<br>• `packages/shared-types/test/exports.test.ts` |
| **Dữ liệu Đầu ra & Bảo vệ Riêng tư (Outputs & Privacy Protection)** | • Che mặt nạ tự động cho số CCCD (`079******123`), số điện thoại (`090***5432`), và email (`p***u@example.com`).<br>• Tuyệt đối không xuất hiện CCCD/SĐT/Email dạng plaintext trong nội dung tệp tải về.<br>• Loại bỏ hoàn toàn mã xác thực OTP, token truy cập, mật khẩu và dữ liệu bí mật khỏi tệp xuất và nhật ký ghi vết (logs). | **ĐẠT (Verified)** | • `apps/api/src/exports/exports.service.ts`<br>• `apps/api/src/security/citizen-id-utils.ts`<br>• `apps/api/src/security/phone-utils.ts`<br>• `apps/api/src/exports/exports.service.spec.ts`<br>• `apps/api/test/exports.e2e-spec.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts` (bước 9 FR-25)
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema cô lập `qlkp_e2e`, `Redis DB 15`, Chromium desktop, không sử dụng mock routes, request interception hay can thiệp trực tiếp DB.
   - **Các bước kiểm chứng thực tế**:
     1. Trưởng khu phố xác thực qua OTP dev và điều hướng đến mục Báo cáo & Xuất dữ liệu.
     2. Xác minh 4 nút khởi chạy xuất dữ liệu tương ứng 4 tập dữ liệu: Danh sách cư dân, Danh sách chính trị - XH, Sổ hoạt động, Danh sách kiến nghị.
     3. Mở modal xuất dữ liệu cho Danh sách cư dân, kiểm chứng dropdown hiển thị đủ 4 tùy chọn tập dữ liệu với giá trị mặc định `residents`, và định dạng mặc định là CSV (`aria-pressed="true"`).
     4. Kích hoạt tải xuống tệp CSV cư dân thực tế qua trình duyệt; kiểm chứng tên tệp an toàn khớp mẫu `danh-sach-nhan-khau-YYYY-MM-DD.csv`.
     5. Đọc stream dữ liệu tệp CSV tải về: xác minh tiền tố UTF-8 BOM (`\uFEFF`), chứa bản ghi cư dân đã được tạo trong kịch bản E2E (họ tên, mã hộ khẩu, nghề nghiệp đã cập nhật), số CCCD được che mặt nạ bảo mật (`079******123`) và hoàn toàn không chứa số CCCD/SĐT/Email dạng plaintext, không chứa OTP/token/secret; modal tự động đóng sau khi tải thành công.
     6. Mở lại modal xuất dữ liệu cho Sổ hoạt động khu phố; xác minh modal tự động nhận diện tập dữ liệu `activities` và đặt lại định dạng CSV mặc định (`aria-pressed="true"` cho CSV, `aria-pressed="false"` cho XLSX).
     7. Chọn định dạng `Microsoft Excel (.xlsx)` (`aria-pressed="true"`) và kích hoạt tải xuống tệp XLSX thực tế qua trình duyệt.
     8. Đọc stream dữ liệu tệp XLSX tải về: xác minh tên tệp an toàn khớp mẫu `so-tay-hoat-dong-YYYY-MM.xlsx`, dung lượng tệp lớn hơn 0 byte, và 4 byte đầu tiên khớp chính xác chữ ký ZIP chuẩn OpenXML (`0x50 0x4B 0x03 0x04`); modal đóng và Trưởng khu phố đăng xuất an toàn.

2. **Rào chắn Kiểm thử Đơn vị & Tích hợp Backend API (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/exports/exports.service.spec.ts`: Kiểm thử logic phân quyền RBAC (từ chối Resident 403), kiểm tra tham số tập dữ liệu (từ chối dataset không hợp lệ 400), khống chế giới hạn 10.000 dòng (`EXPORT_LIMIT_EXCEEDED`), phân vùng dữ liệu Leader theo khu phố, xuất CSV có BOM, che mặt nạ CCCD/SĐT, escape formula injection, và xuất XLSX binary Buffer đại diện cho dữ liệu cư dân.
     - `apps/api/test/exports.e2e-spec.ts`: Kiểm thử đầu cuối API HTTP bao gồm xác thực phiên qua cookie, phân quyền máy chủ theo vai trò (chặn Resident 403, cho phép Leader/Officer), kiểm tra dataset không hợp lệ (400), xác minh đầy đủ 4 dataset định dạng CSV (UTF-8 BOM, Content-Disposition, Cache-Control, masking, formula defense) và hai workbook XLSX đại diện cho cư dân/hoạt động (Buffer nhị phân, Content-Type, Content-Disposition, chữ ký ZIP OpenXML).
     - `apps/api/test/security/authorization-idor.spec.ts`: Kiểm chứng rào chắn phân quyền và chống lỗ hổng IDOR trên toàn bộ endpoint xuất dữ liệu.

3. **Rào chắn Kiểm thử Giao diện Web & Hợp đồng Kiểu Dùng chung (Focused Web & Shared Suites)**:
   - **Tệp thực thi**:
     - `packages/shared-types/test/exports.test.ts`: Kiểm thử hợp đồng cấu trúc kiểu DTO, các enum `ExportDataset` (4 giá trị), `ExportFormat` (2 giá trị), thứ bậc học vấn, và các mã lỗi nghiệp vụ xuất dữ liệu.
     - `apps/web/test/exports.test.ts`: Kiểm thử hàm xây dựng tham số `buildExportParams` (không làm rơi giá trị số 0), hàm trích xuất tên tệp RFC 5987 `extractFilenameFromDisposition`, nhãn tiếng Việt cho toàn bộ dataset, máy trạng thái chuyển đổi modal (`getInitialExportModalState`, `resolveExportModalTransition`), và các thuộc tính trợ năng WAI-ARIA (`aria-pressed`, `disabled`, `type="button"`).

---

## 4. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 4.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Kiểm thử Shared Types (`packages/shared-types`)**: Đạt **5/5** bài kiểm thử (`packages/shared-types/test/exports.test.ts`).
- **Bộ kiểm thử API chuyên biệt (`apps/api`)**: Đạt **17/17** bài kiểm thử (`apps/api/src/exports/exports.service.spec.ts` và `apps/api/test/exports.e2e-spec.ts`).
- **Bộ kiểm thử Web chuyên biệt (`apps/web`)**: Đạt **16/16** bài kiểm thử (`apps/web/test/exports.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web**: `lint` và `typecheck` Web UI đạt.
- **Hành trình trình duyệt Full-Stack E2E cô lập**: Đạt **1/1** hành trình đa vai trò trong **1,3 phút** trên schema PostgreSQL `qlkp_e2e` và Redis DB 15, tải file CSV và XLSX thực tế từ giao diện người dùng, không sử dụng mock routes hay can thiệp trực tiếp cơ sở dữ liệu.
- **Phân định phạm vi kiểm chứng**: Phân quyền máy chủ (Leader giới hạn theo khu phố, Officer quản lý toàn phường, Resident bị chặn 403), giới hạn tối đa 10.000 dòng, toàn bộ 4 tập dữ liệu trên cả 2 định dạng CSV và XLSX cùng cơ chế escape formula injection được thực thi và chứng minh qua bộ kiểm thử API; hành trình trình duyệt tập trung chứng minh luồng tương tác thực tế của Trưởng khu phố khi tải xuống CSV cư dân và XLSX hoạt động khu phố.

### 4.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **PASSED (ĐẠT)**
- **Kết quả xác minh độc lập của Codex**:
  - `pnpm lint`: đạt, **5/5** tác vụ thành công.
  - `pnpm typecheck`: đạt, **5/5** tác vụ thành công.
  - `pnpm --filter @quanlykhupho/api exec prisma validate`: đạt, schema Prisma hợp lệ.
  - `pnpm test`: đạt, **4/4** tác vụ Turborepo thành công; riêng API đạt **37/37** tệp và **569/569** bài kiểm thử.
  - `pnpm test:ops`: đạt **99/99** bài kiểm thử vận hành.
  - `pnpm build`: đạt **3/3** tác vụ build production.
  - `pnpm e2e:fullstack`: đạt **1/1** hành trình full-stack trong **1,3 phút**.
- **Kết luận nghiệm thu**: Phân hệ Xuất dữ liệu Báo cáo & Quản lý (FR-25) đã vượt qua các rào chắn chức năng, bảo mật, trình duyệt full-stack và chất lượng toàn repository.
