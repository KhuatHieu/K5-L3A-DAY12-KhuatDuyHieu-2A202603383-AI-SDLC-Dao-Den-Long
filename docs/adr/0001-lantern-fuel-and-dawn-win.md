# ADR 0001 — Đèn có nhiên liệu, thắng khi sống tới bình minh

- Trạng thái: Chấp nhận (Phase 3, Ticket-03, contract v1.2)
- Thay thế: luật "đèn sáng là vĩnh viễn" và "thắng ngay khi thắp hết đèn" (Phase 1–2)

## Bối cảnh
Ticket-03: người chơi giỏi thắp hết đèn trong 2 phút, cuối Đêm thiếu căng thẳng. Mục tiêu đổi từ "thắp hết" sang "giữ đảo sáng tới bình minh".

## Quyết định
1. **Mô hình trạng thái đèn** đổi từ 2 trạng thái một chiều (`unlit → lit`) thành một vòng:
   `unlit(ever_lit=false) --10 đom đóm--> lit(fuel=100) --fuel≤0--> unlit(ever_lit=true) --5 đom đóm--> lit(fuel=100) …`
   Đèn đang sáng mang thêm `fuel` và nhận *châm dầu* (`refuel`). `relit_count` đếm số lần thắp lại.
2. **Dầu là số nguyên** theo đơn vị 1/60 (`FU = 60` trong `sim.js`): hao đúng 1 đơn vị mỗi tick, mỗi Bóng hút thêm 5 đơn vị mỗi tick. Không có sai số float tích lũy; chỉ làm tròn 1 chữ số khi xuất snapshot. Phase 1 đã từng gặp lỗi float với timer, nên lần này chọn đơn vị nguyên từ đầu.
3. **Vùng an toàn** tính từ trạng thái đèn: `lit && fuel ≥ 30` (`safeLantern`). Đèn yếu là "mồi" cho Bóng Mực, tạo trạng thái mới `drain` trong máy trạng thái của Bóng: `wander → drain → {chase | stunned | wander}`.
4. **Luật thắng** chỉ xét ở tick bình minh, sau mọi cập nhật trong tick: `flames ≤ 0 → lost/no_flames` luôn ưu tiên; nếu hết giờ thì `lit ≥ ceil(0.6·n) → won/dawn_survived`, ngược lại `lost/dawn`. Bỏ `all_lit` và bỏ thưởng thời gian. Điểm bình minh tính theo dầu còn lại của từng đèn sáng.
5. **Thứ tự trong tick**: hao và hút dầu được đặt ở bước 2 (2b), đèn hết dầu tắt ngay sau đó, trước bước di chuyển. Vì vậy đèn tắt đúng ở tick bình minh thì không được tính.

## Hệ quả
- Một đèn có thể phát `lantern_lit` nhiều lần (`relight: true`). Sức chứa tăng theo `successful_lights`.
- Test cũ phụ thuộc "thắng sớm" hoặc "đèn sáng không nhận đom đóm" đã được thay; lý do ghi ngay tại test (comment `[Ticket-03]`) và trong `CHANGELOG.md`.
- Đèn sáng hao ngay ở bước 2 nên không bao giờ "đầy 100" vào lúc tương tác. Châm dầu cho đèn vừa thắp tốn 1 đom đóm (`ceil(0.017/10) = 1`). Đây là hệ quả trực tiếp của công thức trong ticket; tôi giữ nguyên và có test riêng.
- Bóng ở trạng thái `drain` đứng yên và không gây sát thương (giả định C3); muốn tấn công thì nó phải chuyển sang `chase` khi Mây vào trong 6 m.

## Phương án đã loại
- Lưu dầu bằng float giây: dễ lệch 1 tick ở ngưỡng 30 và 0.
- Giữ `all_lit` như thắng phụ: ticket ghi rõ là bỏ.
