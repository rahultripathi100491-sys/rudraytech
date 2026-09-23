using TestApplication.Domain.Dtos;

namespace TestApplication.Infrastructure.Interface
{
    public interface IMessageRepository
    {
        Task<Guid?> GetPrivateConversationIdAsync(
        Guid currentUserId,
        Guid targetUserId,
        CancellationToken cancellationToken = default);

        Task<List<MessageHistoryDto>> GetMessageHistoryByConversationIdAsync(
            Guid conversationId,
            CancellationToken cancellationToken = default);
        Task<MessageHistoryDto> SaveMessageAsync(
        Guid senderId,
        Guid receiverId,
        string content,
        CancellationToken cancellationToken = default);

        Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid UserId, CancellationToken cancellationToken = default);
    }
}
