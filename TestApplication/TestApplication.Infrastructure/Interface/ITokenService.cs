using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface ITokenService
    {
        string GenerateToken(User user);
        string GenerateRefreshToken();
        string HashToken(string token);
    }
}
