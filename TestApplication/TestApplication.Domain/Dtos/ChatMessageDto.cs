using TestApplication.Domain.Enums;

namespace TestApplication.Domain.Dtos
{
    public class ChatMessageDto
    {
        public Guid Id { get; set; }
        public Guid SenderUserId { get; set; }
        public Guid ReceiverUserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public MessageStatus Status { get; set; }
        public DateTime SentAtUtc { get; set; }
        public DateTime? DeliveredAtUtc { get; set; }

        public DateTime? ReadAtUtc { get; set; }
    }
}
