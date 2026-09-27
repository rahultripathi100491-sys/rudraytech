using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetFriendRequestsHandler : IRequestHandler<GetFriendRequestsQuery, List<FriendRequestDto>>
    {
        private readonly IFriendRepository _repository;

        public GetFriendRequestsHandler(IFriendRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<FriendRequestDto>> Handle(GetFriendRequestsQuery request, CancellationToken cancellationToken)
        {
            return await _repository.GetFriendRequestsAsync(request.UserId, cancellationToken);
        }
    }
}
