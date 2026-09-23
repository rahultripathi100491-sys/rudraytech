using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace TestApplication.API.Hubs
{
    public class CustomUserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection)
        {
            // Must match the exact string format stored in receiverUserId
            return connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? connection.User?.FindFirst("sub")?.Value
                ?? connection.User?.FindFirst("id")?.Value;
        }
    }
}
