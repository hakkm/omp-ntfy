# omp-ntfy

[![npm version](https://badgen.net/npm/v/omp-ntfy)](https://www.npmjs.com/package/omp-ntfy)
[![npm downloads](https://badgen.net/npm/dm/omp-ntfy)](https://www.npmjs.com/package/omp-ntfy)
[![GitHub license](https://badgen.net/github/license/hakkm/omp-ntfy)](LICENSE)
[![GitHub stars](https://badgen.net/github/stars/hakkm/omp-ntfy)](https://github.com/hakkm/omp-ntfy)

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
2. [Install omp-ntfy](#installation) and run `/ntfy status`. On first run it generates a random topic (like `omp-kqzt`) and saves it to your config.
3. In the ntfy app, tap the **`+`** button (Add subscription), enter that topic, and tap **Subscribe**. That's it!

ntfy.sh topics are public: anyone who knows the name can read and post to it, and notifications include a summary of your agent's work. The generated topic is short so it's easy to type, which also means it's guessable and another user could get the same one. For more privacy, run `/ntfy topic <name>` with a longer name that's hard to guess, or [self-host ntfy](https://docs.ntfy.sh/install/) and use `/ntfy server <url>`.

---

## Installation

### Let your agent install it

Paste this prompt into omp, pi, or any coding agent with shell access:

```text
Install the omp-ntfy extension (https://github.com/hakkm/omp-ntfy) for me. It sends phone push notifications from omp/pi via ntfy.sh.

1. Run `command -v omp` and `command -v pi` to see which agent CLI I have.
2. If omp is available: run `omp install npm:omp-ntfy`. If omp-ntfy is already installed, run `omp plugin upgrade omp-ntfy` instead. Then run `omp plugin list` and confirm omp-ntfy is listed.
3. If only pi is available: run `pi install npm:omp-ntfy`. If omp-ntfy is already installed, run `pi update --extension npm:omp-ntfy` instead. Then run `pi list` and confirm omp-ntfy is listed.
4. Do not create or edit omp-ntfy.json yourself. The extension generates a random topic the first time it runs.
5. When you're done, tell me to:
   - install the free ntfy app (Google Play, F-Droid, or the iOS App Store),
   - restart omp or pi and run `/ntfy status` to see my topic,
   - subscribe to that topic in the ntfy app, then run `/ntfy test`,
   - unsubscribe from `omp-alert` if I subscribed to it before.
```

### On oh-my-pi (omp)
```bash
# via npm:
omp install npm:omp-ntfy

# or via omp marketplace:
/marketplace add hakkm/omp-ntfy
/marketplace install omp-ntfy@omp-ntfy

# or directly from git:
omp install git:github.com/hakkm/omp-ntfy
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

On first run, omp-ntfy generates a random topic and saves it to `~/.omp/agent/omp-ntfy.json` (`~/.pi/agent/omp-ntfy.json` on stock pi). `/ntfy topic <name>` and `/ntfy server <url>` update the same file.

You can also configure via environment variables (the config file takes precedence):
- `NTFY_TOPIC`: Topic name to use instead of a generated one (e.g. `export NTFY_TOPIC="omp-$(openssl rand -hex 8)"`)
- `NTFY_SERVER`: Custom ntfy server URL (defaults to `https://ntfy.sh`)

---

## Upgrading from 0.1.0

0.1.0 used `omp-alert` as the default topic, so everyone who didn't set their own topic shared one public channel and received each other's notifications. Since 0.1.1, omp-ntfy generates a random topic per user instead, including for configs that still contain `omp-alert`. Your first `/ntfy` command shows the new topic name. Subscribe to it in the ntfy app and unsubscribe from `omp-alert`.

---

## License

[MIT](LICENSE)
