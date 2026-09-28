using MediatR;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Command
{
    public record RegisterUserCommand(User user) : IRequest<Guid>;
}
