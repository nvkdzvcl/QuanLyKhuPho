# Biên bản Nghiệm thu Sprint 2B — Phân hệ Kiến nghị & Phản ánh Cư dân

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động, và ranh giới nghiệm thu cho Sprint 2B thuộc dự án **QuanLyKhuPho**, bao gồm các yêu cầu chức năng từ **FR-12** đến **FR-16** theo đặc tả SRS và hợp đồng kỹ thuật `.ai-work/phase-contract.md`.

---

## 1. Mục đích & Phạm vi Sprint 2B (Purpose & Scope)

- **Mục đích**: Nghiệm thu phân hệ quản lý kiến nghị và phản ánh dân sinh trên cả giao diện Web UI (Next.js) và Backend API (NestJS), đáp ứng các yêu cầu nghiệp vụ cốt lõi:
  - **Gửi kiến nghị & Đính kèm minh chứng an toàn (FR-12)**: Cư dân gửi kiến nghị kèm danh mục, tiêu đề, nội dung và tối đa 5 hình ảnh minh chứng (JPEG, PNG, WebP; tối đa 10 MiB/ảnh; kiểm tra chữ ký magic bytes). Kiến nghị khởi tạo ở trạng thái `reviewing`, tự động tạo bản ghi lịch sử ban đầu và phân phối thông báo in-app bền vững tới Trưởng khu phố.
  - **Danh sách kiến nghị phân quyền & Bộ lọc đa tiêu chí (FR-13)**: Trưởng khu phố chỉ xem trong khu phố phụ trách; Cán bộ phường xem toàn phường hoặc lọc theo từng khu phố. Hỗ trợ lọc theo trạng thái, danh mục, khoảng thời gian và tìm kiếm từ khóa.
  - **Quy trình xử lý & Chuyển trạng thái có kiểm soát (FR-14)**: Trưởng khu phố và Cán bộ phường tiếp nhận và xử lý kiến nghị theo máy trạng thái xác định (`reviewing -> processing -> resolved | rejected`). Yêu cầu bắt buộc nhập lý do khi từ chối; cập nhật nguyên tử chống tương tranh; tự động ghi nhận lịch sử xử lý bất biến, gửi thông báo in-app bền vững và thử Web Push theo cơ chế best-effort cho tác giả.
  - **Hủy kiến nghị từ tác giả cư dân (FR-15)**: Cho phép tác giả cư dân hủy kiến nghị khi còn ở trạng thái `reviewing`; chặn thao tác hủy khi kiến nghị đã chuyển sang xử lý hoặc trạng thái đóng; ghi nhận lý do hủy vào lịch sử bất biến.
  - **Lịch sử kiến nghị của cư dân (FR-16)**: Cư dân chỉ thấy các kiến nghị do mình gửi, trạng thái hiện tại, phản hồi và toàn bộ tiến trình xử lý theo thứ tự thời gian tăng dần. Kiểm soát tải minh chứng là rào chắn bảo mật xuyên suốt của phân hệ, không được diễn giải thành yêu cầu riêng của FR-16.
- **Ranh giới an toàn & Môi trường kiểm thử E2E**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình thực tế người dùng từ Web UI Next.js đến API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp vào DB.

---

## 2. Ma trận Bằng chứng Chức năng Sprint 2B (FR-12 → FR-16)

| Mã Yêu cầu (SRS) | Tên Chức năng & Nội dung Nghiệp vụ | Trạng thái Nghiệm thu | Bằng chứng Kỹ thuật & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **FR-12** | **Gửi Kiến nghị / Phản ánh & Tải Minh chứng Hình ảnh**<br>• Cư dân tạo kiến nghị với danh mục (`category`), tiêu đề (`title`), nội dung (`description`).<br>• Chặn Trưởng khu phố và Cán bộ phường tạo kiến nghị từ giao diện cư dân (403 Forbidden).<br>• Hỗ trợ tải kèm tối đa 5 hình ảnh minh chứng, dung lượng tối đa 10 MiB/ảnh.<br>• Xác thực an toàn tệp: kiểm tra magic bytes (JPEG, PNG, WebP), MIME type và làm sạch tên tệp.<br>• Kiến nghị khởi tạo ở trạng thái `reviewing` và ghi nhận lịch sử ban đầu (`fromStatus: null, toStatus: reviewing`).<br>• Tạo thông báo in-app bền vững trong transaction DB gửi đến các Trưởng khu phố đang hoạt động trong khu phố; kích hoạt Web Push sau commit. | **ĐẠT (Verified)** | • `apps/api/src/petitions/petitions.service.ts`<br>• `apps/api/src/petitions/evidence-file.validator.ts`<br>• `apps/api/src/petitions/petition-evidence-storage.service.ts`<br>• `apps/api/src/petitions/petitions.service.spec.ts`<br>• `apps/api/src/petitions/evidence-file.validator.spec.ts`<br>• `apps/api/src/petitions/petition-evidence-storage.service.spec.ts`<br>• `apps/api/test/petitions.e2e-spec.ts`<br>• `apps/web/src/components/petitions/create-petition-modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 4) |
| **FR-13** | **Danh sách Kiến nghị dành cho Quản trị & Bộ lọc Đa tiêu chí**<br>• Trưởng khu phố: Chỉ xem danh sách kiến nghị thuộc khu phố được phân công phụ trách (`neighborhoodId`). Chặn truy cập trái phép khu phố khác.<br>• Cán bộ phường: Xem danh sách toàn phường hoặc lọc theo từng khu phố.<br>• Hỗ trợ bộ lọc kết hợp: trạng thái (`status`), danh mục (`category`), khoảng ngày tạo (`startDate`, `endDate`), tìm kiếm từ khóa (`search`), và phân trang (`page`, `limit`). | **ĐẠT (Verified)** | • `apps/api/src/petitions/petitions.service.ts`<br>• `apps/api/src/petitions/petitions.controller.ts`<br>• `apps/api/src/petitions/dto/petition-query.dto.ts`<br>• `apps/api/src/petitions/petitions.service.spec.ts`<br>• `apps/api/test/petitions.e2e-spec.ts`<br>• `apps/web/src/components/petitions/petition-list.tsx`<br>• `apps/web/src/hooks/use-petitions.ts`<br>• `apps/web/test/petitions.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 5, Step 6) |
| **FR-14** | **Tiếp nhận & Cập nhật Trạng thái Xử lý Kiến nghị**<br>• Quyền thực hiện: Chỉ Trưởng khu phố (trong khu phố quản lý) và Cán bộ phường (toàn phường). Cư dân bị chặn quyền (403 Forbidden).<br>• Máy trạng thái hợp lệ:<br>  - `reviewing` → `processing` (Tiếp nhận xử lý)<br>  - `processing` → `resolved` (Đã giải quyết) hoặc `rejected` (Từ chối)<br>  - Chặn chuyển trạng thái từ các trạng thái đóng (`resolved`, `rejected`, `cancelled`).<br>• Bắt buộc nhập lý do / phản hồi (`responseNote`) khi từ chối (`rejected`).<br>• Cập nhật nguyên tử bảo vệ tương tranh (optimistic concurrency update).<br>• Tự động bổ sung bản ghi lịch sử xử lý bất biến (`PetitionHistory`) và gửi thông báo in-app bền vững tới tác giả cư dân. | **ĐẠT (Verified)** | • `apps/api/src/petitions/petitions.service.ts`<br>• `apps/api/src/petitions/dto/update-petition-status.dto.ts`<br>• `apps/api/src/petitions/petitions.service.spec.ts`<br>• `apps/api/test/petitions.e2e-spec.ts`<br>• `apps/web/src/components/petitions/petition-detail-modal.tsx`<br>• `apps/web/src/components/petitions/petition-status-badge.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 5, Step 6) |
| **FR-15** | **Hủy Kiến nghị từ Tác giả Cư dân**<br>• Chỉ chính tác giả cư dân mới có quyền hủy kiến nghị của mình. Chặn người dùng khác và cấp quản lý hủy thay (403 / 404).<br>• Ràng buộc trạng thái: Chỉ cho phép hủy khi kiến nghị đang ở trạng thái `reviewing` (Chờ tiếp nhận).<br>• Chặn hủy khi kiến nghị đã chuyển sang `processing`, `resolved`, `rejected` hoặc đã `cancelled`.<br>• Chuyển trạng thái sang `cancelled`, lưu lý do hủy và bổ sung bản ghi lịch sử xử lý bất biến (`fromStatus: reviewing, toStatus: cancelled`). | **ĐẠT (Verified)** | • `apps/api/src/petitions/petitions.service.ts`<br>• `apps/api/src/petitions/dto/cancel-petition.dto.ts`<br>• `apps/api/src/petitions/petitions.service.spec.ts`<br>• `apps/api/test/petitions.e2e-spec.ts`<br>• `apps/web/src/components/petitions/petition-detail-modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 4) |
| **FR-16** | **Xem Lịch sử Kiến nghị của Cư dân**<br>• Cư dân chỉ xem danh sách kiến nghị do chính mình tạo (`authorId`); truy cập chéo bị che giấu bằng 404.<br>• Hiển thị trạng thái hiện tại, phản hồi và toàn bộ lịch sử xử lý (`history`) theo thứ tự thời gian tăng dần (`createdAt: 'asc'`).<br>• Thông tin lịch sử gồm trạng thái trước/sau, người thực hiện kèm số điện thoại che mặt nạ (`maskedPhone`), vai trò, ghi chú và thời điểm.<br>• Dữ liệu lịch sử là bất biến (append-only), không hỗ trợ chỉnh sửa hay xóa. | **ĐẠT (Verified)** | • `apps/api/src/petitions/petitions.service.ts`<br>• `apps/api/src/petitions/petitions.service.spec.ts`<br>• `apps/api/test/petitions.e2e-spec.ts`<br>• `apps/web/src/components/petitions/petition-list.tsx`<br>• `apps/web/src/components/petitions/petition-detail-modal.tsx`<br>• `apps/web/test/petitions.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 4, Step 7) |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

Hệ thống thiết lập các rào chắn kiểm thử tự động đa tầng nhằm bảo đảm tính toàn vẹn và an toàn cho phân hệ Kiến nghị:

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts`
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema `qlkp_e2e`, `Redis DB 15`.
   - **Kịch bản kiểm chứng thực tế**:
     - *Step 4*: Cư dân đăng nhập qua dev OTP; gửi kiến nghị chính kèm tệp minh chứng hình ảnh thực tế; gửi kiến nghị thứ hai ở trạng thái `reviewing` rồi thực hiện hủy kiến nghị, xác minh hộp thoại xác nhận và lịch sử hủy.
     - *Step 5*: Trưởng khu phố đăng nhập; điều hướng đến mục Kiến nghị; thực thi bộ lọc trạng thái, danh mục, ngày tháng; mở chi tiết kiến nghị kèm hình ảnh minh chứng; chuyển trạng thái sang `processing` và kết thúc với `resolved` kèm ghi chú giải quyết.
     - *Step 6*: Cán bộ phường giám sát danh sách kiến nghị toàn phường; kiểm tra bộ lọc; mở xem chi tiết kiến nghị đã giải quyết, hình ảnh minh chứng và dòng thời gian xử lý.
     - *Step 7*: Cư dân đăng nhập lại; xác nhận thông báo cập nhật trạng thái kiến nghị hiển thị trong chuông thông báo in-app; mở chi tiết kiến nghị để đối soát trạng thái cuối cùng, ghi chú giải quyết và toàn bộ dòng thời gian xử lý.

2. **Rào chắn Kiểm thử Tích hợp & Đơn vị Backend API (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/petitions/petitions.service.spec.ts` (Kiểm thử logic nghiệp vụ, phân quyền RBAC, máy trạng thái, hủy kiến nghị, rollback tệp khi lỗi DB).
     - `apps/api/src/petitions/evidence-file.validator.spec.ts` (Kiểm thử xác thực magic bytes JPEG/PNG/WebP, giới hạn kích thước 10 MiB, số lượng tối đa 5 tệp).
     - `apps/api/src/petitions/petition-evidence-storage.service.spec.ts` (Kiểm thử lưu trữ tệp an toàn, kiểm tra chống path traversal `isPathContained`, dọn dẹp tệp staged).
     - `apps/api/test/petitions.e2e-spec.ts` (Kiểm thử đầu cuối API HTTP cho toàn bộ các endpoint kiến nghị, phân quyền, lọc, cập nhật trạng thái, hủy và tải minh chứng).

3. **Rào chắn Kiểm thử Hợp đồng Giao diện Web (Focused Web Suites)**:
   - **Tệp thực thi**:
     - `apps/web/test/petitions.test.ts` (Kiểm thử hợp đồng cấu trúc dữ liệu `PetitionDto`, `PetitionDetailDto`, `PetitionHistoryDto`, phân quyền và trạng thái).

---

## 4. Các Ranh giới Kiến trúc & Hạng mục Hoãn lại Có chủ đích (Architectural Invariants & Intentional Boundaries)

1. **Bảo toàn lịch sử xử lý bất biến (Append-Only & Immutable Audit History)**:
   - Mọi thay đổi trạng thái kiến nghị (tạo mới, tiếp nhận, giải quyết, từ chối, hủy) đều được ghi nhận tuần tự vào bảng `PetitionHistory`.
   - Hệ thống không cung cấp API chỉnh sửa hoặc xóa lịch sử nhằm đảm bảo tính toàn vẹn phục vụ công tác thanh kiểm tra.
2. **Cơ chế dự phòng thông báo đa tầng (In-App Notification Fallback & Best-Effort Web Push)**:
   - Thông báo in-app được tạo bền vững ngay trong transaction cơ sở dữ liệu khi kiến nghị được tạo hoặc cập nhật trạng thái.
   - Web Push được kích hoạt bất đồng bộ sau khi commit transaction (best-effort) và không làm gián đoạn luồng nghiệp vụ nếu chưa cấu hình VAPID hoặc người dùng không bật thông báo trình duyệt.
3. **Kiểm soát an toàn tệp minh chứng**:
   - Chỉ chấp nhận ảnh định dạng JPEG, PNG, WebP; tối đa 5 tệp/kiến nghị; tối đa 10 MiB/tệp.
   - Lưu trữ ngoài thư mục web tĩnh công khai; truy xuất thông qua stream có xác thực quyền và kiểm tra an toàn đường dẫn (`isPathContained`).
4. **Các hạng mục ngoài phạm vi phase này (Intentional Boundaries)**:
   - Dashboard, báo cáo và các yêu cầu từ FR-17 trở đi.
   - Cơ chế giao việc hoặc chuyển tiếp kiến nghị đa cấp giữa các phòng ban chuyên môn.
   - Tải lên tệp video hoặc âm thanh dung lượng lớn làm minh chứng.

---

## 5. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 5.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Bộ kiểm thử API chuyên biệt (S2P-A)**: Đạt 75/75 bài kiểm thử (`petitions.service.spec.ts`, `evidence-file.validator.spec.ts`, `petition-evidence-storage.service.spec.ts`, `test/petitions.e2e-spec.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu API**: `lint` và `typecheck` cho API đạt.
- **Bộ kiểm thử Web chuyên biệt (S2P-B)**: Đạt 1/1 bài kiểm thử hợp đồng (`apps/web/test/petitions.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web (S2P-B)**: `lint` và `typecheck` cho Web UI đạt.
- **Hành trình trình duyệt Full-Stack E2E (S2P-B)**: Đạt 1/1 kịch bản tích hợp hoàn chỉnh trên Chromium desktop với schema PostgreSQL `qlkp_e2e` và `Redis DB 15` cô lập, không dùng mock routes hay can thiệp DB.

### 5.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **ĐẠT (28/08/2026)**
- `pnpm lint`: Đạt trên toàn monorepo.
- `pnpm typecheck`: Đạt trên toàn monorepo.
- `pnpm --filter @quanlykhupho/api exec prisma validate`: Đạt.
- `pnpm test`: Đạt trên toàn monorepo (API 522/522, Web 108/108, Shared Types 38/38).
- `pnpm test:ops`: Đạt 99/99 bài kiểm thử.
- `pnpm build`: Đạt 3/3 tác vụ build.
- `pnpm e2e:fullstack`: Đạt 1/1 hành trình đa vai trò trên Chromium desktop, sử dụng PostgreSQL schema `qlkp_e2e` và Redis DB 15 cô lập.
- **Kết luận nghiệm thu**: Phân hệ Kiến nghị đáp ứng rào chắn acceptance cho FR-12 đến FR-16; không còn lỗi mở trong phạm vi phase này.
