# My Little World — Prototype v0.1

Một **web game 3D cozy sandbox** cá nhân: đi dạo trong thế giới 3D, trồng cà rốt, tưới cây, thu hoạch, nhặt trứng gà, hái táo, bán hàng, thay màu nhà và trang trí sân. Có nhiệm vụ *tùy chọn* và lưu tiến độ tự động.

## Chơi ngay trên GitHub Pages

1. Tạo **repository GitHub mới**, ví dụ `my-little-world` (không ghi đè repository LingoTown).
2. **Giải nén ZIP**, tải **4 file** `index.html`, `style.css`, `game.js`, `logic.js` và `README.md` vào **thư mục gốc** repository.
3. Trong GitHub: **Settings → Pages → Build and deployment**: Source `Deploy from a branch`, Branch `main`, Folder `/(root)` → **Save**.
4. Game sẽ mở ở đường dẫn dạng `https://TEN-TAI-KHOAN.github.io/my-little-world/`. Chờ GitHub hoàn tất deploy; xem đường dẫn chính thức trong Settings → Pages.

Game dùng Three.js lấy từ CDN nên cần Internet trong lần tải trang. Github Pages là static hosting, không cần server backend hoặc npm build.

## Điều khiển

| Phím/nút | Chức năng |
| --- | --- |
| W A S D / các phím mũi tên | Di chuyển |
| Click vào khu game 3D và rê chuột | Nhìn quanh (Esc để thoát pointer lock) |
| E / nút tương tác | Tương tác với vật gần nhất |
| V | Chuyển góc nhìn First-person và Third-person |
| B | Cửa hàng: mua hạt giống, bán nông sản |
| H | Trang trí: sơn nhà, đặt chậu hoa/ghế/đèn |
| 📜 | Nhiệm vụ tự chọn |
| 💾 | Lưu thủ công (game cũng tự lưu mỗi 12 giây) |
| ❔ | Hướng dẫn, xuất/nhập bản Save JSON |

Trên thiết bị cảm ứng: dùng 4 phím hướng trên màn hình, kéo vùng 3D để xoay góc nhìn. **Ưu tiên chơi bằng PC** trong phiên bản v0.1.

## Cơ chế chính

- Bắt đầu với 120 Coins và 6 hạt giống.
- Đến luống đất: **E gieo hạt**, **E tưới nước**, **E thu hoạch** khi chín. Tưới giúp cây phát triển từ 45 giây xuống còn khoảng 30 giây.
- Thu hoạch 3 củ cà rốt, được 15 XP; cây vẫn phát triển theo thời gian thực khi bạn đóng trình duyệt.
- Chuồng gà có 3 ổ trứng. Nhặt trứng, mỗi ổ đẻ lại sau 35 giây. Cây táo ra quả lại sau 40 giây.
- Cửa hàng bán tất cả nông sản một lần, mua 5 hạt giống với 30 Coins.
- Trang trí tối đa 8 món ở vị trí định sẵn trong sân, thay màu nhà miễn phí.
- Rương quà bất ngờ xuất hiện khoảng mỗi 110 giây, không bị mất khi bạn bỏ qua.
- Có hệ thống cấp độ, Coins, XP và 3 nhiệm vụ không thời hạn.

## Lưu tiến độ

Dùng `localStorage` trong trình duyệt, key: `my-little-world-v0.1`. Xóa cache hoặc dùng trình duyệt khác có thể mất tiến độ. **Định kỳ nhấn `❔` → `⬇ Xuất file Save` để sao lưu**. Chức năng nhập file Save có kiểm tra dữ liệu và định dạng.

## Giới hạn của v0.1

- Đồ họa 3D dạng hình khối low-poly, không dùng model nhân vật chuyên nghiệp.
- Nhà chưa có nội thất bên trong; trang trí qua 8 điểm định sẵn, **chưa xây tường/sàn tự do**.
- Chưa có NPC hội thoại, bản đồ các vùng đất, co-op hay hệ thống nhiệm vụ động.
- Di chuyển chỉ có va chạm đơn giản với nhà, chuồng và ao; chưa có physics engine chuyên dụng.
- Một số thao tác cảm ứng còn cơ bản, màn hình nhỏ có thể hạn chế trải nghiệm.
- Đây là prototype để tiếp tục phát triển, chưa được kiểm thử trên mọi thiết bị.

## Kiểm thử logic

Dùng Node.js 18+:

```bash
node --test test-logic.mjs
```

`test-logic.mjs` là file test bổ sung, không cần tải lên GitHub Pages.

## Cấu trúc

```text
my-little-world/
├── index.html      # Layout UI + bootstrap
├── style.css       # Responsive styling
├── logic.js        # Data, game mechanics, save validation
├── game.js         # Three.js scene, inputs, render loop, UI
├── README.md
└── test-logic.mjs  # Unit tests (không bắt buộc để host)
```
