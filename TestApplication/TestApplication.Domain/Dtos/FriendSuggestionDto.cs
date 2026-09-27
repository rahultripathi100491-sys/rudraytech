namespace TestApplication.Domain.Dtos
{
    public class FriendSuggestionDto
    {
        public Guid UserId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string? ProfileImage { get; set; }

        public int MutualFriends { get; set; }
    }
}
