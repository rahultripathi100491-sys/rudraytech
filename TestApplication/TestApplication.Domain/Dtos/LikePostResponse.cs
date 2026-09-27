namespace TestApplication.Domain.Dtos
{
    public class LikePostResponse
    {
        public bool IsLiked { get; set; }
        public int LikeCount { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
