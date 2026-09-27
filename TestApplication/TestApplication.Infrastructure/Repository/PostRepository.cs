using Microsoft.EntityFrameworkCore;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Infrastructure.Repository
{
    public class PostRepository : IPostRepository
    {
        private readonly ApplicationDbContext _context;

        public PostRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<CommentDto> AddCommentAsync(Guid postId, Guid userId, string content, CancellationToken cancellationToken)
        {
            var postExists = await _context.Posts.AnyAsync(x => x.Id == postId, cancellationToken);

            if (!postExists)
            {
                throw new KeyNotFoundException(
                    "Post not found.");
            }


            var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

            if (user == null)
            {
                throw new KeyNotFoundException(
                    "User not found.");
            }


            var comment = new PostComment
            {
                Id = Guid.NewGuid(),

                PostId = postId,

                UserId = userId,

                Content = content.Trim(),

                CreatedAt = DateTime.UtcNow
            };


            await _context.PostComments.AddAsync(comment, cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);


            return new CommentDto
            {
                Id = comment.Id,

                UserId = user.Id,

                UserName = user.FirstName + " " + user.LastName,

                ProfileImage = user.ProfileImage,

                Content = comment.Content,

                CreatedAt = comment.CreatedAt
            };
        }

        public async Task CreatePostAsync(Post post, CancellationToken cancellationToken)
        {
            await _context.Posts.AddAsync(post, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<List<Post>> GetAllPostsAsync(CancellationToken cancellationToken)
        {
            return await _context.Posts
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        }

        public async Task<List<CommentDto>> GetCommentsAsync(Guid postId, CancellationToken cancellationToken)
        {
            return await _context.PostComments.Where(x => x.PostId == postId).OrderByDescending(x => x.CreatedAt).Select(x => new CommentDto
            {
                Id = x.Id,

                UserId = x.UserId,

                UserName = x.User.FirstName + " " + x.User.LastName,

                ProfileImage = x.User.ProfileImage,

                Content = x.Content,

                CreatedAt = x.CreatedAt
            }).ToListAsync(cancellationToken);
        }

        public async Task<LikePostResponse> ToggleLikeAsync(Guid postId, Guid userId, CancellationToken cancellationToken)
        {
            var postExists = await _context.Posts.AnyAsync(x => x.Id == postId, cancellationToken);

            if (!postExists)
            {
                throw new KeyNotFoundException(
                    "Post not found.");
            }

            var existingLike = await _context.PostLikes
                .FirstOrDefaultAsync(
                    x =>
                        x.PostId == postId &&
                        x.UserId == userId,
                    cancellationToken);


            bool isLiked;


            if (existingLike != null)
            {
                // Unlike
                _context.PostLikes.Remove(existingLike);

                isLiked = false;
            }
            else
            {
                // Like
                var like = new PostLike
                {
                    Id = Guid.NewGuid(),

                    PostId = postId,

                    UserId = userId,

                    CreatedAt = DateTime.UtcNow
                };

                await _context.PostLikes.AddAsync(
                    like,
                    cancellationToken);

                isLiked = true;
            }


            await _context.SaveChangesAsync(
                cancellationToken);


            var likeCount = await _context.PostLikes
                .CountAsync(
                    x => x.PostId == postId,
                    cancellationToken);


            return new LikePostResponse
            {
                IsLiked = isLiked,

                LikeCount = likeCount,

                Message = isLiked
                    ? "Post liked."
                    : "Post unliked."
            };
        }
    }
}
