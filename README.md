# omp-ntfy

Instant, 100% free push notifications to your phone for the [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) coding agent and [pi](https://pi.dev) via [ntfy.sh](https://ntfy.sh).

Know the exact second your agent completes a long-running task or stops to wait for your answer — without watching the terminal, without paid API subscriptions, and without scanning QR codes that expire.

---

## Why `omp-ntfy`?

- **100% Free & Open Source:** No Twilio, no paid SMS gateways, no subscription plans.
- **Zero Logins, Zero Accounts, Zero QR Codes:** No accounts to create. No WhatsApp Web linked sessions that disconnect every few weeks.
- **Reliable Lock-Screen Alerts:** High-priority push notifications with vibration and sound that wake up your phone even in deep sleep (Android Doze).
- **Disabled by Default:** Starts completely silent on every session so you're never spammed during normal interactive work.
- **One-Shot Arming (`/ntfy once`):** Arms the agent for just the upcoming run. Once the agent finishes or asks a question, your phone buzzes and the notification **automatically disarms** itself.

---

## 30-Second Phone Setup

1. Install the free **ntfy** app on your phone:
   - [Google Play Store](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   - [F-Droid](https://f-droid.org/packages/io.heckel.ntfy/)
   - [iOS App Store](https://apps.apple.com/app/ntfy/id1625396347)
2. Open the app, tap the **`+`** button (Add subscription), and choose a unique topic name (e.g. `my-omp-alert` or a private string).
3. Tap **Subscribe**. That's it!

---

## Installation

### On oh-my-pi (omp)
```bash
omp install npm:omp-ntfy
# or directly from git:
omp install git:github.com/<username>/omp-ntfy
```

For local development:
```bash
omp plugin link ./omp-ntfy
```

### On stock pi
```bash
pi install npm:omp-ntfy
```

---

## Commands

Inside your `omp` terminal session, use the `/ntfy` slash command:

| Command | Action |
| :--- | :--- |
| `/ntfy once` | **One-shot arming:** Alerts your phone on the next task completion or question, then immediately disarms back to disabled. |
| `/ntfy on` | Keep notifications enabled for all turns in the active session. |
| `/ntfy off` | Disarm / disable notifications. |
| `/ntfy test` | Send an immediate test push notification to verify phone delivery. |
| `/ntfy topic <name>` | Set your ntfy topic name (saved to config). |
| `/ntfy status` | Show current arming state, active topic, and preview URL. |
| `/ntfy server <url>` | Use a custom or self-hosted ntfy server (defaults to `https://ntfy.sh`). |

---

## How it Works

| Event | Phone Notification | Priority |
| :--- | :--- | :--- |
| **Task Completed** | `Task completed: <concise summary of work done>` | High (Chime + Vibration) |
| **Question Waiting** | `Question waiting for your answer: <what the agent needs your input on>` | Urgent (Loud + Persistent) |
| **Tool Approval** | `Waiting for your approval to run tool: <tool name>` | High |

- **Quiet Window Debounce:** Completion notifications only fire when the agent has truly settled and returned to idle, preventing duplicate alerts during multi-turn plan executions.
- **Smart Formatting:** Code fences and markdown symbols are stripped to keep push notification previews clean and readable on lock screens.

---

## Configuration

Settings are saved automatically to `~/.omp/agent/omp-ntfy.json` when you run `/ntfy topic <name>`.

You can also configure via environment variables:
- `NTFY_TOPIC`: Default topic name (e.g. `export NTFY_TOPIC="my-omp-alert"`)
- `NTFY_SERVER`: Custom ntfy server URL (defaults to `https://ntfy.sh`)

---

## License

[MIT](LICENSE)
