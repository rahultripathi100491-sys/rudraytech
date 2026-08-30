using MediatR;
using TestApplication.Domain.Entity;

namespace TestApplication.Application.Common.Query
{
    public class GenericGetAllQuery<T> :IRequest<PaginatedResult<T>> where T : class
    {
        public PaginationRequest Request { get; set; }

        public GenericGetAllQuery(PaginationRequest request)
        {
            Request = request;
        }
    }
}
