using MediatR;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Messages.Queries;

public record GetMessageHistoryQuery(Guid CurrentUserId, Guid TargetUserId, PaginationRequest PaginationRequest, CancellationToken CancellationToken) : IRequest<PaginatedResult<MessageHistoryDto>>;
public record GetUserConversationsQuery(Guid UserId) : IRequest<IEnumerable<ConversationDto>>;