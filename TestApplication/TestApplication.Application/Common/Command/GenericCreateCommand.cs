using MediatR;

namespace TestApplication.Application.Common.Command
{
    public record GenericCreateCommand<T>(T Entity) : IRequest<T?> where T : class;
}
