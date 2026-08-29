using MediatR;

namespace TestApplication.Application.Common.Query
{
    public record GenericGetByIdQuery<T>(Guid id) : IRequest<T> where T : class;
}
