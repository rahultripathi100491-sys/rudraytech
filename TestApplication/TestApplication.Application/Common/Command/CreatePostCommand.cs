using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Dtos;

namespace TestApplication.Application.Common.Command
{
    public record CreatePostCommand(string Content, string UserId, string UserName) : IRequest<PostDto>;
    public record TogglePostLikeCommand(Guid PostId, Guid UserId) : IRequest<LikePostResponse>;
    public record AddCommentCommand(Guid PostId, Guid UserId, string Content) : IRequest<CommentDto>;
}
