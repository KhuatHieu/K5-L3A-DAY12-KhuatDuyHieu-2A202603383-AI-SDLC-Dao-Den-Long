# Đảo Đèn Lồng

> 🎬 **Video demo:** _(thêm ở Phase 4 — Release `v1.0.0`)_ · Đề bài lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi đội nón lá, khăn đỏ, đi qua **3 Đêm**: Đảo Bến, Đảo Cau, Đảo Chuông. Ở mỗi đảo, Mây gom đom đóm để thắp lại các Đèn Lồng Lớn trước bình minh, né Bóng Mực và Gió Lạc.

![gameplay](docs/proof/phase-2/night2.png)

## Cài đặt & chạy (macOS / Linux, Node ≥ 18)

```bash
npm install          # build_cmd
npm start            # run_cmd → mở http://localhost:5173
```

Headless (Test Contract **v1.2**):

```bash
node src/headless.js --seed 1 --night 1|2|3 --ticks 21600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Test & bằng chứng: `npm test` · `bash scripts/proof.sh 3` · FPS: `node scripts/fps.mjs <night> 15` (khi `npm start` đang chạy)

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D / ↑ ↓ | Di chuyển (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| E | Nạp ánh sáng vào đèn gần nhất (trong 2 m) |
| Q | Tỏa Sáng: tốn 3 đom đóm, choáng Bóng Mực trong 5 m, hồi 3 s |
| E (ở đèn đang sáng) | Châm dầu |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt (âm lượng, độ nhạy, bảng màu dễ phân biệt) / Về menu |

## Luật & cách tính điểm (Ticket-02 + Ticket-03 "Đèn cạn dầu")

- Tự nhặt đom đóm khi cách ≤ 1 m. **Sức chứa** bắt đầu 10, tăng 2 sau mỗi lần thắp thành công (tối đa 20).
- Thắp đèn lần đầu cần **10** đom đóm. Đèn sáng có **dầu** (100, hao 1/giây); đứng cạnh đèn bấm E để **châm dầu** (1 đom đóm = +10 dầu). Hết dầu thì đèn **tắt**; **thắp lại** chỉ cần 5 đom đóm.
- **Bóng Mực** (4 m/s, 4.5 ở Đêm 3) phát hiện Mây trong 12 m. Đèn còn ≥ 30 dầu có vùng an toàn 6 m. Đèn **< 30 dầu** (nhấp nháy) mất vùng an toàn, và Bóng Mực tới **hút dầu** (5/giây).
- **Gió Lạc** (Đêm 2, 3) cướp đom đóm. **Bùa Gió** cho chạy nhanh và lướt không hồi chiêu. Rơi khỏi đảo thì mất 1 lửa.
- **Thắng**: còn sống khi **bình minh** tới (240 / 270 / 300 s) và có ≥ 60% số đèn đang sáng (3/5, 4/6, 5/7). **Thua**: hết 3 Ngọn Lửa, hoặc bình minh tới mà thiếu đèn sáng.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Bóng Mực trúng Tỏa Sáng (đang hút dầu) | +5 (+15) |
| Bình minh (khi thắng): mỗi đèn đang sáng | +50 + floor(dầu) |
| Bình minh (khi thắng): mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng. Ví dụ kiểm chứng: kịch bản `dawn_win` cho 3 × (50 + 50) + 3 × 50 = **450**. Quyết định thiết kế ghi ở [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md); thay đổi phá vỡ tương thích ở [CHANGELOG.md](CHANGELOG.md).

## Test Contract v1.2

- `game.contract.json`: `tuning` là nguồn duy nhất cho các số có khóa contract. Các số chuẩn khác của ticket (nhảy, lịch sinh, bản đồ…) nằm ở `STD` / `NIGHTS` trong `src/sim.js`.
- Thứ tự xử lý trong một tick theo đúng 11 bước của Ticket-02 (đánh số trong `step()`).
- Trạng thái Bóng Mực: `spawning` · `wander` · `chase` · `recoil` · `stunned` · `drain`. Dầu tính bằng số nguyên theo đơn vị 1/60. Gió Lạc: `idle` · `chase` · `flee` · `removed`.
- `player.invuln` trong snapshot là boolean. `night_start` được ghi ngay sau snapshot tick 0, với `tick: 0`.
- Mã thoát: 0 thành công; 2 khi file scenario/inputs sai định dạng; 1 khi lỗi tham số (kể cả `--night` ngoài 1–3).
- Giả định cho các chỗ mơ hồ: [docs/notes/assumptions.md](docs/notes/assumptions.md).

## Sáng tạo của tôi

- **Cá voi mây**: những con cá voi khổng lồ bơi chậm trong biển mây quanh đảo. Chỉ là hình ảnh trong `web/main.js`, không tồn tại trong `sim.js`, nên **không ảnh hưởng headless**.
- **Ông Đăng**: người giữ đèn già, có một câu dẫn chuyện riêng ở màn giới thiệu mỗi Đêm.
- **Chuông bình minh**: tháp chuông Đảo Chuông có quả chuông vàng; màn Bình Minh kể chuông ngân khi cả ba đảo sáng lại.
- Hiệu ứng vòng sáng lan ra khi Tỏa Sáng và khi thắp đèn; lá bay báo trước gió; toàn bộ âm thanh, nhạc nền tự tổng hợp bằng WebAudio.
- Bằng chứng phần lõi vẫn đúng: 51 test contract (`npm test`) chạy CLI headless vốn không nạp `web/`. Xem [docs/proof/phase-3](docs/proof/phase-3/README.md).

## Tài liệu

- Bằng chứng: [phase-1](docs/proof/phase-1/README.md) · [phase-2](docs/proof/phase-2/README.md) · [phase-3](docs/proof/phase-3/README.md)
- [ADR 0001 — dầu đèn & thắng ở bình minh](docs/adr/0001-lantern-fuel-and-dawn-win.md) · [CHANGELOG.md](CHANGELOG.md)
- Spec Phase 2 (acceptance criteria): [docs/notes/spec-phase-2.md](docs/notes/spec-phase-2.md)
- Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Harness AI: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.claude/settings.json](.claude/settings.json) (hook Stop chặn kết thúc khi test đỏ), [.claude/skills/verify](.claude/skills/verify/SKILL.md)
- [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) (MIT)
