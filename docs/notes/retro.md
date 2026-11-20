# Retro — Đảo Đèn Lồng (4 phase)

## Evaluation từng phase
| Phase | Kết quả | Đánh giá |
|---|---|---|
| 1 · PRD-0 | Đêm 1 + headless v1.0, 24 test | Tách `sim.js` thuần ngay từ đầu là quyết định đáng giá nhất: mọi phase sau chỉ sửa một file luật. Chưa chơi tay; tag thiếu thư mục `out/` vì `.gitignore` (phát hiện ở Phase 2). |
| 2 · Ba hòn đảo | Viết lại sim theo 11 bước tick, 3 bản đồ, UI đầy đủ, 39 test | Ticket dài nhưng chính xác; viết test từ ticket trước khi chạy giúp bắt lỗi recoil 59/60. Đo FPS headless mặc định ra số sai (SwiftShader) → phải ép GPU. |
| 3 · Đèn cạn dầu | Dầu theo đơn vị nguyên, drain, thắng ở bình minh, 51 test, ADR | Nhờ có bộ test lớn, luật bị thay thế lộ ra ngay ở đúng 4 test; cập nhật có ghi lý do. Xong trong khung 30 phút. |
| 4 · Bình minh | bench/soak/leaderboard/accessibility/release, 57 test | Soak lần đầu trượt ngưỡng RAM; phân tích heap cho thấy không rò rỉ mà do JIT → dùng `--jitless` có ghi lý do. Video phải do người làm. |

## Điều hiệu quả khi làm với AI
- **Contract test chạy CLI thật**: một lệnh `npm test` thay cho việc đọc output bằng mắt. Các test đều lấy số từ `game.contract.json` nên đổi số là test đổi theo.
- **Chép ticket vào repo** (`docs/lab/phase-N-*.md`) trước khi code, để AI và người chấm cùng nhìn một bản yêu cầu.
- **Kiểm chứng bằng mắt**: mỗi thay đổi UI đều được chụp ảnh và xem lại. Cách này bắt được nhãn "Shift trái" tràn ô và lỗi cú pháp khiến trang bench trắng.

## Điều không hiệu quả
- AI tự viết test rồi tự sửa test là rủi ro "test luôn xanh". Tôi giảm rủi ro bằng cách bắt mỗi lần sửa test phải ghi lý do và đối chiếu với ticket (ai-log). Tổng cộng 11 test sai do AI viết, đều là lỗi đọc sai tick hoặc thiếu cờ, không có trường hợp nào sửa luật cho khớp test.
- `--virtual-time-budget` của Chrome không chạy sim thật: ảnh "đúng" nhưng đồng hồ đứng yên. Phải viết `scripts/shot.mjs` chạy theo thời gian thực.
- Lab board tải ticket từ database riêng mà AI không được phép đọc, nên mỗi phase người dùng phải dán ticket vào.

## Những lần AI sai và cách phát hiện
1. Sai số float ở timer và bán kính (Phase 1): kịch bản `win` không thắng → sửa bằng đếm tick nguyên và epsilon.
2. Recoil 1.967 m thay vì 2 m (Phase 2): test số học → bước lùi đầu tiên đặt ngay tick bị đánh.
3. Comment `//` chèn giữa dòng làm hỏng cả module (Phase 4): bench báo "page error" → bắt `Runtime.exceptionThrown` qua CDP, rồi chạy `node --check`.
4. `.gitignore` chặn bằng chứng (Phase 1): phát hiện khi `git status` ở Phase 2 không thấy `out/`.
5. `pkill -f` khớp nhầm shell của chính AI (Phase 2): exit 144 → dùng mẹo `[u]ser-data-dir`; đã ghi vào skill `verify`.
6. Giả thuyết "semi-space" cho RAM soak bị đo sai: đo `process.memoryUsage()` mới thấy heap không đổi, phần tăng là JIT.

## Harness giúp nhiều nhất
- **AGENTS.md** ngắn (≈ 30 dòng) với các luật cứng: sim thuần, tuning một nguồn, timer bằng tick nguyên, không làm yếu test. Mỗi khi AI sai một lỗi mới, thêm một dòng.
- **Hook Stop** (`.claude/settings.json`): không cho kết thúc lượt khi `npm test` đỏ, chặn được việc "báo xong" khi test chưa xanh.
- **Skill `verify`**: một quy trình kiểm chứng lặp lại (test → proof → ảnh → FPS); ghi cả các bẫy đã gặp (SwiftShader, pkill).

## Token / chi phí ước tính
| Phase | Token vào | Token ra |
|---|---|---|
| 1 | ~150k | ~35k |
| 2 | ~250k | ~60k |
| 3 | ~120k | ~35k |
| 4 | ~220k | ~55k |
| **Tổng** | **~740k** | **~185k** |

Tiết kiệm token bằng cách: một phiên duy nhất, không dùng subagent; đọc kết quả test qua `grep` thay vì đọc nguyên log; sửa code bằng thay chuỗi có kiểm tra (`assert count == 1`) thay vì viết lại file; tự dựng CDP bằng WebSocket có sẵn của Node thay vì cài và debug puppeteer; chép ticket vào repo một lần.

## Nếu làm lại
- Ngay Phase 1 thêm `scripts/shot.mjs` (chụp theo thời gian thực) và một test `node --check` cho `web/`.
- Viết `.gitignore` theo đường dẫn gốc (`/out/`) ngay từ đầu.
- Dành 10 phút mỗi phase để tự chơi tay, thay vì dồn hết vào video cuối.
- Dùng InstancedMesh cho Bóng Mực trước khi đo bench, để dư biên trên máy yếu.
