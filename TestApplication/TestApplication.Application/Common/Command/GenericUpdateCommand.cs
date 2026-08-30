using MediatR;

namespace TestApplication.Application.Common.Command
{
    public record GenericUpdateCommand<T>(T Entity) : IRequest<Unit> where T : class;
}
