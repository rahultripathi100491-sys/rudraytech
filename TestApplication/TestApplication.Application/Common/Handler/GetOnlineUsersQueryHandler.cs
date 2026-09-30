using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetOnlineUsersQueryHandler : IRequestHandler<GetOnlineUsersQuery, IReadOnlyCollection<UserPresence>>
    {
        private readonly IUserPresenceService _presenceService;

        public GetOnlineUsersQueryHandler(IUserPresenceService presenceService)
        {
            _presenceService = presenceService;
        }

        public Task<IReadOnlyCollection<UserPresence>> Handle(GetOnlineUsersQuery request, CancellationToken cancellationToken)
        {
            var users = _presenceService.GetOnlineUsers();

            return Task.FromResult(users);
        }
    }
}
