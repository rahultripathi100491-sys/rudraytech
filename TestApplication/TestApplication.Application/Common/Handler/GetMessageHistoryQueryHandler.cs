using MediatR;
using Microsoft.AspNetCore.Mvc.RazorPages;
using TestApplication.Application.Messages.Queries;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GetMessageHistoryQueryHandler : IRequestHandler<GetMessageHistoryQuery, PaginatedResult<MessageHistoryDto>>
    {
        private readonly IMessageRepository _messageRepository;

        public GetMessageHistoryQueryHandler(IMessageRepository messageRepository)
        {
            _messageRepository = messageRepository;
        }

        public async Task<PaginatedResult<MessageHistoryDto>> Handle(GetMessageHistoryQuery request, CancellationToken cancellationToken)
        {
            var conversationId = await _messageRepository.GetPrivateConversationIdAsync(request.CurrentUserId, request.TargetUserId, cancellationToken
        );

            if (!conversationId.HasValue)
            {
                return new PaginatedResult<MessageHistoryDto>();
            }

            // 2. Fetch messages history for the retrieved conversation ID
            return await _messageRepository.GetMessageHistoryByConversationIdAsync(conversationId.Value, request.PaginationRequest, cancellationToken
            );
        }
    }
}
