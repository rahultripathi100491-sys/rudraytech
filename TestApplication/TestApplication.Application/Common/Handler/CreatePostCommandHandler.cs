using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, PostDto>
    {
        private readonly IPostRepository _repository;

        public CreatePostCommandHandler(IPostRepository repository)
        {
            _repository = repository;
        }

        public async Task<PostDto> Handle(CreatePostCommand request, CancellationToken cancellationToken)
        {
            var post = new Post
            {
                Content = request.Content,
                UserId = request.UserId,
                UserName = request.UserName
            };

            await _repository.CreatePostAsync(post, cancellationToken);

            return new PostDto(post.Id, post.UserId, post.UserName, post.Content, post.CreatedAtUtc);
        }
    }
    public class GetAllPostsQueryHandler : IRequestHandler<GetAllPostsQuery, List<PostDto>>
    {
        private readonly IPostRepository _repository;

        public GetAllPostsQueryHandler(IPostRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<PostDto>> Handle(GetAllPostsQuery request, CancellationToken cancellationToken)
        {
            var posts = await _repository.GetAllPostsAsync(cancellationToken);
            return posts.Select(p => new PostDto(p.Id, p.UserId, p.UserName, p.Content, p.CreatedAtUtc)).ToList();
        }
    }
}
