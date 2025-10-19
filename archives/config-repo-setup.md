# RadianPlanner Private Config

This is a private repository containing sensitive configuration for RadianPlanner.

## Setup Instructions

1. Clone this private repo alongside RadianPlanner:
```
GitHub/
├── RadianPlanner/           (public repo)
└── RadianPlanner-Config/    (private repo)
    └── .env
```

2. The RadianPlanner app will automatically look for config in `../RadianPlanner-Config/.env`

## Environment Variables

Copy the example below to `.env` and fill in your credentials:

```bash
# iRacing OAuth2 Credentials
IRACING_CLIENT_ID=radian-limited
IRACING_CLIENT_SECRET=viewable-SALAMI-net-mortician-Fever-asparagus
IRACING_EMAIL=your-iracing-email@example.com
IRACING_PASSWORD=your-iracing-password

# Database Configuration  
DATABASE_URL=your-database-url-here
```

## Security Notes

- Never commit real credentials to any public repository
- This private repo should only be accessible to authorized team members
- Consider using GitHub organization private repos for team access