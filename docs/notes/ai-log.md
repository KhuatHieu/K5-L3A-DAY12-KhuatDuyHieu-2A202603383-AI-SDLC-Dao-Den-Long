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

## Phase 2
- Công cụ: Claude Code (Claude Opus 5.5), cùng phiên, không dùng subagent.
- Lấy yêu cầu: AI đọc lab board nhưng Ticket-02 được tải từ database riêng của artifact, mà tài khoản AI không được phép đọc. Người dùng dán nội dung ticket vào; AI chép lại vào `docs/lab/phase-2-ticket-02.md`.
- Quy trình: chép ticket → viết lại `sim.js` theo đúng thứ tự 11 bước → cập nhật contract v1.1 và CLI → viết lại test (39) → sửa → làm bản chơi (menu, tạm dừng, cài đặt, HUD, 3 bản đồ) → ảnh chụp + đo FPS → tài liệu.
- Test Phase 1 bị luật mới làm sai và đã được **sửa kèm lý do** (không tắt):
  - điểm +10 tính khi **nạp** chứ không phải khi nhặt;
  - `pickup_radius` 1.5 → 1.0, `interact_radius` 3 → 2, `carry_capacity`/`lantern_cost` 5 → 10;
  - `pulse_cost` 1 → 3, `pulse_radius` 6 → 5 (đo 3D từ chân + 0.8 m);
  - stun 3 s → 120 tick, đẩy lùi giờ trải trong 15 tick thay vì tức thời;
  - Bóng Mực sinh 2 con ở tick 300 thay vì 2 con lúc đầu;
  - đom đóm rơi khi bị đánh giờ nằm lại trên đất (sống 480 tick) thay vì mất hẳn;
  - `fall_enabled` false → true.
- Lỗi phát hiện nhờ kiểm chứng:
  1. Recoil chỉ lùi 1.967 m thay vì 2 m: bộ đếm giảm trước khi di chuyển nên chỉ có 59/60 bước. Sửa: bước lùi đầu tiên xảy ra ngay tick bị đánh.
  2. Bốn test do AI viết sai: test gió quên bật `wind_enabled`; test Gió Lạc chưa ở trạng thái chase lúc Tỏa Sáng (Tỏa Sáng ở bước 7 xảy ra trước khi Gió Lạc cập nhật trạng thái ở bước 8); test kết thúc trước tick cần kiểm tra; test "thắp + bị đánh cùng tick" không thể xảy ra vì Bóng ở gần đèn vừa thắp bị đẩy ra và không gây sát thương. Đã sửa test, giữ nguyên luật.
  3. Script đo FPS dính tiến trình Chrome cũ (cổng 9333) từ lần chạy lỗi trước, và `pkill -f` khớp nhầm shell của chính nó (exit 144). Sửa: tự dọn khi thoát, dùng mẹo `[u]ser-data-dir` khi pkill. Ghi vào skill `verify`.
  4. Đo FPS headless mặc định dùng SwiftShader (CPU, ~11 FPS), không đại diện cho máy thật. Bật GL (`--use-angle=gl`) để đo trên iGPU Intel Arc thật.
- Token ước tính Phase 2: ~250k vào / ~60k ra (phần lớn là viết lại sim, test và renderer).
- Tiết kiệm: ticket được chép một lần vào repo; test chạy CLI thật nên đọc kết quả qua grep; tự dựng CDP bằng WebSocket có sẵn của Node thay vì cài puppeteer.

## Phase 3 (30 phút)
- Ticket-03 do người dùng dán, AI chép vào `docs/lab/phase-3-ticket-03.md`.
- Quyết định chính (ADR 0001): dầu là số nguyên theo đơn vị 1/60 ngay từ đầu, rút kinh nghiệm từ lỗi float ở Phase 1.
- Test cũ bị luật mới làm sai, đã **cập nhật kèm comment `[Ticket-03]`** (không skip):
  1. `contract file` → v1.2, thời lượng mới, bảng điểm mới;
  2. `deposit…` → +5/đom đóm, `lantern_lit.relight`;
  3. `nearest… tie` → đèn sáng giờ cũng chọn được (để châm dầu), nên dời L3 ra xa;
  4. `win all_lit…` → **thay** bằng `lighting all lanterns does not end the night…` vì `all_lit` đã bị bỏ.
- Thêm 13 test Phase 3, tổng 51/51 đạt.
- Lỗi phát hiện nhờ kiểm chứng: 3 test mới do AI viết sai. Hai test quên `every: 1` nên đọc snapshot không tồn tại. Một test kỳ vọng lần nhấn E thứ hai nạp vào L2, nhưng đúng luật thì L1 vừa thắp đã hao xuống dưới 100 nên vẫn chọn được và gần hơn. Đã sửa test, luật giữ nguyên, và ghi thành giả định C8.
- Kịch bản `drain_refuel` không ra kết quả như dự tính: Bóng chuyển sang chase rồi đánh trúng Mây trước khi kịp châm dầu. Đổi tên thành `drain_chase` để đúng với điều nó chứng minh, thay vì sửa input cho "đẹp".
- Token ước tính Phase 3: ~120k vào / ~35k ra.
