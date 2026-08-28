# Biên bản Nghiệm thu Sprint 2 — Quản lý Bảng tin Thông báo Khu phố & Phường

Tài liệu này tổng hợp ma trận bằng chứng kỹ thuật, các rào chắn kiểm thử tự động, và ranh giới nghiệm thu cho Sprint 2 thuộc dự án **QuanLyKhuPho**, bao gồm các yêu cầu chức năng từ **FR-06** đến **FR-11** theo đặc tả SRS và hợp đồng kỹ thuật `.ai-work/phase-contract.md`.

---

## 1. Mục đích & Phạm vi Sprint 2 (Purpose & Scope)

- **Mục đích**: Hoàn thiện toàn diện phân hệ quản lý thông báo, tệp đính kèm an toàn, tương tác bình luận, kiểm duyệt nội dung và thông báo đa kênh trên cả giao diện Web UI (Next.js) và Backend API (NestJS), đảm bảo:
  - **Tạo và phân vùng thông báo (FR-06)**: Cán bộ phường đăng thông báo toàn phường hoặc theo khu phố; Trưởng khu phố chỉ đăng trong phạm vi khu phố phụ trách; Cư dân bị chặn tạo thông báo ở tầng máy chủ.
  - **Kiểm soát tệp đính kèm an toàn**: Giới hạn tối đa 5 tệp, không quá 10 MiB/tệp; xác thực chữ ký nhị phân (magic bytes) và danh sách mở rộng hợp lệ; lưu trữ ngoài web root và cô lập đường dẫn (`isPathContained`).
  - **Cơ chế thông báo đa tầng (In-app & Web Push)**: Tạo thông báo in-app bền vững ngay trong transaction cơ sở dữ liệu; kích hoạt Web Push sau commit (best-effort); luôn duy trì hoạt động của thông báo in-app kể cả khi Web Push chưa cấu hình.
  - **Chỉnh sửa & Gỡ bỏ bảo toàn lịch sử (FR-07)**: Phân quyền cập nhật và gỡ bỏ cho tác giả hoặc Cán bộ phường; gỡ bỏ dạng ẩn mềm (`AnnouncementStatus.removed`) để bảo toàn lịch sử kiểm toán và bình luận liên quan, không xóa vật lý.
  - **Bảng tin & Cô lập dữ liệu máy chủ (FR-08)**: Sắp xếp theo thứ tự mới nhất (`createdAt: 'desc'`), phân trang và tìm kiếm; cư dân/trưởng khu phố chỉ thấy thông báo toàn phường và khu phố của mình, chặn hoàn toàn truy vấn chéo khu phố.
  - **Xem chi tiết & Tải tệp đính kèm an toàn (FR-09)**: Hiển thị đầy đủ nội dung, bình luận theo trình tự thời gian tăng dần; bảo vệ lượt tải tệp bằng kiểm tra quyền truy cập thông báo và quyền sở hữu tệp đính kèm.
  - **Bình luận văn minh & Thông báo tác giả (FR-10)**: Cư dân, Trưởng khu phố và Cán bộ có quyền xem được gửi bình luận không rỗng; tự động gửi thông báo in-app đến tác giả bài đăng.
  - **Kiểm duyệt bình luận bất biến (FR-11)**: Trưởng khu phố kiểm duyệt bình luận trong khu phố; Cán bộ phường kiểm duyệt toàn phường; Cư dân bị cấm kiểm duyệt; cơ chế ẩn mềm (`isRemoved: true`) lưu vết lý do và người thực hiện, ngăn chặn ghi đè hoặc mở lại quyết định kiểm duyệt ban đầu.
- **Ranh giới an toàn & Môi trường kiểm thử E2E**:
  - PostgreSQL schema cô lập: `qlkp_e2e`.
  - Redis database cô lập: `Redis DB 15`.
  - Kiểm thử hành trình người dùng thực tế từ Web UI Next.js đến API NestJS, không sử dụng mock routes, request interception hay can thiệp trực tiếp vào DB.

---

## 2. Ma trận Bằng chứng Chức năng Sprint 2 (FR-06 → FR-11)

| Mã Yêu cầu (SRS) | Tên Chức năng & Nội dung Nghiệp vụ | Trạng thái Nghiệm thu | Bằng chứng Kỹ thuật & Tệp Kiểm chứng trong Repository |
| :--- | :--- | :--- | :--- |
| **FR-06** | **Tạo Thông báo, Kiểm tra Tệp đính kèm & Thông báo Đẩy**<br>• Trưởng khu phố tạo thông báo trong khu phố được phân công.<br>• Cán bộ phường tạo thông báo toàn phường hoặc theo khu phố chỉ định.<br>• Cư dân bị chặn tạo thông báo (403 Forbidden).<br>• Kiểm tra trường bắt buộc (tiêu đề, nội dung).<br>• Tối đa 5 tệp đính kèm, dung lượng tối đa 10 MiB/tệp.<br>• Kiểm tra chữ ký magic bytes (PDF, JPEG, PNG, GIF, DOCX, XLSX, ZIP, TXT) và phần mở rộng MIME.<br>• Phân phối thông báo in-app bền vững trong transaction DB và kích hoạt Web Push sau commit. | **ĐẠT (Verified)** | • `apps/api/src/announcements/announcements.service.ts`<br>• `apps/api/src/announcements/file-signature.validator.ts`<br>• `apps/api/src/announcements/attachment-storage.service.ts`<br>• `apps/api/src/announcements/announcements.service.spec.ts`<br>• `apps/api/src/announcements/file-signature.validator.spec.ts`<br>• `apps/api/src/announcements/attachment-storage.service.spec.ts`<br>• `apps/api/test/announcements.e2e-spec.ts`<br>• `apps/web/src/components/announcements/create-announcement-modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 3, Step 6) |
| **FR-07** | **Chỉnh sửa & Gỡ bỏ Thông báo**<br>• Chỉ tác giả thông báo hoặc Cán bộ phường có quyền chỉnh sửa tiêu đề/nội dung hoặc gỡ bỏ thông báo.<br>• Trưởng khu phố không thể sửa hoặc gỡ thông báo của khu phố khác hoặc do người khác tạo.<br>• Cư dân bị chặn quyền sửa và gỡ thông báo.<br>• Gỡ bỏ là thao tác ẩn mềm (`AnnouncementStatus.removed`), đưa thông báo ra khỏi bảng tin công khai nhưng bảo toàn nguyên vẹn lịch sử và các bình luận liên quan. | **ĐẠT (Verified)** | • `apps/api/src/announcements/announcements.service.ts`<br>• `apps/api/src/announcements/announcements.service.spec.ts`<br>• `apps/api/test/announcements.e2e-spec.ts`<br>• `apps/web/src/components/announcements/edit-announcement-modal.tsx`<br>• `apps/web/src/components/announcements/remove-announcement-modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 5) |
| **FR-08** | **Bảng tin Thông báo & Cô lập Dữ liệu Máy chủ**<br>• Bảng tin sắp xếp theo thứ tự mới nhất (`createdAt: 'desc'`), hỗ trợ phân trang và tìm kiếm.<br>• Thực thi cô lập dữ liệu nghiêm ngặt ở tầng máy chủ:<br>  - Cư dân & Trưởng khu phố chỉ thấy thông báo toàn phường và thông báo thuộc khu phố mình; chặn truy vấn sang khu phố khác (403 Forbidden).<br>  - Cán bộ phường có thể xem toàn bộ và lọc theo từng khu phố. | **ĐẠT (Verified)** | • `apps/api/src/announcements/announcements.service.ts`<br>• `apps/api/src/announcements/announcements.controller.ts`<br>• `apps/api/src/announcements/announcements.service.spec.ts`<br>• `apps/api/test/announcements.e2e-spec.ts`<br>• `apps/web/src/components/announcements/announcement-feed.tsx`<br>• `apps/web/src/hooks/use-announcements.ts`<br>• `apps/web/test/announcements.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 3, Step 7) |
| **FR-09** | **Xem Chi tiết Thông báo & Tải Tệp Đính kèm An toàn**<br>• Xem đầy đủ thông tin chi tiết thông báo kèm danh sách tệp đính kèm và danh sách bình luận theo thứ tự thời gian.<br>• Chặn xem chi tiết thông báo ngoài phạm vi khu phố được phép.<br>• Tải tệp đính kèm được bảo vệ: kiểm tra quyền xem thông báo, kiểm tra quan hệ thuộc tính tệp (`attachmentId` thuộc `announcementId`), và kiểm tra an toàn đường dẫn (`isPathContained`) chống tấn công path traversal. | **ĐẠT (Verified)** | • `apps/api/src/announcements/announcements.service.ts`<br>• `apps/api/src/announcements/attachment-storage.service.ts`<br>• `apps/api/src/announcements/announcements.service.spec.ts`<br>• `apps/api/src/announcements/attachment-storage.service.spec.ts`<br>• `apps/api/test/announcements.e2e-spec.ts`<br>• `apps/web/src/components/announcements/announcement-detail-modal.tsx`<br>• `packages/ui/src/modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 4, Step 5, Step 7) |
| **FR-10** | **Gửi Bình luận Thông báo & Dự phòng Thông báo**<br>• Người dùng có quyền xem (Cư dân, Trưởng KP, Cán bộ) có thể gửi bình luận không rỗng.<br>• Chặn gửi bình luận rỗng (Validation error), bình luận ngoài phạm vi khu phố, hoặc bình luận trên thông báo đã bị gỡ bỏ.<br>• Tự động tạo thông báo in-app bền vững gửi đến tác giả bài đăng ngay trong transaction và gửi Web Push sau commit (nếu có cấu hình). | **ĐẠT (Verified)** | • `apps/api/src/announcements/announcements.service.ts`<br>• `apps/api/src/announcements/announcements.service.spec.ts`<br>• `apps/api/test/announcements.e2e-spec.ts`<br>• `apps/web/src/components/announcements/announcement-detail-modal.tsx`<br>• `apps/web/src/hooks/use-notifications.ts`<br>• `apps/web/test/use-notifications.test.ts`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 4) |
| **FR-11** | **Kiểm duyệt & Ẩn Bình luận Vi phạm (Bảo toàn Lịch sử)**<br>• Trưởng khu phố có quyền kiểm duyệt bình luận thuộc khu phố mình; Cán bộ phường có quyền kiểm duyệt toàn phường; Cư dân bị cấm kiểm duyệt.<br>• Kiểm duyệt thực hiện ẩn nội dung (`isRemoved: true`), ghi nhận lý do ẩn (`removedReason`) và tài khoản thực hiện (`removedBy`).<br>• Nội dung bị ẩn đối với cư dân thông thường nhưng vẫn hiển thị thông tin kiểm duyệt cho Trưởng khu phố/Cán bộ/Tác giả bình luận.<br>• Dữ liệu bình luận được bảo toàn lịch sử bất biến, ngăn chặn việc ghi đè hoặc mở lại quyết định kiểm duyệt ban đầu. | **ĐẠT (Verified)** | • `apps/api/src/announcements/announcements.service.ts`<br>• `apps/api/src/announcements/announcements.service.spec.ts`<br>• `apps/api/test/announcements.e2e-spec.ts`<br>• `apps/web/src/components/announcements/announcement-detail-modal.tsx`<br>• `apps/web/e2e/fullstack-role-flows.spec.ts` (Step 5) |

---

## 3. Danh mục Rào chắn Kiểm thử Tự động (Automated Acceptance Gates)

Hệ thống triển khai kiểm thử tự động nhiều tầng nhằm chứng minh tính toàn vẹn chức năng và an toàn của Sprint 2:

1. **Rào chắn Trình duyệt Full-Stack E2E (Full-Stack Browser Journey)**:
   - **Tệp thực thi**: `apps/web/e2e/fullstack-role-flows.spec.ts`
   - **Cấu hình & Môi trường**: `playwright.fullstack.config.ts`, PostgreSQL schema `qlkp_e2e`, `Redis DB 15`.
   - **Kịch bản kiểm chứng thực tế**:
     - *Step 3*: Trưởng KP đăng nhập, duyệt cư dân, tạo thông báo cấp khu phố KP-01.
     - *Step 4*: Cư dân đăng nhập, xác nhận thông báo xuất hiện qua in-app notification fallback, mở chi tiết thông báo và gửi bình luận.
     - *Step 5*: Trưởng KP xử lý kiến nghị; mở thông báo khu phố, kiểm duyệt và ẩn bình luận của cư dân kèm lý do; chỉnh sửa nội dung thông báo; gỡ bỏ thông báo khỏi bảng tin công khai.
     - *Step 6*: Cán bộ phường giám sát kiến nghị toàn phường và tạo thông báo cấp phường.
     - *Step 7*: Trưởng KP khóa cư dân, kiểm chứng chặn đăng nhập; mở khóa cư dân; cư dân đăng nhập lại, xác nhận thông báo toàn phường xuất hiện trong chuông thông báo in-app và trên bảng tin.
   - **Cải tiến UI Modal Portal**: Sửa `packages/ui/src/modal.tsx` để render qua `createPortal(..., document.body)`, đảm bảo hộp thoại chi tiết mở từ thanh thông báo không bị che khuất bởi header sticky có hiệu ứng backdrop-blur.

2. **Rào chắn Kiểm thử Tích hợp & Đơn vị Backend API (Focused API Suites)**:
   - **Tệp thực thi**:
     - `apps/api/src/announcements/announcements.service.spec.ts` (Kiểm thử logic nghiệp vụ, phân quyền RBAC, transaction DB và rollback tệp).
     - `apps/api/src/announcements/file-signature.validator.spec.ts` (Kiểm thử kiểm tra magic bytes, kích thước tệp, danh sách mở rộng MIME và lọc tên tệp).
     - `apps/api/src/announcements/attachment-storage.service.spec.ts` (Kiểm thử lưu trữ an toàn, kiểm tra chống path traversal `isPathContained`, dọn dẹp tệp khi rollback).
     - `apps/api/test/announcements.e2e-spec.ts` (Kiểm thử đầu cuối API HTTP cho luồng thông báo, tệp đính kèm, bình luận và kiểm duyệt).

3. **Rào chắn Kiểm thử Hợp đồng Giao diện Web (Focused Web Suites)**:
   - **Tệp thực thi**:
     - `apps/web/test/announcements.test.ts` (Kiểm thử hợp đồng cấu trúc dữ liệu `AnnouncementDto`, phân quyền và trạng thái).
     - `apps/web/test/use-notifications.test.ts` (Kiểm thử cấu trúc Service Worker Web Push và tính tương thích khi môi trường chưa hỗ trợ Web Push).

---

## 4. Các Ranh giới Kiến trúc & Hạng mục Hoãn lại Có chủ đích (Architectural Invariants & Deferred Items)

1. **Bảo toàn lịch sử xử lý bất biến (Immutable Audit & Soft Removal/Moderation)**:
   - Thao tác gỡ thông báo và kiểm duyệt bình luận là ẩn mềm (`status = 'removed'`, `isRemoved = true`), không thực hiện xóa cứng (hard delete) nhằm đảm bảo tính toàn vẹn của lịch sử quản lý và nhật ký kiểm toán.
2. **Dự phòng thông báo trong ứng dụng (In-app Notification Fallback)**:
   - Thông báo in-app được ghi nhận bền vững ngay trong transaction cơ sở dữ liệu, đảm bảo cư dân luôn nhận được thông báo dù hệ thống chưa thiết lập khóa VAPID cho Web Push hoặc người dùng không bật quyền nhận thông báo trình duyệt.
3. **Các hạng mục hoãn lại có chủ đích**:
   - Bình luận phân nhánh nhiều cấp (threaded/nested comments) và phản ứng biểu tượng cảm xúc (emoji reactions).
   - Tải lên tệp đa phương tiện dung lượng lớn (video, âm thanh).
   - Ghim thông báo ưu tiên (pinned announcements) lên đầu bảng tin.

---

## 5. Hiện trạng Bằng chứng Kiểm thử & Trạng thái Rào chắn Cuối (Verification Status)

### 5.1. Bằng chứng kiểm thử cục bộ đã xác minh (Verified Focused Results)

- **Bộ kiểm thử API chuyên biệt (S2-A)**: Đạt 72/72 bài kiểm thử (`announcements.service.spec.ts`, `file-signature.validator.spec.ts`, `attachment-storage.service.spec.ts`, `test/announcements.e2e-spec.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu API**: `lint` và `typecheck` cho API đạt.
- **Bộ kiểm thử Web chuyên biệt**: Đạt 3/3 bài kiểm thử (`apps/web/test/announcements.test.ts`, `apps/web/test/use-notifications.test.ts`).
- **Kiểm tra cú pháp & kiểu dữ liệu Web (S2-B)**: `lint` và `typecheck` cho Web UI đạt.
- **Hành trình trình duyệt Full-Stack E2E (S2-B)**: Đạt (Playwright fullstack journey với trạng thái `.last-run.json` ghi nhận `passed`, không có kiểm thử thất bại).
- **Sửa chữa UI Modal**: Thành phần `packages/ui/src/modal.tsx` đã được chuyển sang portal gắn vào `document.body`, giải quyết triệt để lỗi hiển thị khi mở thông báo từ header.

### 5.2. Trạng thái rào chắn tổng thể toàn repository (Final Repository-Wide Gate Status)

- **Trạng thái**: **Đạt (28/08/2026)**
- `pnpm lint`: Đạt trên toàn monorepo.
- `pnpm typecheck`: Đạt trên toàn monorepo.
- `pnpm --filter @quanlykhupho/api exec prisma validate`: Đạt.
- `pnpm test`: Đạt trên toàn monorepo.
- `pnpm test:ops`: Đạt 99/99 bài kiểm thử.
- `pnpm build`: Đạt 3/3 tác vụ build.
- `pnpm e2e:fullstack`: Đạt 1/1 hành trình đa vai trò trên Chromium desktop; dữ liệu kiểm thử dùng schema PostgreSQL `qlkp_e2e` và Redis DB 15 cô lập.
- **Kết luận nghiệm thu**: Sprint 2 đáp ứng rào chắn acceptance cho FR-06 đến FR-11; không còn lỗi mở trong phạm vi Sprint 2.
