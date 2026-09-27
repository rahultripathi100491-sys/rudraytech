using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IPostRepository
    {
        Task CreatePostAsync(Post post, CancellationToken cancellationToken);
        Task<List<Post>> GetAllPostsAsync(CancellationToken cancellationToken);
        Task<LikePostResponse> ToggleLikeAsync(Guid postId, Guid userId, CancellationToken cancellationToken);
        Task<CommentDto> AddCommentAsync(Guid postId, Guid userId, string content, CancellationToken cancellationToken);
        Task<List<CommentDto>> GetCommentsAsync(Guid postId, CancellationToken cancellationToken);
    }
}
