# Changelog

## [v1.0.0 / phase-4] — contract v1.3 (Ticket-04 "Bình minh")
### Added
- `bench_cmd` (`node scripts/bench.mjs`): cảnh benchmark chuẩn (200 Bóng Mực, 100 đom đóm, camera bay vòng), cửa sổ Chrome 1280×720, vsync tắt → `bench.json`.
- `soak_cmd` (`node --expose-gc --jitless src/soak.js`): 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed → `soak.json`.
- Bảng xếp hạng cục bộ (top 10, lưu `data/leaderboard.json`), màn hình từ menu, nhập tên sau Bình Minh hoặc khi thua (chấp nhận tên tiếng Việt có dấu), `node server.js --export-leaderboard out.json`.
- Accessibility: đổi phím (phát hiện trùng, khôi phục mặc định), phụ đề và mũi tên mép màn hình, giảm chuyển động, chữ lớn ×1.25, chữ UI ≥ 18 px.
- Release v1.0.0: gói web tĩnh chạy bằng `node server.js`, không cần `npm install`.
### Changed
- `run_cmd` đổi từ `npm start` thành `node server.js`, để `--export-leaderboard` được chuyển thẳng vào chương trình (npm sẽ nuốt cờ này). `npm start` vẫn dùng được.
- Phím tạm dừng mặc định là P; Esc luôn tạm dừng.


## [phase-3] — contract v1.2 (Ticket-03 "Đèn cạn dầu")
### ⚠ Breaking changes
- `game_over.reason`: **bỏ `all_lit`**, thêm `dawn_survived`. Thắp hết đèn **không** còn kết thúc Đêm; thắng chỉ được xét ở bình minh (cần ≥ ceil(0.6 × số đèn) đèn đang sáng).
- Thời lượng Đêm 300/330/360 → **240/270/300 s**.
- Điểm: +10 → **+5** mỗi đom đóm nạp; thêm +40 thắp lại, +15 khi Tỏa Sáng trúng Bóng đang `drain`, thưởng bình minh +50 + floor(fuel) mỗi đèn sáng; **bỏ** thưởng thời gian (`per_second_left` = 0).
- Đèn sáng giờ **nhận** đom đóm (châm dầu) và có thể **tắt** (`lantern_out`, `deposited` về 0).
- Bóng Mực **được vào** vùng an toàn của đèn có fuel < 30; thêm trạng thái `drain`.
- Sức chứa không cố định 10 nữa: 10 + 2 × successful_lights, tối đa 20.
- Scenario `lit: true` không kèm `fuel` → fuel 100 (và `ever_lit` = true).
### Added
- Snapshot: `lanterns[].fuel/ever_lit/relit_count`, `player.capacity`. Sự kiện `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`.
- Scenario: `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.
- Tuning: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`, `score.per_relight/per_stun_drain/per_lantern_dawn`.
- UI: thanh dầu, đèn nhấp nháy 1 Hz khi fuel < 30, đèn tắt bị xẹp 20% và giấy rách, HUD sức chứa và ngưỡng thắng, cài đặt "Bảng màu dễ phân biệt".

## [phase-2] — contract v1.1 (Ticket-02 "Ba hòn đảo")
- Số liệu chuẩn; 3 Đêm; lướt, bục nhảy, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió, tạm dừng; menu, cài đặt, HUD, bảng màu.

## [phase-1] — contract v1.0 (PRD-0)
- Đêm 1, headless CLI, game 3D chơi được.
