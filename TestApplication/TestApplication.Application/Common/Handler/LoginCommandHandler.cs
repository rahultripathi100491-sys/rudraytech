using MediatR;
using Microsoft.AspNetCore.Identity;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponseDto>
    {
        private readonly IUserRepository _userRepository;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly ITokenService _tokenService;

        public LoginCommandHandler(IUserRepository userRepository, IPasswordHasher<User> passwordHasher, ITokenService tokenService)
        {
            _userRepository = userRepository;
            _passwordHasher = passwordHasher;
            _tokenService = tokenService;
        }

        public async Task<AuthResponseDto> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);

            var test = _passwordHasher.HashPassword(user!, request!.Password);

            if (user == null)
            {
                return null!; // User not found
            }
            var verificationResult = _passwordHasher.VerifyHashedPassword(
               user,
               user.Password,
               request.Password
            );
            if (verificationResult == PasswordVerificationResult.Failed)
            {
                throw new UnauthorizedAccessException("Invalid email or password.");
            }
            // 3. Generate token using TokenService
            var token = _tokenService.GenerateToken(user);
            var expiry = DateTime.UtcNow.AddMinutes(60);

            return new AuthResponseDto(token, expiry);
        }
        private bool VerifyPassword(string inputPassword, string storedHash)
        {
            // Replace with BCrypt, Argon2, or ASP.NET Identity PasswordHasher evaluation
            return inputPassword == storedHash;
        }
    }
}
