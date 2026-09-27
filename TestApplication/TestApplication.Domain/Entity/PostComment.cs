namespace TestApplication.Domain.Entity
{
    public class PostComment
    {
        public Guid Id { get; set; }
        public Guid PostId { get; set; }
        public Guid UserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public Post Post { get; set; } = null!;
        public User User { get; set; } = null!;
    }
    public class AddCommentRequest
    {
        public string Content { get; set; } = string.Empty;
    }
}
