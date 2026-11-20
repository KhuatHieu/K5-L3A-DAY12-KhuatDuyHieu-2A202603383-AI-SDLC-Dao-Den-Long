# Spec Phase 2 — Ticket-02 "Ba hòn đảo"

Nguồn: [docs/lab/phase-2-ticket-02.md](../lab/phase-2-ticket-02.md). Số liệu chuẩn (Phần 1) nằm ở `game.contract.json` (khóa contract) và `STD` / `NIGHTS` trong `src/sim.js` (số không có khóa contract). Test: `tests/v11.test.js` (tên test trong ngoặc).

## Acceptance criteria — Phần 3 (tính năng mới)

| Tính năng | Acceptance criteria (kiểm chứng được) | Kiểm chứng |
|---|---|---|
| **Gió Lạc** | AC1 Đêm 2/3 sinh D1 tại tick 1200, tối đa 2 con còn sống; Đêm 1 không có. AC2 idle → chase khi mang ≥ 5 và cách ≤ 15 m; mất điều kiện → idle. AC3 chạm XZ ≤ 1.2 → `drifter_steal {amount=min(3,mang), carried}`, chuyển flee, mỗi con 1 lần. AC4 flee 240 tick rồi `removed`. AC5 Tỏa Sáng trúng lúc chase → flee, không cướp. AC6 trúng lúc flee có đồ → `drifter_drop`, đồ thành đom đóm `dropped`, biến mất sau 120 tick. AC7 bất tử và vùng an toàn không ngăn cướp; không mất lửa. | test `drifter: idle → chase…`, `drifter steal ignores invulnerability…`, `pulse vs drifter…`, `drifters spawn on nights 2/3…`; kịch bản `n2_pad_drifter` |
| **Bùa Gió** | AC1 nhặt theo luật đom đóm → `charm_picked {charm_id, charm_ticks: 600}`. AC2 trong 600 tick chạy 7.2 m/s. AC3 Lướt không hồi chiêu nhưng phải nhấn lại; nhấn khi đang lướt bị bỏ qua. AC4 xuất hiện lại sau 2700 tick. AC5 vị trí: Đêm 2 (35,0,0); Đêm 3 (±30,0,25). | test `charm: pickup event…`, `charm default positions…`; kịch bản `pause_charm` |
| **Lướt** (Phần 1, mới) | 14 m/s × 12 tick = 2.8 m; hồi 90 tick tính từ lúc lướt; hướng = hướng di chuyển, đứng yên → hướng mặt (+Z lúc đầu); trên không giữ độ cao; sự kiện `dash {}`. | test `dash: …`, `dash in the air keeps height` |
| **Rơi khỏi đảo** | Y < −10 → `player_hit {by:"fall", flames, dropped:0, lost}` đúng 1 lần, mất hết đom đóm; 60 tick sau hồi sinh ở điểm xuất phát, v = 0, bất tử 90; lửa về 0 → thua ngay. | test `fall off island…`, `fall with last flame…` |
| **Bản đồ Đêm 2/3** | Đèn, điểm sinh, cầu, bục nhảy, tầng/dốc/vách/tháp, gió đúng tọa độ Phần 2. | test `night 2: …`, `night 3: …`, `night 3 wind…`, `night 3 shades are 4.5 m/s`; kịch bản `n3_ramp_wind`; ảnh `night2.png`, `night3.png` |
| **Chuỗi 3 Đêm** | Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh với tổng điểm (tổng các Đêm đã thắng); thua → "Chơi lại Đêm". | `web/main.js` (`startNight`, `finish`); ảnh `menu.png`; kiểm tay |
| **Tạm dừng** | Esc/P dừng hẳn logic (bản chơi không gọi `step`), menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Headless: input `pause` → `paused {}` / `resumed {}`, tick tăng, sim_tick/thời gian/hồi chiêu đứng yên, snapshot `state: "paused"`. | test `pause: …`; kịch bản `pause_charm` |
| **Cài đặt** | Âm lượng, độ nhạy chuột; lưu `localStorage` (`ddl-settings`), đọc lại khi mở game; lỗi storage không làm hỏng game. | `web/main.js`; kiểm tay |
| **Âm thanh** | Nhạc nền đêm + SFX: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng xuất hiện, đếm ngược 10 s cuối (+ bùa, cướp, thả). | `web/main.js` (`SFX`, `startMusic`); kiểm tay |
| **HUD** | Lửa trên trái; mm:ss trên giữa, đỏ + nhấp nháy ≤ 30 s; đèn k/n + điểm trên phải; 10 ô đom đóm dưới giữa; hồi chiêu Lướt/Tỏa Sáng dưới phải; "E — Nạp ánh sáng (x/10)" gần đèn; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình. | ảnh `night1.png` (mũi tên, 10 ô, cooldown), `night3.png` (đồng hồ đỏ 00:25) |
| **Bảng màu + ánh sáng** | Màu đúng hex Ticket-02 (hằng `P` trong `web/main.js`); ambient = 0.15 + 0.55 × sáng/tổng. | code review `web/main.js` |
| **FPS** | ≥ 30 FPS trung bình ở 1280×720. | `scripts/fps.mjs` → `fps.txt` |
| **Hiệu năng headless** | Một Đêm đầy đủ ≤ 21 600 tick chạy ≤ 30 s. | test `performance…`; `headless-summary.txt` (≈ 0.2–1 s) |
