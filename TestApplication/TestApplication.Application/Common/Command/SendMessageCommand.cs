using MediatR;
using TestApplication.Domain.Dtos;

namespace TestApplication.Application.Common.Command
{
    public record SendMessageCommand(Guid SenderUserId, Guid ReceiverUserId, string Content)
    : IRequest<MessageHistoryDto>;
}
