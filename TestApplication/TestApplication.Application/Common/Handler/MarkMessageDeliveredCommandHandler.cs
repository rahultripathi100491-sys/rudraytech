using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class MarkMessageDeliveredCommandHandler : IRequestHandler<MarkMessageDeliveredCommand, ChatMessageDto?>
    {
        private readonly IMessageRepository _messageRepository;

        public MarkMessageDeliveredCommandHandler(IMessageRepository messageRepository)
        {
            _messageRepository = messageRepository;
        }

        public async Task<ChatMessageDto?> Handle(MarkMessageDeliveredCommand request, CancellationToken cancellationToken)
        {
            var message = await _messageRepository.MarkAsDeliveredAsync(request.MessageId, request.ReceiverUserId, cancellationToken);

            if (message == null)
            {
                return null;
            }

            return Map(message);
        }
        private static ChatMessageDto Map(Message message)
        {
            return new ChatMessageDto
            {
                Id = message.Id,

                SenderUserId =
                    message.SenderId,

                ReceiverUserId =
                    message.ReceiverId,

                Content =
                    message.Content,

                Status =
                    message.Status,

                SentAtUtc =
                    message.SentAt,

                DeliveredAtUtc =
                    message.DeliveredAt,

                ReadAtUtc =
                    message.ReadAt
            };
        }

    }
}
