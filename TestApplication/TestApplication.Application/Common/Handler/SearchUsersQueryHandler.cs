using MediatR;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Handler
{
    public class SearchUsersQueryHandler : IRequestHandler<SearchUsersQuery, List<User>>
    {
        private readonly IUserRepository _userRepository;

        public SearchUsersQueryHandler(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<List<User>> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
        {
            return await _userRepository.SearchUsersAsync(request.SearchTerm, request.CurrentUserId, cancellationToken);
        }
    }
}
