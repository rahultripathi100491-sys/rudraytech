using MediatR;
using Microsoft.AspNetCore.Identity;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class RegisterUserCommandHandler : IRequestHandler<RegisterUserCommand, Guid>
    {
        private readonly IUserRepository _userRepository;
        private readonly IPasswordHasher<User> _passwordHasher;

        public RegisterUserCommandHandler(IUserRepository userRepository, IPasswordHasher<User> passwordHasher)
        {
            _userRepository = userRepository;
            _passwordHasher = passwordHasher;
        }

        public async Task<Guid> Handle(RegisterUserCommand request, CancellationToken cancellationToken)
        {
            var email = request.user.Email.Trim().ToLowerInvariant();
            var exists = await _userRepository.ExistsByEmailAsync(email, cancellationToken);
            if (exists)
                throw new InvalidOperationException("Email already registered.");

            request.user.Password = _passwordHasher.HashPassword(request.user, request.user.Password);

            await _userRepository.AddAsync(request.user, cancellationToken);

            await _userRepository.SaveChangesAsync(cancellationToken);

            return request.user.Id;
        }
    }
}
