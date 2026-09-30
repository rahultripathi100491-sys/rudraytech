using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Dtos;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class MarkMessageReadCommandHandler : IRequestHandler<MarkMessageReadCommand, ChatMessageDto?>
    {
        private readonly IMessageRepository _messageRepository;

        public MarkMessageReadCommandHandler(IMessageRepository messageRepository)
        {
            _messageRepository = messageRepository;
        }

        public Task<ChatMessageDto?> Handle(MarkMessageReadCommand request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}
