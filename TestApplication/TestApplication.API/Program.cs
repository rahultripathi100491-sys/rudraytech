using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Handler;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;
using TestApplication.Infrastructure.Repository;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Environment.IsDevelopment() ? builder.Configuration.GetConnectionString("DefaultConnection") : builder.Configuration.GetConnectionString("DevConnection");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));

// Register MediatR assembly from Application layer
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(IGenericRepository<>).Assembly));

// 2. Explicitly register open generic handlers for MediatR
builder.Services.AddTransient(
    typeof(IRequestHandler<GenericCreateCommand<User>, User>),
    typeof(GenericCreateCommandHandler<User>)
);
//builder.Services.AddTransient(typeof(IRequestHandler<GenericCreateCommand<User>, object>), typeof(GenericCreateCommandHandler<>));
// Register PasswordHasher for your User entity
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
//builder.Services.AddTransient(typeof(IRequestHandler<GenericUpdateCommand<>, Unit>), typeof(GenericUpdateCommandHandler<>));
//builder.Services.AddTransient(typeof(IRequestHandler<GenericDeleteCommand<>, Unit>), typeof(GenericDeleteCommandHandler<>));
//builder.Services.AddTransient(typeof(IRequestHandler<GenericGetByIdQuery<>, >), typeof(GenericGetByIdQueryHandler<>));
//builder.Services.AddTransient(typeof(IRequestHandler<GenericGetAllQuery<>, >), typeof(GenericGetAllQueryHandler<>));

var app = builder.Build();

// Configure the HTTP request pipeline.
//if (app.Environment.IsDevelopment())
//{
    app.UseSwagger();
    app.UseSwaggerUI();
//}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
