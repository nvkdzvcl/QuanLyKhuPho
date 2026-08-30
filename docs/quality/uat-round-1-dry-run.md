# Biên bản Chạy thử Nghiệm thu Người dùng Vòng 1 (UAT Round-1 Dry-Run Record)

> [!WARNING]
> **Tuyên bố Phân định Ranh giới Kỹ thuật & Trạng thái Văn bản**
> 1. **Biên bản Chạy thử Kỹ thuật Nội bộ (Internal Dry-Run Record)**: Tài liệu này ghi nhận kết quả ánh xạ đối chiếu giữa 39 ca kiểm thử nghiệm thu người dùng chuẩn tại [Danh mục UAT](uat-checklist.md) với bằng chứng kiểm thử tự động full-stack từ mã nguồn [apps/web/e2e/fullstack-role-flows.spec.ts](../../apps/web/e2e/fullstack-role-flows.spec.ts).
> 2. **Không thay thế Nghiệm thu Thực tế**: Kết quả chạy thử tự động **tuyệt đối không thay thế** phiên nghiệm thu thực tế với các bên liên quan (Stakeholder Sign-Off). Toàn bộ 39 ca kiểm thử trong biên bản này đều được bảo lưu trạng thái đánh giá UAT là **`PENDING MANUAL`**.

---

## 1. Thông tin Phiên Chạy thử & Môi trường Kiểm chứng (Dry-Run Metadata)

| Thuộc tính (Property) | Giá trị ghi nhận thực tế (Verified Value) |
| :--- | :--- |
| **Mục đích** | Báo cáo ánh xạ UAT vòng 1 từ bằng chứng kiểm thử tự động full-stack đa vai trò |
| **Ngày thực hiện** | 29/08/2026 (Asia/Bangkok) |
| **Mã băm Commit Baseline** | `e917256` |
| **Lệnh thực thi tự động** | `pnpm e2e:fullstack` |
| **Tệp kịch bản kiểm thử nguồn** | `apps/web/e2e/fullstack-role-flows.spec.ts` |
| **Cơ sở dữ liệu & Cấu hình** | PostgreSQL schema `qlkp_e2e`, Redis DB 15, RabbitMQ cục bộ (`local test broker (credentials omitted)`), Dev SMS Inbox |
| **Kết quả Thực thi Tự động** | **1/1 passed** (Thời gian tổng: **1.9m**, Thời gian thân kịch bản hành trình: **56.1s**) |
| **Xác minh sau xử lý observation ảnh preview** | **1/1 passed** (Thời gian tổng: **1.4m**, Thời gian thân hành trình: **1.2m**); cảnh báo tỷ lệ ảnh `blob:` không tái xuất hiện |
| **Trạng thái Nghiệm thu UAT** | **`PENDING MANUAL`** (39/39 ca kiểm thử đang chờ phiên nghiệm thu thực tế) |

---

## 2. Bảng Tổng hợp Mức độ Bao phủ Bằng chứng Tự động (Evidence Coverage Summary)

| Mức độ Bằng chứng Tự động (Automated Evidence) | Định nghĩa Tiêu chí | Số lượng Ca | Tỷ lệ (%) | Đánh giá UAT Tương ứng |
| :--- | :--- | :---: | :---: | :---: |
| **`FULL` (Toàn phần)** | Hành trình nghiệp vụ chính, tương tác UI và các xác minh dữ liệu cốt lõi đã được kiểm chứng tự động đầy đủ trong kịch bản E2E full-stack. | 21 | 53.8% | `PENDING MANUAL` (21) |
| **`PARTIAL` (Một phần)** | Kịch bản tự động đã kiểm chứng một phần hành trình (ví dụ: luồng tạo/xem UI cơ bản), nhưng một số nhánh phụ, xác thực lỗi, tải tệp, hoặc kiểm tra phân quyền nâng cao cần thao tác thủ công bổ sung. | 13 | 33.3% | `PENDING MANUAL` (13) |
| **`NONE` (Chưa có)** | Kịch bản E2E full-stack hiện tại chưa bao quát ca kiểm thử này (chỉ có kiểm thử tầng API/Unit hoặc yêu cầu thiết bị vật lý chuyên biệt). | 5 | 12.8% | `PENDING MANUAL` (5) |
| **TỔNG CỘNG** | **Bao quát toàn bộ 39 ca kiểm thử chuẩn (FR-01 → FR-25, NFR-01 → NFR-09)** | **39** | **100%** | **`PENDING MANUAL` (39/39)** |

---

## 3. Bảng Ma trận Ánh xạ Chi tiết 39 Ca UAT sang Bằng chứng Tự động (Traceability Matrix)

### Phần A: Hành trình Vai trò Cư dân (`resident`) — 8 ca

| Mã UAT | Nhóm / Vai trò | Tên kịch bản kiểm thử | Bằng chứng Tự động | Bằng chứng Nguồn (`fullstack-role-flows.spec.ts`) | Hành động Kiểm thử Thủ công Còn lại | Đánh giá UAT |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `UAT-RES-01` | Cư dân (`resident`) | Đăng ký tài khoản cư dân mới qua xác thực OTP | **`FULL`** | Step 2 (lines 318–396): Điền số điện thoại, nhận dev OTP, điền form đăng ký đầy đủ (họ tên, địa chỉ, chọn KP-01), hiển thị modal "Hồ sơ đang chờ phê duyệt" với trạng thái "Đang chờ xét duyệt". | Thao tác nhập liệu trực tiếp trên giao diện trình duyệt thực tế, kiểm tra độ mượt mà và tính rõ ràng của các thông báo hướng dẫn tiếng Việt. | **`PENDING MANUAL`** |
| `UAT-RES-02` | Cư dân (`resident`) | Đăng nhập khi tài khoản đang ở trạng thái Chờ duyệt | **`PARTIAL`** | Step 2 (lines 377–387): Xác minh hộp thoại trạng thái chờ phê duyệt hiển thị ngay sau đăng ký; chưa thực hiện luồng đăng nhập lại độc lập từ đầu khi đang pending. | Thực hiện đăng nhập mới từ đầu bằng tài khoản đang chờ duyệt để xác nhận hiển thị đúng modal thông báo chặn truy cập. | **`PENDING MANUAL`** |
| `UAT-RES-03` | Cư dân (`resident`) | Đăng nhập tài khoản cư dân đã kích hoạt & Duy trì phiên | **`PARTIAL`** | Step 4 & Step 7 (lines 145–204, 1241–1246, 2040–2043): Đăng nhập thành công bằng dev OTP, xác minh định danh cư dân và huy hiệu `Cư dân · Khu phố 1`; chưa thử nhập sai OTP và chưa kiểm tra tắt mở tab để kiểm chứng cookie phiên. | Thử cố tình nhập sai mã OTP 1 lần để kiểm tra thông báo lỗi; đóng tab trình duyệt và mở lại để kiểm tra phiên đăng nhập được duy trì tự động. | **`PENDING MANUAL`** |
| `UAT-RES-04` | Cư dân (`resident`) | Xem bảng tin thông báo, bộ lọc & Tải tệp đính kèm | **`PARTIAL`** | Step 4 & Step 7 (lines 1248–1269, 2088–2112): Xem chi tiết thông báo khu phố từ drawer thông báo và bảng tin; chưa thực hiện tìm kiếm từ khóa trên thanh search và tải tệp PDF đính kèm từ bảng tin cư dân. | Nhập từ khóa tìm kiếm trên thanh tìm kiếm bảng tin và bấm tải xuống tệp đính kèm để kiểm tra tính toàn vẹn của tệp văn bản. | **`PENDING MANUAL`** |
| `UAT-RES-05` | Cư dân (`resident`) | Gửi bình luận vào thông báo & Nhận thông báo trong ứng dụng | **`PARTIAL`** | Step 4 (lines 1248–1296): Mở thông báo qua chuông in-app notification fallback, gửi bình luận hợp lệ, xác minh nội dung bình luận hiển thị; chưa kiểm tra validate chặn gửi bình luận rỗng. | Thử bấm nút gửi khi ô nhập bình luận rỗng để kiểm tra validate; kiểm tra thông báo in-app gửi đến tác giả bài viết. | **`PENDING MANUAL`** |
| `UAT-RES-06` | Cư dân (`resident`) | Gửi phản ánh / kiến nghị mới kèm ảnh minh chứng | **`FULL`** | Step 4 (lines 1298–1354): Mở modal tạo kiến nghị, chọn danh mục `INFRASTRUCTURE`, tải tệp ảnh PNG in-memory thực tế, kiểm tra preview ảnh, gửi thành công, kiểm tra danh sách có huy hiệu "Chờ tiếp nhận" và "1 ảnh". | Kiểm tra độ sắc nét của hình ảnh xem trước trên các kích thước màn hình và xác nhận thời gian nhận thông báo của Tổ trưởng. | **`PENDING MANUAL`** |
| `UAT-RES-07` | Cư dân (`resident`) | Hủy kiến nghị khi còn ở trạng thái Đang tiếp nhận | **`FULL`** | Step 4 (lines 1355–1447): Tạo kiến nghị thứ 2 trạng thái Chờ tiếp nhận, mở chi tiết, bấm "Hủy kiến nghị này", nhập lý do hủy bắt buộc trong modal xác nhận, kiểm tra trạng thái chuyển sang "Đã hủy" và lý do hủy hiển thị trong lịch sử. | Xác minh nút "Hủy kiến nghị" bị ẩn hoàn toàn sau khi đã hủy và kiểm tra lịch sử trạng thái không bị xóa bỏ. | **`PENDING MANUAL`** |
| `UAT-RES-08` | Cư dân (`resident`) | Xem lịch sử kiến nghị cá nhân & Dòng thời gian tiến độ | **`FULL`** | Step 7 (lines 2113–2178): Vào "Kiến nghị của tôi", mở chi tiết kiến nghị đã xử lý, kiểm tra ảnh đính kèm, huy hiệu "Đã giải quyết", ghi chú kết quả giải quyết và dòng thời gian xử lý đầy đủ các bước theo thứ tự thời gian. | Thao tác lọc theo từng tab trạng thái trên danh sách cá nhân và kiểm tra giao diện trên thiết bị di động. | **`PENDING MANUAL`** |

---

### Phần B: Hành trình Vai trò Tổ trưởng Dân phố (`leader`) — 14 ca

| Mã UAT | Nhóm / Vai trò | Tên kịch bản kiểm thử | Bằng chứng Tự động | Bằng chứng Nguồn (`fullstack-role-flows.spec.ts`) | Hành động Kiểm thử Thủ công Còn lại | Đánh giá UAT |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `UAT-LEA-01` | Tổ trưởng (`leader`) | Phê duyệt tài khoản cư dân Chờ duyệt trong khu phố | **`FULL`** | Step 3 (lines 401–429): Đăng nhập Tổ trưởng, thấy hồ sơ cư dân chờ duyệt trong hàng đợi công việc, bấm "Duyệt", xác minh toast thông báo phê duyệt thành công. | Kiểm tra danh sách Chờ duyệt tự động làm mới và xác nhận cư dân có thể đăng nhập ngay lập tức sau khi duyệt. | **`PENDING MANUAL`** |
| `UAT-LEA-02` | Tổ trưởng (`leader`) | Từ chối tài khoản cư dân kèm lý do bắt buộc | **`NONE`** | Chưa có trong kịch bản E2E full-stack (luồng này được kiểm thử ở tầng API/Unit). | Thao tác bấm Từ chối một hồ sơ chờ duyệt, kiểm tra form bắt buộc nhập lý do từ chối và xác minh trạng thái chuyển sang Từ chối (`rejected`). | **`PENDING MANUAL`** |
| `UAT-LEA-03` | Tổ trưởng (`leader`) | Khóa và Mở khóa tài khoản cư dân (Thu hồi phiên tức thì) | **`FULL`** | Step 7 (lines 1908–2043): Khóa tài khoản cư dân kèm lý do bắt buộc; kiểm chứng ngữ cảnh trình duyệt cư dân bị chặn đăng nhập ("Tài khoản đã bị tạm khóa"); Tổ trưởng mở khóa thành công; cư dân đăng nhập lại bình thường. | Kiểm tra việc thu hồi phiên làm việc tức thì khi cư dân đang tương tác dở dang trong phiên làm việc. | **`PENDING MANUAL`** |
| `UAT-LEA-04` | Tổ trưởng (`leader`) | Đăng thông báo mới cho khu phố kèm tệp đính kèm | **`PARTIAL`** | Step 3 (lines 1178–1234): Đăng thông báo phạm vi Khu phố 1, xác minh toast thành công và hiển thị trên bảng tin; chưa thực hiện đính kèm tệp tài liệu PDF trong kịch bản này. | Đính kèm tệp PDF văn bản thực tế (< 10 MiB) khi đăng thông báo và kiểm tra khả năng tải xuống của cư dân. | **`PENDING MANUAL`** |
| `UAT-LEA-05` | Tổ trưởng (`leader`) | Chỉnh sửa nội dung & Gỡ bỏ thông báo (Ẩn mềm) | **`FULL`** | Step 5 (lines 1693–1766): Sửa tiêu đề/nội dung thông báo KP-01, xác minh cập nhật; thực hiện "Gỡ bỏ" kèm xác nhận trong modal, xác minh thông báo biến mất khỏi bảng tin công khai. | Kiểm tra dữ liệu trong CSDL để đảm bảo bản ghi thông báo và bình luận chỉ bị ẩn mềm (`removed`) chứ không bị xóa vật lý. | **`PENDING MANUAL`** |
| `UAT-LEA-06` | Tổ trưởng (`leader`) | Kiểm duyệt và Ẩn bình luận vi phạm trong thông báo | **`FULL`** | Step 5 (lines 1623–1692): Mở chi tiết thông báo, thấy bình luận của cư dân, bấm "Kiểm duyệt", nhập lý do ẩn vi phạm, xác minh bình luận chuyển sang trạng thái "Đã bị ẩn" kèm lý do ẩn. | Đăng nhập tài khoản cư dân khác để xác nhận bình luận bị ẩn không còn hiển thị nội dung gốc đối với công chúng. | **`PENDING MANUAL`** |
| `UAT-LEA-07` | Tổ trưởng (`leader`) | Quản lý danh sách kiến nghị & Lọc đa tiêu chí | **`FULL`** | Step 5 (lines 1458–1542): Vào quản lý kiến nghị KP-01, thực hiện lọc theo trạng thái ("Chờ tiếp nhận", "Đã hủy", "Tất cả"), lọc theo danh mục (`SANITATION`, `INFRASTRUCTURE`), và lọc theo khoảng ngày gửi (Từ ngày - Đến ngày). | Kiểm tra tính năng phân trang khi số lượng kiến nghị vượt quá 20 bản ghi trên giao diện thực tế. | **`PENDING MANUAL`** |
| `UAT-LEA-08` | Tổ trưởng (`leader`) | Cập nhật trạng thái xử lý kiến nghị (`reviewing` → `processing` → `resolved`) | **`FULL`** | Step 5 (lines 1543–1608): Mở chi tiết kiến nghị, kiểm tra ảnh đính kèm, bấm "Tiếp nhận xử lý" (chuyển sang "Đang xử lý"), bấm "Giải quyết thành công", nhập nội dung kết quả giải quyết, kiểm tra ghi chú hiển thị trong dòng thời gian. | Kiểm tra thông báo in-app tức thời gửi về tài khoản cư dân tạo kiến nghị khi trạng thái thay đổi. | **`PENDING MANUAL`** |
| `UAT-LEA-09` | Tổ trưởng (`leader`) | Từ chối kiến nghị kèm lý do nghiệp vụ bắt buộc | **`NONE`** | Chưa có trong kịch bản E2E full-stack (luồng này được kiểm thử ở tầng API/Unit). | Thao tác Từ chối một kiến nghị không hợp lệ, kiểm tra validate bắt buộc nhập lý do từ chối và kiểm tra hiển thị lý do phía cư dân. | **`PENDING MANUAL`** |
| `UAT-LEA-10` | Tổ trưởng (`leader`) | Quản lý hồ sơ cư dân chi tiết (Thêm mới, Cập nhật, Xem giải mã) | **`FULL`** | Step 3 (lines 433–619): Thêm mới hồ sơ nhân khẩu (15 trường thông tin), xác minh bản ghi trong bảng; mở xem chi tiết giải mã đầy đủ CCCD và địa chỉ; chỉnh sửa nghề nghiệp và nơi ở hiện tại, xác minh cập nhật bền vững. | Kiểm tra trực quan việc che mặt nạ CCCD và số điện thoại trên bảng danh sách trước khi mở hộp thoại chi tiết. | **`PENDING MANUAL`** |
| `UAT-LEA-11` | Tổ trưởng (`leader`) | Trích lọc nhân khẩu nâng cao & Bàn giao sang lập sổ hoạt động | **`FULL`** | Step 3 (lines 620–712): Áp dụng bộ lọc nâng cao kết hợp (độ tuổi 25–35, giới tính, quan hệ chủ hộ, nghề nghiệp, phường); kiểm tra trạng thái rỗng khi điều kiện không khớp; bấm "Tạo hoạt động từ danh sách", xác minh modal nhận diện 1 nhân khẩu đã chọn sẵn. | Thử nghiệm trích lọc với danh sách nhân khẩu lớn và kiểm tra thao tác chọn/bỏ chọn thủ công trên modal. | **`PENDING MANUAL`** |
| `UAT-LEA-12` | Tổ trưởng (`leader`) | Tạo sổ hoạt động khu phố, Điểm danh & Đánh giá xếp loại | **`FULL`** | Step 3 (lines 713–996): Kiểm tra validate tên hoạt động rỗng; tạo hoạt động tháng 8/2026; điểm danh "Có mặt", xếp loại "Tốt", lưu ghi chú đóng góp; sửa thông tin hoạt động; chuyển đổi tháng và quay lại kiểm tra dữ liệu bền vững; tạo hoạt động điều kiện < 18 tuổi xác minh cảnh báo không có nhân khẩu phù hợp. | Trải nghiệm bảng điểm danh trên màn hình cảm ứng máy tính bảng và kiểm tra tỷ lệ phần trăm tổng kết. | **`PENDING MANUAL`** |
| `UAT-LEA-13` | Tổ trưởng (`leader`) | Quản lý thông tin chính trị - xã hội của cư dân trong khu phố | **`FULL`** | Step 3 (lines 997–1176): Tìm kiếm nhân khẩu, kiểm tra validate bắt buộc ngày vào Đảng khi là Đảng viên, lưu hồ sơ chính trị - xã hội đầy đủ 7 trường; lọc theo Đảng viên; mở lại modal xác minh dữ liệu đã lưu nguyên vẹn. | Kiểm tra việc chuyển đổi trạng thái giữa Đảng viên và Quần chúng, xác minh độ bảo mật của thông tin chính trị. | **`PENDING MANUAL`** |
| `UAT-LEA-14` | Tổ trưởng (`leader`) | Xuất báo cáo dữ liệu định dạng CSV và Excel kèm che mặt nạ | **`FULL`** | Step 9 (lines 2380–2540): Kiểm tra 4 nút xuất dữ liệu; xuất CSV danh sách cư dân có UTF-8 BOM (`\uFEFF`), xác minh CCCD được che mặt nạ và không có PII nhạy cảm/secret; mở lại modal tự động reset về CSV; chọn XLSX sổ hoạt động và tải tệp có chữ ký định dạng ZIP (`0x50 0x4B 0x03 0x04`). | Mở tệp CSV và Excel bằng Microsoft Excel trên Windows để kiểm tra hiển thị dấu tiếng Việt và định dạng cột. | **`PENDING MANUAL`** |

---

### Phần C: Hành trình Vai trò Cán bộ Phường (`officer`) — 8 ca

| Mã UAT | Nhóm / Vai trò | Tên kịch bản kiểm thử | Bằng chứng Tự động | Bằng chứng Nguồn (`fullstack-role-flows.spec.ts`) | Hành động Kiểm thử Thủ công Còn lại | Đánh giá UAT |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `UAT-OFF-01` | Cán bộ phường (`officer`) | Tạo tài khoản Tổ trưởng dân phố mới gắn với khu phố | **`PARTIAL`** | Step 1 & Step 3 (lines 250–313, 401–409): Cán bộ phường tạo tài khoản Tổ trưởng gắn với KP-01, xác minh thông báo thành công; Tổ trưởng đăng nhập thành công bằng dev OTP; chưa thử tạo Tổ trưởng thứ 2 trùng khu phố trong UI spec này. | Thao tác cố tình tạo Tổ trưởng thứ 2 gán trùng vào Khu phố 1 đang có Tổ trưởng hoạt động để kiểm tra thông báo chặn. | **`PENDING MANUAL`** |
| `UAT-OFF-02` | Cán bộ phường (`officer`) | Đăng thông báo chỉ đạo phạm vi Toàn phường | **`FULL`** | Step 6 & Step 7 (lines 1839–1903, 2066–2112): Đăng thông báo phạm vi Toàn phường (`WARD`), xác minh toast và card trong feed; cư dân nhận được thông báo trong drawer chuông và bảng tin cư dân. | Đính kèm tệp chỉ đạo PDF thực tế và kiểm tra hiển thị đồng thời trên tài khoản Tổ trưởng KP-01 và KP-02. | **`PENDING MANUAL`** |
| `UAT-OFF-03` | Cán bộ phường (`officer`) | Giám sát danh sách kiến nghị toàn phường & Xử lý kiến nghị | **`FULL`** | Step 6 (lines 1773–1838): Vào mục giám sát toàn phường, thấy kiến nghị của KP-01 kèm tên cư dân và số lượng ảnh; lọc trạng thái "Đã giải quyết" và "Tất cả"; mở chi tiết xem ảnh đính kèm và ghi chú giải quyết. | Thử nghiệm lọc danh sách theo từng khu phố khi có nhiều khu phố và thử cán bộ phường bổ sung ý kiến chỉ đạo. | **`PENDING MANUAL`** |
| `UAT-OFF-04` | Cán bộ phường (`officer`) | Theo dõi Dashboard tổng quan tình hình toàn phường | **`FULL`** | Step 8 (lines 2187–2199): Xác minh hiển thị các thẻ số liệu tổng hợp khu phố, cư dân, kiến nghị, các khối "Kiến nghị theo danh mục", "Tiến độ xử lý theo khu phố", "Tình hình các khu phố" và dòng số liệu KP-01. | Đối chiếu các số liệu trên Dashboard với cơ sở dữ liệu để xác nhận độ chính xác tổng hợp. | **`PENDING MANUAL`** |
| `UAT-OFF-05` | Cán bộ phường (`officer`) | Xem chuyên sâu chi tiết một tổ dân phố / khu phố | **`FULL`** | Step 8 (lines 2200–2244): Mở drill-down "Xem chi tiết Khu phố 1", xác minh thông tin định danh KP-01, các chỉ số cư dân hoạt động, thông báo đã đăng, danh sách kiến nghị gần đây; đóng drill-down an toàn. | Chuyển đổi xem chi tiết giữa nhiều khu phố khác nhau và đánh giá độ mượt của giao diện. | **`PENDING MANUAL`** |
| `UAT-OFF-06` | Cán bộ phường (`officer`) | Phân tích Biểu đồ Kiến nghị theo Danh mục & Lọc địa bàn | **`FULL`** | Step 8 (lines 2245–2289): Xem phân bố nhóm vấn đề, lọc theo KP-01, lọc theo khoảng ngày quá khứ không có dữ liệu (xác minh trạng thái 0 kiến nghị an toàn), thực hiện xóa lọc khôi phục dữ liệu ban đầu. | Kiểm tra trực quan màu sắc, tỷ lệ % và kiểm tra tương tác tooltip khi rê chuột trên biểu đồ. | **`PENDING MANUAL`** |
| `UAT-OFF-07` | Cán bộ phường (`officer`) | Xem trước & Xuất báo cáo định kỳ cho UBND Phường/Quận | **`FULL`** | Step 8 (lines 2290–2375): Xem trước bảng số liệu báo cáo định kỳ (phạm vi thời gian, trạng thái dữ liệu, tổng hợp toàn phường, chi tiết KP-01); xuất tệp CSV đúng tên `bao-cao-khu-pho-*.csv`, có BOM UTF-8, cấu trúc bảng chuẩn và loại trừ PII nhạy cảm. | Mở tệp CSV định kỳ bằng Microsoft Excel trên máy tính Windows để kiểm tra định dạng bảng biểu và cảnh báo khi kỳ chưa kết thúc. | **`PENDING MANUAL`** |
| `UAT-OFF-08` | Cán bộ phường (`officer`) | Quản lý & Xuất dữ liệu nhân khẩu toàn địa bàn | **`NONE`** | Chưa có luồng Cán bộ phường xuất hồ sơ nhân khẩu toàn phường trong kịch bản E2E full-stack (Step 9 chỉ kiểm chứng Tổ trưởng xuất KP-01; Step 8 kiểm chứng xuất báo cáo định kỳ). | Đăng nhập tài khoản Cán bộ phường, vào mục Quản lý hồ sơ cư dân, mở modal xuất dữ liệu Excel (.xlsx) danh sách cư dân toàn phường và kiểm tra kết quả. | **`PENDING MANUAL`** |

---

### Phần D: Kiểm tra Phân quyền & Cô lập Địa bàn (Security & Authorization) — 5 ca

| Mã UAT | Nhóm / Vai trò | Tên kịch bản kiểm thử | Bằng chứng Tự động | Bằng chứng Nguồn (`fullstack-role-flows.spec.ts`) | Hành động Kiểm thử Thủ công Còn lại | Đánh giá UAT |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `UAT-SEC-01` | Người dùng ẩn danh | Truy cập tài nguyên bảo vệ khi chưa xác thực | **`PARTIAL`** | Lines 207–229, 239–245, 389–396: Xác minh trạng thái công khai chưa xác thực và điều hướng về trang chủ sau đăng xuất; các kiểm thử mã lỗi `401 Unauthorized` qua API trực tiếp được bao quát riêng tại Gate `pnpm security:api`. | Nhập trực tiếp các đường dẫn quản trị (`/dashboard`, `/admin/residents`) trên thanh địa chỉ URL khi chưa đăng nhập và xác nhận chuyển hướng về `/login`. | **`PENDING MANUAL`** |
| `UAT-SEC-02` | Cư dân (`resident`) | Cư dân cố gắng thao tác vượt quyền quản trị & Xuất dữ liệu | **`PARTIAL`** | Step 4 & Step 7 (lines 1243–1246, 1299–1306, 2090–2096, 2115–2122): Xác minh giao diện cư dân chỉ hiển thị các chức năng công dân, không có menu/nút quản trị; các kiểm thử mã lỗi `403 Forbidden` được kiểm chứng riêng tại Gate `pnpm security:api`. | Thử gửi request API duyệt cư dân hoặc gọi API xuất dữ liệu từ phiên cư dân để xác nhận backend từ chối với mã lỗi 403 Forbidden. | **`PENDING MANUAL`** |
| `UAT-SEC-03` | Tổ trưởng KP-01 | Tổ trưởng thao tác chéo khu phố (Cô lập dữ liệu địa bàn) | **`PARTIAL`** | Step 3, Step 5 & Step 9 (lines 408–410, 1466–1469, 2473–2485): Xác minh dữ liệu hiển thị và xuất ra chỉ giới hạn trong phạm vi Khu phố 1; các kiểm thử can thiệp chéo KP-02 nhận mã `403 Forbidden` được kiểm chứng tại Gate `pnpm security:api`. | Dùng tài khoản Tổ trưởng KP-01 thử gửi request cập nhật hồ sơ hoặc kiến nghị của KP-02 để xác nhận hệ thống chặn 403. | **`PENDING MANUAL`** |
| `UAT-SEC-04` | Tổ trưởng (`leader`) | Tổ trưởng truy cập Dashboard tổng quan Cán bộ phường | **`PARTIAL`** | Lines 404–410, 2187–2200: Xác minh phân định menu điều hướng giữa Tổ trưởng và Cán bộ phường; kiểm thử chặn truy cập API `/api/dashboard/ward-overview` với mã 403 được kiểm chứng tại Gate `pnpm security:api`. | Đăng nhập tài khoản Tổ trưởng, nhập đường dẫn Dashboard Cán bộ phường trên thanh địa chỉ để xác nhận giao diện chặn hiển thị. | **`PENDING MANUAL`** |
| `UAT-SEC-05` | Cư dân A (`resident`) | Kiểm soát quyền sở hữu kiến nghị & Chống IDOR | **`PARTIAL`** | Step 4 & Step 7 (lines 1347–1354, 2123–2178): Xác minh danh sách và chi tiết kiến nghị gắn đúng với cư dân tạo; kiểm thử chống IDOR (truy cập kiến nghị người khác trả về `404 Not Found`) được kiểm chứng tại Gate `pnpm security:api`. | Dùng tài khoản Cư dân A thử mở trực tiếp ID kiến nghị của Cư dân B trên URL để xác nhận nhận lỗi 404 Not Found. | **`PENDING MANUAL`** |

---

### Phần E: Đa Trình duyệt, Thiết bị Vật lý & Trải nghiệm (Browser, Device & UX) — 4 ca

| Mã UAT | Nhóm / Vai trò | Tên kịch bản kiểm thử | Bằng chứng Tự động | Bằng chứng Nguồn (`fullstack-role-flows.spec.ts`) | Hành động Kiểm thử Thủ công Còn lại | Đánh giá UAT |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `UAT-DEV-01` | QA & Cư dân | Kiểm thử trên Thiết bị Apple iOS Safari thực tế | **`NONE`** | Chưa có trong kịch bản E2E full-stack (yêu cầu thiết bị iPhone vật lý chạy iOS 16.4+ Safari gốc). | Thực hiện trên iPhone thật: kiểm tra bàn phím số OTP (`inputmode="numeric"`), vùng an toàn Safe Area / Dynamic Island, thanh địa chỉ URL co giãn và thao tác modal. | **`PENDING MANUAL`** |
| `UAT-DEV-02` | QA & Các vai trò | Kiểm thử trên Microsoft Edge & Google Chrome (Desktop) | **`PARTIAL`** | Lines 231–2542: Kịch bản full-stack chạy tự động trên Chromium desktop độ phân giải 1920x1080; chưa chạy trên trình duyệt Microsoft Edge thương mại và chưa kiểm tra phím Tab/Escape ARIA. | Mở ứng dụng trên Microsoft Edge bản thương mại trên Windows 1920x1080, kiểm tra điều hướng phím Tab / Escape và độ sắc nét font chữ. | **`PENDING MANUAL`** |
| `UAT-DEV-03` | QA & Các vai trò | Kiểm tra Bố cục Đáp ứng (Responsive) & Mục tiêu Cảm ứng (Touch Targets) | **`NONE`** | Không có assertion viewport 320px/768px trong kịch bản E2E full-stack này (kiểm thử responsive public shell được thực hiện riêng ở bộ `pnpm e2e`). | Thu nhỏ màn hình về 320px và 768px trên trình duyệt thật, kiểm tra diện tích chạm nút bấm $\ge 44 \times 44\text{ px}$ và đảm bảo không tràn ngang. | **`PENDING MANUAL`** |
| `UAT-DEV-04` | Đại diện Cư dân & Tổ trưởng | Kiểm tra Ngôn ngữ Tiếng Việt & Trải nghiệm Người dùng | **`PARTIAL`** | Lines 250–2540: Khẳng định tự động hàng loạt chuỗi tiếng Việt chuẩn mực (tiêu đề, nhãn, thông báo toast, nội dung báo cáo CSV); trải nghiệm người dùng thực tế cần con người đánh giá. | Mời đại diện Cư dân và Tổ trưởng dân phố trực tiếp thao tác để đánh giá độ thuận tiện, tính dễ hiểu của từ vựng hành chính đối với người lớn tuổi. | **`PENDING MANUAL`** |

---

## 4. Ghi nhận Kỹ thuật Trong Quá trình Chạy (Technical Runtime Observations)

Trong quá trình thực thi lệnh `pnpm e2e:fullstack` trên commit baseline `e917256`, hệ thống ghi nhận một cảnh báo phát sinh tại runtime như sau:

- **Loại cảnh báo**: Cảnh báo Console không gây lỗi (Non-failing Runtime Warning).
- **Vị trí ghi nhận**: Thành phần xem trước ảnh minh chứng tải lên (`Image preview for blob URI`).
- **Nội dung cảnh báo**: Một hình ảnh preview từ `blob:...` có thuộc tính `width` hoặc `height` được điều chỉnh tùy biến mà không khai báo đồng thời thuộc tính kích thước còn lại (hoặc tỉ lệ co giãn `aspect-ratio`).
- **Đánh giá Kỹ thuật ban đầu**: Cảnh báo không làm gián đoạn luồng kiểm thử; tải ảnh, preview và lưu kiến nghị đều hoàn thành thành công.
- **Xử lý trong vòng dry-run**: Component preview được chuyển sang ảnh `fill` trong khung kích thước tương đối, giữ `object-cover` và loại bỏ xung đột giữa kích thước intrinsic với `w-full`.
- **Xác minh sau xử lý**: Web lint, typecheck và 129/129 test đạt; hành trình full-stack đạt lại 1/1 và cảnh báo `blob:` không tái xuất hiện. Observation được đóng ở mức kỹ thuật, không được dùng để tự động kết luận PASS cho trải nghiệm hình ảnh trên thiết bị vật lý.

---

## 5. Ranh giới Kỹ thuật & Các Hạn chế Ngoại vi Chưa Kiểm chứng (External Limitations)

Để đảm bảo tính trung thực kỹ thuật tuyệt đối, biên bản chạy thử này xác nhận các hạng mục sau **nằm ngoài phạm vi chứng minh của kịch bản E2E tự động** và tiếp tục ở trạng thái chờ giải phóng (**PENDING**):

1. **Thiết bị Vật lý Thực tế (Physical Device Testing)**: Chưa kiểm chứng trên điện thoại iPhone vật lý chạy Apple iOS 16.4+ Safari gốc (`UAT-DEV-01`) và máy tính chạy Microsoft Edge thương mại (`UAT-DEV-02`).
2. **Kênh Viễn thông & Dịch vụ Đẩy Thực tế (Real Carrier SMS & Web Push)**: Môi trường chạy thử sử dụng Dev SMS Inbox / bộ nhớ mô phỏng; chưa kết nối cổng SMS Brandname thực tế và cặp khóa Web Push VAPID sản xuất.
3. **Khóa Bảo mật & Hạ tầng Sản xuất (Production Secrets & KMS)**: Hệ thống sử dụng development fallback keys trong môi trường sandbox; chưa kích hoạt cấu hình quản trị khóa KMS và secret của môi trường sản xuất thật.
4. **Hiệu năng Đường truyền Internet & Chứng chỉ Bảo mật (Internet Performance & TLS)**: Điểm số Google PageSpeed Insights ($\ge 80$), chứng chỉ SSL/TLS loại A+ trên Reverse Proxy công khai, giám sát Uptime 99% SLA và lưu trữ bản sao lưu ngoài máy chủ (Off-Host Backup) là các rào chắn ngoại vi cần đo lường trên môi trường live.
5. **Biên bản Ký kết của Các Bên Liên quan (Stakeholder Signatures)**: Chưa có sự tham gia và chữ ký xác nhận của đại diện Cư dân, Tổ trưởng dân phố và Cán bộ phường.

---

## 6. Hướng dẫn Chuyển tiếp Dữ liệu cho Điều phối viên UAT (Facilitator Next Steps)

Khi tổ chức phiên kiểm thử nghiệm thu người dùng thực tế, Điều phối viên UAT / QA Lead thực hiện theo quy trình chuẩn sau:

1. **Chuẩn bị Dữ liệu Giả lập (Synthetic Data Preparation)**:
   - Tham chiếu và sử dụng đúng các hồ sơ giả lập (synthetic personas) quy định tại Mục 2 của [Danh mục UAT](uat-checklist.md).
   - **Tuyệt đối không sử dụng thông tin cá nhân thật (No Real PII)** của cư dân hoặc cán bộ trong quá trình kiểm thử.
2. **Tiến hành Phiên Nghiệm thu Từng Vai trò**:
   - Mời đại diện từng vai trò (Cư dân, Tổ trưởng, Cán bộ) thực hiện lần lượt các bước trong kịch bản từ `UAT-RES-01` đến `UAT-DEV-04`.
   - Đối với 21 ca đã có bằng chứng tự động `FULL`, điều phối viên hướng dẫn người dùng tập trung đánh giá trải nghiệm giao diện và thao tác thực tế.
   - Đối với 13 ca `PARTIAL` và 5 ca `NONE`, điều phối viên giám sát chặt chẽ các hành động kiểm thử thủ công còn lại được nêu tại Mục 3.
3. **Ghi nhận Kết quả vào Danh mục UAT Chuẩn**:
   - Sao chép và ghi nhận kết quả thực tế vào từng ca trong tệp `docs/quality/uat-checklist.md`.
   - Đánh dấu chính xác `[X] PASS`, `[X] FAIL`, hoặc `[X] BLOCKED`.
   - Nếu phát sinh lỗi, điền thông tin vào Bảng theo dõi lỗi (`DEF-UAT-*`) với mức độ nghiêm trọng phù hợp.
4. **Hoàn tất Biên bản Ký kết Nghiệm thu**:
   - Sau khi hoàn thành toàn bộ 39 ca, tổng hợp số liệu vào Bảng tổng kết tại Mục 6 của `docs/quality/uat-checklist.md`.
   - Lấy chữ ký xác nhận bằng văn bản của Đại diện Cư dân, Đại diện Tổ trưởng, Đại diện Cán bộ Phường và Đội ngũ QA/Phát triển.
