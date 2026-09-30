using MediatR;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Query
{
    public sealed record GetOnlineUsersQuery : IRequest<IReadOnlyCollection<UserPresence>>;
}
