using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class UserConnectedCommandHandler : IRequestHandler<UserConnectedCommand, bool>
    {
        private readonly IUserPresenceService _presenceService;

        public UserConnectedCommandHandler(IUserPresenceService presenceService)
        {
            _presenceService = presenceService;
        }

        public Task<bool> Handle(UserConnectedCommand request, CancellationToken cancellationToken)
        {
            var becameOnline = _presenceService.AddConnection(request.UserId, request.UserName, request.ConnectionId);

            return Task.FromResult(becameOnline);
        }
    }
}
