namespace TestApplication.Application.Common.Query
{
    public record PostDto(Guid Id, string UserId, string UserName, string Content, DateTime CreatedAtUtc);
    public record GetAllPostsQuery() : MediatR.IRequest<List<PostDto>>;
}
