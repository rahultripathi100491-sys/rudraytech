using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TestApplication.Application.Common.Command;
using TestApplication.Domain.Entity;

namespace TestApplication.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        protected readonly IMediator Mediator;
        private readonly IPasswordHasher<User> _passwordHasher;

        public UserController(IMediator mediator, IPasswordHasher<User> passwordHasher)
        {
            Mediator = mediator;
            _passwordHasher = passwordHasher;
        }
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody]User user)
        {
            user.Password = _passwordHasher.HashPassword(user, user.Password);
            var result = await Mediator.Send(new GenericCreateCommand<User>(user));
            return Ok(result);
        }
    }
}
