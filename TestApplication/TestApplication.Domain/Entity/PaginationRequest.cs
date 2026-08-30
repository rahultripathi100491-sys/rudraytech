namespace TestApplication.Domain.Entity
{
    public class PaginationRequest
    {
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;

        // Global search
        public string? Search { get; set; }

        // Example: Name,Email
        public string? SortBy { get; set; }
        public bool SortDescending { get; set; } = false;

        // Dynamic filters
        // Example:
        // Name = "Rahul"
        // Status = "Active"
        public Dictionary<string, string>? Filters { get; set; }
    }
}
