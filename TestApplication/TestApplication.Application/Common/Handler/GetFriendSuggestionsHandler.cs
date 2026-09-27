using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetFriendSuggestionsHandler : IRequestHandler<GetFriendSuggestionsQuery, List<FriendSuggestionDto>>
    {
        private readonly IFriendRepository _friendRepository;

        public GetFriendSuggestionsHandler(IFriendRepository friendRepository)
        {
            _friendRepository = friendRepository;
        }

        public async Task<List<FriendSuggestionDto>> Handle(GetFriendSuggestionsQuery request, CancellationToken cancellationToken)
        {
            var suggestions = await _friendRepository.GetFriendSuggestionsAsync(request.UserId, request.Page, request.PageSize, cancellationToken);
            // No friend suggestions found
            if (suggestions.Count == 0)
            {
                // Return latest 10 users
                return await _friendRepository.GetLatestUsersAsync(
                    request.UserId,
                    10,
                    cancellationToken);
            }
            return suggestions;
        }
    }
}
