using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Query;
using TestApplication.Domain.Entity;

namespace TestApplication.API.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        protected readonly IMediator _mediator;
        private readonly IPasswordHasher<User> _passwordHasher;

        public UserController(IMediator mediator, IPasswordHasher<User> passwordHasher)
        {
            _mediator = mediator;
            _passwordHasher = passwordHasher;
        }
        [HttpGet]
        public async Task<IActionResult> GetAllUsers(CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new GenericGetAllQuery<User>());
            return Ok(result);
        }
        [HttpGet]
        public async Task<IActionResult> GetUserById(Guid id)
        {
            var result=await _mediator.Send(new GenericGetByIdQuery<User>(id));
            return Ok(result);
        }
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody]User user)
        {
            user.Password = _passwordHasher.HashPassword(user, user.Password);
            var result = await _mediator.Send(new GenericCreateCommand<User>(user));
            return Ok(result);
        }
    }
}
