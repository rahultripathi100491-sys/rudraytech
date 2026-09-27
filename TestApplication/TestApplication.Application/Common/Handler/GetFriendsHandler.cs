using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetFriendsHandler : IRequestHandler<GetFriendsQuery, List<FriendDto>>
    {
        private readonly IFriendRepository _friendRepository;

        public GetFriendsHandler(IFriendRepository friendRepository)
        {
            _friendRepository = friendRepository;
        }

        public async Task<List<FriendDto>> Handle(GetFriendsQuery request, CancellationToken cancellationToken)
        {
            return await _friendRepository.GetFriendsAsync(request.UserId, cancellationToken);
        }
    }
}
