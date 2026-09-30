namespace TestApplication.Domain.Entity
{
    public sealed class UserPresence
    {
        public string UserId { get; init; } = default!;
        public string UserName { get; init; } = default!;
        public DateTime ConnectedAtUtc { get; init; }
    }
}
