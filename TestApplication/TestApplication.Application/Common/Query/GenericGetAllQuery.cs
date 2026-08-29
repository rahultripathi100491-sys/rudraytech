using MediatR;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Query
{
    public record GenericGetAllQuery<T>:IRequest<IReadOnlyList<T>> where T : class;
}
