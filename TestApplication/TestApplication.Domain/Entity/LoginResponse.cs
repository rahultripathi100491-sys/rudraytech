using System.Runtime.CompilerServices;

namespace TestApplication.Domain.Entity
{
    public record LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public string RefreshToken { get; init; } = string.Empty;
        public DateTime Expiry { get; set; }
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool IsLogin{ get; set; }
    }
}
