using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IUserPresenceService
    {
        bool AddConnection(string userId, string userName, string connectionId);
        bool RemoveConnection(string userId, string connectionId);
        IReadOnlyCollection<UserPresence> GetOnlineUsers();
        bool IsOnline(string userId);
    }
}
