# Bằng chứng Phase 4 (Ticket-04, contract v1.3, v1.0.0)

Máy dev: Intel Core Ultra 7 155H, iGPU Intel Arc (Meteor Lake), Linux 7.3 (CachyOS, Wayland), Chrome 157, Node 24.15. Số đo trên máy chấm sẽ khác; số ở đây chỉ để tham khảo.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Contract v1.3 + `bench_cmd`/`soak_cmd`; mọi luật v1.0–v1.2 giữ nguyên | test `contract v1.3…` + 50 test cũ | [test-report.txt](test-report.txt) (57/57) | Đạt |
| Bench: cửa sổ 1280×720, vsync tắt, 200 Bóng wander, 100 đom đóm, L1–L3 fuel 100, camera R 30 / Y 15 / 15 s, 3 s khởi động, công thức avg / p1-low / p95 | `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` | [bench.json](bench.json): avg **205**, p1-low **102.8**, p95 6.7 ms, 6170 frames, load **2912 ms** · ảnh [bench-scene.png](bench-scene.png) | Đạt ngưỡng trên máy này (≥ 60 / ≥ 30 / ≤ 10000) |
| Bench tắt: spawn, sát thương, nhặt, hao dầu, kết thúc Đêm; cá voi mây tắt | `createBenchGame` trong `sim.js` (cờ `bench`); `scene` trong bench.json (200 / 100 / L1–L3) | bench.json `scene` | Đạt |
| Soak: 10 Đêm, 1→2→3, seed 7 + i, input ngẫu nhiên đúng tỉ lệ | `node --expose-gc --jitless src/soak.js --seed 7 --nights 10 --out soak.json`; test `soak_cmd writes…` | [soak.json](soak.json): crashes **0**, RAM 45.9 → 53.4 MB (**×1.16** ≤ 1.2) | Đạt |
| Soak không rò rỉ (chạy dài hơn) | 30 Đêm: 46.2 → 54.3 MB (×1.175, đứng yên như 10 Đêm); JS heapUsed 4.1 → 4.2 MB | log trong `docs/notes/ai-log.md` (Phase 4) | Đạt |
| Bảng xếp hạng: tên 3–12 [A-Za-z0-9_] (+ tiếng Việt), top 10, điểm giảm dần, bằng điểm ai trước đứng trên, ISO 8601 có múi giờ, lưu đĩa qua khởi động lại, export | `tests/leaderboard.test.js` (5 test, có khởi động lại server) | test-report · ảnh [leaderboard.png](leaderboard.png) | Đạt |
| Đổi phím mọi hành động, báo trùng, khôi phục mặc định, được lưu | code `assignKey`/`renderKeys`; ảnh | [keys.png](keys.png) | Đạt (ảnh + code); chưa có test tự động UI |
| Phụ đề: Bóng Mực xuất hiện + mũi tên mép màn hình; gió; 10 s cuối; đèn < 30 | ảnh chụp thời gian thực (`scripts/shot.mjs`, giây thứ 6.2, sau khi 2 Bóng sinh ở tick 300) | [spawn-caption.png](spawn-caption.png) | Đạt cho Bóng Mực (ảnh); 3 chỉ báo còn lại đúng theo code |
| Giảm chuyển động (rung camera + chớp), chữ lớn ×1.25, chữ UI ≥ 18 px | CSS `html { font-size: 18px }`, `html.big` 22.5 px; toggle trong Cài đặt | [settings.png](settings.png) | Đạt (code + ảnh) |
| Clone sạch → ≤ 3 lệnh → chơi | clone tag `phase-4` sang thư mục mới, `npm install`, `npm test`, `node server.js` | xem ai-log | Đạt |
| Release v1.0.0 có bản chạy được | `dao-den-long-v1.0.0-web.zip` (không cần `npm install`) | GitHub Release | Đạt |
| Video demo < 5 phút | — | `docs/demo/demo.mp4` | **Chưa** — cần người chơi tự quay |
