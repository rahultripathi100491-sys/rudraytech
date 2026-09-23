using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TestApplication.Application.Common.Command;

namespace TestApplication.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ISender _mediator;

        public ChatHub(ISender mediator)
        {
            _mediator = mediator;
        }

        public async Task JoinConversation(string ConversationId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ConversationId);
        }
        public async Task LeaveConversation(string ConversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, ConversationId);
        }
        //public async Task SendMessage(string ConversationId, string SenderId, string Message)
        //{
        //    await Clients.Group(ConversationId)
        //        .SendAsync("ReceiveMessage", new
        //        {
        //            ConversationId,
        //            SenderId,
        //            Message,
        //            SentAt=DateTime.UtcNow
        //        });
        //}
        public async Task SendMessage(string receiverUserId, string content)
        {
            var currentUserIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(currentUserIdClaim) || !Guid.TryParse(currentUserIdClaim, out var senderId))
            {
                throw new HubException("Unauthorized: Missing user identity claim.");
            }

            if (!Guid.TryParse(receiverUserId, out var targetId))
            {
                throw new HubException("Invalid receiver user ID.");
            }

            // Send Command via MediatR to save message to Database
            var command = new SendMessageCommand(senderId, targetId, content);
            var createdMessage = await _mediator.Send(command);

            // Broadcast to target user connection/group
            await Clients.User(receiverUserId).SendAsync("ReceiveMessage", createdMessage);
            await Clients.User(currentUserIdClaim).SendAsync("ReceiveMessage", createdMessage);
        }
        public async Task SendTyping(string ConversationId, string UserId)
        {
            await Clients.GroupExcept(ConversationId, Context.ConnectionId)
                .SendAsync("UserTyping", UserId);
        }
        public async Task UserOnline(string UserId)
        {
            await Clients
                .Others
                .SendAsync("UserOnline", UserId);
        }
        public async Task UserOffline(string UserId)
        {
            await Clients
                .Others
                .SendAsync("UserOffline", UserId);
        }
    }
}
