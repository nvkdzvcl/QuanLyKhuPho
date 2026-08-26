# Sổ tay Quan sát Vận hành & Chỉ số Tiến trình (Operational Observability Runbook)

Tài liệu này quy định cấu hình, mô hình dữ liệu, cơ chế phân quyền, chính sách bảo vệ dữ liệu riêng tư (No-PII) và ranh giới bằng chứng kỹ thuật (**Evidence Boundaries**) cho hệ thống quan sát vận hành tiến trình cục bộ (**Process-Local Operational Observability**) trong dự án **QuanLyKhuPho**.

---

## 1. Mục đích & Phạm vi Quan sát (Purpose & Scope)

- **Mục đích**: Cung cấp tín hiệu chẩn đoán nhanh, nhẹ và an toàn về độ tin cậy của máy chủ API và tỷ lệ gửi thông báo Web Push trực tiếp tại từng tiến trình đang chạy, phục vụ công tác giám sát của Cán bộ phường (`officer`) và kỹ sư vận hành.
- **Phạm vi kỹ thuật**:
  - Endpoint quản trị chỉ dành riêng cho vai trò Cán bộ phường: `GET /api/observability/operational-metrics`.
  - Bộ đếm tổng hợp yêu cầu HTTP với độ đo tối giản (Low-cardinality aggregates: tổng số request, số lỗi 5xx, độ trễ trung bình và tối đa).
  - Bộ đếm vòng đời phân phát Web Push (số lượt thử, thành công, thất bại, dọn dẹp subscription hết hạn và tỷ lệ thành công phần trăm).
  - Thời gian hoạt động liên tục (`uptimeSeconds`) và thời điểm khởi động tiến trình (`startedAt`).

---

## 2. ⚠️ Tuyên bố Ranh giới Bằng chứng Kỹ thuật (Evidence Boundary Notice)

Các chỉ số vận hành cung cấp qua endpoint `GET /api/observability/operational-metrics` là **tín hiệu chẩn đoán cục bộ trong bộ nhớ tiến trình (Process-Local In-Memory Diagnostics)**. Các chỉ số này được phân định ranh giới rõ ràng theo đặc tả SRS:

1. **Ranh giới Đo lường Độ sẵn sàng 99% Uptime (SRS NFR-08 Boundary)**:
   - `uptimeSeconds` và `startedAt` chỉ phản ánh thời gian sống liên tục của **một tiến trình Node.js cụ thể**.
   - Chỉ số này **KHÔNG** chứng minh cam kết SLA độ sẵn sàng 99% cho toàn bộ hệ thống sản xuất.
   - Để đo lường SLA 99% chính thức, hệ thống bắt buộc phải có công cụ giám sát ngoại vi độc lập (Synthetic Uptime Probes / Blackbox Exporter / Ping Monitoring) theo dõi xuyên suốt toàn bộ chuỗi hạ tầng (DNS, Load Balancer, SSL Termination, Máy chủ API, Cơ sở dữ liệu PostgreSQL, Bộ nhớ đệm Redis, Hàng đợi RabbitMQ).

2. **Ranh giới Tỷ lệ Phân phát Web Push 90% (SRS NFR-04 Boundary)**:
   - `push.successRatePercent` phản ánh tỷ lệ bản tin Web Push được máy chủ trung gian (Google FCM, Apple Web Push, Mozilla Autopush) **chấp nhận phân phát (Handshake 201 Created)** trong tiến trình hiện tại.
   - Chỉ số này **KHÔNG** đại diện cho tỷ lệ người dùng thực tế mở máy hoặc nhìn thấy thông báo trên màn hình thiết bị đầu cuối (do thiết bị có thể tắt nguồn, mất sóng, ngắt kết nối mạng, bật chế độ Không làm phiền, hoặc do hệ điều hành hạn chế chạy ngầm).
   - Cơ chế Web Push hoạt động theo nguyên tắc **nỗ lực tối đa (Best-Effort)**; toàn bộ thông báo quan trọng luôn được lưu trữ bền vững trong cơ sở dữ liệu và hiển thị qua danh sách thông báo trong ứng dụng (**Durable In-App Fallback**).

3. **Ranh giới Đo lường Độ trễ API (SRS NFR-03 Boundary)**:
   - `http.averageLatencyMs` và `http.maxLatencyMs` là các giá trị trung bình và cực đại đơn giản tính từ khi request vào Interceptor đến khi hoàn tất.
   - Các giá trị này phục vụ chẩn đoán tức thời với overhead cực thấp, **KHÔNG** thay thế các chỉ số phân vị chuẩn $p95 < 500\text{ ms}$ thu thập từ hệ thống APM chuyên dụng hoặc bộ kiểm thử hiệu năng xác định `pnpm perf:api`.

4. **Giới hạn Khởi động lại & Đa Tiến trình (Restart & Multi-Instance Limitations)**:
   - Toàn bộ bộ đếm là đơn điệu tăng dần trong bộ nhớ và sẽ **tự động đặt lại về 0 khi tiến trình khởi động lại (restart/deploy/crash)**.
   - Trong môi trường triển khai nhiều bản sao (Multi-Instance / Cluster / Kubernetes Pods), mỗi tiến trình lưu trữ một snapshot riêng biệt; endpoint trả về số liệu của tiến trình xử lý request đó. Cần có bộ thu thập dữ liệu tập trung ngoại vi (như Prometheus / OpenTelemetry) để scrape và tổng hợp toàn cụm.

---

## 3. Chính sách Bảo vệ Quyền riêng tư Tuyệt đối (No-PII Policy - SRS NFR-07)

Hệ thống tuân thủ nguyên tắc bảo mật và quyền riêng tư theo thiết kế (Privacy by Design):

- **Không lưu nhãn chi tiết (Zero-Cardinality / No Labels)**: Tuyệt đối không lưu trữ đường dẫn URL, route pattern, query params, headers, cookie, hoặc IP của người dùng trong bộ đếm chỉ số.
- **Không lưu dữ liệu định danh (Zero-PII)**: Tuyệt đối không ghi nhận số điện thoại, số CCCD, họ tên, mã tài khoản, mã khu phố, mã OTP, session token, hay nội dung thông báo.
- **Không rò rỉ bí mật Web Push**: Không bao giờ truyền endpoint Web Push của trình duyệt, khóa công khai `p256dh`, khóa bí mật `auth`, hay mã lỗi chi tiết vào các bộ đếm chỉ số.
- **Bảo toàn phản hồi lỗi**: Bộ thu thập Interceptor ghi nhận mã trạng thái 5xx mà không thay đổi cấu trúc phản hồi lỗi, không nuốt lỗi (exception swallowing) và không kéo dài độ trễ của request.

---

## 4. Chi tiết Endpoint & Cấu trúc Dữ liệu (API Specification)

### Thông tin Endpoint

- **Phương thức**: `GET`
- **Đường dẫn**: `/api/observability/operational-metrics`
- **Quyền hạn truy cập**: Chỉ dành riêng cho Cán bộ phường (`UserRole.OFFICER`).
- **Mã HTTP kiểm soát**:
  - `401 UNAUTHORIZED`: Người dùng chưa đăng nhập hoặc cookie phiên không hợp lệ.
  - `403 FORBIDDEN`: Người dùng có vai trò Cư dân (`resident`) hoặc Trưởng khu phố (`leader`).
  - `200 OK`: Cán bộ phường (`officer`) truy cập thành công.

### Cấu trúc Phản hồi (JSON Schema)

```json
{
  "success": true,
  "data": {
    "startedAt": "2026-08-26T12:00:00.000Z",
    "uptimeSeconds": 3600,
    "http": {
      "totalRequests": 1250,
      "serverErrorRequests": 2,
      "averageLatencyMs": 42.15,
      "maxLatencyMs": 312.4
    },
    "push": {
      "attempts": 80,
      "successes": 76,
      "failures": 4,
      "stalePruned": 3,
      "successRatePercent": 95.0
    }
  },
  "timestamp": "2026-08-26T13:00:00.000Z"
}
```

### Ý nghĩa các trường dữ liệu

| Nhóm trường | Tên trường | Kiểu dữ liệu | Ý nghĩa & Quy tắc tính toán |
| :--- | :--- | :--- | :--- |
| **Gốc** | `startedAt` | `string` (ISO 8601) | Thời điểm tiến trình Node.js bắt đầu chạy. |
| **Gốc** | `uptimeSeconds` | `number` | Số giây tiến trình đã hoạt động liên tục (`Math.floor(process.uptime())`). |
| **HTTP** | `totalRequests` | `number` | Tổng số lượng request HTTP đã hoàn tất xử lý qua máy chủ. |
| **HTTP** | `serverErrorRequests` | `number` | Số lượng request kết thúc với mã lỗi phía máy chủ (HTTP 5xx). |
| **HTTP** | `averageLatencyMs` | `number` | Độ trễ xử lý trung bình (ms), làm tròn 2 chữ số thập phân ($0$ nếu chưa có request). |
| **HTTP** | `maxLatencyMs` | `number` | Độ trễ xử lý lớn nhất từng ghi nhận (ms) trong vòng đời tiến trình. |
| **Push** | `attempts` | `number` | Tổng số subscription Web Push được tìm thấy và bắt đầu xử lý; lỗi giải mã khóa vẫn là một lần thử thất bại. |
| **Push** | `successes` | `number` | Số lượt gửi Web Push được gateway tiếp nhận thành công. |
| **Push** | `failures` | `number` | Số lượt gửi Web Push thất bại (lỗi giải mã khóa, lỗi mạng, lỗi 4xx/5xx). |
| **Push** | `stalePruned` | `number` | Số subscription hết hạn/vô hiệu (`404`/`410`) đã được xóa thành công khỏi DB. |
| **Push** | `successRatePercent` | `number \| null` | Tỷ lệ thành công phần trăm ($\frac{\text{successes}}{\text{attempts}} \times 100$). Trả về `null` khi `attempts = 0` để tránh hiểu sai tỷ lệ. |

---

## 5. Hướng dẫn Dành cho Đội ngũ Vận hành (Operator Runbook)

### 1. Kiểm tra Chỉ số từ Dòng lệnh (CLI / cURL)

Cán bộ phường hoặc kỹ sư vận hành có thể kiểm tra nhanh trạng thái qua cURL với cookie phiên hợp lệ:

Ví dụ HTTP dưới đây chỉ dành cho môi trường phát triển loopback. Môi trường triển khai thực tế bắt buộc sử dụng HTTPS theo SRS NFR-01.

```bash
curl -X GET "http://localhost:4000/api/observability/operational-metrics" \
  -H "Accept: application/json" \
  --cookie "qlkp_session=<session_cookie_of_officer>"
```

### 2. Tiêu chí Diễn giải & Cảnh báo Sớm (Operational Signals)

Khi kiểm tra chỉ số định kỳ, người vận hành cần lưu ý các dấu hiệu sau:

| Tín hiệu chẩn đoán | Cách đối chiếu | Hành động xử lý đề xuất |
| :--- | :--- | :--- |
| **Lỗi 5xx (`serverErrorRequests`)** | SRS không đặt ngưỡng phần trăm riêng; cần theo dõi xu hướng bằng hệ thống thu thập ngoài tiến trình. | Khi số lỗi tăng liên tục, kiểm tra log máy chủ và trạng thái PostgreSQL, Redis, RabbitMQ. |
| **Độ trễ (`averageLatencyMs`, `maxLatencyMs`)** | Chỉ dùng chẩn đoán tức thời; tiêu chí SRS NFR-03 là p95 dưới 500 ms và được kiểm chứng riêng bằng `pnpm perf:api` hoặc APM production. | Kiểm tra CPU, bộ nhớ, kết nối hạ tầng và truy vấn CSDL khi xu hướng độ trễ tăng. |
| **Tỷ lệ gửi Web Push (`successRatePercent`)** | SRS NFR-04 yêu cầu từ 90% trở lên; chỉ đánh giá khi có mẫu gửi đại diện, không dùng giá trị `null`. | Nếu dưới 90%, kiểm tra VAPID keys và kết nối Internet tới các Web Push gateway. |
| **Dọn dẹp Subscription (`stalePruned`)** | SRS không đặt ngưỡng riêng; đây là tập con các lần gửi thất bại 404/410 đã xóa subscription thành công. | Khi tăng bất thường, kiểm tra thay đổi trình duyệt/thiết bị và vòng đời subscription. |

### 3. Quy trình Khi Tỷ lệ Web Push Giảm Mạnh

1. Kiểm tra cấu hình biến môi trường `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` có đầy đủ và hợp lệ không.
2. Kiểm tra tường lửa (Firewall / Egress Rules) của máy chủ có cho phép kết nối HTTPS ra các cổng push của Google, Apple và Mozilla không.
3. Xác nhận rằng hệ thống thông báo trong ứng dụng vẫn hoạt động bình thường (`GET /api/notifications`), đảm bảo cư dân không bị mất thông tin quan trọng.
