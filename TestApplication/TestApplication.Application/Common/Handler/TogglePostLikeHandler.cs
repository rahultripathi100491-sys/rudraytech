using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class TogglePostLikeHandler : IRequestHandler<TogglePostLikeCommand, LikePostResponse>
    {
        private readonly IPostRepository _repository;

        public TogglePostLikeHandler(IPostRepository repository)
        {
            _repository = repository;
        }

        public async Task<LikePostResponse> Handle(TogglePostLikeCommand request, CancellationToken cancellationToken)
        {
            return await _repository.ToggleLikeAsync(request.PostId, request.UserId, cancellationToken);
        }
    }
}
