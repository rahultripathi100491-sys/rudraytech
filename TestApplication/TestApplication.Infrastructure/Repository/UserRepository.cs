using Microsoft.EntityFrameworkCore;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Infrastructure.Repository
{
    public class UserRepository : IUserRepository
    {
        private readonly ApplicationDbContext _context;

        public UserRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            return await _context.Users
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
        }

        public async Task<List<User>> SearchUsersAsync(string searchTerm, Guid currentUserId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return new List<User>();
            }

            var term = searchTerm.Trim().ToLower();

            return await _context.Users
                .AsNoTracking()
                .Where(u => u.Id != currentUserId &&
                           (u.FirstName!.ToLower().Contains(term) || u.LastName!.ToLower().Contains(term) || u.Email!.ToLower().Contains(term)))
                .Take(10)
                .ToListAsync(cancellationToken);
        }

        public async Task<User?> SetUserOnLine(User user, CancellationToken cancellationToken = default)
        {
            user.IsOnLine = true;

            await _context.SaveChangesAsync();
            return user;
        }
    }
}
