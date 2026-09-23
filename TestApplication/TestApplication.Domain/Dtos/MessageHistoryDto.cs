namespace TestApplication.Domain.Dtos;

public class MessageHistoryDto
{
    public Guid Id { get; set; }

    public Guid SenderUserId { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime SentAtUtc { get; set; }
}