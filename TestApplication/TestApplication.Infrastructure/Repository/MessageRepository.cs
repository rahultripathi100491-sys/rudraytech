using Azure.Core;
using Microsoft.EntityFrameworkCore;
using TestApplication.Domain.Dtos;
using TestApplication.Domain.Entity;
using TestApplication.Domain.Enums;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Infrastructure.Repository
{
    public class MessageRepository : IMessageRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IEncryptionService _encryptionService;

        public MessageRepository(ApplicationDbContext context, IEncryptionService encryptionService)
        {
            _context = context;
            _encryptionService = encryptionService;
        }
        public async Task<Guid?> GetPrivateConversationIdAsync(Guid currentUserId, Guid targetUserId, CancellationToken cancellationToken = default)
        {
            var conversationId = await _context.ConversationMembers
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId)
                .Select(x => x.ConversationId)
                .Where(conversationId =>
                    _context.ConversationMembers.Any(x =>
                        x.ConversationId == conversationId &&
                        x.UserId == targetUserId))
                .Where(conversationId =>
                    _context.Conversations.Any(x =>
                        x.Id == conversationId &&
                        x.Type == ConversationType.Private))
                .FirstOrDefaultAsync(cancellationToken);

            return conversationId == Guid.Empty ? null : conversationId;
        }

        public async Task<PaginatedResult<MessageHistoryDto>> GetMessageHistoryByConversationIdAsync(Guid conversationId, PaginationRequest pagination, CancellationToken cancellationToken = default)
        {
            try
            {
                var query = _context.Messages.AsNoTracking().Where(x => x.ConversationId == conversationId);

                var totalCount = await query.CountAsync(cancellationToken);

                var messages = await query.OrderByDescending(x => x.SentAt).Skip(
                        (pagination.PageNumber - 1) * pagination.PageSize).Take(pagination.PageSize)
                    .Select(x => new MessageHistoryDto
                    {
                        Id = x.Id,
                        SenderUserId = x.SenderId,
                        Content = _encryptionService.Decrypt(x.Content),
                        Status = x.Status,
                        SentAtUtc = x.SentAt,
                        DeliveredAt = x.DeliveredAt,
                        ReadAt = x.ReadAt
                    })
                    .ToListAsync(cancellationToken);

                // Database returns newest -> oldest.
                // Reverse so Angular displays oldest -> newest.
                messages.Reverse();

                return new PaginatedResult<MessageHistoryDto>
                {
                    Items = messages,
                    TotalCount = totalCount,
                    PageNumber = pagination.PageNumber,
                    PageSize = pagination.PageSize
                };
            }
            catch(Exception ex)
            {
                throw;
            }
        }

        public async Task<MessageHistoryDto> SaveMessageAsync(
        Guid senderId,
        Guid receiverId,
        string content,
        CancellationToken cancellationToken = default)
        {
            try
            {
                var conversationId = await GetPrivateConversationIdAsync(senderId, receiverId, cancellationToken);

                if (!conversationId.HasValue)
                {
                    // Create new conversation if none exists
                    var conversation = new Conversation { Id = Guid.NewGuid(), Type = ConversationType.Private };
                    _context.Conversations.Add(conversation);

                    _context.ConversationMembers.AddRange(
                        new ConversationMember { ConversationId = conversation.Id, UserId = senderId },
                        new ConversationMember { ConversationId = conversation.Id, UserId = receiverId }
                    );

                    conversationId = conversation.Id;
                }
            

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = conversationId.Value,
                SenderId = senderId,
                ReceiverId=receiverId,
                Content = _encryptionService.Decrypt(content),
                SentAt = DateTime.UtcNow
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync(cancellationToken);


            return new MessageHistoryDto
            {
                Id = message.Id,
                SenderUserId = message.SenderId,
                Content = _encryptionService.Decrypt(message.Content),
                SentAtUtc = message.SentAt
            };
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        public async Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid UserId, CancellationToken cancellationToken = default)
        {
            return await _context.Conversations.AsNoTracking()
                .Where(c => c.Members.Any(cm => cm.UserId == UserId))
                .Select(c => new ConversationDto
                {
                    Id = c.Id,
                    ParticipantUserId = c.Members.Where(m => m.UserId != UserId).Select(m => m.UserId).FirstOrDefault(),
                    ParticipantName = c.Members.Where(m => m.UserId != UserId).Select(m => m.User.FirstName + " " + m.User.LastName).FirstOrDefault() ?? "Unknown User",
                    LastMessage = _encryptionService.Decrypt(c.Messages.OrderByDescending(m => m.SentAt).Select(m => m.Content).FirstOrDefault()!),
                    UnreadCount = 0 // Connect your unread tracking logic here if needed
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<Message?> MarkAsDeliveredAsync(Guid messageId, Guid receiverUserId, CancellationToken cancellationToken)
        {
            var message =
                await _context.Messages
                    .FirstOrDefaultAsync(
                        x =>
                            x.Id == messageId &&
                            x.ReceiverId == receiverUserId,
                        cancellationToken);

            if (message == null)
            {
                return null;
            }

            // Do not downgrade Read -> Delivered
            if (message.Status == MessageStatus.Read)
            {
                return message;
            }

            // Sent -> Delivered
            if (message.Status == MessageStatus.Sent)
            {
                message.Status =
                    MessageStatus.Delivered;

                message.DeliveredAt =
                    DateTime.UtcNow;

                await _context.SaveChangesAsync(
                    cancellationToken);
            }

            return message;
        }

        public async Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken)
        {
            return await _context.Messages.FirstOrDefaultAsync(x => x.Id == messageId, cancellationToken);
        }

        public async Task UpdateStatusAsync(Message message, MessageStatus status, CancellationToken cancellationToken)
        {
            // Don't allow status to move backwards.
            if (status < message.Status)
            {
                return;
            }

            if (status == MessageStatus.Delivered &&
                message.Status < MessageStatus.Delivered)
            {
                message.Status = MessageStatus.Delivered;
                message.DeliveredAt ??= DateTime.UtcNow;
            }

            if (status == MessageStatus.Read)
            {
                if (message.Status < MessageStatus.Delivered)
                {
                    message.Status = MessageStatus.Delivered;
                    message.DeliveredAt ??= DateTime.UtcNow;
                }

                message.Status = MessageStatus.Read;
                message.DeliveredAt ??= DateTime.UtcNow;
                message.ReadAt ??= DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<Message?> GetMessageForReceiverAsync(Guid messageId, Guid receiverUserId, CancellationToken cancellationToken)
        {
            // BREAKPOINT 1
            System.Diagnostics.Debugger.Break();

            var message =
                await _context.Messages.FirstOrDefaultAsync(x => x.Id == messageId && x.ReceiverId == receiverUserId, cancellationToken);

            // BREAKPOINT 2
            System.Diagnostics.Debugger.Break();

            return message;
        }

        public async Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
