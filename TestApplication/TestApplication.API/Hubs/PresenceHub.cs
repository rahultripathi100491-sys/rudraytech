using MediatR;
using Microsoft.AspNetCore.SignalR;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.API.Hubs
{
    public class PresenceHub : Hub
    {
        private readonly IMediator _mediator;
        private readonly IUserPresenceService _presenceService;

        public PresenceHub(IMediator mediator, IUserPresenceService presenceService)
        {
            _mediator = mediator;
            _presenceService = presenceService;
        }
        public override async Task OnConnectedAsync()
        {
            // Demo identity.
            //
            // Replace this with:
            // Context.User?.FindFirst("sub")?.Value
            // when JWT authentication is configured.

            var userId = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault() ?? Context.ConnectionId;

            var userName = Context.GetHttpContext()?.Request.Query["userName"].FirstOrDefault() ?? "Anonymous";

            var becameOnline = await _mediator.Send(new UserConnectedCommand(userId, userName, Context.ConnectionId));

            if (becameOnline)
            {
                await Clients.Others.SendAsync(
                    "UserOnline",
                    new
                    {
                        userId,
                        userName
                    });
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault() ?? Context.ConnectionId;

            var userName = Context.GetHttpContext()?.Request.Query["userName"].FirstOrDefault() ?? "Anonymous";

            var wentOffline = _presenceService.RemoveConnection(userId, Context.ConnectionId);

            if (wentOffline)
            {
                await Clients.Others.SendAsync(
                    "UserOffline",
                    new
                    {
                        userId,
                        userName
                    });
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task<IReadOnlyCollection<UserPresence>> GetOnlineUsers()
        {
            return await _mediator.Send(new GetOnlineUsersQuery());
        }
    }
}
