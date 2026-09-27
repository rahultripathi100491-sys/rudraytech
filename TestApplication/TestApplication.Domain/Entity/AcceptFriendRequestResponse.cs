namespace TestApplication.Domain.Entity
{
    public class AcceptFriendRequestResponse
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;

        public Guid? FriendshipId { get; set; }
    }
}
