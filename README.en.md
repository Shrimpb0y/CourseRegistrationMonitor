# UPM Local Course Monitor

Archived release: `v-0.1` (package version `0.1.0`). See [CHANGELOG.en.md](CHANGELOG.en.md) for changes and validation scope, and [the English documentation index](docs/en/INDEX.md) for the handoff, discussion record, and GitHub selection report. Git stores application code and shareable documentation; local authentication and runtime data are excluded.

This project is derived from [estallio/tiss-registration-bot](https://github.com/estallio/tiss-registration-bot), revision `6dbd4dcba8a6f9603ba14b55a67f2719a463b7f5`. The original code and configuration are preserved in `upstream-tiss/`, and the MIT license remains at the repository root. The UPM adapter is a new implementation that follows the original browser automation, background task, and retry design. It does not reuse the TU Vienna login or JavaScript-blocking logic.

## Delivered functionality

- A local Node.js service with a management page at `http://127.0.0.1:8765`.
- Current Puppeteer Core driving the installed Microsoft Edge, with a separate profile in `runtime/browser-profile`.
- Manual login, without requesting or storing a plaintext password.
- Registered-course verification, lecture-group seat queries, serial polling, failure backoff, and duplicate-registration protection.
- Monitor-only mode by default. Adding and submitting a course is attempted only after automatic registration is explicitly enabled in the local management page.
- Persistent suspension when a registration outcome is unclear. Restarting does not clear the manual-review requirement.
- Course-code or prefix search, lecture groups with complete schedules, course-category selection, and target persistence. One target is processed at a time; multiple-target scheduling is future work.

## Start the application

Dependencies are already installed on the delivery machine. In Windows File Explorer, open the project directory and double-click `启动本地监听.cmd` (start local monitor). Keep its console open, then open `http://127.0.0.1:8765/` in the system Edge browser. Startup errors appear in the console. Closing it stops the foreground service.

After confirming foreground startup works, `后台启动.cmd` starts the service with a hidden console. `停止本地监听.cmd` stops the service. `重新启动.cmd` stops the previous instance, waits for its port to be released, and starts the new instance. These launchers set execution options only for the PowerShell process they start; they do not change the system execution policy.

Opening a script link in a chat or editor may show its source instead of executing it. Run the launcher from File Explorer, or run this from PowerShell in the project directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File .\start-local.ps1
```

For the delivered desktop location, Win + R can run:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "C:\Users\22567\Desktop\courseregistration\start-local.ps1"
```

The Chinese source documents include the earlier workspace location. The command above uses the final desktop delivery location; application scripts and behavior have not been changed by this translation.

If the browser reports a refused connection, check whether the startup console is still running. An old `server.pid` or an address in a log does not prove that the service is currently available. The launcher checks `/health` and reports readiness only after the local service responds. An occupied port or missing dependency produces an explicit error. Use the system Edge browser for initial validation.

The script first tries the Node.js runtime bundled with Codex, then a system installation. On another machine, install Node.js 22 or later, run `npm ci --ignore-scripts`, then `npm start`. The application uses the installed Edge and does not download another Chromium browser.

1. Open the local management page.
2. Click `打开登录浏览器` (open login browser) and manually sign in to UPM in the new dedicated Edge window.
3. Return to the management page, enter a course code or prefix such as `LPD`, and click `搜索课程` (search courses). Click a result to load its lecture groups.
4. Select a Lecture Group and check every time slot in its schedule. If Lab groups exist, select a Lab group as well. Confirm the category, which defaults to `EL`, and the polling interval, then click `保存为监听目标` (save monitoring target). The target is saved in local `config.json` and survives a restart. Full groups can also be selected for monitoring.
5. Click `开始监听` (start monitoring). This queries availability without submitting a registration. Stop monitoring and wait for the current operation to finish before changing the target.
6. For automatic registration, confirm the target, tick the explicit confirmation checkbox, and click `启动自动选课` (start automatic registration). Saving a new target clears automatic mode and requires confirmation again. Targets with a Lab group cannot start automatic registration in this version; only Lecture availability is monitored.
7. For desktop notifications, enable them in the local page and allow the browser notification permission. Notifications require the management page to remain open; background polling does not.

Search returns the current page of the school's course-directory results. Use a more complete course code if too many results exist. Saving is restricted to groups loaded during the current selection operation. Unknown groups, a missing required Lab selection, or an unresolved previous registration outcome are rejected. The selector does not decide prerequisite eligibility, credit limits, or timetable conflicts; the school determines final eligibility.

Do not manually operate the dedicated Edge UPM page during monitoring: the adapter navigates and queries it. Its login session is separate from Codex's in-app browser. The computer must remain powered on, connected, and awake. Locking the desktop can allow background execution; it is distinct from sleep.

## Configure a target

Prefer searching and saving through the management page. You may also stop the service, edit `config.json`, and restart. Each run handles one target. Verify the school's complete time code for a new target.

```json
{
  "port": 8765,
  "pollIntervalSeconds": 30,
  "target": {
    "courseCode": "LPD2107",
    "lectureGroup": "1",
    "lectureTime": "I10-12,R09",
    "category": "EL",
    "labGroup": ""
  }
}
```

The default target meets Monday 10:00–12:00 and Wednesday at 09:00, in BK03 KAA. The query did not provide Wednesday's end time. FE means Free Elective and corresponds to ELECTIVE COURSE (`EL`) in the system. The configured group, category, and complete schedule must match the school page. Allowed polling intervals are 15–3600 seconds; 30 seconds is the initial recommendation. Both availability fields must be positive before automatic registration is triggered. Changes in field meaning or format require review.

Automatic handling of Lab courses has not been validated. The initial verified target has no Lab. Selecting a Lab Group alone does not mean that the full experimental-class registration flow is supported.

## Stop and recover

`停止监听` (stop monitoring) prevents subsequent cycles and a final submission that has not yet occurred. It cannot retract a request already submitted to the school. If pending items exist when the task pauses, check them on the school page; temporary reservations may occupy seats. Do not restart blindly and risk duplicate submission.

To close the service and dedicated Edge completely:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\stop-local.ps1
```

When a registration result is unclear, first inspect the school's registered and pending lists, then use the management page's control to confirm that you have checked the previous result and clear the suspension. When authentication expires, sign in again in dedicated Edge; monitoring retries with backoff. You can stop monitoring, log in, and restart monitoring.

To restart the service:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File .\restart-local.ps1
```

## Storage and network

`runtime/` contains `state.json`, `events.jsonl`, `notifications.jsonl`, service logs, and the dedicated Edge profile. It is ignored by Git and must not be packaged for sharing or uploaded to GitHub. The application has no cloud database, remote logging, or third-party messaging integration. Runtime operations require the UPM website; installation requires the relevant source and package registries. Edge's own system services and network behavior are not fully controlled by this application. Absence of application uploads does not mean the browser makes no other requests.

The service binds only to `127.0.0.1`. Management APIs validate Host, Origin, and a random page token to prevent other websites from invoking registration actions. Do not expose the service publicly.

## Validation scope

On 2026-10-10, the revised adapter performed real read-only queries using an authenticated dedicated Edge. Searching `LPD` returned LPD2107 and LPD2108, with five and one Lecture Groups respectively, and no Lab groups. LPD2107 Group 1 had time code `I10-12,R09`, capacity 29, 29 registered students, and zero in both availability fields. LPD2108 Group 1 had AVAILABLE = 1 but NO. OF QUOTA AVAILABLE = 0, so automatic registration remained ineligible. These are historical snapshots, not current availability. No course was added or submitted during these queries.

The adapter was fixed to wait for the school's same-origin read-only directory response rather than reading old results before the school's two-second search-field check. The page CSP was also fixed to allow `app.js`. An existing service must be restarted to load revised code. The restart entry point shuts down the old service through its local API, waits for the port to be released, then starts the new code.

Twenty-one logic, API, and adapter-helper tests passed, covering course changes, mandatory Lab selection, operation exclusion, persistence, clearing automatic mode, and page script policy. The last reported full-code line coverage was approximately 69%, below the 80% target. The simulated browser test included in `npm test` still failed with `Target closed` when launching Edge in the restricted tool environment; it is not recorded as passed.

At 17:52 on 2026-10-10 (Asia/Singapore), the real management page passed this sequence: search LPD → load five LPD2107 groups → select Group 1 → save an EL target → start monitor-only mode → read availability successfully → stop. The final successful query was at 17:52:44: capacity 29, registered 29, remaining quota 0, available 0, no error. After validation, `running=false` and `autoEnroll=false`; the target remained saved locally. See [the acceptance screenshot](docs/UPM课程选择验收.jpg).

Final registration after a real opening appears has not been validated. The adapter depends on the current e-SMP page structure and needs review when it changes.
