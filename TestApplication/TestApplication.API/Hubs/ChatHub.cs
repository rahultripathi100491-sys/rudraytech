using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Services;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ISender _mediator;
        private readonly IEncryptionService _encryptionService;
        private readonly UserPresenceService _presence;

        public ChatHub(
            ISender mediator,
            IEncryptionService encryptionService,
            UserPresenceService presence)
        {
            _mediator = mediator;
            _encryptionService = encryptionService;
            _presence = presence;
        }

        // =========================================================
        // CONNECTED
        // =========================================================

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            if (string.IsNullOrWhiteSpace(userId))
            {
                await base.OnConnectedAsync();
                return;
            }

            if (!Guid.TryParse(userId, out var userGuid))
            {
                await base.OnConnectedAsync();
                return;
            }

            // Add this connection to presence service
            var becameOnline = _presence.AddConnection(
                userId,
                Context.ConnectionId
            );

            Console.WriteLine(
                $"🟢 User connected: {userId}"
            );

            // Only update DB + broadcast when
            // the FIRST connection is established.
            if (becameOnline)
            {
                // Update User.IsOnline = true
                await _mediator.Send(
                    new UpdateUserOnlineStatusCommand(
                        userGuid,
                        true
                    )
                );

                // Notify everyone else
                await Clients.Others.SendAsync(
                    "UserOnline",
                    userId
                );
            }

            await base.OnConnectedAsync();
        }

        // =========================================================
        // DISCONNECTED
        // =========================================================

        public override async Task OnDisconnectedAsync(
            Exception? exception)
        {
            var userId = Context.User?
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                var becameOffline =
                    _presence.RemoveConnection(
                        userId,
                        Context.ConnectionId
                    );

                Console.WriteLine(
                    $"🔴 User disconnected: {userId}"
                );

                // Only update DB + broadcast when
                // the LAST connection disappears.
                if (becameOffline)
                {
                    if (Guid.TryParse(userId, out var userGuid))
                    {
                        // Update User.IsOnline = false
                        await _mediator.Send(
                            new UpdateUserOnlineStatusCommand(
                                userGuid,
                                false
                            )
                        );
                    }

                    await Clients.Others.SendAsync(
                        "UserOffline",
                        new
                        {
                            userId = userId,
                            lastSeen = DateTime.UtcNow
                        }
                    );
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        // =========================================================
        // GET ONLINE USERS
        // =========================================================

        public Task<string[]> GetOnlineUsers()
        {
            return Task.FromResult(
                _presence.GetOnlineUsers()
            );
        }

        // =========================================================
        // CONVERSATION
        // =========================================================

        public async Task JoinConversation(
            string conversationId)
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                conversationId
            );
        }

        public async Task LeaveConversation(
            string conversationId)
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                conversationId
            );
        }

        // =========================================================
        // SEND MESSAGE
        // =========================================================

        public async Task SendMessage(
            string receiverUserId,
            string content)
        {
            var currentUserIdClaim =
                Context.User?
                    .FindFirst(ClaimTypes.NameIdentifier)?
                    .Value;

            if (
                string.IsNullOrEmpty(currentUserIdClaim) ||
                !Guid.TryParse(
                    currentUserIdClaim,
                    out var senderId)
            )
            {
                throw new HubException(
                    "Unauthorized: Missing user identity claim."
                );
            }

            if (!Guid.TryParse(
                    receiverUserId,
                    out var targetId))
            {
                throw new HubException(
                    "Invalid receiver user ID."
                );
            }

            var encryptedMessage =
                _encryptionService.Encrypt(content);

            var command =
                new SendMessageCommand(
                    senderId,
                    targetId,
                    encryptedMessage
                );

            var createdMessage =
                await _mediator.Send(command);

            await Clients.User(receiverUserId)
                .SendAsync(
                    "ReceiveMessage",
                    createdMessage
                );

            await Clients.User(currentUserIdClaim)
                .SendAsync(
                    "ReceiveMessage",
                    createdMessage
                );
        }

        // =========================================================
        // TYPING
        // =========================================================

        public async Task SendTyping(
            string conversationId,
            string userId)
        {
            await Clients
                .GroupExcept(
                    conversationId,
                    Context.ConnectionId)
                .SendAsync(
                    "UserTyping",
                    userId
                );
        }

        // =========================================================
        // CALLING
        // =========================================================

        public async Task SendOffer(
            string targetUserId,
            string offer) =>
            await Clients.User(targetUserId)
                .SendAsync(
                    "ReceiveOffer",
                    Context.UserIdentifier,
                    offer
                );

        public async Task SendAnswer(
            string targetUserId,
            string answer) =>
            await Clients.User(targetUserId)
                .SendAsync(
                    "ReceiveAnswer",
                    Context.UserIdentifier,
                    answer
                );

        public async Task SendIceCandidate(
            string targetUserId,
            string candidate) =>
            await Clients.User(targetUserId)
                .SendAsync(
                    "ReceiveIceCandidate",
                    Context.UserIdentifier,
                    candidate
                );

        public async Task RingUser(
            string targetUserId) =>
            await Clients.User(targetUserId)
                .SendAsync(
                    "IncomingCall",
                    Context.UserIdentifier
                );

        public async Task AcceptCall(
            string targetUserId) =>
            await Clients.User(targetUserId)
                .SendAsync(
                    "CallAccepted",
                    Context.UserIdentifier
                );

        public async Task RejectCall(
            string targetUserId) =>
            await Clients.User(targetUserId)
                .SendAsync(
                    "CallRejected",
                    Context.UserIdentifier
                );

        public async Task EndCall(
            string targetUserId)
        {
            await Clients.User(targetUserId)
                .SendAsync("CallEnded");
        }
    }
}
