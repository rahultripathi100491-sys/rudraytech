using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GenericCreateCommandHandler<T> : IRequestHandler<GenericCreateCommand<T>, T?> where T : class
    {
        private readonly IGenericRepository<T> _repository;

        public GenericCreateCommandHandler(IGenericRepository<T> repository)
        {
            _repository = repository;
        }

        public async Task<T?> Handle(GenericCreateCommand<T> request, CancellationToken cancellationToken)
        {
            return await _repository.AddAsync(request.Entity);
        }
    }
}
