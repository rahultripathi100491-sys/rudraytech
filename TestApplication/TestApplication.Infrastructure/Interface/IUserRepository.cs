using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IUserRepository
    {
        Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
        Task<User?> SetUserOnLine(User user, CancellationToken cancellationToken = default);
    }
}
