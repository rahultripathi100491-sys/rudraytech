using TestApplication.Domain.Enums;

namespace TestApplication.Domain.Entity
{
    public class Friendship
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid FriendId { get; set; }
        public FriendshipStatus Status { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public User User { get; set; } = null!;
        public User Friend { get; set; } = null!;
    }
}
