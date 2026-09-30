using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using TestApplication.Application.Common.Command;
using TestApplication.Infrastructure.AppDbContext;

namespace TestApplication.Application.Common.Handler
{
    public class UpdateUserOnlineStatusCommandHandler : IRequestHandler<UpdateUserOnlineStatusCommand>
    {
        private readonly ApplicationDbContext _context;

        public UpdateUserOnlineStatusCommandHandler(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task Handle(UpdateUserOnlineStatusCommand request, CancellationToken cancellationToken)
        {
                var user = await _context.Users
                    .FirstOrDefaultAsync(
                        x => x.Id == request.UserId,
                        cancellationToken);

                if (user == null)
                    return;

                user.IsOnLine = request.IsOnline;

                await _context.SaveChangesAsync(
                    cancellationToken);
        }
    }
}
