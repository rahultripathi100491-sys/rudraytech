using Microsoft.AspNetCore.Identity;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Services
{
    public class UserService
    {
        private readonly IPasswordHasher<User> _passwordHasher;

        public UserService(IPasswordHasher<User> passwordHasher)
        {
            _passwordHasher = passwordHasher;
        }
        public string HashPassword(User user, string plainPassword)
        {
            // Generates a secure, salted hash
            return _passwordHasher.HashPassword(user, plainPassword);
        }

        public bool VerifyPassword(User user, string hashedPassword, string providedPassword)
        {
            var result = _passwordHasher.VerifyHashedPassword(user, hashedPassword, providedPassword);
            return result == PasswordVerificationResult.Success;
        }
    }
}
