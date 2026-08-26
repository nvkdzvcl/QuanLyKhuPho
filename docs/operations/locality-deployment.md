# Sổ tay Vận hành: Khởi tạo & Triển khai Địa bàn (Locality Deployment Runbook)

Tài liệu này hướng dẫn quy trình vận hành, khởi tạo và quản lý hồ sơ triển khai địa bàn hành chính (phường/xã/thị trấn) cho hệ thống **QuanLyKhuPho**.

---

## 1. Nguyên tắc Kiến trúc & Bất biến Vận hành

1. **Mỗi Địa bàn một Cơ sở dữ liệu Độc lập (Separate Database per Locality)**:
   - Hệ thống áp dụng kiến trúc cô lập dữ liệu theo từng phường/xã: mỗi địa bàn vận hành trên một cơ sở dữ liệu PostgreSQL độc lập.
   - Không chia sẻ dữ liệu cư dân, cán bộ hoặc lịch sử giữa các địa bàn trong cùng một database.
   - Cán bộ phường (`officer`) có phạm vi truy cập toàn bộ địa bàn của cơ sở dữ liệu đó. Trưởng khu phố (`leader`) bị giới hạn trong khu phố được phân công.

2. **Khởi tạo An toàn & Chế độ Kiểm tra Mặc định (Dry-Run by Default)**:
   - Lệnh khởi tạo mặc định luôn chạy ở chế độ **Dry-Run** (chỉ đọc, kiểm tra tính hợp lệ và xung đột dữ liệu).
   - Chỉ khi có cờ `--apply` rõ ràng, chương trình mới thực hiện ghi vào cơ sở dữ liệu trong một Transaction có mức cô lập cao (`Serializable`).

3. **Chống Ghi đè, Khóa Địa bàn & Rào cản Dữ liệu Dự thảo (Fail-Closed Draft Gate)**:
   - Một cơ sở dữ liệu đã khởi tạo hồ sơ địa bàn (`DeploymentProfile`) sẽ **từ chối** áp dụng bất kỳ gói địa bàn nào khác có mã hoặc tên khác biệt.
   - Cơ sở dữ liệu đã có khu phố nhưng chưa có hồ sơ địa bàn sẽ bị từ chối khởi tạo tự động để tránh làm hỏng dữ liệu cũ.
   - Gói cấu hình có `confirmed: false` tuyệt đối bị chặn áp dụng vào CSDL. Việc gói dự thảo đã được điền dữ liệu (ví dụ: 25 khu phố tạm thời) **không cấu thành bằng chứng triển khai** và hệ thống duy trì cơ chế fail-closed cho đến khi hoàn tất phê duyệt chính thức.

4. **Bảo mật, Quyền riêng tư & Quy ước Mã Kỹ thuật Nội bộ**:
   - Gói triển khai (`deployment.json`) chỉ chứa siêu dữ liệu hành chính và danh sách khu phố công khai.
   - Tuyệt đối không lưu mã OTP, số điện thoại riêng tư, token hay chuỗi kết nối nhạy cảm trong gói triển khai.
   - Endpoint công khai `GET /api/deployment-profile` chỉ trả về thông tin địa bàn công khai, loại trừ hoàn toàn các định danh nội bộ (`id`, `singletonKey`, `confirmedBy`).
   - Các mã khu phố dạng `KP-01`, `KP-02`, ... trong gói triển khai là **mã kỹ thuật nội bộ của ứng dụng (deterministic application-local codes)** phục vụ định tuyến và phân quyền phần mềm, **không phải là mã định danh hành chính do Nhà nước ban hành**.

---

## 2. Quy trình Chuẩn Triển khai Địa bàn Mới (Standard Deployment Sequence)

Người vận hành bắt buộc tuân thủ tuần tự 9 bước an toàn sau:

```text
[1. Chuẩn bị DB mới] ──> [2. Chạy Migration] ──> [3. Dry-run kiểm tra]
           │
           ▼
[4. Xác minh Dữ liệu] ──> [5. Cấu hình Confirmed] ──> [6. Áp dụng --apply]
           │
           ▼
[7. Bootstrap Cán bộ] ──> [8. Sao lưu DB ban đầu] ──> [9. Smoke Test]
```

### Bước 1: Chuẩn bị Cơ sở dữ liệu Mới

Tạo một database PostgreSQL rỗng dành riêng cho địa bàn mới (ví dụ: `quanlykhupho_choquan`) và thiết lập biến môi trường `DATABASE_URL` tương ứng.

### Bước 2: Chạy Database Migration

Áp dụng toàn bộ migration để khởi tạo cấu trúc bảng:

```bash
pnpm --filter @quanlykhupho/api prisma:migrate
```

### Bước 3: Kiểm tra Gói Cấu hình ở Chế độ Dry-Run

Chạy lệnh kiểm tra tính hợp lệ của gói triển khai (không ghi vào database):

```bash
pnpm deployment:init -- --profile <slug>
# Ví dụ: pnpm deployment:init -- --profile cho-quan
```

Nếu gói cấu hình ở trạng thái bản nháp (`confirmed: false`), CLI sẽ thông báo kiểm tra cấu trúc thành công (ví dụ: nhận diện đủ 25 khu phố dự thảo) nhưng cảnh báo fail-closed chặn không cho áp dụng vào CSDL. Người vận hành tham khảo sổ tay nguồn gốc kiểm chứng đính kèm gói cấu hình (ví dụ: [`deployments/cho-quan/README.md`](../../deployments/cho-quan/README.md)) để đối soát nguồn và trạng thái thẩm tra.

### Bước 4: Xác minh Thông tin Hành chính & Đánh giá Nguồn gốc / Độ tươi mới (Provenance & Freshness Review)

Trước khi kích hoạt bất kỳ địa bàn nào, người vận hành bắt buộc đối soát hồ sơ nguồn gốc dữ liệu (Provenance Ledger) tại `deployments/<slug>/README.md` (ví dụ: [`deployments/cho-quan/README.md`](../../deployments/cho-quan/README.md)) và kiểm tra các thông tin chính thức từ cơ quan nhà nước có thẩm quyền:
- **Mã địa bàn & Tỉnh/Thành phố**: Mã chuẩn theo danh mục hành chính nhà nước (ví dụ: Phường Chợ Quán là `27301`, TP.HCM là `79`). Bỏ phân cấp quận cũ theo mô hình chính quyền đô thị.
- **Kênh liên hệ công khai**: Xác minh hotline công vụ và cổng thông tin điện tử; không cấu hình địa chỉ email công vụ nếu chưa được kiểm chứng độc lập.
- **Rà soát rủi ro sắp xếp hành chính & Độ tươi mới (Reorganization & Freshness Review)**:
  - Đối với các địa bàn đang thực hiện đề án sắp xếp lại khu phố (như Phường Chợ Quán với kế hoạch tổ chức lại khu phố vào tháng 06/2026), danh mục 25 khu phố hiện tại chỉ là dữ liệu tạm thời/trước sắp xếp.
  - **Dữ liệu dự thảo không phải bằng chứng triển khai**: Sự tồn tại của danh sách khu phố trong tệp dự thảo (`confirmed: false`) **không phải là bằng chứng sẵn sàng triển khai (not deployable evidence)**.
  - **Rào cản phê duyệt bắt buộc**: Bắt buộc phải thu thập và đối soát văn bản pháp lý chính thức cuối cùng (Nghị quyết của HĐND / Quyết định của UBND cấp có thẩm quyền) phê duyệt đề án sắp xếp và ban hành danh sách khu phố chính thức sau sắp xếp trước khi đặt `confirmed: true`.
- **Mã khu phố nội bộ**: Gán mã kỹ thuật nội bộ tất định (`KP-01`, `KP-02`, ...) tương ứng với từng khu phố đã được chuẩn hóa. Tuyệt đối không nhầm lẫn mã kỹ thuật này với mã định danh hành chính của Nhà nước.

### Bước 5: Xác nhận Gói Triển khai (`confirmed: true`)

Khi toàn bộ thông tin đã được kiểm chứng và có văn bản pháp lý chính thức sau sắp xếp:
1. Cập nhật danh sách khu phố chính thức vào mảng `"neighborhoods"` trong tệp `deployments/<slug>/deployment.json`.
2. Đặt `"confirmed": true`.
3. Bổ sung trường `"confirmedAt"` (thời gian xác nhận theo chuẩn ISO-8601, ví dụ: `"2026-08-26T00:00:00.000Z"`).
4. Bổ sung trường `"confirmedBy"` ghi rõ danh tính/chức danh của người chịu trách nhiệm phê duyệt hồ sơ.

### Bước 6: Áp dụng Khởi tạo vào Cơ sở Dữ liệu (`--apply`)

Thực hiện ghi hồ sơ địa bàn và danh sách khu phố vào CSDL:

```bash
pnpm deployment:init -- --profile <slug> --apply
```

Lệnh sẽ tạo bản ghi hồ sơ địa bàn duy nhất (`SINGLETON`) và khởi tạo danh sách khu phố trong một transaction an toàn.

### Bước 7: Khởi tạo Tài khoản Cán bộ Phường Đầu tiên

Tạo tài khoản Cán bộ phường quản trị viên đầu tiên:

```bash
BOOTSTRAP_OFFICER_PHONE="0901234567" \
BOOTSTRAP_OFFICER_FULL_NAME="Nguyễn Văn Cán Bộ" \
pnpm --filter @quanlykhupho/api bootstrap:officer
```

### Bước 8: Tạo Bản Sao Lưu Cơ sở Dữ liệu Ban đầu

Ngay sau khi khởi tạo thành công, tạo bản sao lưu snapshot đầu tiên:

```bash
pnpm db:backup
```

### Bước 9: Kiểm thử Khói Vận hành (Smoke Test)

1. **Kiểm tra API Hồ sơ Triển khai**:
   ```bash
   curl -s http://localhost:4000/api/deployment-profile
   ```
   Xác nhận kết quả trả về `initialized: true`, đúng tên địa bàn và mã tỉnh. Danh sách khu phố được kiểm tra riêng qua `GET /api/neighborhoods`.

2. **Kiểm tra Đăng nhập Cán bộ**:
   Gửi mã OTP và đăng nhập vào tài khoản cán bộ vừa được bootstrap để kích hoạt khu vực làm việc.

---

## 3. Cập nhật Thông tin Địa bàn & Tính Idempotent

- Lệnh `deployment:init -- --apply` có tính **idempotent**: khi chạy lại với cùng một gói địa bàn đã áp dụng, hệ thống chỉ cập nhật các thông tin thay đổi (như tên hiển thị, mô tả khu phố, thông tin liên hệ) mà **không xóa** hoặc làm trùng lặp bản ghi khu phố hiện có.
- Nếu cần thêm khu phố mới, bổ sung vào mảng `neighborhoods` trong tệp JSON và chạy lại lệnh `--apply`.
- Hệ thống bảo vệ toàn vẹn: không tự ý xóa khu phố đã có dữ liệu cư dân/tài khoản liên kết.

---

## 4. Kế hoạch Quay lui & Ứng phó Sự cố (Rollback & Recovery)

1. **Luôn Sao lưu trước khi Thay đổi**:
   Trước khi chạy bất kỳ thao tác `--apply` cập nhật nào trên cơ sở dữ liệu đã có người dùng thực tế, bắt buộc chạy `pnpm db:backup`.

2. **Khôi phục khi Khởi tạo Nhầm hoặc Dữ liệu Lỗi**:
   Sử dụng công cụ phục hồi chuẩn có kiểm tra chữ ký PGDMP:
   ```bash
   # Bước 1: Kiểm tra tính toàn vẹn bản sao lưu
   pnpm db:restore -- --file=backups/<ten_tep_sao_luu>.dump

   # Bước 2: Phục hồi thực tế (yêu cầu xác nhận tường minh)
   node scripts/postgres-restore.mjs \
     --file=backups/<ten_tep_sao_luu>.dump \
     --confirm-destructive \
     --confirm-database=quanlykhupho
   ```

3. **Từ chối Xung đột Địa bàn (Locality Conflict Guard)**:
   Nếu vô tình chạy lệnh với slug của địa bàn khác trên database đang hoạt động, tiến trình sẽ báo lỗi và hủy toàn bộ thao tác ngay lập tức, không gây ảnh hưởng đến dữ liệu hiện có.
