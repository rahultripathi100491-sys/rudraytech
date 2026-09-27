namespace TestApplication.Domain.Dtos
{
    public class FriendDto
    {
        public Guid UserId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string? ProfileImage { get; set; }
    }
}
