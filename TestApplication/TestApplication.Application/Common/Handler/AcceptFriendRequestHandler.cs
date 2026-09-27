using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class AcceptFriendRequestHandler : IRequestHandler<AcceptFriendRequestCommand, AcceptFriendRequestResponse>
    {
        private readonly IFriendRepository _friendRepository;

        public AcceptFriendRequestHandler(IFriendRepository friendRepository)
        {
            _friendRepository = friendRepository;
        }

        public async Task<AcceptFriendRequestResponse> Handle(AcceptFriendRequestCommand request, CancellationToken cancellationToken)
        {
            // Find friendship request
            var friendship =
                await _friendRepository.GetFriendshipByIdAsync(request.FriendshipId, cancellationToken);

            if (friendship == null)
            {
                return new AcceptFriendRequestResponse
                {
                    Success = false,
                    Message = "Friend request not found."
                };
            }

            // ------------------------------------------
            // Security:
            // Only the receiver can accept the request
            // ------------------------------------------

            if (friendship.FriendId != request.UserId)
            {
                return new AcceptFriendRequestResponse
                {
                    Success = false,
                    Message = "You cannot accept this friend request."
                };
            }

            // ------------------------------------------
            // Request must be pending
            // ------------------------------------------

            if (friendship.Status != FriendshipStatus.Pending)
            {
                return new AcceptFriendRequestResponse
                {
                    Success = false,
                    Message = "This friend request is no longer pending."
                };
            }

            // ------------------------------------------
            // Accept request
            // ------------------------------------------

            friendship.Status = FriendshipStatus.Accepted;

            await _friendRepository.SaveChangesAsync(cancellationToken);

            return new AcceptFriendRequestResponse
            {
                Success = true,
                Message = "Friend request accepted.",
                FriendshipId = friendship.Id
            };
        }
    }
}
