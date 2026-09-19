# 🛡️ Social Shield: Anti-Ragebait, Scam, Seeding & Monk Mode

> Tiện ích mở rộng AI bảo vệ người dùng mạng xã hội toàn diện: **Làm mờ bài viết kích động/Rage-bait**, **chặn bẫy lừa đảo/lùa gà tài chính**, **lọc Goon-bait / Tu tập (Monk Mode)**, và **tự động thu gọn comment seeding/bot clone** trên **Threads (`threads.com` & `threads.net`)**, **Facebook**, và **𝕏 (Twitter)** — hỗ trợ tiếng Việt và tiếng Anh mượt mà bằng mô hình **Jev Zero-Shot AI** ([classifier.dev](https://classifier.dev)).

---

## 🌟 4 Lớp Bảo Vệ Toàn Diện (4-in-1 Protection)

* 🚨 **Lớp 1: Chặn Kích động Phẫn nộ (Anti-Ragebait & Drama)**:
  - Tự động nhận diện và làm mờ các bài viết câu war, tạo drama, kích động thù ghét để bảo vệ tâm lý người đọc.
  - Kèm hộp cảnh báo đỏ và nút *"Reveal post / Re-blur"* tiện lợi.
* 🛑 **Lớp 2: Chặn Bẫy Lừa Đảo (Anti-Scam & Financial Fraud)**:
  - Phát hiện các bài viết tuyển CTV xem TikTok/gõ văn bản lừa cọc, kéo nhóm Telegram/Zalo crypto cam kết lãi khủng, app vay nặng lãi, mạo danh ngân hàng.
  - Làm mờ bài viết và hiển thị dấu hiệu cảnh báo chi tiết.
* 🧘 **Lớp 3: Chế độ Tu Tập & Chặn Pop-up Reels (Monk Mode & Facebook Reels Shield)**:
  - Tự động quét và làm mờ mọi hình ảnh, video có phụ nữ / khoe thân / goonbait / thirst-traps nhằm duy trì sự tập trung tối đa, cai nghiện dopamine độc hại.
  - **Chặn triệt để Pop-up Reels trên Facebook**: Tự động phát hiện hộp thoại Pop-up Reels (`role="dialog"`, `/reel/`, `data-pagelet="Tahoe"`, mini-player) và khay "Reels & Video ngắn" trên Bảng tin. Tự động **tạm dừng (pause)** và **tắt tiếng (mute)** video ngay lập tức, hiển thị màn hình bảo vệ tập trung kèm nút `[▶ Xem video]` và `[✕ Đóng pop-up]`.
  - Sử dụng kết hợp **0ms Meta AI Vision Alt-Tags** (trên Threads & Facebook) và **Jev Zero-Shot AI** để phát hiện tức thì.
  - Bảo vệ avatar tài khoản (không làm mờ ảnh đại diện người đăng), kèm nút *"Xem ảnh"* để chủ động bật khi cần.
* 🧹 **Lớp 4: Dọn Sạch Comment Seeding (Seeding & Bot Purger)**:
  - Tự động thu gọn các bình luận clone khen dạo, tung hứng mồi chài "check ib", seeding link affiliate bẩn thành 1 thanh mỏng thanh lịch: `[🧹 Đã thu gọn bình luận nghi vấn Seeding / Clone] (Xem nội dung ▾)`.
* ⚡ **Bộ nhớ đệm tức thời (Instant Cache 0ms)**:
  - Sử dụng `sessionStorage` lưu kết quả đã phân tích theo phiên duyệt web. Khi **Reload (F5)** hoặc mở tab mới, toàn bộ rác được dọn dẹp tức thì ở **0ms**, không làm giật lag trang.
* 🔒 **Không xung đột & Bảo vệ sự riêng tư (100% Privacy)**:
  - Tích hợp tất cả trong 1 request Jev duy nhất (~250ms), không bao giờ bị đè giao diện hay chồng chéo banner lên nhau.
  - Không thu thập dữ liệu cá nhân, không cần tài khoản hay API key.

---

## 🧪 Benchmark Thực Tế với Jev AI

| Kịch bản thực tế trên MXH | Phân loại từ Jev AI | Độ tin cậy | Tốc độ |
| :--- | :---: | :---: | :---: |
| *"Tuyển CTV làm việc tại nhà xem TikTok kiếm 300k-500k/ngày, không cọc, ib Zalo"* | **`scam / fraudulent scheme`** | **100%** | ~280ms |
| *"Xem xong video này mà không phẫn nộ với cách hành xử của con bé kia thì chịu"* | **`rage bait / outrage`** | **98%** | ~250ms |
| *"Ảnh/Video bikini, gái xinh khoe dáng kèm caption thả thính / Meta AI alt: 'woman, selfie'"* | **`goon bait / thirst trap`** | **99%** | **0ms (Alt) / ~270ms (Jev)** |
| *"Bài viết phân tích rất hay và chi tiết, nhưng mình nghĩ đoạn so sánh vẫn chưa khách quan."* | **`genuine human discussion`** | **100%** | ~250ms |

---

## 🚀 Cài Đặt (Installation)

### Cách 1: Cài đặt Chrome Extension (Khuyên dùng)
1. Mở Chrome (hoặc Brave / Edge / Cốc Cốc) và vào đường dẫn: `chrome://extensions`
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Bấm **Tải tiện ích đã giải nén (Load unpacked)** và chọn thư mục `x-anti-ragebait`.
4. Truy cập [threads.com](https://threads.com), [facebook.com](https://facebook.com), hoặc [x.com](https://x.com) để tận hưởng mạng xã hội sạch bóng drama, lừa đảo và seeding!

### Cách 2: Cài đặt qua Tampermonkey (Userscript)
1. Cài đặt tiện ích [Tampermonkey](https://www.tampermonkey.net/).
2. Tạo Userscript mới và dán code từ [`social-anti-ragebait.user.js`](./social-anti-ragebait.user.js).
3. Bấm Save (`Ctrl + S`) và F5 lại trang mạng xã hội.

---

## 📄 Bản quyền (License)
Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**.
