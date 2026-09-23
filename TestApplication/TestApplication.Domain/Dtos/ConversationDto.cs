namespace TestApplication.Domain.Dtos
{
    public class ConversationDto
    {
        public Guid Id { get; set; }
        public Guid ParticipantUserId { get; set; }
        public string ParticipantName { get; set; } = string.Empty;
        public string? LastMessage { get; set; }
        public int UnreadCount { get; set; }
    }
}
