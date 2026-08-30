using MediatR;
using TestApplication.Application.Common.Command;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class GenericUpdateCommandHandler<T> : IRequestHandler<GenericUpdateCommand<T>, Unit> where T : class
    {
        private readonly IGenericRepository<T> _repository;

        public GenericUpdateCommandHandler(IGenericRepository<T> repository)
        {
            _repository = repository;
        }

        public async Task<Unit> Handle(GenericUpdateCommand<T> request, CancellationToken cancellationToken)
        {
            await _repository.UpdateAsync(request.Entity, cancellationToken);
            return Unit.Value;
        }
    }
}
