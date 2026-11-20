# Đảo Đèn Lồng

> 🎬 **Video demo:** _(thêm ở Phase 4 — Release `v1.0.0`)_ · Đề bài lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi đội nón lá, khăn đỏ, đi qua **3 Đêm**: Đảo Bến, Đảo Cau, Đảo Chuông. Ở mỗi đảo, Mây gom đom đóm để thắp lại các Đèn Lồng Lớn trước bình minh, né Bóng Mực và Gió Lạc.

![gameplay](docs/proof/phase-2/night2.png)

## Cài đặt & chạy (macOS / Linux, Node ≥ 18)

```bash
npm install          # build_cmd
npm start            # run_cmd → mở http://localhost:5173
```

Headless (Test Contract **v1.1**):

```bash
node src/headless.js --seed 1 --night 1|2|3 --ticks 21600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Test & bằng chứng: `npm test` · `bash scripts/proof.sh 2` · FPS: `node scripts/fps.mjs <night> 15` (khi `npm start` đang chạy)

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D / ↑ ↓ | Di chuyển (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| E | Nạp ánh sáng vào đèn gần nhất (trong 2 m) |
| Q | Tỏa Sáng: tốn 3 đom đóm, choáng Bóng Mực trong 5 m, hồi 3 s |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Luật & cách tính điểm (số liệu chuẩn Ticket-02)

- Mang tối đa **10** đom đóm, tự nhặt khi cách ≤ 1 m. Mỗi đèn cần **10** đom đóm, nạp được nhiều lần.
- **Bóng Mực** (4 m/s, 4.5 m/s ở Đêm 3) phát hiện Mây trong 12 m, bỏ đuổi ở 18 m. Bị chạm thì mất 1 Ngọn Lửa, rơi một nửa số đom đóm xuống đất (nhặt lại được trong 8 s), bất tử 1.5 s.
- **Đèn đã thắp** tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- **Gió Lạc** (Đêm 2, 3) đuổi khi Mây mang ≥ 5 đom đóm và cướp tối đa 3. Tỏa Sáng lúc nó đang chạy trốn thì nó thả lại đồ đã cướp.
- **Bùa Gió** có hiệu lực 10 s: chạy 7.2 m/s, Lướt không hồi chiêu.
- **Rơi khỏi đảo**: mất 1 lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát.
- **Thắng**: thắp hết đèn. **Thua**: hết 3 Ngọn Lửa, hoặc bình minh tới (300 / 330 / 360 s).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần, kể cả đang choáng) | +5 |
| Khi thắng Đêm: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng Đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng. Ví dụ kiểm chứng: kịch bản `n1_win` cho 10×10 + 100 + 2×118 + 3×50 = **586**, khớp output headless.

## Test Contract v1.1

- `game.contract.json`: `tuning` là nguồn duy nhất cho các số có khóa contract. Các số chuẩn khác của ticket (nhảy, lịch sinh, bản đồ…) nằm ở `STD` / `NIGHTS` trong `src/sim.js`.
- Thứ tự xử lý trong một tick theo đúng 11 bước của Ticket-02 (đánh số trong `step()`).
- Trạng thái Bóng Mực: `spawning` · `wander` · `chase` · `recoil` · `stunned`. Gió Lạc: `idle` · `chase` · `flee` · `removed`.
- `player.invuln` trong snapshot là boolean. `night_start` được ghi ngay sau snapshot tick 0, với `tick: 0`.
- Mã thoát: 0 thành công; 2 khi file scenario/inputs sai định dạng; 1 khi lỗi tham số (kể cả `--night` ngoài 1–3).
- Giả định cho các chỗ mơ hồ: [docs/notes/assumptions.md](docs/notes/assumptions.md).

## Sáng tạo của tôi

- **Cá voi mây**: những con cá voi khổng lồ bơi chậm trong biển mây quanh đảo. Chỉ là hình ảnh trong `web/main.js`, không tồn tại trong `sim.js`, nên **không ảnh hưởng headless**.
- **Ông Đăng**: người giữ đèn già, có một câu dẫn chuyện riêng ở màn giới thiệu mỗi Đêm.
- **Chuông bình minh**: tháp chuông Đảo Chuông có quả chuông vàng; màn Bình Minh kể chuông ngân khi cả ba đảo sáng lại.
- Hiệu ứng vòng sáng lan ra khi Tỏa Sáng và khi thắp đèn; lá bay báo trước gió; toàn bộ âm thanh, nhạc nền tự tổng hợp bằng WebAudio.
- Bằng chứng phần lõi vẫn đúng: 39 test contract (`npm test`) chạy CLI headless vốn không nạp `web/`. Xem [docs/proof/phase-2](docs/proof/phase-2/README.md).

## Tài liệu

- Bằng chứng: [phase-1](docs/proof/phase-1/README.md) · [phase-2](docs/proof/phase-2/README.md)
- Spec Phase 2 (acceptance criteria): [docs/notes/spec-phase-2.md](docs/notes/spec-phase-2.md)
- Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Harness AI: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.claude/settings.json](.claude/settings.json) (hook Stop chặn kết thúc khi test đỏ), [.claude/skills/verify](.claude/skills/verify/SKILL.md)
- [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) (MIT)
