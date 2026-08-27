# Hồ sơ Triển khai Địa bàn Phường Chợ Quán (Provenance & Deployment Ledger)

Tài liệu này ghi nhận nguồn gốc kiểm chứng dữ liệu (provenance ledger), trạng thái thẩm tra và các rào cản kiểm soát trước khi kích hoạt gói cấu hình địa bàn Phường Chợ Quán (`deployments/cho-quan/deployment.json`).

---

## 1. Trạng thái Triển khai Hiện tại (Current Status)

- **Trạng thái cấu hình**: Bản nháp chưa xác nhận (`confirmed: false`).
- **Khóa kích hoạt (Activation Lock)**: Gói cấu hình đang ở trạng thái bản nháp, bị chặn áp dụng vào cơ sở dữ liệu (`--apply`) theo cơ chế fail-closed. Không chứa các trường `confirmedAt` và `confirmedBy`.
- **Mục đích**: Lưu trữ dữ liệu cấu hình ban đầu kèm nguồn gốc kiểm chứng công khai, cho phép chạy kiểm thử xác thực cấu trúc (dry-run) và diễn tập kỹ thuật cô lập (`pnpm locality:rehearsal`) mà không thực hiện ghi vào cơ sở dữ liệu sản xuất.

---

## 2. Nhật ký Nguồn gốc Dữ liệu & Bằng chứng Kiểm chứng (Provenance Ledger)

Toàn bộ thông tin trong gói cấu hình được đối soát và cập nhật từ các nguồn dữ liệu chính thức vào ngày **2026-08-27** (rà soát ban đầu ngày 2026-08-26):

| Nguồn kiểm chứng | URL tài liệu / Cổng thông tin | Ngày đối soát | Dữ liệu được chứng minh (Evidence Supported) |
| :--- | :--- | :--- | :--- |
| **Công báo Chính phủ** | [Công báo PDF](https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2025/7/45431/57440-1-921-922.pdf) | 2026-08-27 | - Mã đơn vị hành chính chính thức: `27301`<br>- Tên hành chính: `Phường Chợ Quán`<br>- Cấp hành chính: `ward` (phường)<br>- Tỉnh/Thành phố: `Thành phố Hồ Chí Minh` (mã tỉnh `79`)<br>- Bỏ phân cấp quận cũ theo mô hình chính quyền đô thị. |
| **Cơ cấu tổ chức Cổng thông tin điện tử UBND Phường Chợ Quán** | [phuongchoquan.vn/co-cau-bo-may.htm](https://phuongchoquan.vn/co-cau-bo-may.htm) | 2026-08-27 | - Danh sách 25 khu phố hiện hữu (Khu phố 1 đến Khu phố 25).<br>- Tên thương hiệu/cơ quan: `UBND Phường Chợ Quán`.<br>- Kênh liên hệ công khai: Hotline `028 39555555`, Cổng thông tin `https://phuongchoquan.vn`.<br>- *Lưu ý*: Email công vụ chưa được kiểm chứng độc lập nên không cấu hình trong tệp JSON. |
| **Thông báo triển khai Kế hoạch 174/KH-UBND sắp xếp khu phố** | [phuongchoquan.vn - Tin sắp xếp khu phố](https://phuongchoquan.vn/phuong-cho-quan-trien-khai-ke-hoach-va-du-kien-phuong-an-sap-xep-khu-pho-tren-dia-ban-phuong-bv.htm) | 2026-08-27 | - Bài viết ngày 09/06/2026 thông báo UBND phường triển khai Kế hoạch 174/KH-UBND ngày 05/06/2026 về dự kiến phương án sắp xếp, tổ chức lại 25 khu phố hiện hữu trên địa bàn. |
| **Thông tin kết quả lấy ý kiến nhân dân về Đề án sắp xếp khu phố** | [phuongchoquan.vn - Thông tin công khai trang 5](https://phuongchoquan.vn/thong-tin-cong-khai/trang/5.htm) | 2026-08-27 | - Cổng thông tin điện tử UBND phường đăng tải công khai mục `THÔNG TIN KẾT QUẢ LẤY Ý KIẾN NHÂN DÂN VỀ ĐỀ ÁN SẮP XẾP KHU PHỐ TRÊN ĐỊA BÀN PHƯỜNG CHỢ QUÁN`, xác nhận đề án sắp xếp đang trong tiến trình công khai kết quả lấy ý kiến nhân dân. |
| **Ủy ban Mặt trận Tổ quốc Việt Nam TP.HCM** | [ubmttq.hochiminhcity.gov.vn - Kiện toàn Ban Công tác Mặt trận](https://ubmttq.hochiminhcity.gov.vn/tin-tuc/chitiet/8316/categoryid/5/phuong-cho-quan-kien-toan-ban-cong-tac-mat-tran-cac-khu-pho) | 2026-08-27 | - Bài viết ngày 16/09/2025 ghi nhận việc kiện toàn 25 Ban Công tác Mặt trận tương ứng 25 khu phố; đây là bằng chứng lịch sử bổ trợ, không chứng minh danh mục sau đề án sắp xếp năm 2026. |

---

## 3. Quy ước Mã Khu phố Nội bộ Hệ thống (Application-Local Codes Semantics)

- Danh sách gồm 25 khu phố (`Khu phố 1` đến `Khu phố 25`) được gán các mã nội bộ tất định từ `KP-01` đến `KP-25`.
- **Tuyên bố quan trọng**: Các mã `KP-01` đến `KP-25` là **mã kỹ thuật nội bộ của ứng dụng (deterministic application-local codes)**, phục vụ định tuyến và phân quyền trong phần mềm. Các mã này **không phải là mã định danh hành chính do Nhà nước ban hành**.
- Tuyệt đối không lưu trữ dữ liệu cá nhân, thông tin bảo mật hoặc mã định danh công dân trong danh mục này.

---

## 4. Rà soát Nguồn Chính thức 2026-08-27 & Rào cản Kích hoạt (Official Source Review & Safety Gate)

- **Kết quả rà soát nguồn chính thức (Official Source Review 2026-08-27)**:
  - Danh mục 25 khu phố vẫn đang được tham chiếu công khai trong cơ cấu tổ chức của UBND phường và hệ thống Ban Công tác Mặt trận cơ sở.
  - UBND Phường Chợ Quán đã triển khai Kế hoạch 174/KH-UBND ngày 05/06/2026 và công khai kết quả lấy ý kiến nhân dân về Đề án sắp xếp khu phố trên cổng thông tin điện tử.
  - Tuy nhiên, **chưa tìm thấy văn bản quyết định pháp lý cuối cùng (Nghị quyết của HĐND / Quyết định của UBND cấp có thẩm quyền)** chính thức phê duyệt đề án sắp xếp và ban hành danh mục khu phố sau sắp xếp. Tuyệt đối không suy diễn hiệu lực pháp lý từ kết quả tìm kiếm hay sự vắng mặt của văn bản.
- **Rào cản an toàn sản xuất (Fail-Closed Safety Gate)**:
  - Do chưa có quyết định pháp lý cuối cùng, cổng kích hoạt sản xuất **tiếp tục đóng chặt (fail-closed)**: tệp `deployment.json` trong kho mã nguồn duy trì `confirmed: false` và không có thông tin `confirmedAt`/`confirmedBy`.
  - Tuyệt đối không được kích hoạt (`--apply`) gói dự thảo này vào môi trường sản xuất thực tế.
- **Cơ chế Diễn tập Triển khai Kỹ thuật Cô lập (Technical Rehearsal)**:
  - Gói cấu hình dự thảo có thể được diễn tập và kiểm chứng trọn vẹn qua công cụ diễn tập cô lập (`pnpm locality:rehearsal`, xem [Sổ tay Diễn tập Triển khai Địa bàn](../../docs/quality/locality-deployment-rehearsal.md)).
  - Bản sao tạm thời (temporary clone) được tạo trong quá trình diễn tập chỉ là cơ chế kỹ thuật bên trong cơ sở dữ liệu kiểm thử cô lập, **không phải là sự phê duyệt pháp lý hay gói phát hành sản xuất có thể tái sử dụng**, và không làm thay đổi trạng thái dự thảo của gói trong kho mã nguồn.

---

## 5. Các Bước Bắt buộc Trước khi Xác nhận (`confirmed: true`)

Trước khi chuyển trạng thái sang `confirmed: true` và áp dụng vào cơ sở dữ liệu địa bàn sản xuất, đội ngũ vận hành bắt buộc hoàn thành các bước sau:

1. **Tiếp nhận Văn bản Quyết định Chính thức Cuối cùng**: Thu thập nghị quyết của Hội đồng nhân dân / quyết định của Ủy ban nhân dân cấp có thẩm quyền về việc phê duyệt đề án sắp xếp khu phố tại Phường Chợ Quán.
2. **Cập nhật Danh sách Khu phố Thực tế**: Rà soát, cập nhật lại số lượng, tên gọi chính thức và mã kỹ thuật tương ứng trong `deployment.json` theo đúng văn bản pháp lý đã ban hành.
3. **Kiểm chứng Kênh Liên hệ**: Xác minh số điện thoại hotline, cổng thông tin và bổ sung email tiếp nhận công vụ chính thức (nếu có).
4. **Diễn tập Triển khai Kỹ thuật & Kiểm tra Cấu trúc**:
   ```bash
   # Diễn tập toàn diện trên stack Compose cô lập
   pnpm locality:rehearsal

   # Kiểm tra tính hợp lệ ở chế độ dry-run
   pnpm deployment:init -- --profile cho-quan
   ```
   Xác nhận kết quả diễn tập thành công và kiểm tra dry-run không có lỗi cấu trúc hoặc xung đột dữ liệu.
5. **Ký duyệt Xác nhận Hồ sơ**:
   - Đổi `"confirmed": true` trong `deployment.json`.
   - Bổ sung `"confirmedAt"` với định dạng thời gian ISO-8601 (ví dụ: `2026-08-27T00:00:00.000Z`).
   - Bổ sung `"confirmedBy"` ghi rõ họ tên/chức danh cán bộ chịu trách nhiệm phê duyệt.
6. **Áp dụng vào Cơ sở Dữ liệu Vận hành**:
   ```bash
   pnpm deployment:init -- --profile cho-quan --apply
   ```
