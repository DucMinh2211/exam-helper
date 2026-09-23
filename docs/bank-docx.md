# Import và export ngân hàng DOCX

Trong Bank, chọn **Import DOCX**, kiểm tra các câu được nhận diện rồi xác nhận import.

- Đáp án trắc nghiệm được nhận từ gạch chân hoặc chữ đỏ ở bất kỳ phần nào của lựa chọn, kể cả chỉ chữ A/B/C/D. Chữ đỏ trong đề bài và khoảng trắng không được tính là đáp án.
- Hỗ trợ nhiều lựa chọn cùng dòng, nhãn tự động của Word, bảng đáp án theo bài và các bảng Đúng/Sai `Câu | Lệnh hỏi | Đáp án`.
- Nhận câu dạng `Câu 1.`, `Câu 1:`, `1.`, `1)`. Đề hoàn toàn không có nhãn/số câu chưa được tự động phân đoạn. Các tiêu đề Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao trở thành tag cho các câu bên dưới, đến khi đổi mức độ/bài/phần.
- Trong Bank có bộ lọc theo từ khóa (không bắt buộc gõ dấu), loại câu và tag/mức độ; các điều kiện được áp dụng đồng thời.
- Bấm **Sửa** để mở khung chỉnh sửa bên phải. Có nút **Lưu & câu tiếp**, điều hướng theo danh sách đang lọc, lựa chọn đáp án rõ ràng và gợi ý tags. Đóng khung giữ nguyên bộ lọc/vị trí danh sách; thay đổi chưa lưu được hỏi trước khi bỏ.
- Câu thiếu đáp án, thiếu lựa chọn hoặc có nhiều lựa chọn được đánh dấu cần được sửa hoặc bỏ qua trong review. Không suy đoán đáp án từ kiến thức môn học.

**Export DOCX** có trong Bank và menu ngân hàng ở trang chính.

- Mỗi lần import lưu file gốc cùng liên kết đến câu hỏi trong IndexedDB, trong cùng transaction với các câu được import. Nguồn vẫn còn sau khi tải lại trang.
- Một nguồn: tải DOCX dựa trên gói tài liệu gốc, cập nhật nội dung, lựa chọn và đáp án hiện tại. Bản xuất bổ sung định danh ẩn và dòng tags để nhập lại; các thành phần không liên quan được giữ nguyên.
- Nhiều nguồn: tải ZIP chứa từng DOCX để giữ riêng font, ảnh, header/footer và thiết lập trang của mỗi tài liệu.
- Câu bị bỏ qua khi import hoặc bị xóa khỏi Bank được loại khỏi bản xuất. Câu mới được thêm cuối tài liệu; khi có nhiều nguồn, câu mới nằm trong `Cau_hoi_bo_sung.docx`.
- Khi đổi loại câu hoặc sửa cấu trúc lựa chọn bị lỗi, câu đó được dựng lại tại vị trí cũ; các phần khác vẫn dùng tài liệu nguồn. Nội dung dài hơn có thể làm thay đổi số trang.
- DOCX xuất ra thêm/cập nhật một dòng `Tags: ...` bên dưới mỗi câu. Import lại sẽ lấy dòng này làm tag hiện tại, kể cả `Tags:` trống để xóa hết tag; không nhân đôi dòng tag. Tag có dấu phẩy/chấm phẩy được ghi dạng danh sách JSON để không bị tách nhầm. File nguồn trên máy không bị ghi đè.
- Bank cũ hoặc tạo thủ công chưa có nguồn DOCX sẽ xuất theo mẫu Word mặc định. Muốn giữ định dạng cũ cần import lại DOCX gốc. JSON backup mang theo nguồn và ánh xạ câu hỏi; Excel không mang theo định dạng DOCX.

**Nhập lại file đã sửa**

- Chọn **Cập nhật thay đổi** trong Import DOCX. File đã xuất từ Bank được tự nhận diện bằng bookmark ẩn và thông tin nguồn trong DOCX. Câu cũ giữ ID, câu mới được thêm; nhập lại 59 câu không thành 118 câu.
- Trước khi áp dụng, màn hình đối chiếu báo câu mới/cập nhật/giữ nguyên và các trường đã đổi. Đối chiếu bị trùng phải được xử lý hoặc bỏ qua.
- Định danh đi theo câu khi đổi số hoặc di chuyển cả câu trong Word. Nếu bookmark bị xóa, cần kiểm tra lại đối chiếu. Với file cũ chưa có định danh, chọn đúng file nguồn: hệ thống đối chiếu theo bài, loại và số câu, vì vậy tránh đổi các thông tin này trước lần nhập cập nhật đầu tiên.
- Sửa `Tags: Nhận biết, Ôn tập` trong Word để thay tags; để `Tags:` trống để xóa hết. Xóa cả dòng tags khi cập nhật sẽ giữ tags đang có trong Bank.
- Câu vắng trong file hoặc bị bỏ qua không bị xóa khỏi Bank. Chế độ **Thêm thành câu mới** vẫn có sẵn khi chủ động muốn tạo bản sao.
- File nguồn mới và các cập nhật câu hỏi được lưu trong cùng transaction; nếu lưu lỗi thì toàn bộ lần nhập được rollback.

Kiểm thử: `npm test`. Bộ test gồm nhận diện 11 mẫu SGK 12, vòng import/export, cập nhật không nhân đôi, sửa/xóa tags trong DOCX, giữ nguyên các thành phần DOCX không sửa, cập nhật bảng đáp án và rollback khi không lưu được nguồn.
