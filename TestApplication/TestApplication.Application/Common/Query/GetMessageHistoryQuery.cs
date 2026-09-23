using MediatR;
using TestApplication.Domain.Dtos;

namespace TestApplication.Application.Messages.Queries;

public record GetMessageHistoryQuery(
    Guid CurrentUserId,
    Guid TargetUserId
) : IRequest<List<MessageHistoryDto>>;
public record GetUserConversationsQuery(Guid UserId) : IRequest<IEnumerable<ConversationDto>>;