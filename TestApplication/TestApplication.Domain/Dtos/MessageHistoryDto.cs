using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;

namespace TestApplication.Domain.Dtos;

public class MessageHistoryDto
{
    public Guid Id { get; set; }
    public Guid SenderUserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public MessageStatus Status { get; set; }
    public DateTime SentAtUtc { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? ReadAt { get; set; }
    public Conversation Conversation { get; set; } = null!;

}