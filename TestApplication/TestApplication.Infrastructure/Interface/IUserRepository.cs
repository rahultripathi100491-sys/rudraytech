using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IUserRepository
    {
        Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
        Task<User?> SetUserOnLine(User user, CancellationToken cancellationToken = default);
        Task<List<User>> SearchUsersAsync(string searchTerm, Guid currentUserId, CancellationToken cancellationToken);
        Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken);
        Task AddAsync(User user, CancellationToken cancellationToken);
        Task AddRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken);
        Task SaveChangesAsync(CancellationToken cancellationToken);
        Task<User?> GetByIdAsync(Guid userId);
        Task UpdateAsync(User user);
    }
}
