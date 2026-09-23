using MediatR;
using TestApplication.Application.Messages.Queries;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetUserConversationsHandler : IRequestHandler<GetUserConversationsQuery, IEnumerable<ConversationDto>>
    {
        private readonly IMessageRepository _messageRepository;

        public GetUserConversationsHandler(IMessageRepository messageRepository)
        {
            _messageRepository = messageRepository;
        }

        public async Task<IEnumerable<ConversationDto>> Handle(GetUserConversationsQuery request, CancellationToken cancellationToken)
        {
            return await _messageRepository.GetUserConversationsAsync(request.UserId, cancellationToken);
        }
    }
}
