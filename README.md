# N2 Goi

Web app flashcard mobile-first cho 1.045 từ vựng JLPT N2. App dùng HTML, TailwindCSS đã biên dịch và JavaScript thuần; không có dependency runtime hoặc request bên thứ ba.

## Chạy app

```bash
npm install
npm run build
npm run serve
```

Mở `http://localhost:4173`. Service worker chỉ hoạt động trên HTTPS hoặc localhost. Khi triển khai, có thể đưa toàn bộ thư mục lên bất kỳ static host nào.

## Cập nhật dữ liệu

Chỉnh `tu_vung_tat_ca.csv`, sau đó chạy:

```bash
npm run build:data
```

Script sẽ kiểm tra encoding, header, số cột, mặt trước/nghĩa trống, tổng số thẻ và tạo lại `src/data.generated.js`.

## Kiểm thử

```bash
npm test
npm run test:browser
```

Browser test chạy trên Chromium mobile và WebKit/iPhone, gồm viewport 320 px, lưu tiến độ, dark mode, hoàn tác, tổng kết và cache offline.

Trên máy tính: dùng `←` cho Chưa nhớ, `→` cho Đã nhớ, `↑`/`↓` hoặc `Space` để lật thẻ, `Backspace` để quay lại thẻ trước và `Esc` để về danh sách.
