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
