# Hướng dẫn Nghiệm thu Trình duyệt và Hiệu năng (Browser & Performance Acceptance)

Tài liệu này quy định ma trận kiểm thử tự động, ánh xạ bằng chứng kỹ thuật tới các yêu cầu phi chức năng (**SRS NFR-03**, **NFR-05**, **NFR-06**, **NFR-09**), và phân định rõ ràng ranh giới giữa kiểm thử tự động trong repository với các bước nghiệm thu thực tế bắt buộc trước khi go-live.

---

## 1. Ma trận Trình duyệt & Kích thước Màn hình Tự động (Automated Matrix)

Hệ thống kiểm thử tự động sử dụng **Playwright** để kiểm tra giao diện ứng dụng Web đã build ở chế độ production (`next start`) trên 6 cấu hình độc lập:

| Tên Project Playwright | Động cơ trình duyệt (Engine) | Độ phân giải (Viewport) | Chế độ | Mục đích kiểm chứng |
| :--- | :--- | :--- | :--- | :--- |
| `chromium-desktop-1920x1080` | Chromium | 1920 x 1080 | Desktop | Màn hình máy tính chuẩn độ phân giải Full HD |
| `chromium-mobile-320x568` | Chromium | 320 x 568 | Mobile | Màn hình di động nhỏ nhất (tiêu chuẩn iPhone SE 1st gen / Android compact) |
| `firefox-desktop-1920x1080` | Firefox (Gecko) | 1920 x 1080 | Desktop | Tương thích động cơ Mozilla Firefox trên máy tính |
| `firefox-mobile-320x568` | Firefox (Gecko) | 320 x 568 | Mobile | Bố cục responsive trên Firefox di động |
| `webkit-desktop-1920x1080` | WebKit | 1920 x 1080 | Desktop | Tương thích động cơ Apple WebKit trên máy tính (macOS Safari layout engine) |
| `webkit-mobile-320x568` | WebKit | 320 x 568 | Mobile | Đại diện hiển thị bố cục WebKit di động (iOS Safari engine proxy) |

### ⚠️ Tuyên bố Ranh giới Động cơ Trình duyệt (Engine Proxy Notice)

- **Đại diện Động cơ (Engine Proxies)**: Các trình duyệt chạy bởi Playwright (`chromium`, `firefox`, `webkit`) là các bản build kiểm thử của nhân động cơ trình duyệt.
- **Không thay thế thiết bị vật lý**: Kết quả kiểm thử thành công trên `chromium` và `webkit` **không cấu thành bằng chứng nghiệm thu hoàn chỉnh** cho:
  1. Trình duyệt **Microsoft Edge thương mại** (bao gồm các cấu hình chính sách bảo mật Group Policy, SmartScreen của doanh nghiệp).
  2. Thiết bị di động **Apple iOS Safari thực tế** (bao gồm quản lý bàn phím ảo, vùng an toàn tai thỏ/Dynamic Island `env(safe-area-inset)`, thanh điều hướng URL động co giãn của Safari, và cử chỉ cuộn quán tính iOS).

---

## 2. Ánh xạ Yêu cầu Phi chức năng & Bằng chứng Tự động

| Yêu cầu SRS | Nội dung yêu cầu | Bằng chứng kiểm thử tự động (`apps/web/e2e/public-home.spec.ts`) | Giới hạn & Điểm lưu ý |
| :--- | :--- | :--- | :--- |
| **NFR-03**<br>*(Hiệu năng tải trang)* | - Trang tải nhanh, thời gian tải hoàn tất trong ngưỡng quy định.<br>- Ngân sách tải trang shell <= 3 giây.<br>- PageSpeed Insights >= 80.<br>- API latency p95 < 500ms. | - Đo lường thời gian từ lúc gửi yêu cầu tới khi dựng xong giao diện công khai chính (`hero heading`) trên bản build production Next.js.<br>- Khẳng định nghiêm ngặt thời gian tải `<= 3000 ms` (3.0 giây). | - **Lab Smoke Test**: Đo lường cục bộ với boundary mock API, không có độ trễ đường truyền Internet và tải đồng thời.<br>- **Chưa chứng minh**: Điểm Google PageSpeed Insights `>= 80` trên production hoặc p95 API `< 500ms` dưới tải thực tế. |
| **NFR-05**<br>*(Tương thích trình duyệt)* | - Hỗ trợ Chrome, Edge, Safari từ iOS 16.4 trở lên và Firefox phiên bản mới nhất. | - Chạy thành công 100% kịch bản kiểm thử trên cả 3 họ động cơ độc lập: Chromium, Firefox và WebKit. | - Cần bổ sung kiểm thử xác nhận trực tiếp trên Chrome, Microsoft Edge và Safari iOS 16.4+ thực tế. |
| **NFR-06**<br>*(Thiết kế Responsive & Mobile-First)* | - Bố cục tối ưu trên cả di động (từ 320px) và máy tính (1920px).<br>- Không bị vỡ khung hoặc tràn ngang màn hình. | - Đo lường `scrollWidth` và `clientWidth` của toàn bộ tài liệu.<br>- Khẳng định `scrollWidth <= clientWidth` (không xuất hiện thanh cuộn ngang hay tràn nội dung ở 320px và 1920px). | - Kiểm thử bố cục hình học, không thay thế kiểm tra cảm ứng thực tế (touch target) trên các dòng ngón tay người dùng khác nhau. |
| **NFR-09**<br>*(Ngôn ngữ & trải nghiệm)* | - Giao diện hoàn toàn bằng tiếng Việt, hiện đại, thân thiện và ưu tiên mobile.<br>- Nghiệm thu thực tế với Tổ trưởng. | - Kiểm tra thuộc tính `html[lang="vi"]` và nội dung tiếng Việt đặc trưng.<br>- Kiểm tra bổ sung khả năng mở/đóng hộp thoại qua control có tên truy cập và phím Escape. | - Automation không thay thế nghiệm thu trải nghiệm với Tổ trưởng; kiểm thử trợ năng là bằng chứng bổ sung, không phải chỉ số SRS riêng. |

---

## 3. Danh mục Nghiệm thu Ngoài Repository (Manual & Provider Acceptance Checklist)

Trước Go-Live, đơn vị vận hành và QA phải thực hiện các chỉ số được SRS yêu cầu;
các mục ghi rõ "khuyến nghị" giúp tăng độ tin cậy nhưng không được coi là yêu cầu SRS mới.

### 1. Nghiệm thu Điểm số Google PageSpeed Insights (NFR-03)
- [ ] Chạy kiểm tra Google PageSpeed Insights trên URL môi trường Staging/Production thực tế.
- [ ] Đạt điểm Performance `>= 80` trên cả hai chế độ Di động (Mobile) và Máy tính (Desktop).
- [ ] Khuyến nghị: ghi nhận Core Web Vitals để hỗ trợ chẩn đoán nếu PageSpeed không đạt; SRS không đặt ngưỡng riêng cho từng chỉ số này.

### 2. Nghiệm thu Độ trễ API p95 Dưới Tải (NFR-03)
- [ ] Thiết lập công cụ giám sát hiệu năng ứng dụng (APM / OpenTelemetry / Prometheus).
- [ ] Thực hiện bài kiểm thử tải mô phỏng lưu lượng giờ cao điểm của phường (nhiều cư dân cùng đăng nhập và gửi phản ánh).
- [ ] Đo lường và xác nhận độ trễ phản hồi p95 của toàn bộ API endpoints `< 500ms`.

### 3. Nghiệm thu Trên Thiết bị Vật lý Thực tế (NFR-05 & NFR-06)
- [ ] **Apple iOS**: Kiểm thử Safari gốc trên iOS 16.4 trở lên, bao gồm viewport iPhone SE theo NFR-05/NFR-06. Khuyến nghị kiểm tra thêm bàn phím OTP, safe area và thanh địa chỉ động.
- [ ] **Chrome**: Kiểm thử Chrome chính thức ở viewport mobile 320px và desktop 1920px; Android/Samsung Internet là phạm vi khuyến nghị bổ sung.
- [ ] **Máy tính để bàn**: Kiểm thử trên Microsoft Edge chính thức (Windows) và Safari (macOS).

### 4. Nghiệm thu Trợ năng Người dùng Thực tế (NFR-09)
- [ ] Thử nghiệm điều hướng hoàn toàn bằng bàn phím (`Tab`, `Shift+Tab`, `Enter`, `Escape`, `Space`) không dùng chuột.
- [ ] Thử nghiệm với trình đọc màn hình tiếng Việt (NVDA trên Windows, VoiceOver trên iOS/macOS, TalkBack trên Android).
- [ ] Nghiệm thu trải nghiệm với Tổ trưởng theo NFR-09; mở rộng sang Cư dân và Cán bộ là khuyến nghị bổ sung.

---

## 4. Hướng dẫn Thực thi Kiểm thử

### Cài đặt Trình duyệt Playwright (Chỉ tải 3 động cơ cần thiết)

```bash
pnpm exec playwright install --with-deps chromium firefox webkit
```

### Chạy Toàn bộ Bộ Kiểm thử E2E (Tự động build và test 6 dự án)

```bash
pnpm e2e
```

### Chạy Kiểm thử với Giao diện Trực quan (Playwright UI Mode)

```bash
pnpm exec playwright test --ui
```

### Chạy Riêng cho Từng Động cơ / Kích thước

```bash
# Chỉ chạy Mobile WebKit (iOS Safari proxy)
pnpm exec playwright test --project=webkit-mobile-320x568

# Chỉ chạy Desktop Chromium
pnpm exec playwright test --project=chromium-desktop-1920x1080
```

### Xem Báo cáo Chi tiết (HTML Report & Traces khi thất bại)

```bash
pnpm exec playwright show-report
```

Toàn bộ vết thực thi (trace), ảnh chụp lỗi (screenshot) và báo cáo HTML được tự động ghi nhận khi có kiểm thử thất bại và được loại trừ khỏi Git qua tệp `.gitignore`.
