using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;

namespace TestApplication.Infrastructure.Interface
{
    public interface IMessageRepository
    {
        Task<Guid?> GetPrivateConversationIdAsync(Guid currentUserId, Guid targetUserId, CancellationToken cancellationToken = default);
        Task<PaginatedResult<MessageHistoryDto>> GetMessageHistoryByConversationIdAsync(Guid conversationId, PaginationRequest pagination, CancellationToken cancellationToken = default);
        Task<MessageHistoryDto> SaveMessageAsync(Guid senderId, Guid receiverId, string content, CancellationToken cancellationToken = default);
        Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid UserId, CancellationToken cancellationToken = default);
        Task<Message?> MarkAsDeliveredAsync(Guid messageId, Guid receiverUserId, CancellationToken cancellationToken);
        Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken);
        Task UpdateStatusAsync(Message message, MessageStatus status, CancellationToken cancellationToken);
        Task<Message?> GetMessageForReceiverAsync(Guid messageId, Guid receiverUserId, CancellationToken cancellationToken);
        Task SaveChangesAsync(CancellationToken cancellationToken);
    }
}
