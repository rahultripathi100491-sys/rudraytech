using Microsoft.AspNetCore.SignalR;
using System.Text.RegularExpressions;

namespace TestApplication.API.Hubs
{
    public class ChatHub : Hub
    {
        public async Task JoinConversation(string ConversationId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ConversationId);
        }
        public async Task LeaveConversation(string ConversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, ConversationId);
        }
        public async Task SendMessage(string ConversationId, string SenderId, string Message)
        {
            await Clients.Group(ConversationId)
                .SendAsync("ReceiveMessage", new
                {
                    ConversationId,
                    SenderId,
                    Message,
                    SentAt=DateTime.UtcNow
                });
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
