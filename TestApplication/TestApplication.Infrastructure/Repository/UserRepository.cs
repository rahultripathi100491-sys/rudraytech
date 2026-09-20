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

        public async Task<User?> SetUserOnLine(User user, CancellationToken cancellationToken = default)
        {
            user.IsOnLine = true;

            await _context.SaveChangesAsync();
            return user;
        }
    }
}
