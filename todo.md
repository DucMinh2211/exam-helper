# TODO

## Import ngân hàng câu hỏi từ DOCX

### Mục tiêu

Cho phép người dùng tải file DOCX lên, tự động nhận diện format và parse câu hỏi/đáp án. Những phần sai format, thiếu dữ liệu hoặc có độ tin cậy thấp phải được đưa vào màn hình kiểm tra để người dùng sửa và xác nhận trước khi import vào ngân hàng câu hỏi.

### Luồng người dùng

- [x] Thêm nút **Import DOCX** tại màn hình ngân hàng câu hỏi.
- [x] Cho phép chọn hoặc kéo-thả file `.docx`; kiểm tra loại file và giới hạn dung lượng.
- [x] Hiển thị tiến trình: đọc file → nhận diện format → parse → kiểm tra dữ liệu.
- [x] Hiển thị bản xem trước theo `Chủ đề → Bài → Phần → Câu hỏi`.
- [x] Đánh dấu rõ câu hỏi, lựa chọn hoặc đáp án bị thiếu, sai format hay có độ tin cậy thấp.
- [x] Cho phép người dùng sửa trực tiếp từng lỗi và xem nội dung DOCX gốc tương ứng.
- [ ] Có thao tác **Xác nhận** cho từng lỗi và **Xác nhận tất cả mục hợp lệ**.
- [x] Chỉ bật nút **Import** khi không còn lỗi bắt buộc chưa được xác nhận.
- [x] Hiển thị tổng kết trước khi import: số câu hợp lệ, số câu đã sửa, số câu bỏ qua và số cảnh báo còn lại.
- [ ] Import vào bank mới hoặc bank hiện tại theo lựa chọn của người dùng.

### Parser foundation

- [x] Tạo `DocumentModel` trung gian, giữ đúng thứ tự paragraph và table trong DOCX.
- [x] Tách `DocxReader` khỏi parser nghiệp vụ để có thể tái sử dụng cho nhiều format.
- [x] Định nghĩa interface `QuestionDocumentParser` gồm `id`, `detect()` và `parse()`.
- [x] Tạo parser registry để tự chọn parser có điểm nhận diện cao nhất.
- [x] Mỗi kết quả parse phải trả về `questions`, `warnings`, `confidence` và vị trí block nguồn.
- [x] Không tự đoán hoặc tự tạo đáp án khi dữ liệu nguồn bị thiếu/mơ hồ.
- [x] Chuẩn hóa khoảng trắng và các biến thể phổ biến nhưng vẫn lưu lại raw text để đối chiếu.

### Format đầu tiên: câu hỏi phía trên, bảng đáp án cuối DOCX

- [x] Đặt ID format: `DOCX_QUESTION_BANK_WITH_TRAILING_ANSWER_KEY_V1`.
- [x] Nhận diện các cấp `CHỦ ĐỀ`, `BÀI`, `PHẦN` dù khác chữ hoa/thường hoặc dấu câu.
- [x] Parse câu trắc nghiệm nhiều lựa chọn với các đáp án `A/B/C/D`.
- [x] Parse câu đúng–sai gồm các mệnh đề `a/b/c/d`.
- [x] Ghép các paragraph bị xuống dòng trong nội dung câu hỏi hoặc lựa chọn.
- [x] Nhận diện khu vực đáp án ở cuối tài liệu và nhóm bảng theo từng bài.
- [x] Ghép đáp án bằng khóa `(bài, loại câu hỏi, số câu)` thay vì chỉ dựa vào vị trí.
- [x] Chuẩn hóa các biến thể như `Câu 1.`/`Câu 1:`, `4.C`/`4C.`, `Đ`/`D`, `S`/`Sai`.
- [x] Cảnh báo khi trùng số câu, thiếu lựa chọn, thiếu đáp án, dư đáp án hoặc số câu không khớp bảng.
- [x] Kiểm thử parser bằng `exam-samples/file bộ đề sử 12.docx`.

### Màn hình validate và confirm

- [x] Phân loại trạng thái: `valid`, `warning`, `error`, `confirmed` và `skipped`.
- [x] Bộ lọc để chỉ xem các mục cần xử lý.
- [x] Hiển thị lý do cảnh báo và gợi ý sửa, không âm thầm thay đổi dữ liệu.
- [x] Cho phép sửa loại câu hỏi, số câu, nội dung, lựa chọn và đáp án.
- [x] Khi người dùng sửa, chạy validation lại ngay cho câu đó.
- [x] Lưu quyết định xác nhận trong phiên import để không mất khi chuyển bước.
- [x] Yêu cầu xác nhận rõ ràng nếu người dùng muốn bỏ qua câu lỗi.
- [x] Cho phép bỏ qua tất cả câu lỗi trong một thao tác, có xác nhận rõ ràng.
- [x] Không ghi vào IndexedDB trước bước xác nhận cuối cùng.
- [x] Import trong transaction; nếu có lỗi ghi dữ liệu thì rollback toàn bộ.

### Kiến trúc mở rộng và AI tùy chọn

- [x] Cho phép đăng ký parser mới mà không sửa parser hiện có.
- [x] Lưu `parserId` và phiên bản parser trong báo cáo import để truy vết.
- [x] Thêm fixture/test riêng cho mỗi format được hỗ trợ.
- [ ] Thiết kế `AiParserFallback` tùy chọn cho block không nhận diện được; parser quy tắc vẫn là mặc định.
- [ ] AI chỉ trả dữ liệu theo JSON Schema và mọi kết quả AI phải qua validation như parser thường.
- [ ] Không gửi toàn bộ tài liệu hoặc dữ liệu người dùng tới dịch vụ bên ngoài nếu chưa có sự đồng ý rõ ràng.

### Điều kiện hoàn thành

- [ ] File mẫu được parse thành đúng hai loại câu hỏi và ghép đúng bảng đáp án theo từng bài.
- [x] Mọi dữ liệu không chắc chắn đều xuất hiện trong màn hình review với vị trí nguồn tương ứng.
- [x] Không thể import khi còn lỗi bắt buộc chưa được sửa, xác nhận hoặc bỏ qua.
- [ ] Thêm một format DOCX mới chỉ cần tạo parser và fixture mới.
- [ ] Build, lint và các parser test đều chạy thành công.
