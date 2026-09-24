using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using TestApplication.API.Hubs;
using TestApplication.Application.Common.Command;
using TestApplication.Application.Common.Handler;
using TestApplication.Application.Common.Query;
using TestApplication.Application.Common.Services;
using TestApplication.Domain.Entity;
using TestApplication.Infrastructure.AppDbContext;
using TestApplication.Infrastructure.Interface;
using TestApplication.Infrastructure.Repository;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
//builder.Services.AddSwaggerGen();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Test Application API",
        Version = "v1"
    });

    // 1. Define the Security Scheme (Bearer Token)
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token in the text box below.\n\nExample: `eyJhbGciOiJIUzI1Ni...`"
    });

    // 2. Apply Security Requirement Globally
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var connectionString = builder.Environment.IsDevelopment() ? builder.Configuration.GetConnectionString("DefaultConnection") : builder.Configuration.GetConnectionString("DevConnection");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddSignalR();

builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));

// Register MediatR assembly from Application layer
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(IGenericRepository<>).Assembly));
// MediatR v12+ syntax:
builder.Services.AddMediatR(cfg =>
{
    // Register handlers from Application assembly using any class in that project
    cfg.RegisterServicesFromAssembly(typeof(LoginCommandHandler).Assembly);
});

var jwtKey = builder.Configuration["JwtSettings:Secret"]
    ?? throw new InvalidOperationException("JWT Key 'Jwt:Key' is missing in appsettings.json");

// 1. Configure Authentication with Default Schemes
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"]!))
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            // Extracts token from query string when connecting to /chatHub
            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/chatHub", StringComparison.OrdinalIgnoreCase))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});
// 2. Explicitly register open generic handlers for MediatR
builder.Services.AddScoped(typeof(IRequestHandler<GenericCreateCommand<User>, User>), typeof(GenericCreateCommandHandler<User>)
);
//builder.Services.AddTransient(typeof(IRequestHandler<GenericCreateCommand<User>, object>), typeof(GenericCreateCommandHandler<>));
// Register PasswordHasher for your User entity
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddTransient(typeof(IRequestHandler<GenericUpdateCommand<User>, Unit>), typeof(GenericUpdateCommandHandler<User>));
//builder.Services.AddTransient(typeof(IRequestHandler<GenericDeleteCommand<>, Unit>), typeof(GenericDeleteCommandHandler<>));
builder.Services.AddTransient(typeof(IRequestHandler<GenericGetByIdQuery<User>, User>), typeof(GenericGetByIdQueryHandler<User>));
builder.Services.AddTransient(typeof(IRequestHandler<GenericGetAllQuery<User>, PaginatedResult<User>>), typeof(GenericGetAllQueryHandler<User>));
builder.Services.AddScoped<IUserRepository, UserRepository>();
// Register TokenService in Dependency Injection container
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(
                    "https://rudraytech.lovestoblog.com", // Your hosted frontend domain
                    "http://localhost:4200"              // Local development domain
               )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR WebSocket connections
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
//if (app.Environment.IsDevelopment())
//{
    app.UseSwagger();
    app.UseSwaggerUI();
//}

app.UseCors("AllowAngular");

app.UseHttpsRedirection();

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapHub<ChatHub>("/chatHub");

app.Run();
