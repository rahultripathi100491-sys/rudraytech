using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TestApplication.Application.Common.Query;

namespace TestApplication.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/friends")]
    public class FriendsController : Controller
    {
        private readonly IMediator _mediator;

        public FriendsController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet("suggestions")]
        public async Task<IActionResult> GetSuggestions(int page = 1, int pageSize = 20)
        {
            //var userId = User.FindFirst("sub")!.Value;
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(currentUserIdClaim) || !Guid.TryParse(currentUserIdClaim, out var userId))
            {
                throw new HubException("Unauthorized: Missing user identity claim.");
            }

            var result = await _mediator.Send(
                new GetFriendSuggestionsQuery(userId, page, pageSize));

            return Ok(result);
        }

        [HttpPost("{friendId}/request")]
        public async Task<IActionResult> SendRequest(Guid friendId)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(currentUserIdClaim) || !Guid.TryParse(currentUserIdClaim, out var userId))
            {
                throw new HubException("Unauthorized: Missing user identity claim.");
            }

            var result = await _mediator.Send(new SendFriendRequestCommand(userId, friendId));

            return Ok(new
            {
                success = result
            });
        }
        [HttpPost("{friendshipId:guid}/accept")]
        public async Task<IActionResult> AcceptFriendRequest(Guid friendshipId, CancellationToken cancellationToken)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
            {
                return Unauthorized();
            }

            if (!Guid.TryParse(
                    userIdClaim.Value,
                    out var userId))
            {
                return Unauthorized();
            }

            var command =
                new AcceptFriendRequestCommand(
                    friendshipId,
                    userId);

            var result = await _mediator.Send(
                command,
                cancellationToken);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        [HttpGet("requests")]
        [Authorize]
        public async Task<IActionResult> GetFriendRequests(CancellationToken cancellationToken)
        {
            var userIdClaim =
                User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
                return Unauthorized();

            if (!Guid.TryParse(userIdClaim.Value, out Guid userId))
            {
                return Unauthorized();
            }

            var result = await _mediator.Send(new GetFriendRequestsQuery(userId), cancellationToken);

            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetFriends(
                CancellationToken cancellationToken)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
                return Unauthorized();

            if (!Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var friends = await _mediator.Send(new GetFriendsQuery(userId), cancellationToken);

            return Ok(friends);
        }
    }
}
