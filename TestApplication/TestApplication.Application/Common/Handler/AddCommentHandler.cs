using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class AddCommentHandler : IRequestHandler<AddCommentCommand, CommentDto>
    {
        private readonly IPostRepository _repository;

        public AddCommentHandler(IPostRepository repository)
        {
            _repository = repository;
        }

        public async Task<CommentDto> Handle(AddCommentCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Content))
            {
                throw new ArgumentException("Comment cannot be empty.");
            }

            return await _repository.AddCommentAsync(request.PostId, request.UserId, request.Content, cancellationToken);
        }
    }
}
