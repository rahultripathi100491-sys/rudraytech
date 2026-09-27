namespace TestApplication.Domain.Entity
{
    public class PostLike
    {
        public Guid Id { get; set; }
        public Guid PostId { get; set; }
        public Guid UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public Post Post { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
