using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;
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

        public async Task<ChatMessageDto?> Handle(MarkMessageReadCommand request, CancellationToken cancellationToken)
        {
            var message =
                await _messageRepository.GetMessageForReceiverAsync(
                    request.MessageId,
                    request.ReceiverUserId,
                    cancellationToken);

            if (message == null)
            {
                return null;
            }

            // Already read
            if (message.Status != MessageStatus.Read)
            {
                message.Status =
                    MessageStatus.Read;

                message.DeliveredAt ??=
                    DateTime.UtcNow;

                message.ReadAt =
                    DateTime.UtcNow;

                await _messageRepository.UpdateStatusAsync(
                    message, MessageStatus.Read,
                    cancellationToken);
            }

            return Map(message);
        }
        private static ChatMessageDto Map(Message message)
        {
            return new ChatMessageDto
            {
                Id =
                    message.Id,

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
