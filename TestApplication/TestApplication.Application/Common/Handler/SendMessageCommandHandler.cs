using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, MessageHistoryDto>
    {
        private readonly IMessageRepository _messageRepository;

        public SendMessageCommandHandler(IMessageRepository messageRepository)
        {
            _messageRepository = messageRepository;
        }

        public async Task<MessageHistoryDto> Handle(SendMessageCommand request, CancellationToken cancellationToken)
        {
            return await _messageRepository.SaveMessageAsync(
            request.SenderUserId,
            request.ReceiverUserId,
            request.Content,
            cancellationToken
        );
        }
    }
}
