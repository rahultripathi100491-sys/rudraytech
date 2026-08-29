using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GenericGetByIdQueryHandler<T> : IRequestHandler<GenericGetByIdQuery<T>, T> where T : class
    {
        private readonly IGenericRepository<T> _repository;

        public GenericGetByIdQueryHandler(IGenericRepository<T> repository)
        {
            _repository = repository;
        }

        public async Task<T> Handle(GenericGetByIdQuery<T> request, CancellationToken cancellationToken)
        {
            var result = await _repository.GetByIdAsync(request.id);
            return result!;
        }
    }
}
