using MediatR;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Query
{
    public record GetFriendSuggestionsQuery(Guid UserId, int Page = 1, int PageSize = 20) : IRequest<List<FriendSuggestionDto>>;
    public record SendFriendRequestCommand(Guid UserId, Guid FriendId) : IRequest<bool>;
    public record AcceptFriendRequestCommand(Guid FriendshipId, Guid UserId) : IRequest<AcceptFriendRequestResponse>;
    public record GetFriendRequestsQuery(Guid UserId) : IRequest<List<FriendRequestDto>>;
    public record GetFriendsQuery(Guid UserId) : IRequest<List<FriendDto>>;

}
