using MediatR;

namespace TestApplication.Application.Common.Command
{
    public sealed record UserConnectedCommand(string UserId, string UserName, string ConnectionId) : IRequest<bool>;
    public record UpdateUserOnlineStatusCommand(Guid UserId, bool IsOnline) : IRequest;
}
