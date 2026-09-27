using Microsoft.EntityFrameworkCore;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Infrastructure.Repository
{
    public class FriendRepository : IFriendRepository
    {
        private readonly ApplicationDbContext _context;

        public FriendRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(Friendship friendship, CancellationToken cancellationToken)
        {
            // BREAKPOINT - Repository
            await _context.Friendships.AddAsync(friendship, cancellationToken);
        }

        public async Task AddFriendRequestAsync(Friendship friendship, CancellationToken cancellationToken)
        {
            await _context.Friendships.AddAsync(friendship, cancellationToken);
        }

        public async Task<bool> ExistsAsync(Guid userId, Guid friendId, CancellationToken cancellationToken)
        {
            // BREAKPOINT - Repository
            return await _context.Friendships.AnyAsync(x => (x.UserId == userId && x.FriendId == friendId) || (x.UserId == friendId && x.FriendId == userId), cancellationToken);
        }

        public Task<List<Guid>> GetFriendIdsAsync(Guid userId, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public async Task<List<FriendRequestDto>> GetFriendRequestsAsync(Guid userId, CancellationToken cancellationToken)
        {
            return await _context.Friendships
            .AsNoTracking()

            // Only requests received by current user
            .Where(x =>
                x.FriendId == userId &&
                x.Status == FriendshipStatus.Pending)

            // Latest request first
            .OrderByDescending(x => x.CreatedDate)

            .Select(x => new FriendRequestDto
            {
                FriendshipId = x.Id,

                // Person who sent the request
                UserId = x.UserId,

                Name = x.User.FirstName + " " + x.User.LastName,

                ProfileImage = x.User.ProfileImage,

                CreatedDate = x.CreatedDate
            })

            .ToListAsync(cancellationToken);
        }

        public async Task<List<FriendDto>> GetFriendsAsync(Guid userId, CancellationToken cancellationToken)
        {
            var friendIds = await _context.Friendships

            .Where(x =>
                x.Status == FriendshipStatus.Accepted &&
                (x.UserId == userId ||
                 x.FriendId == userId))

            .Select(x =>
                x.UserId == userId
                    ? x.FriendId
                    : x.UserId)

            .ToListAsync(cancellationToken);


            return await _context.Users

                .Where(x =>
                    friendIds.Contains(x.Id))

                .Select(x => new FriendDto
                {
                    UserId = x.Id,

                    Name = x.FirstName + " " + x.LastName,

                    ProfileImage = x.ProfileImage
                })

                .OrderBy(x => x.Name)

                .ToListAsync(cancellationToken);
        }

        public async Task<Friendship?> GetFriendshipByIdAsync(Guid friendshipId, CancellationToken cancellationToken)
        {
            return await _context.Friendships.FirstOrDefaultAsync(x => x.Id == friendshipId, cancellationToken);
        }

        public async Task<List<FriendSuggestionDto>> GetFriendSuggestionsAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken)
        {
            // 1. Get current user's accepted friends
            var friendIds = await _context.Friendships
                .AsNoTracking()
                .Where(x =>
                    x.Status == FriendshipStatus.Accepted &&
                    (x.UserId == userId || x.FriendId == userId))
                .Select(x =>
                    x.UserId == userId
                        ? x.FriendId
                        : x.UserId)
                .ToListAsync(cancellationToken);


            // 2. Get people who already have a relationship
            //    with the current user.
            var excludedIds = await _context.Friendships.AsNoTracking().Where(x => x.UserId == userId || x.FriendId == userId).Select(x => x.UserId == userId ? x.FriendId : x.UserId).ToListAsync(cancellationToken);

            // Don't suggest yourself
            excludedIds.Add(userId);


            // 3. Find friends of friends
            var suggestions = await _context.Friendships
                .AsNoTracking()
                .Where(x =>
                    x.Status == FriendshipStatus.Accepted &&
                    (
                        friendIds.Contains(x.UserId) ||
                        friendIds.Contains(x.FriendId)
                    ))
                .Select(x => new
                {
                    CandidateId =
                        friendIds.Contains(x.UserId)
                            ? x.FriendId
                            : x.UserId,

                    MutualFriendId =
                        friendIds.Contains(x.UserId)
                            ? x.UserId
                            : x.FriendId
                })
                .Where(x =>
                    !excludedIds.Contains(x.CandidateId))
                .GroupBy(x => x.CandidateId)
                .Select(x => new
                {
                    UserId = x.Key,

                    MutualFriends = x
                        .Select(y => y.MutualFriendId)
                        .Distinct()
                        .Count()
                })
                .OrderByDescending(x => x.MutualFriends)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);


            // 4. Get user information
            var candidateIds = suggestions
                .Select(x => x.UserId)
                .ToList();

            if (candidateIds.Count == 0)
            {
                return new List<FriendSuggestionDto>();
            }


            var users = await _context.Users
                .AsNoTracking()
                .Where(x => candidateIds.Contains(x.Id))
                .Select(x => new
                {
                    x.Id,
                    x.FirstName,
                    x.LastName
                })
                .ToListAsync(cancellationToken);


            // 5. Combine suggestion + user information
            return suggestions
                .Join(
                    users,
                    suggestion => suggestion.UserId,
                    user => user.Id,
                    (suggestion, user) =>
                        new FriendSuggestionDto
                        {
                            UserId = user.Id,
                            Name = $"{user.FirstName} {user.LastName}",
                            //ProfileImage = user.ProfileImage,
                            MutualFriends = suggestion.MutualFriends
                        })
                .ToList();
        }

        public async Task<List<FriendSuggestionDto>> GetLatestUsersAsync(Guid userId, int count, CancellationToken cancellationToken)
        {
            var excludedIds = await _context.Friendships
                .AsNoTracking()
                .Where(x =>
                    x.UserId == userId ||
                    x.FriendId == userId)
                .Select(x =>
                    x.UserId == userId
                        ? x.FriendId
                        : x.UserId)
                .ToListAsync(cancellationToken);

            // Don't suggest yourself
            excludedIds.Add(userId);

            return await _context.Users.AsNoTracking()
            // Don't suggest yourself
            .Where(x => x.Id != userId).Where(x =>
                    !excludedIds.Contains(x.Id)).OrderByDescending(x => x.JoinedDate).Take(count)

            .Select(x => new FriendSuggestionDto
            {
                UserId = x.Id,
                Name = $"{x.FirstName} {x.LastName}",
                ProfileImage = x.ProfileImage,
                MutualFriends = 0
            })

        .ToListAsync(cancellationToken);
        }

        public async Task<Friendship?> GetRelationshipAsync(Guid userId, Guid friendId, CancellationToken cancellationToken)
        {
            return await _context.Friendships.FirstOrDefaultAsync(x => (x.UserId == userId && x.FriendId == friendId) || (x.UserId == friendId && x.FriendId == userId), cancellationToken);
        }

        public async Task<User?> GetUserAsync(Guid userId, CancellationToken cancellationToken)
        {
            return await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        }

        public async Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            // BREAKPOINT - Repository
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
