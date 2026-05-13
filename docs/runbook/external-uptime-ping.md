# External Uptime Ping — Setup Runbook

## Why

GitHub Actions free-tier cron is unreliable: scheduled `*/10 * * * *` runs
in practice drift by 1–3 hours, leaving the Render free-tier backend in
sleep (Render sleeps after 15min idle). When the next ping fires, Render
cold-boots and the ping times out → 503.

External ping services run from their own infrastructure with strict
schedules. UptimeRobot and cron-job.org both offer free 5-min ping plans.

## Target endpoint

```
GET https://<backend-host>/api/healthz
```

Returns `{"status": "ok"}` in <100ms (no DB, no external API).
The backend URL is the value of `BACKEND_BASE_URL` in GitHub secrets,
also visible in `frontend/.env.production` as `NEXT_PUBLIC_API_URL`.

## UptimeRobot setup (recommended)

1. Sign up at https://uptimerobot.com (free tier: 50 monitors, 5-min checks).
2. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: `Portfolio Tracker — Render Keep-Alive`
   - URL: `https://<backend-host>/api/healthz`
   - Monitoring Interval: 5 minutes
   - Monitor Timeout: 30 seconds (Render cold-boot can take 20–30s)
3. Optional: configure an alert contact for downtime notifications.
4. Save.

## cron-job.org alternative

1. Sign up at https://cron-job.org.
2. Create cronjob:
   - URL: `https://<backend-host>/api/healthz`
   - Schedule: every 5 minutes
   - Timeout: 30s
3. Save.

## Verification

24 hours after enabling:

1. Check ping-service dashboard — uptime should be ≥ 99% (some 503s during
   first cold boots are expected as the system stabilizes).
2. Run from any terminal:
   ```bash
   for i in 1 2 3; do
     curl -sS -o /dev/null -w "ping %{http_code} %{time_total}s\n" https://<backend-host>/api/healthz
     sleep 60
   done
   ```
   Three pings, ≥ 200 status, each < 2s = backend is staying warm.

## Rollback

Re-enable `.github/workflows/keep-alive.yml.disabled` by renaming back to
`keep-alive.yml`. The workflow file is preserved in the repo for this purpose.
