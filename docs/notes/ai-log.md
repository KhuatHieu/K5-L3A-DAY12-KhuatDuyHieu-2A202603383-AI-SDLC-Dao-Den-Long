# Nhật ký dùng AI

## Phase 1
- Công cụ: Claude Code (Claude Opus 5.5), một phiên duy nhất, không dùng subagent.
- Quy trình: đọc PRD-0 + Test Contract → chốt kiến trúc tách logic (`src/sim.js`) khỏi render → viết test contract chạy CLI thật → code → chạy test/kịch bản → sửa → bằng chứng.
- Lỗi AI/bug phát hiện nhờ kiểm chứng:
  1. Bản đầu `sim.js` import `node:fs` → không chạy được trên trình duyệt. Sửa: tuning truyền vào qua `configure()`.
  2. Timer bằng giây trừ dần 1/60 → sai số float: bất tử kéo dài 91 tick thay vì 90; choáng 179 thay vì 180. Sửa: timer đếm tick nguyên, giảm ở đầu bước (test `invuln_s`, `stun lasts`).
  3. Kịch bản `win` không thắng: đi 50 tick = 4.9999999 m nên khoảng cách 3.0000001 > `interact_radius`. Sửa: so bán kính với dung sai 1e-6, thêm test hồi quy.
  4. Hai test do AI viết tính sai thời gian (Bóng Mực chưa kịp tới; người chơi chết trước khi quái mới sinh) → sửa test, không sửa luật.
- Thử tải âm thanh CC0 (Kenney) bị 403 → chuyển sang âm thanh tự tổng hợp.
- Token ước tính: ~150k token vào / ~35k token ra (phần lớn là đọc đề + viết code một lần; không chạy agent vòng lặp).
- Tiết kiệm: chỉ đọc file cần thiết; test chạy CLI thật nên không phải đọc output thủ công; dùng script `scripts/proof.sh` để tạo lại bằng chứng bằng một lệnh.
