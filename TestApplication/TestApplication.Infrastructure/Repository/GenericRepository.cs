using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using System.Reflection;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Infrastructure.Repository
{
    public class GenericRepository<T> : IGenericRepository<T> where T : class
    {
        protected readonly ApplicationDbContext _context;

        public GenericRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.Set<T>().FindAsync(new object[] { id }, cancellationToken);
        }

        public async Task<PaginatedResult<T>> GetAllAsync(PaginationRequest request, CancellationToken cancellationToken = default)
        {
            IQueryable<T> query = _context.Set<T>();
            // -----------------------------------------
            // 1. Dynamic Filters
            // -----------------------------------------

            if (request.Filters != null)
            {
                foreach (var filter in request.Filters)
                {
                    query = ApplyFilter(
                        query,
                        filter.Key,
                        filter.Value);
                }
            }
            // -----------------------------------------
            // 2. Global Search
            // -----------------------------------------

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                query = ApplyGlobalSearch(
                    query,
                    request.Search);
            }
            // -----------------------------------------
            // 3. Total Count
            // -----------------------------------------

            var totalCount = await query.CountAsync(
                cancellationToken);

            // -----------------------------------------
            // 4. Sorting
            // -----------------------------------------

            if (!string.IsNullOrWhiteSpace(request.SortBy))
            {
                query = ApplySorting(
                    query,
                    request.SortBy,
                    request.SortDescending);
            }
            // -----------------------------------------
            // 5. Pagination
            // -----------------------------------------

            var pageNumber = request.PageNumber <= 0
                ? 1
                : request.PageNumber;

            var pageSize = request.PageSize <= 0
                ? 10
                : Math.Min(request.PageSize, 100);

            var items = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PaginatedResult<T>
            {
                Items = items,
                PageNumber = pageNumber,
                PageSize = pageSize,
                TotalCount = totalCount
            };
        }

        public async Task<T> AddAsync(T entity, CancellationToken cancellationToken = default)
        {
            await _context.Set<T>().AddAsync(entity, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
            return entity;
        }

        public async Task UpdateAsync(T entity, CancellationToken cancellationToken = default)
        {
            _context.Entry(entity).State = EntityState.Modified;
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAsync(T entity, CancellationToken cancellationToken = default)
        {
            _context.Set<T>().Remove(entity);
            await _context.SaveChangesAsync(cancellationToken);
        }
        // =============================================
        // Dynamic Filter
        // =============================================

        private static IQueryable<T> ApplyFilter(
            IQueryable<T> query,
            string propertyName,
            string value)
        {
            var property = typeof(T)
                .GetProperty(
                    propertyName,
                    BindingFlags.IgnoreCase |
                    BindingFlags.Public |
                    BindingFlags.Instance);

            if (property == null)
                return query;

            var parameter = Expression.Parameter(
                typeof(T),
                "x");

            var propertyExpression =
                Expression.Property(
                    parameter,
                    property);

            var propertyType =
                Nullable.GetUnderlyingType(property.PropertyType)
                ?? property.PropertyType;

            object? convertedValue;

            try
            {
                convertedValue = Convert.ChangeType(
                    value,
                    propertyType);
            }
            catch
            {
                return query;
            }

            var constant = Expression.Constant(
                convertedValue,
                propertyType);

            Expression body;

            // String contains
            if (propertyType == typeof(string))
            {
                var containsMethod =
                    typeof(string).GetMethod(
                        nameof(string.Contains),
                        new[] { typeof(string) })!;

                body = Expression.Call(
                    propertyExpression,
                    containsMethod,
                    Expression.Constant(value));
            }
            else
            {
                body = Expression.Equal(
                    propertyExpression,
                    constant);
            }

            var lambda =
                Expression.Lambda<Func<T, bool>>(
                    body,
                    parameter);

            return query.Where(lambda);
        }

        // =============================================
        // Global Search
        // =============================================

        private static IQueryable<T> ApplyGlobalSearch(
            IQueryable<T> query,
            string search)
        {
            var stringProperties = typeof(T)
                .GetProperties(
                    BindingFlags.Public |
                    BindingFlags.Instance)
                .Where(x =>
                    x.PropertyType == typeof(string));

            if (!stringProperties.Any())
                return query;

            var parameter = Expression.Parameter(
                typeof(T),
                "x");

            Expression? combinedExpression = null;

            foreach (var property in stringProperties)
            {
                var propertyExpression =
                    Expression.Property(
                        parameter,
                        property);

                var containsMethod =
                    typeof(string).GetMethod(
                        nameof(string.Contains),
                        new[] { typeof(string) })!;

                var containsExpression =
                    Expression.Call(
                        propertyExpression,
                        containsMethod,
                        Expression.Constant(search));

                combinedExpression =
                    combinedExpression == null
                        ? containsExpression
                        : Expression.OrElse(
                            combinedExpression,
                            containsExpression);
            }

            if (combinedExpression == null)
                return query;

            var lambda =
                Expression.Lambda<Func<T, bool>>(
                    combinedExpression,
                    parameter);

            return query.Where(lambda);
        }

        // =============================================
        // Sorting
        // =============================================

        private static IQueryable<T> ApplySorting(
            IQueryable<T> query,
            string sortBy,
            bool descending)
        {
            var property = typeof(T)
                .GetProperty(
                    sortBy,
                    BindingFlags.IgnoreCase |
                    BindingFlags.Public |
                    BindingFlags.Instance);

            if (property == null)
                return query;

            var parameter =
                Expression.Parameter(
                    typeof(T),
                    "x");

            var propertyExpression =
                Expression.Property(
                    parameter,
                    property);

            var lambda =
                Expression.Lambda(
                    propertyExpression,
                    parameter);

            string methodName = descending
                ? "OrderByDescending"
                : "OrderBy";

            var resultExpression =
                Expression.Call(
                    typeof(Queryable),
                    methodName,
                    new[]
                    {
                    typeof(T),
                    property.PropertyType
                    },
                    query.Expression,
                    Expression.Quote(lambda));

            return query.Provider
                .CreateQuery<T>(resultExpression);
        }
    }
}
