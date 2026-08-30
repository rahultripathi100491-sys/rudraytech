using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GenericGetAllQueryHandler<T>:IRequestHandler<GenericGetAllQuery<T>, PaginatedResult<T>> where T : class
    {
        private readonly IGenericRepository<T> _repository;

        public GenericGetAllQueryHandler(IGenericRepository<T> repository)
        {
            _repository = repository;
        }

        public async Task<PaginatedResult<T>> Handle(GenericGetAllQuery<T> request, CancellationToken cancellationToken)
        {
            return await _repository.GetAllAsync(request.Request, cancellationToken);
        }
    }
}
