using TestApplication.Domain.Entity;

namespace TestApplication.Infrastructure.Interface
{
    public interface IPostRepository
    {
        Task CreatePostAsync(Post post, CancellationToken cancellationToken);
        Task<List<Post>> GetAllPostsAsync(CancellationToken cancellationToken);
    }
}
