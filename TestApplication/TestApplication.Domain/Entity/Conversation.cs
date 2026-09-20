using System.ComponentModel.DataAnnotations;
using TestApplication.Domain.Enums;

namespace TestApplication.Domain.Entity
{
    public class Conversation
    {
        [Key]
        public Guid Id { get; set; }

        public string? Name { get; set; }

        public ConversationType Type { get; set; }

        public string? ImageUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<ConversationMember> Members { get; set; }
            = new List<ConversationMember>();

        public ICollection<Message> Messages { get; set; }
            = new List<Message>();
    }
}
