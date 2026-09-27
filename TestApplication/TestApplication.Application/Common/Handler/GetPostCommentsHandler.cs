using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetPostCommentsHandler : IRequestHandler<GetPostCommentsQuery, List<CommentDto>>
    {
        private readonly IPostRepository _repository;

        public GetPostCommentsHandler(IPostRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<CommentDto>> Handle(GetPostCommentsQuery request, CancellationToken cancellationToken)
        {
            return await _repository.GetCommentsAsync(request.PostId, cancellationToken);
        }
    }
}
