using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IUserRepository
    {
        Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    }
}
