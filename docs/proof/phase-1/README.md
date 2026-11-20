# Bằng chứng Phase 1

Tạo lại toàn bộ: `npm test` và `bash scripts/proof.sh` (ở tag `phase-1`). Máy: Linux (CachyOS), Node v24.15.0.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| CLI headless đúng tham số, tick 0 = sau scenario, sự kiện tick k+1, snapshot mỗi N tick | test `tick 0 snapshot…`, `input frame applied at tick k…` | [test-report.txt](test-report.txt) | Đạt |
| Di chuyển theo `player_speed`, xoay theo `cam_yaw_deg`, chuẩn hóa vector | test `movement` (60 tick → đúng 6 m; yaw 90° → +X) | test-report | Đạt |
| Nhặt đom đóm ≤ `pickup_radius`, giới hạn `carry_capacity` | test `pickup…`, `carry_capacity…` | test-report | Đạt |
| Nạp/thắp đèn ≤ `interact_radius`, nạp từng phần, cạnh lên | test `deposit…`, `partial deposit…`, `out of interact_radius` | test-report | Đạt |
| Thắng `all_lit`, dừng sớm, điểm thưởng | test `win…`; kịch bản `win` → `won`, 536 điểm | [headless-summary.txt](headless-summary.txt), [out/win.jsonl](out/win.jsonl) | Đạt |
| Thua `no_flames`, `invuln_s`, rơi đom đóm | test `invuln_s…`, `shade chases…`; kịch bản `lose_no_flames` | out/lose_no_flames.jsonl | Đạt |
| Thua `dawn` | test `dawn…`; kịch bản `lose_dawn` (2 s → kết thúc tick 120) | out/lose_dawn.jsonl | Đạt |
| Tỏa sáng: tốn, choáng `pulse_stun_s`, đẩy `pulse_push_m`, hồi chiêu, trạng thái `stunned` | test `pulse…`, `stun lasts…`, `pulse without enough light` | out/pulse.jsonl | Đạt |
| Đèn thắp xua Bóng Mực (`safe_radius`) | test `lit lantern safe_radius…` (600 tick, không bao giờ < 5 m) | test-report | Đạt |
| `shade_spawned` | test `random shades spawn…` | test-report | Đạt |
| Tính tất định | test byte-so-byte; script so 2 lần chạy seed 42 → IDENTICAL | headless-summary.txt | Đạt |
| Làm tròn 3 chữ số | test `coordinates rounded…` | test-report | Đạt |
| Mã thoát 2 cho file sai, ≠0 cho lỗi khác | test `exit codes…`; script | headless-summary.txt | Đạt |
| `tuning` khớp game | `sim.js` đọc trực tiếp `game.contract.json` (không có bản sao số); mọi test lấy số từ contract | `src/sim.js` | Đạt |
| Game 3D chơi được, HUD, thắp đèn làm đảo sáng | Chrome headless chụp màn hình | [menu](screenshot-menu.png), [đang chơi](screenshot-play.png), [3 đèn đã thắp](screenshot-lit3.png) | Đạt (ảnh); chơi tay end-to-end bằng bàn phím chưa quay video — để Phase 4 |
| Chơi lại sau thắng/thua | Overlay R/Enter gọi `newGame()` | `web/main.js` | Đạt theo code; chưa có ảnh/clip |
| Hiệu năng headless | 18000 tick tối đa | headless-summary.txt (~60 ms) | Đạt |

Hạn chế đã biết: Mây chưa có hoạt ảnh đi; Bóng Mực đi thẳng (không né vật cản — đảo không có vật cản trong logic).

> **Ghi chú (sau Phase 1, phát hiện khi làm Phase 2):** `.gitignore` lúc đó có dòng `out/` nên thư mục `out/` **không có trong tag `phase-1`**. Chạy lại `bash scripts/proof.sh` ở tag `phase-1` sẽ tạo lại các file này. Từ Phase 2 trở đi chỉ ignore `/out/` ở gốc repo, và output Phase 1 (chạy ở code Phase 1) được commit bổ sung trên `main`.
