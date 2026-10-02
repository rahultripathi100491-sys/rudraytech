namespace TestApplication.Domain.Entity
{
    public record RefreshResponse
    {
        public string AccessToken { get; init; } = string.Empty;
        public DateTime ExpiresAt { get; init; }
    }
}
