namespace TestApplication.Domain.Dtos
{
    public class ChatMessageDto
    {
        public Guid Id { get; set; }
        public Guid SenderUserId { get; set; }
        public Guid ReceiverUserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime SentAt { get; set; }
    }
}
