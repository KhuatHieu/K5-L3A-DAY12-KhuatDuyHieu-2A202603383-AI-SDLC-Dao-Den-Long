# Giả định — Phase 1 (PRD-0)

| # | Chỗ mơ hồ trong PRD-0 | Giả định của tôi |
|---|---|---|
| A1 | "Máu" là gì | `flames` = 3 ngọn lửa; bị chạm mất 1; về 0 → thua `no_flames` |
| A2 | Hết giờ thì sao | Đêm 300 s; hết giờ mà chưa thắp đủ → **thua** `dawn` |
| A3 | "Tỏa sáng tốn ánh sáng" | Tốn `pulse_cost` = 1 đom đóm đang mang; không đủ → không kích hoạt, không phát sự kiện. Phát `pulse` kể cả khi không trúng con nào (`stunned_ids: []`) |
| A4 | Bóng Mực sợ đèn | Chỉ **đèn đã thắp** có vùng an toàn `safe_radius` 5 m; Bóng Mực bị đẩy ra mép vùng (không vào được). Đèn chưa thắp không xua |
| A5 | Đom đóm rơi khi bị chạm | `floor(carried × 0.5)` biến mất (không rơi lại xuống đất) |
| A6 | Nạp đèn | Nhấn E (cạnh lên) trong 3 m → nạp vào đèn **chưa thắp gần nhất** tối đa số còn thiếu; nạp từng phần được |
| A7 | Nhặt đom đóm | Tự động khi trong `pickup_radius`, theo thứ tự id, dừng khi đầy túi |
| A8 | Bóng Mực xuất hiện | Mặc định 2 con lúc đầu (không phát sự kiện vì là dựng màn), +1 mỗi 30 s (phát `shade_spawned`), tối đa 6, sinh trên vòng 34 m |
| A9 | Đom đóm xuất hiện | Mặc định 20 con ngẫu nhiên theo seed; mỗi 4 s sinh lại 1 nếu < 20 |
| A10 | Rơi khỏi đảo | Không có (`fall_enabled: false`): đảo tròn bán kính 40 m, mép là tường |
| A11 | Bị chạm nhiều lần | Bất tử `invuln_s` 1.5 s sau mỗi lần; mỗi bước tối đa 1 lần chạm; Bóng Mực đang choáng không gây sát thương |
| A12 | Thứ tự trong một bước | timer → input → di chuyển/nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển + vùng an toàn → va chạm → sinh → kiểm tra kết thúc (thắng ưu tiên trước thua) |
| A13 | Timer | Đếm bằng tick nguyên (`round(s×60)`) để tránh sai số float |
| A14 | "Trong bán kính r" | `d ≤ r + 1e-6` (dung sai float, phát hiện khi chạy kịch bản `win`) |
| A15 | Điểm thưởng khi thắng | `per_second_left × floor(time_left)` + `per_flame_left × flames`; chỉ khi thắng |
| A16 | `move` ngoài [−1,1] | Kẹp từng thành phần về [−1,1], rồi chuẩn hóa nếu dài > 1 |
| A17 | `shades[].pos` y | Giữ nguyên y từ scenario; Bóng Mực tự sinh có y = 1.0 (tâm). Khoảng cách luôn đo trên XZ |
| A18 | Scenario `lit: true` | Không đổi `deposited`, không cộng điểm, không phát sự kiện |
| A19 | `--night` khác 1 | Thoát mã 1 (chỉ có Đêm 1 ở Phase 1) |

# Giả định — Phase 2 (Ticket-02)

Ticket-02 **thay** số liệu và một số luật Phase 1. Những giả định cũ bị thay: A1–A3 (số), A5 (đom đóm rơi giờ rơi xuống đất, sống 480 tick), A8–A10 (lịch sinh, bản đồ, rơi khỏi đảo đã bật), A15 (điểm: +10 tính khi **nạp**, không phải khi nhặt; +5 mỗi Bóng trúng Tỏa Sáng).

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | "Tăng tốc/dừng ≤ 0.1 s" | Tức thời (0 s ≤ 0.1 s) — đơn giản, tất định, khớp test di chuyển Phase 1 |
| B2 | Thời gian ở trạng thái `spawning` | 60 tick (1 s): không di chuyển, không gây sát thương |
| B3 | `wander` | Trôi 1 m/s theo hướng ngẫu nhiên (seed), đổi hướng mỗi 120 tick, không ra khỏi đảo |
| B4 | Chênh cao khi nạp đèn | Như nhặt: \|y Mây − y chân đèn\| ≤ 1.5 m (đèn Đêm 3 ở các tầng khác nhau) |
| B5 | "Chênh cao" khi bị chạm | \|y chân Mây − y tâm Bóng\| ≤ 1.5 (tâm Bóng tự sinh = mặt đất + 1 m) |
| B6 | `night_start` | Ghi 1 lần ngay sau snapshot tick 0, `tick: 0` (setup không phát sự kiện gameplay) |
| B7 | Đêm 3 điểm xuất phát | Tâm (0,0,0) là tháp chuông trên tầng 2 → chọn **(0,0,−30)** tầng 0, quay mặt +Z |
| B8 | `invuln` trong snapshot | Boolean (đang bất tử hay không); số tick còn lại có thể đặt qua scenario `invuln_ticks` |
| B9 | Bóng bị đẩy khi đèn vừa thắp | Trạng thái `recoil` trong lúc bị đẩy (tối đa 30 tick), không gây sát thương |
| B10 | Gió Lạc idle | Lượn vòng chậm 2 m/s; điểm sương = điểm sinh Bóng Mực của Đêm đó |
| B11 | Bóng Mực bay trên biển mây | Được (là sinh vật sương); chỉ lúc `wander` mới không ra khỏi đảo |
| B12 | Gió | Cơn gió ở sim tick 1800, 3600…, dài 300 tick; hướng bốc ngẫu nhiên (seed) lúc bắt đầu báo trước (120 tick trước), `dir_deg` giữ giá trị cơn gần nhất; `null` khi chưa có |
| B13 | Thứ tự trong 1 tick | Đúng như ticket; bộ đếm giảm ở bước 2, nên trạng thái kéo dài N tick hiển thị ở N snapshot liên tiếp |
| B14 | Tạm dừng ở bản chơi | Không gọi `step()` khi menu tạm dừng mở (logic dừng hẳn); headless dùng input `pause` theo contract |
| B15 | Vách tầng | Không bước lên được nếu mặt đất mới cao hơn chân > 0.35 m; dốc (0.5 m/m) đi lên được |
| B16 | Gió Lạc đã bị Tỏa Sáng khi đang chase | Coi như đã dùng lượt cướp (không quay lại cướp nữa) |
