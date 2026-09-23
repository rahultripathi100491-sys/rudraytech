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
            //Set user Online
            await _userRepository.SetUserOnLine(user);
            // 3. Generate token using TokenService
            //var token = _tokenService.GenerateToken(user);
            //var expiry = DateTime.UtcNow.AddMinutes(60);
            var loginResponse = new LoginResponse();
            loginResponse.UserId = user.Id;
            loginResponse.UserName = user.FirstName + " " + user.LastName;
            loginResponse.Email = user.Email;
            loginResponse.Token = _tokenService.GenerateToken(user);
            loginResponse.Expiry = DateTime.UtcNow.AddMinutes(60);

            return loginResponse;
        }
        private bool VerifyPassword(string inputPassword, string storedHash)
        {
            // Replace with BCrypt, Argon2, or ASP.NET Identity PasswordHasher evaluation
            return inputPassword == storedHash;
        }
    }
}
