using System.ComponentModel.DataAnnotations;

namespace TestApplication.Domain.Entity
{
    public class User
    {
        public Guid Id { get; set; }
        public required string FirstName { get; set; }
        public required string LastName { get; set; }
        public required string PhoneNumber { get; set; }
        [EmailAddress]
        public required string Email { get; set; }
        [DataType(DataType.Password)]
        public required string Password { get; set; }
        public bool IsEmailConfirmed { get; set; }
        public string? ProfileImage { get; set; }
        public bool IsActive { get; set; }
        public bool IsOnLine { get; set; }
        public DateTime? LastSeen { get; set; } = DateTime.UtcNow;
        public ICollection<ConversationMember> ConversationMembers { get; set; }
        = new List<ConversationMember>();

        public ICollection<Message> Messages { get; set; }
            = new List<Message>();
    }
}
