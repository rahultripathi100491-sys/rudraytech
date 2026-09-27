using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IFriendRepository
    {
        Task<List<FriendSuggestionDto>> GetFriendSuggestionsAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken);
        Task<List<FriendSuggestionDto>> GetLatestUsersAsync(Guid userId, int count, CancellationToken cancellationToken);
        Task<bool> ExistsAsync(Guid userId, Guid friendId, CancellationToken cancellationToken);
        Task AddAsync(Friendship friendship, CancellationToken cancellationToken);
        Task SaveChangesAsync(CancellationToken cancellationToken);
        Task<User?> GetUserAsync(Guid userId, CancellationToken cancellationToken);
        Task<Friendship?> GetRelationshipAsync(Guid userId, Guid friendId, CancellationToken cancellationToken);
        Task<Friendship?> GetFriendshipByIdAsync(Guid friendshipId, CancellationToken cancellationToken);
        Task AddFriendRequestAsync(Friendship friendship, CancellationToken cancellationToken);
        Task<List<FriendRequestDto>> GetFriendRequestsAsync(Guid userId, CancellationToken cancellationToken);
        Task<List<Guid>> GetFriendIdsAsync(Guid userId, CancellationToken cancellationToken);
        Task<List<FriendDto>> GetFriendsAsync(Guid userId, CancellationToken cancellationToken);
    }
}
