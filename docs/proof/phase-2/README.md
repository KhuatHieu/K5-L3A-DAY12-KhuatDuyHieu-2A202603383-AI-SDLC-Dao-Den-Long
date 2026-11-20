# Bằng chứng Phase 2 (Ticket-02, contract v1.1)

Tạo lại toàn bộ ở tag `phase-2`: `npm test` · `bash scripts/proof.sh 2` · `node scripts/fps.mjs <night> 15`.
Máy: Linux (CachyOS), Intel Core Ultra 7 155H, iGPU Intel Arc (Meteor Lake), Node v24.15.0, Chrome stable.
Acceptance criteria từng tính năng: [spec-phase-2.md](../../notes/spec-phase-2.md).

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Số liệu chuẩn trong `tuning` + khóa mới | test `contract v1.1 file has standard numbers` | [test-report.txt](test-report.txt) | Đạt |
| Hồi quy luật Phase 1 với số chuẩn (di chuyển, nhặt, nạp, thắng/thua, mã thoát, làm tròn, tick model) | 13 test lõi | test-report | Đạt |
| Thứ tự tick, ưu tiên thắng/thua (no_flames > all_lit > dawn; thắng cả ở tick hết giờ) | test `win all_lit…`, `dawn` | test-report | Đạt |
| Nhảy 7 / −20, chỉ khi chạm đất | test `jump…` | test-report | Đạt |
| Lướt | test `dash…` ×2 | test-report, kịch bản `pause_charm` | Đạt |
| Bóng Mực: lịch sinh, 5 trạng thái, phát hiện 12/18, chạm, recoil, bất tử 90, rơi đom đóm ra vành | 6 test | test-report | Đạt |
| Vùng an toàn 6 m + đẩy ra ≤ 30 tick | test `safe zone…` | test-report | Đạt |
| Tỏa Sáng 3/5 m 3D/120 tick/đẩy 4 m trong 15 tick/làm mới | 2 test | test-report | Đạt |
| Rơi khỏi đảo | 2 test | test-report | Đạt |
| Tạm dừng (headless) | test `pause…`; kịch bản `pause_charm` | [headless-summary.txt](headless-summary.txt) | Đạt |
| Gió Lạc | 4 test; kịch bản `n2_pad_drifter` (bay bục nhảy rồi bị cướp) | out/n2_pad_drifter.jsonl | Đạt |
| Bùa Gió | 2 test; kịch bản `pause_charm` | out/pause_charm.jsonl | Đạt |
| Đêm 2 (cầu, bục nhảy ~1.4 s đáp ở đảo B) | test `night 2…` | test-report, [ảnh](night2.png) | Đạt |
| Đêm 3 (dốc, vách, bục lên tầng 2, tháp, gió, Bóng 4.5 m/s) | 3 test; kịch bản `n3_ramp_wind` | out/n3_ramp_wind.jsonl, [ảnh](night3.png) | Đạt |
| Tính tất định 3 Đêm | test byte-so-byte; script chạy 2 lần seed 42 × 3 Đêm, 21 600 tick | headless-summary.txt (IDENTICAL ×3) | Đạt |
| Một Đêm ≤ 21 600 tick trong ≤ 30 s | test `performance…`; script đo thời gian | headless-summary.txt (0.16–1.0 s) | Đạt |
| ≥ 30 FPS ở 1280×720 | `scripts/fps.mjs` qua Chrome DevTools Protocol, tắt vsync | [fps.txt](fps.txt): ~1100–1370 FPS trên iGPU | Đạt (trên máy này; SwiftShader không GPU chỉ ~11 FPS) |
| HUD (lửa, đồng hồ đỏ ≤ 30 s, đèn/điểm, 10 ô, cooldown, mũi tên) | ảnh chụp | [night1](night1.png), [night3](night3.png) | Đạt (ảnh) |
| Menu / giới thiệu / kết quả / Bình Minh / tạm dừng / cài đặt / âm thanh | code + ảnh menu | [menu](menu.png), `web/main.js` | Đạt theo code + ảnh menu; **chưa** quay clip chơi trọn 3 Đêm bằng tay (để video Phase 4) |
| ≥ 1 scenario headless cho mỗi tính năng mới | `docs/proof/phase-2/scenarios/` + test | thư mục scenarios | Đạt |

Bằng chứng Phase 1 giữ nguyên ở `docs/proof/phase-1/`, khớp tag `phase-1` (luật v1.0). Output của các lượt chạy đủ 21 600 tick được nén `.jsonl.gz`.
