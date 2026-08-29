# Danh mục Kiểm thử Nghiệm thu Người dùng (User Acceptance Testing — UAT Checklist)

Tài liệu này cung cấp bộ kịch bản kiểm thử nghiệm thu chấp nhận người dùng thực tế (**UAT — User Acceptance Testing**) cho nền tảng quản lý khu phố điện tử **QuanLyKhuPho**, bao quát cả ba vai trò nghiệp vụ: **Cư dân** (`resident`), **Tổ trưởng dân phố** (`leader`), và **Cán bộ phường** (`officer`).

Bộ checklist được thiết kế để kiểm chứng toàn bộ 25 yêu cầu chức năng (**FR-01 → FR-25**) cùng các yêu cầu phi chức năng (**NFR-01 → NFR-09**) theo ma trận truy xuất tại [Ma trận Truy xuất SRS](srs-traceability-matrix.md).

---

## 1. Nguyên tắc An toàn Dữ liệu & Quy tắc Bắt buộc trong UAT

> [!IMPORTANT]
> **Quy định Bắt buộc về Dữ liệu Thử nghiệm (Synthetic Data Only)**
> 1. **Tuyệt đối sử dụng dữ liệu giả lập (Synthetic Test Data)**: Không sử dụng số CCCD thật, số điện thoại cá nhân thật, họ tên thật của cư dân ngoài đời, hoặc địa chỉ thực tế nhạy cảm trong quá trình kiểm thử.
> 2. **Bảo vệ bằng chứng kiểm thử (No Real PII in Evidence)**: Khi chụp ảnh màn hình, quay video thao tác, hoặc đính kèm biên bản lỗi (defect report), tuyệt đối không để lộ mật khẩu, mã OTP, token phiên, hoặc dữ liệu định danh cá nhân thật.
> 3. **Phân định phạm vi địa bàn**:
>    - Tổ trưởng dân phố chỉ kiểm thử và thao tác trên khu phố được phân công phụ trách (ví dụ: `KP-01`).
>    - Cán bộ phường kiểm thử trên phạm vi toàn phường và các khu phố trực thuộc.
>    - Cư dân chỉ kiểm thử các tính năng công dân cá nhân và không có quyền truy cập quản trị.

---

## 2. Thiết lập Môi trường & Bộ Dữ liệu Thử nghiệm Chuẩn (Test Setup)

### 2.1. Cấu hình Môi trường Kiểm thử
- **Môi trường**: Staging / UAT Sandbox cô lập (`http://localhost:3000` hoặc URL UAT nội bộ).
- **Trình duyệt khuyến nghị**: Google Chrome (phiên bản mới nhất), Microsoft Edge (phiên bản mới nhất), Mozilla Firefox (phiên bản mới nhất), và Apple Safari trên iOS 16.4+ (thiết bị vật lý).
- **Kênh OTP**: Ở sandbox/local phải dùng Dev SMS Inbox hoặc OTP fixture; tắt hoàn toàn việc gửi ra nhà cung cấp SMS thật. Các số bên dưới chỉ là định danh fixture trong cơ sở dữ liệu cô lập, không được dùng ngoài sandbox.

### 2.2. Bộ Tài khoản Giả lập Chuẩn hóa (Synthetic Personas)

| Vai trò (Role) | Họ và tên giả lập | Số điện thoại giả lập | Địa bàn / Phạm vi | Mục đích sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Cán bộ phường** (`officer`) | Cán bộ Kiểm thử UAT | `0901234567` | Toàn phường | Quản trị toàn diện, tạo Tổ trưởng, duyệt báo cáo, giám sát |
| **Tổ trưởng KP-01** (`leader`) | Trần Văn Tổ Trưởng 1 | `0902345678` | Khu phố 1 (`KP-01`) | Quản lý cư dân, duyệt hồ sơ, đăng tin, xử lý kiến nghị KP-01 |
| **Tổ trưởng KP-02** (`leader`) | Lê Thị Tổ Trưởng 2 | `0902345679` | Khu phố 2 (`KP-02`) | Kiểm thử cô lập dữ liệu chéo khu phố |
| **Cư dân KP-01 (Active)** (`resident`) | Nguyễn Văn Cư Dân 1 | `0903456789` | Khu phố 1 (`KP-01`) | Gửi phản ánh, xem tin tức, bình luận, quản lý kiến nghị |
| **Cư dân Mới (Pending)** (`resident`) | Phạm Thị Chờ Duyệt | `0903456799` | Khu phố 1 (`KP-01`) | Kiểm thử luồng đăng ký mới và phê duyệt tài khoản |
| **Cư dân KP-02** (`resident`) | Hoàng Văn Cư Dân 2 | `0903456790` | Khu phố 2 (`KP-02`) | Kiểm thử phân quyền không thấy kiến nghị/tin tức chéo KP |

### 2.3. Bộ Hồ sơ Nhân khẩu & Dữ liệu Nghiệp vụ Giả lập
- **Mã hộ khẩu thử nghiệm**: `HK-KP01-001`, `HK-KP01-002`, `HK-KP02-001`.
- **Số CCCD giả lập chuẩn 12 số**: `079195000001`, `079195000002`, `079195000003`.
- **Tệp minh chứng kiến nghị**: Tệp ảnh JPEG/PNG/WebP dung lượng dưới 10 MiB (ảnh chụp mẫu bảng tin, hiện trường giả lập).
- **Tệp đính kèm thông báo**: Tệp PDF/PNG dung lượng dưới 10 MiB (tài liệu mẫu hướng dẫn phòng cháy chữa cháy, lịch sinh hoạt).

---

## 3. Quy định Đánh giá & Phân loại Mức độ Lỗi (Defect Protocol)

### 3.1. Trạng thái Đánh giá (Verdict Legend)
- **`PASS` (Đạt)**: Chức năng hoạt động chính xác theo yêu cầu mong đợi, giao diện hiển thị chuẩn tiếng Việt, không phát sinh lỗi.
- **`FAIL` (Không đạt)**: Chức năng không hoạt động, hoạt động sai logic nghiệp vụ, sai phân quyền hoặc lỗi giao diện nghiêm trọng.
- **`BLOCKED` (Bị nghẽn)**: Không thể thực hiện ca kiểm thử do lỗi ở bước trước đó hoặc môi trường gián đoạn.

### 3.2. Phân loại Mức độ Nghiêm trọng của Lỗi (Defect Severity)
1. **Blocker (Khẩn cấp)**: Hệ thống sập (crash), mất dữ liệu, vi phạm nghiêm trọng về an toàn thông tin (lộ plaintext PII, bypass phân quyền sang vai trò khác).
2. **Critical (Nghiêm trọng)**: Chức năng chính không thể hoàn tất (ví dụ: không thể duyệt cư dân, không thể gửi kiến nghị) và không có luồng thay thế.
3. **Major (Lớn)**: Chức năng hoạt động sai một phần nhưng vẫn có cách khắc phục tạm thời (ví dụ: bộ lọc ngày hoạt động chưa chính xác).
4. **Minor (Nhỏ / Thẩm mỹ)**: Lỗi chính tả tiếng Việt, căn lề hiển thị chưa đều trên một số kích thước màn hình đặc thù.

---

## 4. Kịch bản Kiểm thử UAT Chi tiết

### Phần A: Hành trình Vai trò Cư dân (`resident`)

#### `UAT-RES-01`: Đăng ký tài khoản cư dân mới qua xác thực OTP
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-01`, `FR-02`, `NFR-01`
- **Điều kiện tiên quyết**: Số điện thoại giả lập chưa từng đăng ký trên hệ thống (`0903456799`).
- **Các bước thực hiện**:
  1. Truy cập trang chủ hệ thống, chọn **"Đăng ký"**.
  2. Nhập số điện thoại `0903456799` và bấm **"Gửi mã OTP"**.
  3. Nhập mã OTP 6 chữ số hợp lệ nhận được.
  4. Điền các trường thông tin cá nhân: Họ và tên (`Phạm Thị Chờ Duyệt`), Địa chỉ (`Số 456 Đường Số 2`), chọn Khu phố trực thuộc (`Khu phố 1`).
  5. Bấm **"Hoàn tất đăng ký"**.
- **Kết quả mong đợi**: Hệ thống ghi nhận đăng ký thành công, chuyển sang màn hình thông báo tài khoản đang ở trạng thái **Chờ duyệt** (`pending`) với hướng dẫn rõ ràng.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-02`: Đăng nhập khi tài khoản đang ở trạng thái Chờ duyệt
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-01`, `FR-02`
- **Điều kiện tiên quyết**: Tài khoản `0903456799` đã đăng ký nhưng chưa được Tổ trưởng duyệt.
- **Các bước thực hiện**:
  1. Tại màn hình đăng nhập, nhập số điện thoại `0903456799`.
  2. Nhập mã OTP 6 chữ số xác thực.
- **Kết quả mong đợi**: Hệ thống hiển thị hộp thoại/màn hình thông báo trạng thái tài khoản đang chờ Tổ trưởng dân phố phê duyệt, không chuyển hướng vào trang quản trị hay bảng tin cư dân.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-03`: Đăng nhập tài khoản cư dân đã kích hoạt & Duy trì phiên
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-02`, `NFR-02`
- **Điều kiện tiên quyết**: Tài khoản `0903456789` ở trạng thái Hoạt động (`active`).
- **Các bước thực hiện**:
  1. Nhập số điện thoại `0903456789`, yêu cầu gửi OTP.
  2. Nhập sai OTP 1 lần để kiểm tra thông báo lỗi.
  3. Nhập đúng mã OTP để đăng nhập.
  4. Đóng tab trình duyệt và mở lại sau đó để kiểm tra tự động duy trì phiên đăng nhập.
- **Kết quả mong đợi**: Thông báo lỗi rõ ràng khi nhập sai OTP. Khi nhập đúng OTP, đăng nhập thành công vào bảng tin cư dân; thông tin cá nhân hiển thị chính xác; phiên làm việc được duy trì qua cookie bảo mật HTTP-Only.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-04`: Xem bảng tin thông báo, bộ lọc & Tải tệp đính kèm
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-08`, `FR-09`
- **Điều kiện tiên quyết**: Đã đăng nhập bằng tài khoản Cư dân KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Bảng tin thông báo"**.
  2. Kiểm tra danh sách hiển thị: thông báo toàn phường và thông báo dành riêng cho KP-01.
  3. Nhập từ khóa tìm kiếm trên thanh tìm kiếm.
  4. Bấm vào một thông báo có tệp đính kèm để xem nội dung chi tiết.
  5. Bấm tải xuống tệp đính kèm.
- **Kết quả mong đợi**: Bảng tin sắp xếp theo thời gian mới nhất; tìm kiếm lọc đúng nội dung; xem chi tiết đầy đủ nội dung; tệp đính kèm tải xuống nguyên vẹn, đúng định dạng.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-05`: Gửi bình luận vào thông báo & Nhận thông báo trong ứng dụng
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-10`, `NFR-04`
- **Điều kiện tiên quyết**: Đang mở chi tiết một thông báo hợp lệ của KP-01.
- **Các bước thực hiện**:
  1. Cuộn xuống phần bình luận của thông báo.
  2. Thử bấm gửi bình luận khi ô nhập rỗng để kiểm tra validate.
  3. Nhập nội dung bình luận mẫu: `"Cư dân xin tiếp thu và phối hợp thực hiện."` và bấm **"Gửi"**.
  4. Quan sát danh sách bình luận được cập nhật ngay lập tức.
  5. Kiểm tra biểu tượng quả chuông thông báo trên thanh điều hướng.
- **Kết quả mong đợi**: Hệ thống chặn gửi bình luận rỗng; bình luận hợp lệ hiển thị đúng tên người gửi và thời gian; tác giả bài viết nhận được thông báo in-app bền vững.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-06`: Gửi phản ánh / kiến nghị mới kèm ảnh minh chứng
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-12`, `NFR-01`
- **Điều kiện tiên quyết**: Đã đăng nhập tài khoản Cư dân KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Kiến nghị & Phản ánh"**, bấm **"Tạo kiến nghị mới"**.
  2. Chọn danh mục: `Hạ tầng đô thị` (`INFRASTRUCTURE`).
  3. Nhập tiêu đề: `"Phản ánh đèn chiếu sáng hẻm 123 bị hỏng"`.
  4. Nhập nội dung mô tả chi tiết vị trí và thực trạng.
  5. Đính kèm 1-2 tệp hình ảnh minh chứng giả lập (PNG/JPEG).
  6. Bấm **"Gửi kiến nghị"**.
- **Kết quả mong đợi**: Kiến nghị được tạo thành công ở trạng thái **Đang tiếp nhận** (`reviewing`); tệp ảnh được tải lên và hiển thị thumbnail xem trước an toàn; Tổ trưởng nhận được thông báo in-app.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-07`: Hủy kiến nghị khi còn ở trạng thái Đang tiếp nhận
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-15`
- **Điều kiện tiên quyết**: Cư dân có 1 kiến nghị vừa tạo đang ở trạng thái `reviewing`.
- **Các bước thực hiện**:
  1. Mở chi tiết kiến nghị đang ở trạng thái `reviewing`.
  2. Bấm nút **"Hủy kiến nghị"**.
  3. Nhập lý do hủy: `"Đơn vị bảo trì đã khắc phục xong."` và xác nhận.
- **Kết quả mong đợi**: Trạng thái kiến nghị chuyển sang **Đã hủy** (`cancelled`); lý do hủy được ghi nhận; nút hủy bị ẩn đi; lịch sử xử lý bổ sung sự kiện hủy bất biến.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-RES-08`: Xem lịch sử kiến nghị cá nhân & Dòng thời gian tiến độ
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-16`
- **Điều kiện tiên quyết**: Cư dân đã có các kiến nghị ở các trạng thái khác nhau.
- **Các bước thực hiện**:
  1. Vào danh sách kiến nghị cá nhân.
  2. Kiểm tra bộ lọc theo trạng thái (`Tất cả`, `Đang tiếp nhận`, `Đang xử lý`, `Đã giải quyết`, `Từ chối`, `Đã hủy`).
  3. Mở chi tiết một kiến nghị đã được Tổ trưởng xử lý.
  4. Xem dòng thời gian (timeline) xử lý từ lúc tạo đến lúc hoàn tất.
- **Kết quả mong đợi**: Chỉ thấy danh sách kiến nghị do chính mình tạo (không thấy kiến nghị người khác); dòng thời gian sắp xếp theo thứ tự thời gian tăng dần (`createdAt: asc`) với đầy đủ ghi chú phản hồi từ Tổ trưởng.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

### Phần B: Hành trình Vai trò Tổ trưởng Dân phố (`leader`)

#### `UAT-LEA-01`: Phê duyệt tài khoản cư dân Chờ duyệt trong khu phố
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-03`, `FR-02`
- **Điều kiện tiên quyết**: Đăng nhập tài khoản Tổ trưởng KP-01 (`0902345678`), có cư dân KP-01 đang chờ duyệt.
- **Các bước thực hiện**:
  1. Vào mục **"Quản lý cư dân"** → Tab **"Chờ duyệt"**.
  2. Kiểm tra thông tin hồ sơ cư dân `Phạm Thị Chờ Duyệt` (Họ tên, SĐT, Địa chỉ).
  3. Bấm **"Phê duyệt"** và xác nhận.
- **Kết quả mong đợi**: Hồ sơ chuyển khỏi danh sách chờ duyệt; tài khoản cư dân chuyển sang trạng thái Hoạt động (`active`); cư dân có thể đăng nhập ngay bằng OTP.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-02`: Từ chối tài khoản cư dân kèm lý do bắt buộc
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-03`
- **Điều kiện tiên quyết**: Có hồ sơ cư dân chờ duyệt thông tin không chính xác.
- **Các bước thực hiện**:
  1. Trong danh sách **"Chờ duyệt"**, chọn một hồ sơ cần từ chối.
  2. Bấm **"Từ chối"**.
  3. Thử bấm xác nhận khi chưa nhập lý do từ chối.
  4. Nhập lý do từ chối: `"Địa chỉ không thuộc phạm vi Khu phố 1."` và xác nhận.
- **Kết quả mong đợi**: Hệ thống bắt buộc phải nhập lý do từ chối; sau khi xác nhận, hồ sơ chuyển sang trạng thái Từ chối (`rejected`) và ghi nhận lý do vào hệ thống.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-03`: Khóa và Mở khóa tài khoản cư dân (Thu hồi phiên tức thì)
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-04`, `NFR-02`
- **Điều kiện tiên quyết**: Có tài khoản cư dân KP-01 đang hoạt động.
- **Các bước thực hiện**:
  1. Trong danh sách cư dân KP-01, chọn cư dân cần khóa và bấm **"Khóa tài khoản"**.
  2. Nhập lý do khóa: `"Chuyển nơi cư trú ra ngoài địa bàn."` và xác nhận.
  3. Cư dân bị khóa thử thực hiện một thao tác hoặc đăng nhập lại.
  4. Tổ trưởng chọn lại cư dân đó và bấm **"Mở khóa tài khoản"**.
  5. Cư dân thử đăng nhập lại bằng OTP.
- **Kết quả mong đợi**: Khi bị khóa, phiên làm việc hiện tại của cư dân bị thu hồi tức thì (nhận lỗi 401 khi gọi API); đăng nhập mới bị từ chối. Sau khi mở khóa, cư dân đăng nhập lại bình thường.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-04`: Đăng thông báo mới cho khu phố kèm tệp đính kèm
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-06`, `NFR-01`, `NFR-04`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Thông báo"**, bấm **"Đăng thông báo mới"**.
  2. Nhập tiêu đề: `"Lịch tổng vệ sinh môi trường Khu phố 1 Chủ Nhật tuần này"`.
  3. Nhập nội dung thông báo chi tiết.
  4. Đính kèm 1 tệp văn bản PDF mẫu hướng dẫn (dung lượng < 10 MiB).
  5. Bấm **"Đăng thông báo"**.
- **Kết quả mong đợi**: Thông báo được tạo thành công với phạm vi gắn với Khu phố 1; xuất hiện trên bảng tin của tất cả cư dân KP-01; tạo thông báo in-app cho cư dân; tệp đính kèm được lưu trữ an toàn.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-05`: Chỉnh sửa nội dung & Gỡ bỏ thông báo (Ẩn mềm)
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-07`
- **Điều kiện tiên quyết**: Tổ trưởng đã có thông báo do chính mình tạo.
- **Các bước thực hiện**:
  1. Mở chi tiết thông báo do mình tạo, bấm **"Chỉnh sửa"**.
  2. Sửa tiêu đề, cập nhật nội dung và lưu thay đổi.
  3. Bấm nút **"Gỡ bỏ thông báo"**, nhập lý do gỡ: `"Đã hết thời gian triển khai."` và xác nhận.
- **Kết quả mong đợi**: Nội dung chỉnh sửa được cập nhật chính xác. Khi gỡ bỏ, thông báo bị ẩn khỏi bảng tin người dùng (ẩn mềm `removed`), dữ liệu lịch sử và bình luận cũ được bảo toàn trong cơ sở dữ liệu.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-06`: Kiểm duyệt và Ẩn bình luận vi phạm trong thông báo
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-11`
- **Điều kiện tiên quyết**: Có bình luận trên thông báo thuộc KP-01.
- **Các bước thực hiện**:
  1. Mở thông báo có bình luận, tìm bình luận cần kiểm duyệt.
  2. Bấm nút **"Xóa / Ẩn bình luận"**.
  3. Nhập lý do: `"Nội dung không phù hợp với chủ đề thông báo."` và xác nhận.
- **Kết quả mong đợi**: Bình luận bị ẩn khỏi giao diện xem thông thường; hiển thị nhãn đã được kiểm duyệt/ẩn bởi Tổ trưởng; thông tin kiểm duyệt được ghi vết bất biến trong hệ thống.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-07`: Quản lý danh sách kiến nghị & Lọc đa tiêu chí
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-13`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Quản lý kiến nghị"**.
  2. Kiểm tra danh sách hiển thị: chỉ xuất hiện các kiến nghị thuộc Khu phố 1.
  3. Lọc theo trạng thái: chọn `Đang tiếp nhận` (`reviewing`).
  4. Lọc theo danh mục: chọn `Hạ tầng đô thị` (`INFRASTRUCTURE`).
  5. Lọc theo khoảng ngày gửi (Từ ngày - Đến ngày).
- **Kết quả mong đợi**: Danh sách lọc chính xác theo các tiêu chí đã chọn; phân trang hoạt động mượt mà; không thấy kiến nghị của các khu phố khác (KP-02).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-08`: Cập nhật trạng thái xử lý kiến nghị (`reviewing` → `processing` → `resolved`)
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-14`, `NFR-04`
- **Điều kiện tiên quyết**: Có kiến nghị của cư dân KP-01 đang ở trạng thái `reviewing`.
- **Các bước thực hiện**:
  1. Mở chi tiết kiến nghị, xem hình ảnh minh chứng đính kèm.
  2. Bấm **"Tiếp nhận xử lý"** (chuyển sang `processing`), nhập ghi chú ban đầu.
  3. Sau đó bấm **"Hoàn tất giải quyết"** (chuyển sang `resolved`), nhập nội dung kết quả giải quyết: `"Đã thay mới bóng đèn chiếu sáng lúc 14:00."`.
- **Kết quả mong đợi**: Trạng thái kiến nghị cập nhật nguyên tử; dòng thời gian xử lý bổ sung các mốc tương ứng; cư dân tạo kiến nghị nhận được thông báo in-app về tiến độ xử lý.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-09`: Từ chối kiến nghị kèm lý do nghiệp vụ bắt buộc
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-14`
- **Điều kiện tiên quyết**: Có kiến nghị không thuộc thẩm quyền hoặc thông tin không có căn cứ.
- **Các bước thực hiện**:
  1. Mở chi tiết kiến nghị, chọn hành động **"Từ chối kiến nghị"** (`rejected`).
  2. Thử xác nhận khi chưa điền lý do.
  3. Điền lý do: `"Khu vực phản ánh thuộc dự án đang thi công của chủ đầu tư bên ngoài."` và xác nhận.
- **Kết quả mong đợi**: Hệ thống bắt buộc nhập lý do khi từ chối; trạng thái chuyển sang `rejected`; cư dân xem được lý do từ chối rõ ràng trong dòng thời gian.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-10`: Quản lý hồ sơ cư dân chi tiết (Thêm mới, Cập nhật, Xem giải mã)
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-21`, `NFR-01`, `NFR-07`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Hồ sơ cư dân"**, bấm **"Thêm hồ sơ nhân khẩu mới"**.
  2. Nhập thông tin: Họ tên (`Phạm Thị Nhân Khẩu UAT`), CCCD (`079195000123`), Ngày sinh, Giới tính, Quan hệ chủ hộ (`Chủ hộ`), Mã hộ khẩu (`HK-KP01-888`), Nghề nghiệp, SĐT, Email.
  3. Bấm **"Lưu hồ sơ"**.
  4. Xem danh sách nhân khẩu: kiểm tra số CCCD và SĐT đã được che mặt nạ an toàn (ví dụ: `079*****0123`).
  5. Bấm xem chi tiết hồ sơ: kiểm tra dữ liệu được giải mã đầy đủ và chính xác cho Tổ trưởng.
  6. Bấm sửa thông tin nghề nghiệp thành `"Chuyên viên phân tích"` và lưu lại.
- **Kết quả mong đợi**: Tạo hồ sơ thành công; dữ liệu nhạy cảm được mã hóa CSDL và che mặt nạ trên danh sách; giải mã đúng thẩm quyền khi xem chi tiết; cập nhật thông tin thành công.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-11`: Trích lọc nhân khẩu nâng cao & Bàn giao sang lập sổ hoạt động
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-24`, `FR-23`
- **Điều kiện tiên quyết**: Hệ thống đã có danh sách hồ sơ cư dân KP-01.
- **Các bước thực hiện**:
  1. Trong mục **"Hồ sơ cư dân"**, mở bộ lọc nâng cao.
  2. Thiết lập tiêu chí: Độ tuổi từ `18` đến `60`, Giới tính: `Tất cả`, Tình trạng Đảng: `Tất cả`.
  3. Bấm **"Lọc dữ liệu"** và kiểm tra danh sách kết quả phù hợp.
  4. Bấm nút **"Tạo hoạt động từ danh sách này"** (Bàn giao seed dữ liệu).
- **Kết quả mong đợi**: Danh sách trích lọc chính xác theo tiêu chí tuổi và địa bàn; hệ thống chuyển sang form tạo hoạt động (FR-23) với danh sách nhân khẩu đã được điền sẵn tự động (chế độ `custom`).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-12`: Tạo sổ hoạt động khu phố, Điểm danh & Đánh giá xếp loại
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-23`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Sổ hoạt động khu phố"**, bấm **"Tạo hoạt động mới"**.
  2. Nhập tên hoạt động: `"Hội nghị Nhân dân Khu phố 1 Quý III"`, chọn ngày diễn ra, địa điểm, chọn nhóm đối tượng tham gia: `Toàn bộ cư dân` (`all`).
  3. Lưu hoạt động và kiểm tra danh sách người tham gia được cố định (fixed roster).
  4. Mở bảng điểm danh: thực hiện đánh dấu trạng thái (`Có mặt` / `Vắng mặt` / `Chưa xác nhận`), xếp loại (`Tốt` / `Khá` / `Trung bình`) và nhập ghi chú.
  5. Bấm **"Lưu kết quả điểm danh"**.
- **Kết quả mong đợi**: Hoạt động được tạo thành công với danh sách người tham gia tính đúng tuổi tại ngày diễn ra; lưu điểm danh nguyên tử; các chỉ số thống kê (tỷ lệ tham gia, số lượng xếp loại) tự động tính toán chính xác.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-13`: Quản lý thông tin chính trị - xã hội của cư dân trong khu phố
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-22`
- **Điều kiện tiên quyết**: Đã có hồ sơ cư dân KP-01.
- **Các bước thực hiện**:
  1. Vào mục **"Chính trị - Xã hội"**.
  2. Chọn một cư dân, bấm **"Cập nhật hồ sơ chính trị - xã hội"**.
  3. Chọn Tình trạng Đảng: `Đảng viên chính thức` (`PARTY_MEMBER`).
  4. Thử để trống ngày vào Đảng hoặc chọn ngày trong tương lai để kiểm tra validation.
  5. Nhập ngày vào Đảng hợp lệ (trong quá khứ, sau ngày sinh), trình độ học vấn (`Đại học`), chuyên môn (`Luật`), nghề nghiệp.
  6. Bấm **"Lưu hồ sơ"**.
- **Kết quả mong đợi**: Hệ thống bắt buộc nhập ngày vào Đảng hợp lệ khi là Đảng viên; lưu thông tin thành công; danh sách hỗ trợ lọc theo Đảng viên/Quần chúng; bảo mật dữ liệu định danh.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-LEA-14`: Xuất báo cáo dữ liệu định dạng CSV và Excel kèm che mặt nạ
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-25`, `NFR-07`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng KP-01.
- **Các bước thực hiện**:
  1. Bấm nút **"Xuất dữ liệu"** tại trang quản lý.
  2. Chọn tập dữ liệu: `Danh sách cư dân` (`residents`), định dạng `CSV (UTF-8)`.
  3. Bấm **"Tải xuống"** và mở tệp CSV bằng Microsoft Excel hoặc Notepad.
  4. Mở lại modal xuất dữ liệu, chọn tập dữ liệu: `Sổ hoạt động` (`activities`), chọn định dạng `Microsoft Excel (.xlsx)`.
  5. Bấm **"Tải xuống"** và mở tệp `.xlsx`.
- **Kết quả mong đợi**:
  - Tệp CSV xuất ra đúng chuẩn UTF-8 kèm BOM (`\uFEFF`), hiển thị tiếng Việt có dấu hoàn hảo không bị lỗi font; cột CCCD và SĐT được che mặt nạ an toàn; không chứa formula injection.
  - Tệp Excel (.xlsx) mở bình thường, định dạng bảng chuẩn OpenXML, có frozen header và auto column width.
  - Dữ liệu xuất ra chỉ bao gồm phạm vi Khu phố 1 (không có dữ liệu KP-02).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

### Phần C: Hành trình Vai trò Cán bộ Phường (`officer`)

#### `UAT-OFF-01`: Tạo tài khoản Tổ trưởng dân phố mới gắn với khu phố
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-05`, `FR-02`
- **Điều kiện tiên quyết**: Đăng nhập tài khoản Cán bộ phường (`0901234567`).
- **Các bước thực hiện**:
  1. Vào mục **"Quản lý Tổ trưởng"**, bấm **"Tạo tài khoản Tổ trưởng mới"**.
  2. Nhập Họ và tên (`Lê Văn Tổ Trưởng Mới`), Số điện thoại (`0902999888`), Địa chỉ, chọn Khu phố phụ trách (`Khu phố 1`).
  3. Bấm **"Khởi tạo tài khoản"**.
  4. Thử tạo thêm 1 Tổ trưởng khác gán trùng vào `Khu phố 1` đang có Tổ trưởng hoạt động để kiểm tra ràng buộc.
- **Kết quả mong đợi**: Tài khoản Tổ trưởng mới được kích hoạt trực tiếp (`active`); hệ thống từ chối cho phép 2 Tổ trưởng cùng hoạt động phụ trách 1 khu phố; Tổ trưởng mới đăng nhập thành công bằng OTP.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-02`: Đăng thông báo chỉ đạo phạm vi Toàn phường
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-06`, `NFR-04`
- **Điều kiện tiên quyết**: Đã đăng nhập Cán bộ phường.
- **Các bước thực hiện**:
  1. Vào mục **"Thông báo"**, bấm **"Tạo thông báo mới"**.
  2. Chọn phạm vi phát hành: `Toàn phường` (`WARD_WIDE`).
  3. Nhập tiêu đề: `"Thông báo Kế hoạch tiêm chủng mở rộng toàn phường đợt 2"`.
  4. Nhập nội dung chi tiết và đính kèm văn bản chỉ đạo (PDF).
  5. Bấm **"Đăng thông báo"**.
- **Kết quả mong đợi**: Thông báo được đăng thành công; hiển thị trên bảng tin của tất cả cư dân và Tổ trưởng thuộc mọi khu phố trong toàn phường; tạo thông báo in-app toàn diện.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-03`: Giám sát danh sách kiến nghị toàn phường & Xử lý kiến nghị
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-13`, `FR-14`
- **Điều kiện tiên quyết**: Đã có kiến nghị từ các khu phố khác nhau (KP-01, KP-02).
- **Các bước thực hiện**:
  1. Vào mục **"Giám sát kiến nghị"**.
  2. Kiểm tra danh sách: hiển thị tổng hợp kiến nghị từ tất cả các khu phố trên địa bàn.
  3. Sử dụng bộ lọc khu phố: lọc riêng KP-01, sau đó lọc KP-02.
  4. Mở xem chi tiết một kiến nghị, kiểm tra hình ảnh minh chứng và dòng thời gian.
  5. Cán bộ phường trực tiếp cập nhật trạng thái hoặc bổ sung ý kiến chỉ đạo.
- **Kết quả mong đợi**: Cán bộ phường quan sát trọn vẹn kiến nghị toàn địa bàn; tải tệp minh chứng an toàn; cập nhật trạng thái và ghi nhận lịch sử bất biến chính xác.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-04`: Theo dõi Dashboard tổng quan tình hình toàn phường
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-17`
- **Điều kiện tiên quyết**: Đã đăng nhập Cán bộ phường.
- **Các bước thực hiện**:
  1. Truy cập mục **"Tổng quan địa bàn"** (Ward Overview Dashboard).
  2. Kiểm tra các thẻ số liệu tổng hợp:
     - Tổng số khu phố trực thuộc.
     - Tổng số cư dân (hoạt động / chờ duyệt).
     - Tổng số kiến nghị theo 5 trạng thái (`reviewing`, `processing`, `resolved`, `rejected`, `cancelled`).
     - Số thông báo phát hành trong tháng.
  3. Kiểm tra bảng tổng hợp số liệu chi tiết từng khu phố.
- **Kết quả mong đợi**: Các số liệu thống kê phản ánh chính xác dữ liệu thực tế trong hệ thống; tải trang mượt mà; hiển thị trực quan, rõ ràng.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-05`: Xem chuyên sâu chi tiết một tổ dân phố / khu phố
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-18`
- **Điều kiện tiên quyết**: Đang ở Dashboard tổng quan toàn phường.
- **Các bước thực hiện**:
  1. Trong bảng danh sách khu phố, bấm chọn **"Xem chi tiết"** Khu phố 1 (`KP-01`).
  2. Kiểm tra thông tin định danh khu phố, thông tin Tổ trưởng phụ trách.
  3. Kiểm tra các chỉ số nhân khẩu, danh sách thông báo đã đăng gần nhất, và danh sách kiến nghị phát sinh của riêng khu phố đó.
- **Kết quả mong đợi**: Màn hình hiển thị chi tiết số liệu chuyên sâu của khu phố đã chọn; xử lý an toàn không bị lỗi khi chuyển đổi giữa các khu phố.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-06`: Phân tích Biểu đồ Kiến nghị theo Danh mục & Lọc địa bàn
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-19`
- **Điều kiện tiên quyết**: Đã đăng nhập Cán bộ phường.
- **Các bước thực hiện**:
  1. Xem biểu đồ phân bố kiến nghị theo 4 nhóm danh mục chuẩn: `Hạ tầng đô thị` (`INFRASTRUCTURE`), `Vệ sinh môi trường` (`SANITATION`), `An ninh trật tự` (`SECURITY`), `Khác` (`OTHER`).
  2. Kiểm tra tỷ lệ phần trăm (%) và số lượng đã giải quyết của từng nhóm.
  3. Thay đổi bộ lọc theo từng khu phố và khoảng thời gian.
- **Kết quả mong đợi**: Biểu đồ hiển thị đầy đủ 4 nhóm (tự động zero-fill an toàn nếu danh mục không có số liệu); số liệu và tỷ lệ % tính toán chính xác; cập nhật tức thì khi thay đổi bộ lọc.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-07`: Xem trước & Xuất báo cáo định kỳ cho UBND Phường/Quận
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-20`, `NFR-07`
- **Điều kiện tiên quyết**: Đã đăng nhập Cán bộ phường.
- **Các bước thực hiện**:
  1. Vào mục **"Báo cáo định kỳ"**.
  2. Chọn loại kỳ báo cáo: `Theo Tháng` (Tháng 1..12) hoặc `Theo Quý` (Quý 1..4), chọn Năm báo cáo.
  3. Xem trước (preview) bảng số liệu tổng hợp: nhân sự, dân số, thông báo, tình hình xử lý phản ánh kiến nghị, đánh giá tính đầy đủ của dữ liệu (`isDataSufficient`).
  4. Bấm nút **"Xuất báo cáo CSV"**.
  5. Mở tệp CSV và kiểm tra nội dung dữ liệu.
- **Kết quả mong đợi**:
  - Bảng xem trước hiển thị đúng số liệu kỳ báo cáo; có cảnh báo nếu kỳ chưa kết thúc.
  - Tệp CSV tải về có BOM UTF-8, không bị lỗi font tiếng Việt, tên tệp chuẩn hóa (ví dụ: `Bao_cao_dinh_ky_Thang_08_2026.csv`), không chứa dữ liệu định danh cá nhân nhạy cảm (Zero-PII).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-OFF-08`: Quản lý & Xuất dữ liệu nhân khẩu toàn địa bàn
- **Vai trò**: Cán bộ phường (`officer`)
- **Ánh xạ SRS**: `FR-21`, `FR-25`, `NFR-07`
- **Điều kiện tiên quyết**: Đã đăng nhập Cán bộ phường.
- **Các bước thực hiện**:
  1. Vào mục **"Hồ sơ cư dân"**: kiểm tra danh sách hiển thị hồ sơ của tất cả các khu phố.
  2. Mở hộp thoại xuất dữ liệu, chọn tập dữ liệu `Danh sách cư dân` toàn phường.
  3. Tải xuống tệp Excel (.xlsx) và mở kiểm tra.
- **Kết quả mong đợi**: Cán bộ phường có quyền quản lý toàn phường; tệp xuất ra bao gồm dữ liệu từ các khu phố trực thuộc; các trường CCCD, SĐT được che mặt nạ an toàn.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

### Phần D: Kiểm tra Phân quyền & Cô lập Địa bàn (Security & Authorization Matrix)

#### `UAT-SEC-01`: Truy cập tài nguyên bảo vệ khi chưa xác thực
- **Vai trò**: Người dùng ẩn danh (Anonymous)
- **Ánh xạ SRS**: `NFR-01`, `NFR-02`
- **Điều kiện tiên quyết**: Chưa đăng nhập hoặc đã đăng xuất.
- **Các bước thực hiện**:
  1. Nhập trực tiếp các đường dẫn nội bộ vào thanh địa chỉ trình duyệt: `/dashboard`, `/admin/residents`, `/admin/petitions`.
  2. Gửi request trực tiếp tới API `/api/auth/me` hoặc `/api/petitions`.
- **Kết quả mong đợi**: Giao diện tự động chuyển hướng về trang đăng nhập `/login`; API từ chối với mã lỗi `401 Unauthorized` (`ErrorCode.UNAUTHORIZED`).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-SEC-02`: Cư dân cố gắng thao tác vượt quyền quản trị & Xuất dữ liệu
- **Vai trò**: Cư dân (`resident`)
- **Ánh xạ SRS**: `FR-03`, `FR-05`, `FR-21`, `FR-25`, `NFR-01`
- **Điều kiện tiên quyết**: Đã đăng nhập tài khoản Cư dân.
- **Các bước thực hiện**:
  1. Thử truy cập các đường dẫn quản trị của Tổ trưởng/Cán bộ trên giao diện.
  2. Gửi request duyệt cư dân, tạo Tổ trưởng, cập nhật trạng thái kiến nghị, hoặc xuất dữ liệu nhân khẩu.
- **Kết quả mong đợi**: Giao diện không hiển thị các nút chức năng quản trị; Backend API từ chối nghiêm ngặt với mã lỗi `403 Forbidden` (`ErrorCode.FORBIDDEN`).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-SEC-03`: Tổ trưởng thao tác chéo khu phố (Cô lập dữ liệu địa bàn)
- **Vai trò**: Tổ trưởng KP-01 (`leader` KP-01)
- **Ánh xạ SRS**: `FR-03`, `FR-04`, `FR-14`, `FR-21`, `FR-25`, `NFR-01`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng KP-01.
- **Các bước thực hiện**:
  1. Thử gửi request duyệt/từ chối/khóa tài khoản cư dân thuộc KP-02.
  2. Thử cập nhật trạng thái kiến nghị thuộc KP-02.
  3. Thử xem chi tiết hoặc sửa hồ sơ nhân khẩu thuộc KP-02.
  4. Thử truyền query lọc dữ liệu KP-02 khi xuất báo cáo.
- **Kết quả mong đợi**: Mọi thao tác sửa đổi dữ liệu ngoài địa bàn bị chặn nghiêm ngặt với mã `403 Forbidden`; khi xuất dữ liệu, hệ thống tự động cưỡng chế giới hạn chỉ xuất dữ liệu của KP-01.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-SEC-04`: Tổ trưởng truy cập Dashboard tổng quan Cán bộ phường
- **Vai trò**: Tổ trưởng dân phố (`leader`)
- **Ánh xạ SRS**: `FR-17`, `FR-18`
- **Điều kiện tiên quyết**: Đã đăng nhập Tổ trưởng dân phố.
- **Các bước thực hiện**:
  1. Thử truy cập đường dẫn Dashboard Cán bộ phường hoặc gọi API `/api/dashboard/ward-overview`.
- **Kết quả mong đợi**: Giao diện chặn hiển thị; API trả về mã lỗi `403 Forbidden` (`ErrorCode.FORBIDDEN`).
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-SEC-05`: Kiểm soát quyền sở hữu kiến nghị & Chống IDOR
- **Vai trò**: Cư dân A (`resident`)
- **Ánh xạ SRS**: `FR-15`, `FR-16`, `NFR-01`
- **Điều kiện tiên quyết**: Đã đăng nhập Cư dân A, có mã ID kiến nghị của Cư dân B.
- **Các bước thực hiện**:
  1. Cư dân A thử mở chi tiết hoặc gửi lệnh hủy kiến nghị của Cư dân B theo ID.
  2. Cư dân A thử tải tệp minh chứng hình ảnh thuộc kiến nghị của Cư dân B.
- **Kết quả mong đợi**: Hệ thống che giấu sự tồn tại của kiến nghị bằng mã lỗi `404 Not Found` (`ErrorCode.PETITION_NOT_FOUND`) thay vì 403; không thể tải tệp minh chứng của người khác.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

### Phần E: Kiểm tra Đa Trình duyệt, Thiết bị Vật lý & Trải nghiệm (Browser, Device & UX)

#### `UAT-DEV-01`: Kiểm thử trên Thiết bị Apple iOS Safari thực tế
- **Vai trò**: QA cùng Cư dân thử nghiệm (`resident`)
- **Điều kiện tiên quyết**: Có iPhone vật lý chạy iOS 16.4+ Safari, tài khoản fixture active và Dev SMS Inbox/OTP fixture.
- **Thiết bị / Trình duyệt**: iPhone thật chạy iOS 16.4 trở lên (Safari gốc).
- **Ánh xạ SRS**: `NFR-05`, `NFR-06`, `NFR-09`
- **Các bước thực hiện**:
  1. Mở ứng dụng trên trình duyệt Safari trên iPhone.
  2. Thực hiện luồng đăng nhập bằng OTP: quan sát bàn phím số hiển thị (`inputmode="numeric"`), tự động gợi ý mã OTP (nếu có).
  3. Kiểm tra vùng an toàn (Safe Area): tai thỏ / Dynamic Island, thanh gạt Home không che khuất các nút bấm hoặc thanh điều hướng dưới đáy màn hình.
  4. Cuộn trang lên xuống: kiểm tra thanh địa chỉ URL co giãn của Safari không làm giật lag hay vỡ bố cục giao diện.
  5. Mở và đóng các hộp thoại modal (Tạo kiến nghị, Xem chi tiết, Điểm danh).
- **Kết quả mong đợi**: Giao diện hiển thị hoàn hảo, không bị tràn ngang; bàn phím ảo không che khuất ô nhập liệu; thao tác chạm vuốt mượt mà; modal tự động vừa khít khung nhìn di động.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-DEV-02`: Kiểm thử trên Microsoft Edge & Google Chrome (Desktop)
- **Vai trò**: QA lần lượt kiểm tra với `resident`, `leader`, `officer`
- **Điều kiện tiên quyết**: Có máy Windows 1920x1080 cài Edge và Chrome bản ổn định mới nhất, cùng ba tài khoản fixture active.
- **Thiết bị / Trình duyệt**: Máy tính chạy Microsoft Edge chính thức (Windows) và Google Chrome mới nhất.
- **Ánh xạ SRS**: `NFR-05`, `NFR-06`
- **Các bước thực hiện**:
  1. Mở ứng dụng trên Microsoft Edge và Google Chrome ở độ phân giải Full HD (1920x1080).
  2. Kiểm tra hiển thị bảng biểu số liệu, thanh điều hướng bên (Sidebar/Header).
  3. Kiểm tra tương thích phím tắt: bấm phím `Escape` để đóng modal, phím `Tab` để di chuyển focus giữa các ô nhập liệu.
- **Kết quả mong đợi**: Bố cục rộng thoáng, tận dụng tốt không gian màn hình lớn; không xuất hiện lỗi hiển thị font hay lỗi CSS; điều hướng bàn phím chuẩn WAI-ARIA.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-DEV-03`: Kiểm tra Bố cục Đáp ứng (Responsive) & Mục tiêu Cảm ứng (Touch Targets)
- **Vai trò**: QA lần lượt kiểm tra với `resident`, `leader`, `officer`
- **Điều kiện tiên quyết**: Có trình duyệt/thiết bị cho viewport 320x568 và 768px, dữ liệu fixture đủ mở các trang liệt kê.
- **Thiết bị / Viewport**: Màn hình di động nhỏ (320px x 568px — tiêu chuẩn iPhone SE) và máy tính bảng (768px).
- **Ánh xạ SRS**: `NFR-06`
- **Các bước thực hiện**:
  1. Thu nhỏ màn hình về độ rộng 320px.
  2. Kiểm tra toàn bộ các trang (Trang chủ, Đăng nhập, Bảng tin, Danh sách kiến nghị, Quản lý hồ sơ).
  3. Kiểm tra kích thước các nút bấm và icon: đảm bảo diện tích chạm tối thiểu $\ge 44 \times 44\text{ px}$.
  4. Kiểm tra tài liệu: đảm bảo không xuất hiện thanh cuộn ngang ngoài ý muốn (`scrollWidth <= clientWidth`).
- **Kết quả mong đợi**: Nội dung tự động co giãn linh hoạt; chữ không bị cắt cụt; các nút bấm dễ chạm bằng ngón tay cái mà không bị bấm nhầm; hoàn toàn không tràn ngang.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

#### `UAT-DEV-04`: Kiểm tra Ngôn ngữ Tiếng Việt & Trải nghiệm Người dùng
- **Vai trò**: Đại diện Cư dân (`resident`) và Tổ trưởng (`leader`), có QA điều phối
- **Điều kiện tiên quyết**: Môi trường UAT ổn định, tài khoản/dữ liệu fixture sẵn sàng và người tham gia đã được hướng dẫn không nhập PII thật.
- **Tiêu chuẩn**: Trải nghiệm thực tế với đại diện Tổ trưởng dân phố và Cư dân.
- **Ánh xạ SRS**: `NFR-09`
- **Các bước thực hiện**:
  1. Mời đại diện Tổ trưởng dân phố và Cư dân trực tiếp trải nghiệm thao tác trên ứng dụng.
  2. Rà soát toàn bộ từ vựng, thông báo hướng dẫn, nhãn nút bấm, thông báo lỗi trên giao diện.
  3. Đánh giá tính trực quan, mức độ dễ hiểu của các thuật ngữ quản lý hành chính cơ sở.
- **Kết quả mong đợi**: 100% giao diện thể hiện bằng tiếng Việt chuẩn mực, trong sáng, đúng ngữ cảnh hành chính Việt Nam; người lớn tuổi (Tổ trưởng) thao tác thuận tiện, không gặp rào cản kỹ thuật.
- **Kết quả thực tế**: `[ ] Đạt / [ ] Ghi nhận: __________________________________________________`
- **Đánh giá**: `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`
- **Minh chứng / Mã lỗi**: `__________________________________________________`

---

## 5. Quy trình Dọn dẹp Dữ liệu An toàn Sau Kiểm thử (Safe Teardown & Cleanup)

Sau khi hoàn tất phiên kiểm thử UAT, người vận hành thực hiện quy trình dọn dẹp để đảm bảo tính sẵn sàng cho các đợt kiểm thử tiếp theo:

1. **Thu hồi phiên đăng nhập**: Đăng xuất toàn bộ các tài khoản thử nghiệm trên các thiết bị.
2. **Làm sạch dữ liệu sandbox**:
   - Nếu chạy trên Docker Compose kiểm thử: chỉ dùng lệnh teardown/runbook có **project name UAT/smoke được định danh rõ**. Không chạy `docker compose down -v` chung chung từ thư mục dự án vì có thể xóa volume phát triển.
   - Nếu chạy trên CSDL Staging: xóa các bản ghi thử nghiệm mang tiền tố `UAT-`, `TEST-` hoặc phục hồi CSDL từ bản sao lưu sạch ban đầu theo quy trình tại [Sổ tay Sao lưu & Phục hồi CSDL](../operations/database-backup-restore.md).
3. **Lưu trữ biên bản**: Xuất và lưu trữ tệp biên bản UAT có đầy đủ kết quả và chữ ký xác nhận của các bên liên quan.

---

## 6. Biên bản Tổng hợp & Ký kết Bàn giao Nghiệm thu UAT (Sign-Off Record)

### 6.1. Bảng Tổng kết Kết quả Kiểm thử

| Nhóm Kịch bản UAT | Tổng số ca | Đạt (`PASS`) | Không đạt (`FAIL`) | Bị nghẽn (`BLOCKED`) | Tỷ lệ Đạt (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Phần A: Hành trình Cư dân** | 8 | `[ ]` | `[ ]` | `[ ]` | `____ %` |
| **Phần B: Hành trình Tổ trưởng** | 14 | `[ ]` | `[ ]` | `[ ]` | `____ %` |
| **Phần C: Hành trình Cán bộ Phường** | 8 | `[ ]` | `[ ]` | `[ ]` | `____ %` |
| **Phần D: Phân quyền & Cô lập** | 5 | `[ ]` | `[ ]` | `[ ]` | `____ %` |
| **Phần E: Đa trình duyệt, Thiết bị & UX** | 4 | `[ ]` | `[ ]` | `[ ]` | `____ %` |
| **TỔNG CỘNG** | **39** | `[ ]` | `[ ]` | `[ ]` | `____ %` |

---

### 6.2. Danh sách Lỗi Phát sinh (Defect Tracking Log)

| Mã Lỗi (Defect ID) | Ca kiểm thử liên quan | Mức độ nghiêm trọng | Mô tả ngắn gọn lỗi | Người xử lý | Trạng thái (`OPEN` / `FIXED` / `VERIFIED`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DEF-UAT-01` | `UAT-____` | `[ ] Blocker [ ] Critical [ ] Major [ ] Minor` | __________________________________________________ | ____________ | `[ ] OPEN  [ ] FIXED  [ ] VERIFIED` |
| `DEF-UAT-02` | `UAT-____` | `[ ] Blocker [ ] Critical [ ] Major [ ] Minor` | __________________________________________________ | ____________ | `[ ] OPEN  [ ] FIXED  [ ] VERIFIED` |
| `DEF-UAT-03` | `UAT-____` | `[ ] Blocker [ ] Critical [ ] Major [ ] Minor` | __________________________________________________ | ____________ | `[ ] OPEN  [ ] FIXED  [ ] VERIFIED` |

---

### 6.3. Ký kết Nghiệm thu của Các Bên Liên quan (Stakeholder Signatures)

*Phiên nghiệm thu chấp nhận người dùng thực tế (UAT) cho nền tảng QuanLyKhuPho đã được tiến hành theo đúng quy trình và nội dung quy định tại tài liệu này.*

| Đại diện Cư dân | Đại diện Tổ trưởng Dân phố | Đại diện Cán bộ Phường | Đội ngũ Phát triển / QA |
| :---: | :---: | :---: | :---: |
| *(Ký và ghi rõ họ tên)* | *(Ký và ghi rõ họ tên)* | *(Ký và ghi rõ họ tên)* | *(Ký và ghi rõ họ tên)* |
| <br><br>____________________ | <br><br>____________________ | <br><br>____________________ | <br><br>____________________ |
| Ngày: ____ / ____ / 2026 | Ngày: ____ / ____ / 2026 | Ngày: ____ / ____ / 2026 | Ngày: ____ / ____ / 2026 |
