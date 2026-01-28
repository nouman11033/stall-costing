# Vercel Deployment Checker

Quick commands to check your Vercel deployments and build status from the terminal.

## Quick Commands

### Check Latest Deployment Status
```bash
npm run vercel:check
```
or
```bash
./check-vercel.sh
```

### View Build Logs
```bash
npm run vercel:logs
```

### Manual Commands

**List all deployments:**
```bash
vercel ls --yes
```

**Check specific deployment:**
```bash
vercel inspect <deployment-url>
```

**View build logs:**
```bash
vercel inspect <deployment-url> --logs
```

**Get latest deployment URL:**
```bash
vercel ls --yes | grep -oE "https://[a-zA-Z0-9-]+\.vercel\.app" | head -1
```

## Troubleshooting

If you see "No deployments found":
1. Make sure the project is linked: `vercel link`
2. Check that deployments exist in your Vercel dashboard
3. Wait a few moments after pushing to GitHub for Vercel to start building

If the project is linked to a different Vercel project:
1. Run `vercel link` to re-link to the correct project
2. Or use the deployment URL directly from Vercel dashboard

## Alternative: Check via GitHub Actions/Webhooks

You can also set up GitHub Actions to automatically check deployment status, or use Vercel's webhook notifications.
