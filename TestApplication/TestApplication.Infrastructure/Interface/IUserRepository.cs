using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IUserRepository
    {
        Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
        Task<User?> SetUserOnLine(User user, CancellationToken cancellationToken = default);
        Task<List<User>> SearchUsersAsync(string searchTerm, Guid currentUserId, CancellationToken cancellationToken);
    }
}
