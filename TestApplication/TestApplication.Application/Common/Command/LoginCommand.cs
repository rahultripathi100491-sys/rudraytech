using MediatR;

namespace TestApplication.Application.Common.Command
{
    // Response DTO
    public record AuthResponseDto(string Token, DateTime Expiry);
    // Command Request
    public record LoginCommand(string Email, string Password) : IRequest<AuthResponseDto>;
}
