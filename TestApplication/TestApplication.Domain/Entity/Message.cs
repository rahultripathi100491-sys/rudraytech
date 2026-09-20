using System.ComponentModel.DataAnnotations;

namespace TestApplication.Domain.Entity
{
    public class Message
    {
        [Key]
        public Guid Id { get; set; }

        public Guid ConversationId { get; set; }

        public Guid SenderId { get; set; }

        public string Content { get; set; } = string.Empty;

        public string? AttachmentUrl { get; set; }

        public DateTime SentAt { get; set; } = DateTime.UtcNow;

        public Conversation Conversation { get; set; } = null!;

        public User Sender { get; set; } = null!;
    }
}
