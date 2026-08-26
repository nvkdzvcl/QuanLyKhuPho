# Hồ sơ Triển khai Địa bàn Phường Chợ Quán (Provenance & Deployment Ledger)

Tài liệu này ghi nhận nguồn gốc kiểm chứng dữ liệu (provenance ledger), trạng thái thẩm tra và các rào cản kiểm soát trước khi kích hoạt gói cấu hình địa bàn Phường Chợ Quán (`deployments/cho-quan/deployment.json`).

---

## 1. Trạng thái Triển khai Hiện tại (Current Status)

- **Trạng thái cấu hình**: Bản nháp chưa xác nhận (`confirmed: false`).
- **Khóa kích hoạt (Activation Lock)**: Gói cấu hình đang ở trạng thái bản nháp, bị chặn áp dụng vào cơ sở dữ liệu (`--apply`) theo cơ chế fail-closed. Không chứa các trường `confirmedAt` và `confirmedBy`.
- **Mục đích**: Lưu trữ dữ liệu cấu hình ban đầu kèm nguồn gốc kiểm chứng công khai, cho phép chạy kiểm thử xác thực cấu trúc (dry-run) mà không thực hiện ghi vào cơ sở dữ liệu sản xuất.

---

## 2. Nhật ký Nguồn gốc Dữ liệu & Bằng chứng Kiểm chứng (Provenance Ledger)

Toàn bộ thông tin trong gói cấu hình được đối soát từ các nguồn dữ liệu chính thức vào ngày **2026-08-26**:

| Nguồn kiểm chứng | URL tài liệu / Cổng thông tin | Ngày truy cập | Dữ liệu được chứng minh (Evidence Supported) |
| :--- | :--- | :--- | :--- |
| **Công báo Chính phủ** | [Công báo PDF](https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2025/7/45431/57440-1-921-922.pdf) | 2026-08-26 | - Mã đơn vị hành chính chính thức: `27301`<br>- Tên hành chính: `Phường Chợ Quán`<br>- Cấp hành chính: `ward` (phường)<br>- Tỉnh/Thành phố: `Thành phố Hồ Chí Minh` (mã tỉnh `79`)<br>- Bỏ phân cấp quận cũ theo mô hình chính quyền đô thị. |
| **Cơ cấu tổ chức Cổng thông tin điện tử UBND Phường Chợ Quán** | [phuongchoquan.vn/co-cau-bo-may.htm](https://phuongchoquan.vn/co-cau-bo-may.htm) | 2026-08-26 | - Danh sách 25 khu phố hiện hữu (Khu phố 1 đến Khu phố 25).<br>- Tên thương hiệu/cơ quan: `UBND Phường Chợ Quán`.<br>- Kênh liên hệ công khai: Hotline `028 39555555`, Cổng thông tin `https://phuongchoquan.vn`.<br>- *Lưu ý*: Email công vụ chưa được kiểm chứng độc lập nên không cấu hình trong tệp JSON. |
| **Thông báo triển khai kế hoạch sắp xếp khu phố** | [phuongchoquan.vn - Tin sắp xếp khu phố](https://phuongchoquan.vn/phuong-cho-quan-trien-khai-ke-hoach-va-du-kien-phuong-an-sap-xep-khu-pho-tren-dia-ban-phuong-bv.htm) | 2026-08-26 | - Bài viết ngày 09/06/2026 thông báo UBND phường đang triển khai kế hoạch và dự kiến phương án sắp xếp, tổ chức lại 25 khu phố hiện hữu trên địa bàn. |

---

## 3. Quy ước Mã Khu phố Nội bộ Hệ thống (Application-Local Codes Semantics)

- Danh sách gồm 25 khu phố (`Khu phố 1` đến `Khu phố 25`) được gán các mã nội bộ tất định từ `KP-01` đến `KP-25`.
- **Tuyên bố quan trọng**: Các mã `KP-01` đến `KP-25` là **mã kỹ thuật nội bộ của ứng dụng (deterministic application-local codes)**, phục vụ định tuyến và phân quyền trong phần mềm. Các mã này **không phải là mã định danh hành chính do Nhà nước ban hành**.
- Tuyệt đối không lưu trữ dữ liệu cá nhân, thông tin bảo mật hoặc mã định danh công dân trong danh mục này.

---

## 4. Rủi ro Tươi mới Dữ liệu & Rào cản Kích hoạt (Unresolved Freshness Risk & Gate)

- **Rủi ro hiện hữu (Unresolved Freshness Risk)**: Theo thông báo ngày 09/06/2026 từ UBND Phường Chợ Quán, địa bàn đang trong quá trình thực hiện phương án sắp xếp lại khu phố. Danh sách 25 khu phố hiện tại là dữ liệu trước sắp xếp / tạm thời (provisional).
- **Rào cản an toàn (Fail-Closed Safety Gate)**:
  - Danh sách 25 khu phố mang tính chất dự thảo tạm thời, **tuyệt đối không được kích hoạt (`--apply`) vào môi trường sản xuất** khi chưa có văn bản nghị quyết/quyết định chính thức ban hành danh sách khu phố sau sắp xếp.
  - Gói cấu hình phải duy trì `confirmed: false` và không có thông tin `confirmedAt`/`confirmedBy`.

---

## 5. Các Bước Bắt buộc Trước khi Xác nhận (`confirmed: true`)

Trước khi chuyển trạng thái sang `confirmed: true` và áp dụng vào cơ sở dữ liệu địa bàn, đội ngũ vận hành bắt buộc hoàn thành các bước sau:

1. **Tiếp nhận Văn bản Chính thức**: Thu thập nghị quyết của Hội đồng nhân dân / quyết định của Ủy ban nhân dân cấp có thẩm quyền về việc phê duyệt đề án sắp xếp khu phố tại Phường Chợ Quán.
2. **Cập nhật Danh sách Khu phố Thực tế**: Rà soát, cập nhật lại số lượng, tên gọi chính thức và mã kỹ thuật tương ứng trong `deployment.json` theo đúng văn bản pháp lý đã ban hành.
3. **Kiểm chứng Kênh Liên hệ**: Xác minh số điện thoại hotline, cổng thông tin và bổ sung email tiếp nhận công vụ chính thức (nếu có).
4. **Kiểm tra Cấu trúc & Xung đột (Dry-Run Check)**:
   ```bash
   pnpm deployment:init -- --profile cho-quan
   ```
   Xác nhận kết quả kiểm tra thành công ở chế độ dry-run, không có lỗi cấu trúc hoặc xung đột dữ liệu.
5. **Ký duyệt Xác nhận Hồ sơ**:
   - Đổi `"confirmed": true` trong `deployment.json`.
   - Bổ sung `"confirmedAt"` với định dạng thời gian ISO-8601 (ví dụ: `2026-08-26T00:00:00.000Z`).
   - Bổ sung `"confirmedBy"` ghi rõ họ tên/chức danh cán bộ chịu trách nhiệm phê duyệt.
6. **Áp dụng vào Cơ sở Dữ liệu Vận hành**:
   ```bash
   pnpm deployment:init -- --profile cho-quan --apply
   ```
