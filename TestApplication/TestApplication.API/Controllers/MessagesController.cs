using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TestApplication.Application.Messages.Queries;

namespace TestApplication.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly IMediator _mediator;

        public MessagesController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
       [FromQuery] Guid targetUserId,
       CancellationToken cancellationToken)
        {
            if (targetUserId == Guid.Empty)
            {
                return BadRequest(new
                {
                    message = "targetUserId is required."
                });
            }

            var currentUserIdClaim =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(currentUserIdClaim, out var currentUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid user identity."
                });
            }

            var result = await _mediator.Send(
                new GetMessageHistoryQuery(
                    currentUserId,
                    targetUserId),
                cancellationToken);

            return Ok(result);
        }
        [HttpGet("Conversation")]
        public async Task<IActionResult> GetConversations(CancellationToken cancellationToken)
        {
            var currentUserIdClaim =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(currentUserIdClaim, out var currentUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid user identity."
                });
            }

            var query = new GetUserConversationsQuery(currentUserId);
            var conversations = await _mediator.Send(query, cancellationToken);

            return Ok(conversations);
        }
    }
}
