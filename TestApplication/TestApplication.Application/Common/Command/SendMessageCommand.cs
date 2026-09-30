using MediatR;
using TestApplication.Domain.Dtos;

namespace TestApplication.Application.Common.Command
{
    public record SendMessageCommand(Guid SenderUserId, Guid ReceiverUserId, string Content) : IRequest<MessageHistoryDto>;
    public record MarkMessageDeliveredCommand(Guid MessageId, Guid ReceiverUserId) : IRequest<ChatMessageDto?>;
    public record MarkMessageReadCommand(Guid MessageId, Guid ReceiverUserId) : IRequest<ChatMessageDto?>;
}
