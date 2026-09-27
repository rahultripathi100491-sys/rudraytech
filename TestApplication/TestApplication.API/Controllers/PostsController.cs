using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;

namespace TestApplication.API.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class PostsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public PostsController(IMediator mediator)
        {
            _mediator = mediator;
        }
        [HttpGet]
        public async Task<IActionResult> GetAllPosts(CancellationToken cancellationToken)
        {
            var query = new GetAllPostsQuery();
            var posts = await _mediator.Send(query, cancellationToken);
            return Ok(posts);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest request, CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email) ?? "User";

            var command = new CreatePostCommand(request.Content, userId, userName);
            var createdPost = await _mediator.Send(command, cancellationToken);

            return Ok(createdPost);
        }
        [Authorize]
        [HttpPost("{postId:guid}/like")]
        public async Task<IActionResult> ToggleLike(Guid postId, CancellationToken cancellationToken)
        {
            var userIdClaim = User.FindFirst(
                ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
                return Unauthorized();

            if (!Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var result = await _mediator.Send(
                new TogglePostLikeCommand(postId, userId), cancellationToken);

            return Ok(result);
        }
        [Authorize]
        [HttpPost("{postId:guid}/comments")]
        public async Task<IActionResult> AddComment(Guid postId, [FromBody] AddCommentRequest request, CancellationToken cancellationToken)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
                return Unauthorized();

            if (!Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }


            var result = await _mediator.Send(new AddCommentCommand(postId, userId, request.Content), cancellationToken);


            return Ok(result);
        }
        [Authorize]
        [HttpGet("{postId:guid}/comments")]
        public async Task<IActionResult> GetComments(Guid postId, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new GetPostCommentsQuery(postId), cancellationToken);

            return Ok(result);
        }
    }
    public record CreatePostRequest(string Content);
}
