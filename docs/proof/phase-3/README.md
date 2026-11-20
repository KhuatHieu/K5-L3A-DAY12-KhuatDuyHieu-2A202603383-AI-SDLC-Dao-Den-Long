# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu", contract v1.2)

Tạo lại ở tag `phase-3`: `npm test` · `bash scripts/proof.sh 3`. Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG.md](../../../CHANGELOG.md).

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Tuning v1.2 + thời lượng 240/270/300 | test `contract v1.2…`, `default night durations…` | [test-report.txt](test-report.txt) | Đạt |
| Snapshot/scenario mới (fuel 1 chữ số, ever_lit, relit_count, capacity; lit không fuel → 100) | test `v1.2 snapshot fields…` | test-report | Đạt |
| Hao 1/s chính xác, `lantern_out` ở 0, deposited 0 | test `fuel decays…` (2 fuel → tắt ở tick 120; 100 fuel → hết ở 100 s) | test-report; kịch bản `out_relight` | Đạt |
| Châm dầu đúng công thức, +5/đom đóm, sự kiện `refuel` | test `refuel…`, `full lantern…` | test-report | Đạt |
| Thắp lại 5 (+40), thắp đầu 10 (+100), `relight` flag, sức chứa 10 + 2n ≤ 20 | test `relight needs 5…` | test-report; `out_relight` → 65 điểm | Đạt |
| Đèn < 30 mất vùng an toàn, đúng 30 vẫn còn | test `weak lantern…` | test-report | Đạt |
| Bóng wander tìm đèn yếu, `drain` 5/s cộng dồn, `fuel_drain` mỗi 60 tick | test `wander shade goes to weak lantern…` | test-report; `drain_chase` (3 × fuel_drain) | Đạt |
| Thoát drain: chase trong 6 m; wander khi châm ≥ 30 (đẩy ra, không sát thương); stunned khi trúng Tỏa Sáng (+15) | 2 test | test-report; `drain_chase` (drain → chase → player_hit) | Đạt |
| Thắng ở bình minh ≥ ceil(0.6n) (3/5, 4/6, 5/7), `dawn_survived`, thưởng đèn + lửa; thua `dawn`; no_flames ưu tiên; đèn tắt ở tick bình minh không tính | test `dawn win…`, `a lantern going out on the dawn tick…`, `lighting all lanterns does not end the night…` | `dawn_win` → won 450, `dawn_lose` → lost (L3 tắt) | Đạt |
| Test cũ bị thay: cập nhật có lý do | comment `[Ticket-03]` trong `tests/contract.test.js` (4 test), `docs/notes/ai-log.md` | — | Đạt |
| Tất định 3 Đêm (18 000 tick, seed 42) | proof script | [headless-summary.txt](headless-summary.txt) | Đạt |
| UI: thanh dầu, nhấp nháy 1 Hz < 30, đèn tắt xẹp 20% + rách, HUD mang/sức chứa + ngưỡng thắng | ảnh | [night1.png](night1.png) (đèn L2 fuel 20 nhấp nháy, thanh dầu) | Đạt (ảnh) |
| Chế độ mù màu (được lưu): viền/mắt Bóng #00B3FF, cảnh báo trắng + ⚠ | ảnh `?cb` | [night1-cb.png](night1-cb.png) (đồng hồ "⚠ 00:20" màu trắng) | Đạt (ảnh); chưa chụp Bóng ở chế độ này |
