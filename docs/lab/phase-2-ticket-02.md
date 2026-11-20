# TICKET-02 — "Ba hòn đảo" (Phase 2) — bản chép từ lab board (người dùng dán)
Loại: Feature + chuẩn hóa · Ưu tiên: Cao · Tag nộp: phase-2 · Contract: v1.1

## Phần 1 — Số liệu chuẩn
- Di chuyển 6.0 m/s; tăng tốc/dừng ≤ 0.1 s; điều khiển trên không đầy đủ
- Nhảy: vận tốc 7.0, trọng lực −20, chỉ nhảy khi chạm đất
- Lướt: 14 m/s / 0.2 s / hồi 1.5 s (từ lúc bắt đầu). Hướng = hướng di chuyển, đứng yên → hướng quay mặt. Lướt trên không giữ độ cao. Không bất tử.
- Đom đóm: sức chứa 10; nhặt khi XZ ≤ 1.0 và chênh cao ≤ 1.5; 20 lúc đầu tại 20 điểm khác nhau; trần 30; tick 240, 480… sinh 1 ở điểm trống nếu < 30.
- Đèn: 10 đom đóm, nạp nhiều lần; tương tác 2.0 m; nạp min(mang, thiếu); chỉ đèn chưa sáng; gần nhất, bằng nhau id nhỏ hơn.
- Vùng an toàn 6 m: Bóng ngoài bị chặn ở mép; Bóng ở trong lúc đèn vừa thắp bị đẩy ra mép trong ≤ 30 tick, không gây sát thương lúc đó.
- Tỏa Sáng: 3 đom đóm / 5 m / hồi 3 s. Tâm = chân Mây + 0.8 m; khoảng cách 3D tới tâm Bóng ≤ 5. Choáng 120 tick; 15 tick đầu đẩy tổng 4 m ngang (dừng nếu vật cản; trùng vị trí → +X). Pulse lại làm mới. Không đủ 3 → không kích hoạt.
- Bóng Mực: 4.0 m/s (Đêm 3: 4.5); phát hiện 12 / bỏ 18; chạm XZ ≤ 1.0 và chênh cao ≤ 1.5; tối đa 1 hit/tick; bóng gây hit lùi 2 m trong 60 tick (recoil); chạm lúc bất tử không làm gì. Sinh: 2 con tại tick 300, rồi 1 con mỗi khoảng (300 + 480k ở Đêm 1); hết điểm hợp lệ bỏ lượt; id S1, S2… theo thứ tự sinh.
- Bị đánh: −1 lửa; rơi floor(mang/2) ra vành 1.5–2.5 m (sống 480 tick, nhặt lại từ tick sau); bất tử 90 tick.
- Rơi (Y < −10): đúng 1 lần, bỏ qua bất tử: −1 lửa, mất hết đom đóm; chờ 60 tick (không nhặt, không bị chạm), hồi sinh ở điểm xuất phát, v=0, bất tử 90. Hết lửa thì thua ngay.
- Lửa 3, hồi đầy mỗi Đêm. Thời gian 300 / 330 / 360 s.
- Thắng/thua sau mỗi tick: hết lửa → thua no_flames; còn sống và tất cả đèn sáng → thắng (kể cả tick hết giờ); còn lại hết giờ → thua dawn.
- Điểm: +10 mỗi đom đóm NẠP · +100 mỗi đèn · +5 mỗi Bóng trúng Tỏa Sáng (mỗi con mỗi lần, kể cả đang choáng) · thắng: floor(giây còn) × 2 + 50 × lửa. Tổng game = tổng các Đêm đã thắng.

### Thứ tự trong 1 tick (bắt buộc)
1 input (pause trước; vừa tạm dừng → dừng bước) · 2 giảm bộ đếm (thời gian, hồi chiêu, bất tử, choáng, bùa, TTL đom đóm rơi, hồi bùa) · 3 di chuyển Mây (nhảy, lướt, bục, gió) rồi kiểm tra rơi · 4 nhặt đom đóm và bùa · 5 tương tác đèn · 6 cập nhật vùng an toàn · 7 Tỏa Sáng · 8 di chuyển Bóng Mực và Gió Lạc · 9 chạm: Gió Lạc cướp trước, rồi Bóng Mực (id tăng dần) · 10 sinh đom đóm, Bóng Mực, Gió Lạc (tương tác từ tick sau) · 11 thắng/thua · 12 snapshot.
Tạm dừng: tick tăng nhưng sim_tick, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot state "paused".

## Phần 2 — Bản đồ chuẩn (góc từ +X, ngược chiều kim đồng hồ nhìn từ trên, mặt XZ)
- Đêm 1 Đảo Bến: tròn tâm 0, R 40; ngoài là biển mây (rơi). Xuất phát (0,0,0) quay +Z. Đèn L1 (0,0,25) L2 (23.8,0,7.7) L3 (14.7,0,−20.2) L4 (−14.7,0,−20.2) L5 (−23.8,0,7.7). Đom đóm: 8 điểm R12 (mỗi 45°) + 16 điểm R33 (mỗi 22.5°). Bóng: 12 điểm R37 (15°, 45°…), cách người chơi ≥ 15 m; 2 con lúc 5 s, rồi mỗi 8 s; tối đa 6.
- Đêm 2 Đảo Cau: 2 đảo R28 tâm A (0,0,0), B (70,0,0); cầu x∈[26,44], z∈[−2,2]. Bục R1 tại (20,0,18) và (50,0,−18): vy 14, ngang 24 về tâm đảo kia, giữ tới khi chạm đất (phím không ghi đè; được lướt). Đom đóm mỗi đảo: 4 điểm R10 (0/90/180/270) + 8 điểm R22 (mỗi 45°). Bóng: 8 điểm R26 mỗi đảo (22.5°, 67.5°…). Đèn L1…L6: (0,0,20) (17,0,−10) (−17,0,−10) (70,0,20) (87,0,−10) (53,0,−10). Bóng mỗi 7 s, tối đa 8.
- Đêm 3 Đảo Chuông: R45; tầng 0 Y=0; tầng 1 Y=3 vành 12–24 ở z>0; tầng 2 Y=6 đĩa R8 ở tâm. Mép tầng là vách. 2 dốc rộng 3 m theo bán kính ở 30° và 150°: chân R30 (Y0) → đỉnh R24 (Y3). Bục R1 tại (0,3,13): vy 12, ngang 8 hướng −Z → tầng 2. Tháp chuông trụ R2 cao 8 ở tâm, không leo. Đom đóm (30): tầng 0 18 điểm R34 (mỗi 20° từ 0°); tầng 1 8 điểm R18 (20°…160°); tầng 2 4 điểm R5 (45/135/225/315). Bóng 16 điểm R43 (mỗi 22.5°). Đèn L1…L7: (0,6,6) (18,3,10) (−18,3,10) (35,0,−10) (−35,0,−10) (20,0,−35) (−20,0,−35). Gió: mỗi 30 s một cơn 5 s hướng ngẫu nhiên, đẩy 2 m/s; báo trước 2 s. Bóng mỗi 6 s, tối đa 10.

## Phần 3 — Tính năng mới
- Gió Lạc (Đêm 2, 3): 7 m/s, tối đa 2, sinh tick 1200, 2400… tại điểm sương ngẫu nhiên, id D1… Trạng thái idle (2 m/s) → chase → flee → removed. idle→chase khi mang ≥ 5 và cách ≤ 15 (mỗi tick); mất điều kiện → idle. Chạm XZ ≤ 1.2: cướp min(3, mang), flee (ra xa 7 m/s trong 240 tick rồi biến mất cùng số đã cướp). Mỗi con cướp 1 lần. Tỏa Sáng trúng lúc chase → flee không cướp; trúng lúc flee có đồ → thả lại toàn bộ tại chỗ (đom đóm rơi), biến mất sau 120 tick. Không mất lửa; vùng an toàn không chặn; bất tử không ngăn cướp.
- Bùa Gió C1, C2: nhặt như đom đóm; 600 tick (nhặt lại làm mới): chạy 7.2 m/s, Lướt không hồi chiêu (vẫn phải nhấn lại; nhấn khi đang lướt bị bỏ qua; lướt 14 m/s trong 12 tick). Xuất hiện lại sau 2700 tick. Đêm 2 (35,0,0); Đêm 3 (30,0,25), (−30,0,25).
- Chuỗi 3 Đêm: Menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế. Thắng Đêm 3 → màn Bình Minh + tổng điểm. Thua → chơi lại Đêm đó.
- Tạm dừng (Esc/P): Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Cài đặt: âm lượng, độ nhạy chuột, lưu giữa các lần mở.
- Âm thanh: nhạc nền + hiệu ứng nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng xuất hiện, đếm ngược 10 s cuối.
- HUD: Lửa (trên trái), mm:ss (trên giữa, đỏ + nhấp nháy ≤ 30 s), đèn k/n + điểm (trên phải), thanh đom đóm 10 ô (dưới giữa), hồi chiêu Lướt + Tỏa Sáng (dưới phải), "E — Nạp ánh sáng (x/10)" gần đèn, mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình.
- Bảng màu (±10%/kênh): trời/sương #0E1430/#1B2350; cỏ/cát/gỗ/biển mây #2F5D50/#C9B48A/#6B4A2F/#12384A; đèn sáng/lõi/tắt #FFB347/#FFE9B0/#5B5F6E; đom đóm lõi/quầng #FFF6C2/#FFE58A; Bóng thân/viền/choáng #120A1A/#7A3CFF/#3A3450; áo Mây/khăn Mây + Bùa #E8E2D0/#C8102E; viền vàng, điểm/Gió Lạc #F2C14E/#8FA3B8; UI nguy hiểm/chữ #FF5A5F/#F5F1E6. Ánh sáng môi trường = 0.15 + 0.55 × (sáng/tổng).

## Phần 4 — Test Contract v1.1
- contract_version "1.1"; tuning khớp số chuẩn; thêm dash_speed, dash_duration_s, dash_cooldown_s, night2_duration_s, night3_duration_s.
- --night 1|2|3.
- Snapshot thêm night, wind {active, dir_deg}; player thêm vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s.
- Snapshot thêm mảng bắt buộc: motes (id, pos, kind=random/dropped, ttl_s), drifters (id, pos, state, stolen), charms (id, available, respawn_s).
- Scenario thêm player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}, shades[].{state, state_ticks_left}, drifters, charms, random_drifters, wind_enabled. drifters, charms thay danh sách mặc định.
- Input thêm dash, pause (cạnh false→true).
- Sự kiện mới: dash {}, charm_picked {charm_id, charm_ticks}, drifter_steal {drifter_id, amount, carried}, drifter_drop {drifter_id, amount}, night_start {night}, paused {}, resumed {}. player_hit do rơi thêm trường lost.
- Trạng thái Bóng Mực: spawning, wander, chase, recoil, stunned.
- Một Đêm đầy đủ (≤ 21 600 tick) headless ≤ 30 s.

## DoD
Bằng chứng; test ẩn Phase 1 vẫn đạt với số chuẩn; spec có acceptance criteria cho từng mục Phần 3; AGENTS.md + skill cập nhật; ≥ 1 scenario headless cho mỗi tính năng mới; bản thường ≥ 30 FPS trung bình ở 1280×720.
