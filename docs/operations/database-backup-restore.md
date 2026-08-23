# Sổ tay sao lưu và phục hồi PostgreSQL

Tài liệu này mô tả công cụ vận hành có trong repository và các bước còn phải cấu
hình ở môi trường triển khai. Phạm vi trực tiếp là yêu cầu sao lưu định kỳ của
**SRS NFR-08**. Các NFR-03, NFR-05, NFR-06 và NFR-09 được kiểm chứng bởi quy
trình hiệu năng, trình duyệt, responsive và nghiệm thu người dùng riêng.

## 1. Phạm vi công cụ

Repository cung cấp hai lệnh dùng PostgreSQL 16 trong service postgres của
Docker Compose:

~~~bash
# Tạo bản sao lưu custom format vào backups/
pnpm db:backup

# Chỉ đọc và kiểm tra TOC; không thay đổi cơ sở dữ liệu
pnpm db:restore -- --file=backups/<ten-tep>.dump
~~~

Lệnh sao lưu chạy pg_dump -Fc, ghi vào một tệp tạm duy nhất và chỉ đổi tên
thành .dump sau khi tiến trình thành công và tệp có chữ ký PGDMP. Nếu lỗi,
chương trình chỉ dọn tệp tạm do chính lần chạy đó tạo ra.

Lệnh db:restore mặc định chỉ chạy pg_restore --list. Phục hồi thực tế là
thao tác phá hủy và chỉ được mở khi có đồng thời:

~~~bash
node scripts/postgres-restore.mjs \
  --file=backups/<ten-tep>.dump \
  --db=quanlykhupho \
  --confirm-destructive \
  --confirm-database=quanlykhupho
~~~

Giá trị --confirm-database phải khớp chính xác với --db. Không chạy lệnh
phục hồi thực tế trên production trước khi dừng luồng ghi, xác nhận bản sao lưu
gần nhất và có kế hoạch quay lui.

## 2. Lịch sao lưu đề xuất

SRS chỉ yêu cầu có sao lưu định kỳ, không quy định RPO, RTO hay thời hạn lưu.
Trước khi vận hành production, chủ hệ thống phải phê duyệt các giá trị này. Điểm
khởi đầu đề xuất:

| Hạng mục | Giá trị khởi đầu đề xuất |
| --- | --- |
| Logical backup | Hằng ngày vào giờ ít lưu lượng |
| Bản hằng ngày | Giữ 30 ngày |
| Bản hằng tuần | Giữ 12 tuần |
| Bản hằng tháng | Giữ 12 tháng |
| Kiểm tra pg_restore --list | Sau mỗi lần sao lưu |
| Diễn tập phục hồi cô lập | Mỗi quý và sau migration lớn |

Các giá trị trên là chính sách đề xuất, không phải cấu hình tự động bởi repository.
Scheduler của nền tảng triển khai phải gọi pnpm db:backup, kiểm tra mã thoát và
chỉ đánh dấu thành công sau khi db:restore ở chế độ validation trả về mã 0.

## 3. Lưu trữ ngoài máy chủ

Không để bản sao duy nhất trên cùng ổ đĩa hoặc cùng máy chủ PostgreSQL. Quy trình
triển khai phải:

1. Mã hóa bản .dump bằng khóa do hệ thống quản lý khóa kiểm soát.
2. Truyền bản đã mã hóa tới kho off-host bằng TLS.
3. Bật versioning, lifecycle/retention và quyền truy cập tối thiểu trên kho đích.
4. Không lưu khóa mã hóa trong repository, log scheduler hoặc cùng thư mục backup.
5. Xóa bản cục bộ theo chính sách đã duyệt chỉ sau khi xác minh bản off-host.

Repository chưa cấu hình object storage, KMS, scheduler hoặc lifecycle vì các
giá trị này phụ thuộc nhà cung cấp và môi trường triển khai.

## 4. Diễn tập phục hồi

Phục hồi phải diễn ra trong một PostgreSQL sandbox cô lập, không dùng database
production. Chuẩn bị một Compose file riêng có service PostgreSQL tương thích,
tạo database đích rỗng, rồi trỏ CLI tới đúng file đó:

~~~bash
node scripts/postgres-restore.mjs \
  --file=backups/<ten-tep>.dump \
  --compose-file=docker/<compose-sandbox>.yml \
  --service=postgres \
  --db=<database-sandbox> \
  --confirm-destructive \
  --confirm-database=<database-sandbox>
~~~

Compose sandbox và database đích phải tồn tại trước khi chạy; repository không
tự tạo hoặc tự xóa chúng. Sau khi phục hồi:

- chạy migration/schema validation tương ứng với phiên bản bản sao lưu;
- kiểm tra số lượng bản ghi và các ràng buộc khóa ngoại quan trọng;
- xác minh dữ liệu mã hóa có thể được ứng dụng đọc bằng khóa đúng môi trường;
- ghi lại thời gian, người thực hiện, phiên bản bản sao lưu và kết quả;
- hủy sandbox theo quy trình của môi trường sau khi bằng chứng đã được lưu.

## 5. Giám sát và trách nhiệm

Trước khi go-live phải gán rõ người sở hữu cho scheduler, kho off-host, khóa mã
hóa và diễn tập phục hồi. Cảnh báo tối thiểu nên theo dõi:

- lần sao lưu gần nhất thất bại hoặc quá hạn;
- kích thước bản sao lưu thay đổi bất thường;
- validation TOC thất bại;
- sao chép off-host thất bại;
- diễn tập phục hồi quá hạn hoặc không đạt.

Không coi việc tạo được tệp .dump là bằng chứng phục hồi thành công. Bằng chứng
nghiệm thu NFR-08 cần gồm lịch sử scheduler, bản sao off-host và biên bản diễn tập.

## 6. Giới hạn

- CLI hiện bao quanh Docker Compose, không thay thế backup/PITR do managed database
  cung cấp.
- Chữ ký PGDMP và pg_restore --list phát hiện tệp sai định dạng hoặc hỏng rõ
  ràng, nhưng không thay thế một lần phục hồi sandbox hoàn chỉnh.
- Repository không tự động đạt uptime 99%; uptime còn phụ thuộc kiến trúc triển
  khai, giám sát, quy trình sự cố và dịch vụ hạ tầng.
