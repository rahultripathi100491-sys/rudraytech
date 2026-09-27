namespace TestApplication.Domain.Dtos
{
    public class FriendRequestDto
    {
        public Guid FriendshipId { get; set; }
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ProfileImage { get; set; }
        public DateTime CreatedDate { get; set; }
    }
}
