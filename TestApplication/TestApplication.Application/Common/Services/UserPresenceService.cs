using System.Collections.Concurrent;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Services
{
    public class UserPresenceService : IUserPresenceService
    {
        private readonly ConcurrentDictionary<string, HashSet<string>> _connections = new();
        public bool AddConnection(string userId, string connectionId)
        {
            var connections = _connections.GetOrAdd(userId, _ => new HashSet<string>());

            lock (connections)
            {
                var wasOffline = connections.Count == 0;

                connections.Add(connectionId);

                return wasOffline;
            }
        }

        public bool RemoveConnection(string userId, string connectionId)
        {
            if (
                !_connections.TryGetValue(userId, out var connections)
            )
            {
                return false;
            }

            lock (connections)
            {
                connections.Remove(connectionId);

                if (connections.Count == 0)
                {
                    _connections.TryRemove(userId, out _);

                    return true;
                }

                return false;
            }
        }

        public string[] GetOnlineUsers()
        {
            return _connections.Where(x => x.Value.Count > 0).Select(x => x.Key).ToArray();
        }

        public bool IsOnline(
            string userId)
        {
            if (
                !_connections.TryGetValue(userId, out var connections)
            )
            {
                return false;
            }

            lock (connections)
            {
                return connections.Count > 0;
            }
        }

        public bool AddConnection(string userId, string userName, string connectionId)
        {
            throw new NotImplementedException();
        }

        IReadOnlyCollection<UserPresence> IUserPresenceService.GetOnlineUsers()
        {
            var data = _connections.Where(x => x.Value.Count > 0).Select(x => x.Key).ToArray();

            return data.Select(userId => new UserPresence
            {
                UserId = userId,
                UserName = userId, // Assuming userName is the same as userId for this example
                ConnectedAtUtc = DateTime.UtcNow // This would ideally be tracked per connection
            }).ToList();
        }
    }
}
