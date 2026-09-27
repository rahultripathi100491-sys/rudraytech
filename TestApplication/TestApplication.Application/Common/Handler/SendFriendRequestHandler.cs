using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class SendFriendRequestHandler : IRequestHandler<SendFriendRequestCommand, bool>
    {
        private readonly IFriendRepository _repository;

        public SendFriendRequestHandler(IFriendRepository repository)
        {
            _repository = repository;
        }

        public async Task<bool> Handle(SendFriendRequestCommand request, CancellationToken cancellationToken)
        {
            // BREAKPOINT 1
            if (request.UserId == request.FriendId)
                return false;

            // BREAKPOINT 2
            var exists = await _repository.ExistsAsync(request.UserId, request.FriendId, cancellationToken);

            if (exists)
                return false;

            // BREAKPOINT 3
            var friendship = new Friendship
            {
                UserId = request.UserId,
                FriendId = request.FriendId,
                Status = FriendshipStatus.Pending
            };

            // BREAKPOINT 4
            await _repository.AddAsync(friendship, cancellationToken);

            // BREAKPOINT 5
            await _repository.SaveChangesAsync(
                cancellationToken);

            return true;

        }
    }
}
