using MediatR;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Query
{

    public record UserSearchResultDto(string Id, string Name, string Email);
    public record SearchUsersQuery(string SearchTerm, Guid CurrentUserId) : IRequest<List<User>>;
}
