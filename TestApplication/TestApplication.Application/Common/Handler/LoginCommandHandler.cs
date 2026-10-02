using MediatR;
using Microsoft.AspNetCore.Identity;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
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

        public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);

            if (user == null)
            {
                return null!;
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

            await _userRepository.SetUserOnLine(user);

            // =====================================================
            // ACCESS TOKEN
            // =====================================================

            var accessToken = _tokenService.GenerateToken(user);

            var expiresAt = DateTime.UtcNow.AddMinutes(60);

            // =====================================================
            // REFRESH TOKEN
            // =====================================================

            var refreshToken = _tokenService.GenerateRefreshToken();

            var refreshTokenHash = _tokenService.HashToken(refreshToken);

            var refreshDays = 7;

            var refreshTokenEntity = new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = refreshTokenHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(refreshDays)
            };

            // =====================================================
            // SAVE REFRESH TOKEN
            // =====================================================

            await _userRepository.AddRefreshTokenAsync(refreshTokenEntity, cancellationToken);

            await _userRepository.SaveChangesAsync(cancellationToken);

            // =====================================================
            // RESULT
            // =====================================================

            return new LoginResponse
            {
                Token = accessToken,
                RefreshToken = refreshToken,
                UserId = user.Id,
                UserName = user.FirstName,
                Email = user.Email,
                Expiry = expiresAt
            };
        }

        private bool VerifyPassword(string inputPassword, string storedHash)
        {
            // Replace with BCrypt, Argon2, or ASP.NET Identity PasswordHasher evaluation
            return inputPassword == storedHash;
        }
    }
}
