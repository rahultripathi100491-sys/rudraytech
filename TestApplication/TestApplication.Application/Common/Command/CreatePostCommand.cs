using TestApplication.Application.Common.Query;

namespace TestApplication.Application.Common.Command
{
    public record CreatePostCommand(string Content, string UserId, string UserName) : MediatR.IRequest<PostDto>;
}
