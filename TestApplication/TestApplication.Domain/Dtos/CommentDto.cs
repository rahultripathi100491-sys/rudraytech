namespace TestApplication.Domain.Dtos
{
    public class CommentDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? ProfileImage { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
