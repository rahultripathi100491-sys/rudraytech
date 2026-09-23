using Microsoft.VisualBasic;
using System.ComponentModel.DataAnnotations;
using TestApplication.Domain.Enums;

namespace TestApplication.Domain.Entity
{
    public class ConversationMember
    {
        [Key] 
        public Guid Id { get; set; }
        public Guid ConversationId { get; set; }

        public Guid UserId { get; set; }

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        public Conversation Conversation { get; set; } = null!;

        public User User { get; set; } = null!;
    }
}
