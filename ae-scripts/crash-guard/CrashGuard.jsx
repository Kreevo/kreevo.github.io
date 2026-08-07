// Crash Guard by Kreevo
// ScriptUI dockable panel for After Effects — versioned auto-backup,
// live system load monitor, pre-render health check, crash history log.
// v2.1.0 — single-file build, larger UI, hardened system-stats reading

(function (thisObj) {

    // ---------------------------------------------------------------
    // BRAND
    // ---------------------------------------------------------------
    var BRAND = {
        bg:       [0x2E / 255, 0x4A / 255, 0x3A / 255],
        card:     [0x3D / 255, 0x5C / 255, 0x48 / 255],
        btn:      [0x45 / 255, 0x67 / 255, 0x52 / 255],
        btnHover: [0x51 / 255, 0x76 / 255, 0x5F / 255],
        accent:   [0xD8 / 255, 0x5A / 255, 0x30 / 255],
        text:     [0xF5 / 255, 0xF2 / 255, 0xE3 / 255],
        muted:    [0xB8 / 255, 0xC4 / 255, 0xB5 / 255],
        border:   [0x1C / 255, 0x2E / 255, 0x22 / 255]
    };

    function getBestFont() {
        return ($.os.indexOf("Windows") !== -1) ? "Segoe UI" : "Helvetica Neue";
    }
    var FONT = getBestFont();
    var IS_WIN = ($.os.indexOf("Windows") !== -1);

    // ---------------------------------------------------------------
    // PATHS
    // ---------------------------------------------------------------
    var BASE_DIR = Folder.userData.fsName + "/Kreevo/CrashGuard";
    var SETTINGS_FILE = new File(BASE_DIR + "/settings.txt");
    var HISTORY_FILE = new File(BASE_DIR + "/history.log");
    var SESSION_MARKER = new File(BASE_DIR + "/session.lock");
    var LOGO_CACHE_FILE = new File(BASE_DIR + "/logo_cache.png");
    var STATS_PS1_FILE = new File(BASE_DIR + "/stats.ps1");
    var LAST_STATE_FILE = new File(BASE_DIR + "/last_state.txt");

    function ensureBaseDir() {
        try {
            var f = new Folder(BASE_DIR);
            if (!f.exists) f.create();
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // LOGO — embedded as base64 so the whole panel ships as one .jsx
    // with nothing else to install or place in a folder. Baked at the
    // exact pixel size it's shown at (36x36) — ScriptUI's "image"
    // control does NOT scale its contents to fit a bounding box, it
    // draws pixels 1:1, so shipping a mismatched size is what cropped
    // the logo before. Decoded once into a small cache file (ScriptUI
    // needs a real file on disk, not raw bytes), then reused after.
    // ---------------------------------------------------------------
    var LOGO_BASE64 =
        "iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAACrUlEQVR4nO2UT4scVRTFz7mvuqu7qtsoZECdCBElOxfqMpDEnRtBXMzWjaDiymVAmPkEZuHCpYsggcmHmMGQneIqIQSGpGdaBpPMTP+pnuqqrnrHRfdgcBG7kglkUT94UDzq1Tl1370HqKmpqal5tWHVA5IIbLt/d64AQElSkhwAYnt7sQ2QnxQvbvM5mBt9cYIqgvMq/BWNh/n3zUb4rofMmXsyK+0ayf002f202e58nh1PgkYjtFme77S7/kfgnSlIENBpmD4xFADAaND7Vkolfyj5I0lSMuhdPTzcOTMZ7SVSKmm4WJmSpP8hAGxubrpnK8xZukInONrbQFlOxskMoHNBRpp9HbJ5SZImoycFoLIVxY1s+uhWvJ/elWQky5diSFIBwAEQIEIlAXVAXjGak2TmAiuKIneyb3jhQibJlv3+0i/+94QExXHkWvGKeXINwG/tzmpD8mpFHZtNj39ovbZ6b2trKyDpK+v8Hyc9lIx216Wxjsf9cpY//iMZ7X4FAGnaey+fPrqeTw8mk+HeHUlOklWdvsoVokhAMONBkef9Isv/BICdnfFeOhndyPP0ruDvz3vmJklWmqzKPTTHUBR+aOSl7pnXfx8Meu8HwJqZ+87D9wWeGx08vEiev71o6KWvrHpTU1oE/KqXnwlAg/aLqPMg3qTwBsEhw8bPg0HvMoDBSYYt96sVoWiALwE5gJ0smxagPiZ4FjRKaAlaacfdD5zx2tzIzZc3ZSQyoOPCsNkMmw2LOquBF34y8rN2fNaiKLIoageaZeh0V75Mjh5+RK6V0ikH48bGhpfENN3/NU//vujl35IXfPb4sGm6HnbP3UkGvautOP4in2ZmzjnmRw8UhP3FpJ3+6D+LKuF32sJ8WlySaX3dFs/u6dx5nhyqqampqXnV+QfXWHeeZJE1yQAAAABJRU5ErkJggg==";

    function base64Decode(b64) {
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var output = "";
        var i = 0;
        while (i < b64.length) {
            var e1 = chars.indexOf(b64.charAt(i++));
            var e2 = chars.indexOf(b64.charAt(i++));
            var e3 = chars.indexOf(b64.charAt(i++));
            var e4 = chars.indexOf(b64.charAt(i++));
            var c1 = (e1 << 2) | (e2 >> 4);
            var c2 = ((e2 & 15) << 4) | (e3 >> 2);
            var c3 = ((e3 & 3) << 6) | e4;
            output += String.fromCharCode(c1);
            if (e3 !== 64) output += String.fromCharCode(c2);
            if (e4 !== 64) output += String.fromCharCode(c3);
        }
        return output;
    }

    function getLogoFile() {
        try {
            if (!LOGO_CACHE_FILE.exists) {
                ensureBaseDir();
                LOGO_CACHE_FILE.encoding = "BINARY";
                LOGO_CACHE_FILE.open("w");
                LOGO_CACHE_FILE.write(base64Decode(LOGO_BASE64));
                LOGO_CACHE_FILE.close();
            }
            return LOGO_CACHE_FILE.exists ? LOGO_CACHE_FILE : null;
        } catch (e) {
            return null;
        }
    }
    var LOGO_FILE = getLogoFile();

    // ---------------------------------------------------------------
    // SETTINGS — plain "key=value" lines, no eval, no JSON dependency.
    // ---------------------------------------------------------------
    var SETTINGS_DEFAULTS = { enabled: true, intervalMinutes: 10, maxBackups: 20 };

    function loadSettings() {
        var result = {};
        for (var k in SETTINGS_DEFAULTS) result[k] = SETTINGS_DEFAULTS[k];
        try {
            if (SETTINGS_FILE.exists) {
                SETTINGS_FILE.open("r");
                var raw = SETTINGS_FILE.read();
                SETTINGS_FILE.close();
                var lines = raw.split("\n");
                for (var i = 0; i < lines.length; i++) {
                    var eq = lines[i].indexOf("=");
                    if (eq < 0) continue;
                    var key = lines[i].substring(0, eq).replace(/^\s+|\s+$/g, "");
                    var val = lines[i].substring(eq + 1).replace(/^\s+|\s+$/g, "");
                    if (!(key in SETTINGS_DEFAULTS)) continue;
                    if (typeof SETTINGS_DEFAULTS[key] === "boolean") {
                        result[key] = (val === "true");
                    } else {
                        var n = parseFloat(val);
                        if (!isNaN(n)) result[key] = n;
                    }
                }
            }
        } catch (e) {}
        return result;
    }

    function saveSettings(s) {
        try {
            ensureBaseDir();
            var lines = [];
            for (var k in SETTINGS_DEFAULTS) lines.push(k + "=" + s[k]);
            SETTINGS_FILE.open("w");
            SETTINGS_FILE.write(lines.join("\n"));
            SETTINGS_FILE.close();
        } catch (e) {}
    }

    var settings = loadSettings();

    // ---------------------------------------------------------------
    // HISTORY LOG
    // ---------------------------------------------------------------
    function timestamp() {
        var d = new Date();
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
               pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    function appendHistory(line) {
        try {
            ensureBaseDir();
            HISTORY_FILE.open("a");
            HISTORY_FILE.writeln("[" + timestamp() + "] " + line);
            HISTORY_FILE.close();
            trimHistoryIfNeeded();
        } catch (e) {}
    }

    function trimHistoryIfNeeded() {
        try {
            if (!HISTORY_FILE.exists || HISTORY_FILE.length < 200000) return;
            HISTORY_FILE.open("r");
            var raw = HISTORY_FILE.read();
            HISTORY_FILE.close();
            var lines = raw.split("\n");
            if (lines.length <= 400) return;
            var kept = lines.slice(lines.length - 300);
            HISTORY_FILE.open("w");
            HISTORY_FILE.write(kept.join("\n"));
            HISTORY_FILE.close();
        } catch (e) {}
    }

    function readHistoryTail(maxLines) {
        try {
            if (!HISTORY_FILE.exists) return "No history yet. Back up once, or wait for the first automatic backup.";
            HISTORY_FILE.open("r");
            var raw = HISTORY_FILE.read();
            HISTORY_FILE.close();
            var lines = raw.split("\n");
            if (lines.length > maxLines) lines = lines.slice(lines.length - maxLines);
            return lines.join("\n");
        } catch (e) {
            return "Couldn't read history log.";
        }
    }

    // ---------------------------------------------------------------
    // LAST KNOWN STATE — what project/comp was open, refreshed while
    // the panel runs, so if After Effects dies we can tell the user
    // exactly what they were doing right before it happened.
    // ---------------------------------------------------------------
    function recordLastKnownState() {
        try {
            ensureBaseDir();
            var projectName = (app.project && app.project.file) ? app.project.file.name : "(unsaved project)";
            var compName = "—";
            try {
                if (app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) {
                    compName = app.project.activeItem.name;
                }
            } catch (e) {}
            var lines = [
                "PROJECT=" + projectName,
                "COMP=" + compName,
                "TIME=" + timestamp()
            ];
            LAST_STATE_FILE.open("w");
            LAST_STATE_FILE.write(lines.join("\n"));
            LAST_STATE_FILE.close();
        } catch (e) {}
    }

    function readLastKnownState() {
        try {
            if (!LAST_STATE_FILE.exists) return null;
            LAST_STATE_FILE.open("r");
            var raw = LAST_STATE_FILE.read();
            LAST_STATE_FILE.close();
            var result = {};
            var lines = raw.split("\n");
            for (var i = 0; i < lines.length; i++) {
                var eq = lines[i].indexOf("=");
                if (eq < 0) continue;
                result[lines[i].substring(0, eq)] = lines[i].substring(eq + 1);
            }
            return result;
        } catch (e) {
            return null;
        }
    }

    // ---------------------------------------------------------------
    // CRASH DETECTION — a marker file that only survives a bad exit.
    // ---------------------------------------------------------------
    var possibleCrashDetected = false;
    var lastKnownStateAtStartup = null;
    function checkPreviousSession() {
        ensureBaseDir();
        try {
            if (SESSION_MARKER.exists) {
                possibleCrashDetected = true;
                lastKnownStateAtStartup = readLastKnownState();
                appendHistory("Previous session did not close cleanly — possible crash or force-quit.");
            }
            SESSION_MARKER.open("w");
            SESSION_MARKER.write(timestamp());
            SESSION_MARKER.close();
        } catch (e) {}
    }
    function clearSessionMarker() {
        try { if (SESSION_MARKER.exists) SESSION_MARKER.remove(); } catch (e) {}
    }
    checkPreviousSession();

    // ---------------------------------------------------------------
    // SYSTEM LOAD — CPU / RAM / temperature, real readings only.
    // Never estimates or fakes a number; unavailable stays unavailable.
    // ---------------------------------------------------------------
    function runSystemCommand(cmd) {
        try {
            if (typeof system === "undefined" || !system.callSystem) return null;
            var out = system.callSystem(cmd);
            if (out === undefined || out === null) return null;
            return String(out);
        } catch (e) {
            return null;
        }
    }

    function trimSplitLines(s) {
        var raw = s.split(/\r?\n/);
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var t = raw[i].replace(/^\s+|\s+$/g, "");
            if (t.length) out.push(t);
        }
        return out;
    }

    // Windows stats go through a small .ps1 file on disk rather than an
    // inline "powershell -Command "...."" string — a quoted, semicolon-
    // separated inline command proved unreliable through system.callSystem
    // on real machines (it silently returned nothing), while a plain
    // script file with a simple "-File" call is far more robust and only
    // costs one PowerShell launch per refresh instead of three.
    function ensureStatsScript() {
        try {
            if (STATS_PS1_FILE.exists) return true;
            ensureBaseDir();
            var lines = [
                "$ErrorActionPreference = 'SilentlyContinue'",
                "$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
                "Write-Output (\"CPU=\" + $cpu)",
                "$os = Get-CimInstance Win32_OperatingSystem",
                "Write-Output (\"FREE=\" + $os.FreePhysicalMemory)",
                "Write-Output (\"TOTAL=\" + $os.TotalVisibleMemorySize)",
                "$temp = $null",
                "try { $temp = (Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1 -ExpandProperty CurrentTemperature) } catch {}",
                "Write-Output (\"TEMP=\" + $temp)"
            ];
            STATS_PS1_FILE.open("w");
            STATS_PS1_FILE.write(lines.join("\r\n"));
            STATS_PS1_FILE.close();
            return STATS_PS1_FILE.exists;
        } catch (e) {
            return false;
        }
    }

    function parseKeyValueOutput(out) {
        var result = {};
        var lines = trimSplitLines(out);
        for (var i = 0; i < lines.length; i++) {
            var m = lines[i].match(/^(CPU|FREE|TOTAL|TEMP)=(.*)$/);
            if (m) result[m[1]] = m[2];
        }
        return result;
    }

    function getWindowsStatsViaPowerShell() {
        if (!ensureStatsScript()) return null;
        var cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + STATS_PS1_FILE.fsName + '"';
        var out = runSystemCommand(cmd);
        if (!out) return null;
        var result = parseKeyValueOutput(out);
        return (result.CPU !== undefined || result.FREE !== undefined) ? result : null;
    }

    // Fallback for machines where PowerShell is restricted/unavailable.
    // wmic is deprecated on newest Windows builds, so this is only a
    // second line of defense, not the primary path.
    function getWindowsStatsViaWmic() {
        var result = {};
        var cpuOut = runSystemCommand("wmic cpu get loadpercentage");
        if (cpuOut) {
            var m = cpuOut.match(/(\d+)/);
            if (m) result.CPU = m[1];
        }
        var memOut = runSystemCommand("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value");
        if (memOut) {
            var fm = memOut.match(/FreePhysicalMemory=(\d+)/);
            var tm = memOut.match(/TotalVisibleMemorySize=(\d+)/);
            if (fm) result.FREE = fm[1];
            if (tm) result.TOTAL = tm[1];
        }
        return (result.CPU !== undefined || result.FREE !== undefined) ? result : null;
    }

    function getMacCPULoad() {
        var out = runSystemCommand("top -l 1 -n 0");
        if (!out) return null;
        var m = out.match(/CPU usage:\s*([\d.]+)%\s*user,\s*([\d.]+)%\s*sys/);
        if (!m) return null;
        var load = parseFloat(m[1]) + parseFloat(m[2]);
        return isNaN(load) ? null : Math.round(load);
    }

    function getMacRAMUsage() {
        var totalOut = runSystemCommand("sysctl -n hw.memsize");
        var vmOut = runSystemCommand("vm_stat");
        if (!totalOut || !vmOut) return null;
        var totalBytes = parseFloat(totalOut);
        if (isNaN(totalBytes) || totalBytes <= 0) return null;
        var pageSizeMatch = vmOut.match(/page size of (\d+) bytes/);
        var pageSize = pageSizeMatch ? parseFloat(pageSizeMatch[1]) : 4096;
        var freeMatch = vmOut.match(/Pages free:\s*(\d+)\./);
        var specMatch = vmOut.match(/Pages speculative:\s*(\d+)\./);
        var freePages = (freeMatch ? parseFloat(freeMatch[1]) : 0) + (specMatch ? parseFloat(specMatch[1]) : 0);
        var freeBytes = freePages * pageSize;
        var usedBytes = totalBytes - freeBytes;
        return {
            percent: Math.round((usedBytes / totalBytes) * 100),
            usedGB: usedBytes / 1073741824,
            totalGB: totalBytes / 1073741824
        };
    }

    // Single entry point the UI calls once per refresh. Never throws,
    // never fabricates — every field is either a real reading or null.
    function readSystemStats() {
        try {
            if (IS_WIN) {
                var raw = getWindowsStatsViaPowerShell() || getWindowsStatsViaWmic();
                if (!raw) return { cpu: null, ram: null, temp: null };

                var cpu = null;
                if (raw.CPU !== undefined) {
                    var n = parseFloat(raw.CPU);
                    if (!isNaN(n)) cpu = Math.round(n);
                }

                var ram = null;
                if (raw.FREE !== undefined && raw.TOTAL !== undefined) {
                    var freeKB = parseFloat(raw.FREE), totalKB = parseFloat(raw.TOTAL);
                    if (!isNaN(freeKB) && !isNaN(totalKB) && totalKB > 0) {
                        var usedKB = totalKB - freeKB;
                        ram = {
                            percent: Math.round((usedKB / totalKB) * 100),
                            usedGB: usedKB / 1048576,
                            totalGB: totalKB / 1048576
                        };
                    }
                }

                var temp = null;
                if (raw.TEMP !== undefined) {
                    var t = parseFloat(raw.TEMP);
                    if (!isNaN(t) && t > 0) temp = Math.round((t / 10) - 273.15);
                }

                return { cpu: cpu, ram: ram, temp: temp };
            } else {
                return { cpu: getMacCPULoad(), ram: getMacRAMUsage(), temp: null };
            }
        } catch (e) {
            return { cpu: null, ram: null, temp: null };
        }
    }

    function getGPUTemp() {
        try {
            var out = runSystemCommand("nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits");
            if (!out) return null;
            var n = parseFloat(out);
            return isNaN(n) ? null : Math.round(n);
        } catch (e) {
            return null;
        }
    }

    function playNotifySound() {
        try {
            if (IS_WIN) {
                runSystemCommand('powershell -NoProfile -Command "[console]::beep(880,150)"');
            } else {
                runSystemCommand("afplay /System/Library/Sounds/Glass.aiff");
            }
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // BACKUP CORE
    // ---------------------------------------------------------------
    function getBackupFolder() {
        if (!(app.project && app.project.file)) return null;
        var backupFolder = new Folder(app.project.file.parent.fsName + "/Kreevo_Backups");
        if (!backupFolder.exists) backupFolder.create();
        return backupFolder;
    }

    var statusText = null;
    var lastBackupDate = null;
    function setStatus(msg) { if (statusText) { try { statusText.text = msg; } catch (e) {} } }

    function runBackup(silent) {
        if (!(app.project && app.project.file)) {
            if (!silent) alert("Save your project once with a name before backing up.");
            return false;
        }
        try {
            app.project.save();
            var backupFolder = getBackupFolder();
            if (!backupFolder) return false;
            var baseName = app.project.file.name.replace(/\.aep$/i, "");
            var backupFile = new File(backupFolder.fsName + "/" + baseName + "_" + timestamp().replace(/[:\s]/g, "-") + ".aep");
            app.project.file.copy(backupFile.fsName);
            cleanupOldBackups(backupFolder);
            lastBackupDate = new Date();
            setStatus("Backed up just now");
            appendHistory("Backup saved — " + backupFile.name + " (" + app.project.numItems + " items)");
            return true;
        } catch (err) {
            setStatus("Backup skipped — will retry next cycle");
            appendHistory("Backup failed silently — will retry next cycle");
            return false;
        }
    }

    function cleanupOldBackups(backupFolder) {
        try {
            var files = backupFolder.getFiles(function (f) { return f instanceof File && /\.aep$/i.test(f.name); });
            files.sort(function (a, b) { return a.created - b.created; });
            var excess = files.length - settings.maxBackups;
            for (var i = 0; i < excess; i++) files[i].remove();
        } catch (e) {}
    }

    function listBackups() {
        var backupFolder = getBackupFolder();
        if (!backupFolder) return [];
        var files = backupFolder.getFiles(function (f) { return f instanceof File && /\.aep$/i.test(f.name); });
        files.sort(function (a, b) { return b.created - a.created; });
        return files;
    }

    function restoreBackup(file) {
        var confirmed = confirm("Restore \"" + file.name + "\"?\n\nUnsaved changes in your current project will be lost.");
        if (!confirmed) return;
        try {
            app.open(file);
            appendHistory("Restored backup — " + file.name);
        } catch (err) {
            alert("Couldn't open that backup: " + err.toString());
        }
    }

    function runHealthCheck() {
        if (!app.project) { alert("Open a project first."); return; }
        var missing = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FootageItem && item.footageMissing) missing.push(item.name);
        }
        if (missing.length === 0) {
            alert("No missing footage found. Your project looks ready to render.");
        } else {
            alert("Found " + missing.length + " missing footage item(s):\n\n" + missing.join("\n") +
                  "\n\nRelink these before starting a long render.");
        }
    }

    function relativeTime(date) {
        if (!date) return null;
        var seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + (minutes === 1 ? " min ago" : " min ago");
        var hours = Math.floor(minutes / 60);
        return hours + (hours === 1 ? " hr ago" : " hr ago");
    }

    // ---------------------------------------------------------------
    // PRE-RENDER CHECK
    // ---------------------------------------------------------------
    function checkRenderReadiness(alwaysAlert) {
        var stats = readSystemStats();
        var reasons = [];
        if (stats.cpu !== null && stats.cpu >= 85) reasons.push("CPU is at " + stats.cpu + "% — already maxed out.");
        if (stats.ram !== null && stats.ram.percent >= 85) reasons.push("RAM is at " + stats.ram.percent + "% — very little headroom left.");

        if (reasons.length > 0) {
            alert("This may not be a great time to start a long render:\n\n" + reasons.join("\n") +
                  "\n\nAfter Effects may run slower or become unresponsive.");
            appendHistory("Pre-render warning shown — " + reasons.join(" / "));
        } else if (alwaysAlert) {
            alert("System load looks fine. Good time to render.");
        }
    }

    // ---------------------------------------------------------------
    // SCHEDULED TASKS — assigned to $.global so app.scheduleTask's
    // by-name lookup finds them whether this runs as a dockable panel
    // or a one-off script.
    // ---------------------------------------------------------------
    var backupTaskId = null;
    function scheduleNextBackup() {
        if (backupTaskId !== null) { try { app.cancelTask(backupTaskId); } catch (e) {} backupTaskId = null; }
        if (!settings.enabled) return;
        var delayMs = Math.max(1, settings.intervalMinutes) * 60 * 1000;
        try { backupTaskId = app.scheduleTask("$.global.crashGuardBackupTick()", delayMs, false); } catch (e) {}
    }
    $.global.crashGuardBackupTick = function () {
        if (!settings.enabled) return;
        var ok = runBackup(true);
        if (ok) playNotifySound();
        scheduleNextBackup();
    };

    var monitorTaskId = null;
    var wasRendering = false;
    var wasHighLoad = false;
    function scheduleNextMonitorTick() {
        // 8s balances a responsive readout against the overhead of
        // launching PowerShell on Windows for each stats refresh.
        try { monitorTaskId = app.scheduleTask("$.global.crashGuardMonitorTick()", 8000, false); } catch (e) {}
    }
    $.global.crashGuardMonitorTick = function () {
        updateMonitorUI();
        recordLastKnownState();
        try {
            var isRendering = !!(app.project && app.project.renderQueue && app.project.renderQueue.rendering);
            if (isRendering && !wasRendering) checkRenderReadiness(false);
            wasRendering = isRendering;
        } catch (e) {}
        scheduleNextMonitorTick();
    };

    // ---------------------------------------------------------------
    // UI HELPERS
    // ---------------------------------------------------------------
    function styledText(parent, label, size, weight, color, multiline) {
        var t = parent.add("statictext", undefined, label, multiline ? { multiline: true } : undefined);
        try {
            t.graphics.font = ScriptUI.newFont(FONT, weight, size);
            t.graphics.foregroundColor = t.graphics.newPen(t.graphics.PenType.SOLID_COLOR, color, 1);
        } catch (e) {}
        return t;
    }

    function flatButton(parent, label, onClick, fullWidth) {
        var group = parent.add("group");
        group.orientation = "column";
        group.alignChildren = ["fill", "center"];
        group.minimumSize.height = 46;
        if (fullWidth !== false) group.alignment = ["fill", "top"];

        var isOver = false;
        group.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, isOver ? BRAND.btnHover : BRAND.btn);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };

        var label_ = group.add("statictext", undefined, label);
        label_.alignment = ["center", "center"];
        try {
            label_.graphics.font = ScriptUI.newFont(FONT, "BOLD", 15);
            label_.graphics.foregroundColor = label_.graphics.newPen(label_.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}

        group.addEventListener("mouseover", function () { isOver = true; group.notify("onDraw"); });
        group.addEventListener("mouseout", function () { isOver = false; group.notify("onDraw"); });
        group.addEventListener("mousedown", function () { if (onClick) onClick(); });

        return group;
    }

    function card(parent) {
        var c = parent.add("group");
        c.orientation = "column";
        c.alignChildren = ["fill", "top"];
        c.spacing = 12;
        c.margins = 16;
        try {
            c.graphics.backgroundColor = c.graphics.newBrush(c.graphics.BrushType.SOLID_COLOR, BRAND.card);
        } catch (e) {}
        return c;
    }

    function divider(parent) {
        var d = parent.add("group");
        d.minimumSize.height = 1;
        d.maximumSize.height = 1;
        try {
            d.graphics.backgroundColor = d.graphics.newBrush(d.graphics.BrushType.SOLID_COLOR, BRAND.border);
        } catch (e) {}
        return d;
    }

    // A flat horizontal gauge bar (0-100%). Fill turns coral past 85%
    // so danger reads at a glance, the way the big numbers above it do.
    function gaugeBar(parent) {
        var bar = parent.add("group");
        bar.alignment = ["fill", "top"];
        bar.minimumSize.height = 10;
        bar.maximumSize.height = 10;
        bar._percent = 0;
        bar._danger = false;
        bar.onDraw = function () {
            var g = this.graphics;
            var track = g.newBrush(g.BrushType.SOLID_COLOR, BRAND.btn);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(track);
            var pct = Math.max(0, Math.min(100, this._percent));
            var w = Math.round(this.size[0] * pct / 100);
            if (w > 0) {
                var fillColor = this._danger ? BRAND.accent : BRAND.text;
                var fill = g.newBrush(g.BrushType.SOLID_COLOR, fillColor);
                g.rectPath(0, 0, w, this.size[1]);
                g.fillPath(fill);
            }
        };
        bar.setPercent = function (p, danger) {
            this._percent = (p === null) ? 0 : p;
            this._danger = !!danger;
            this.notify("onDraw");
        };
        return bar;
    }

    // ---------------------------------------------------------------
    // MONITOR UI STATE — filled in by buildUI(), read by the tick above.
    // ---------------------------------------------------------------
    var cpuValueText = null, cpuBar = null;
    var ramValueText = null, ramSubText = null, ramBar = null;
    var tempValueText = null, gpuValueText = null, explanationText = null;
    var backupAgoText = null;

    function updateMonitorUI() {
        try {
            var stats = readSystemStats();
            var cpu = stats.cpu, ram = stats.ram, temp = stats.temp;

            if (cpuValueText) {
                cpuValueText.text = (cpu === null) ? "—" : (cpu + "%");
                try {
                    var cpuColor = (cpu !== null && cpu >= 85) ? BRAND.accent : BRAND.text;
                    cpuValueText.graphics.foregroundColor = cpuValueText.graphics.newPen(cpuValueText.graphics.PenType.SOLID_COLOR, cpuColor, 1);
                } catch (e) {}
            }
            if (cpuBar) cpuBar.setPercent(cpu, cpu !== null && cpu >= 85);

            if (ramValueText) {
                ramValueText.text = (ram === null) ? "—" : (ram.percent + "%");
                try {
                    var ramColor = (ram !== null && ram.percent >= 85) ? BRAND.accent : BRAND.text;
                    ramValueText.graphics.foregroundColor = ramValueText.graphics.newPen(ramValueText.graphics.PenType.SOLID_COLOR, ramColor, 1);
                } catch (e) {}
            }
            if (ramBar) ramBar.setPercent(ram === null ? null : ram.percent, ram !== null && ram.percent >= 85);
            if (ramSubText) ramSubText.text = (ram === null) ? "" : (ram.usedGB.toFixed(1) + " / " + ram.totalGB.toFixed(1) + " GB");

            if (tempValueText) tempValueText.text = (temp === null) ? "Not available on this system" : (temp + "°C");

            var gpuTemp = getGPUTemp();
            if (gpuValueText) gpuValueText.text = (gpuTemp === null) ? "Not available on this system" : (gpuTemp + "°C");

            var explanations = [];
            if (cpu !== null && cpu >= 85) explanations.push("CPU is maxed out — expect slower previews and renders right now.");
            if (ram !== null && ram.percent >= 85) explanations.push("RAM usage is very high — this is likely why After Effects is lagging.");
            if (explanationText) explanationText.text = explanations.join("\n");

            var highNow = explanations.length > 0;
            if (highNow && !wasHighLoad) appendHistory("High load detected — " + explanations.join(" / "));
            wasHighLoad = highNow;

            if (backupAgoText) {
                var rel = relativeTime(lastBackupDate);
                backupAgoText.text = rel ? ("Last backup: " + rel) : "No backup yet this session";
            }
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // HISTORY VIEWER — secondary window
    // ---------------------------------------------------------------
    function showHistoryWindow() {
        var w = new Window("palette", "Crash Guard — History", undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "fill"];
        w.spacing = 12;
        w.margins = 18;
        w.preferredSize = [460, 400];
        try { w.graphics.backgroundColor = w.graphics.newBrush(w.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        styledText(w, "BACKUP & ISSUE HISTORY", 14, "BOLD", BRAND.muted);

        var box = w.add("edittext", undefined, readHistoryTail(300), { multiline: true, readonly: true, scrollable: true });
        box.alignment = ["fill", "fill"];
        try {
            box.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13);
            box.graphics.foregroundColor = box.graphics.newPen(box.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
            box.graphics.backgroundColor = box.graphics.newBrush(box.graphics.BrushType.SOLID_COLOR, BRAND.card);
        } catch (e) {}

        flatButton(w, "Close", function () { w.close(); });

        w.center();
        w.show();
    }

    // ---------------------------------------------------------------
    // UI — wrapped so a startup problem shows a readable error instead
    // of a silently half-built panel.
    // ---------------------------------------------------------------
    function buildUI(thisObj) {
        try {
            return buildUIInner(thisObj);
        } catch (err) {
            var win = (thisObj instanceof Panel)
                ? thisObj
                : new Window("palette", "Crash Guard by Kreevo", undefined, { resizeable: true });
            win.orientation = "column";
            win.alignChildren = ["fill", "top"];
            win.margins = 20;
            win.spacing = 10;
            try { win.graphics.backgroundColor = win.graphics.newBrush(win.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e2) {}
            styledText(win, "Crash Guard couldn't start", 16, "BOLD", BRAND.accent);
            var msg = styledText(win, String(err), 13, "REGULAR", BRAND.text, true);
            msg.preferredSize = [360, 100];
            try { win.layout.layout(true); } catch (e3) {}
            return win;
        }
    }

    function buildUIInner(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Crash Guard by Kreevo", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 14;
        win.margins = 18;
        win.preferredSize.width = 420;

        try { win.graphics.backgroundColor = win.graphics.newBrush(win.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        // ---- Header ----
        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["left", "center"];
        header.spacing = 12;

        if (LOGO_FILE) {
            try { header.add("image", undefined, LOGO_FILE); } catch (e) {}
        }

        styledText(header, "CRASH GUARD", 20, "BOLD", BRAND.text);

        var spacer = header.add("group");
        spacer.alignment = ["fill", "fill"];

        var badge = header.add("group");
        badge.orientation = "column";
        badge.alignChildren = ["center", "center"];
        badge.minimumSize = [90, 26];
        badge.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, BRAND.accent);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };
        var badgeText = badge.add("statictext", undefined, "by Kreevo");
        try {
            badgeText.graphics.font = ScriptUI.newFont(FONT, "BOLD", 12);
            badgeText.graphics.foregroundColor = badgeText.graphics.newPen(badgeText.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}

        if (possibleCrashDetected) {
            var crashLines = ["⚠ Last session didn't close cleanly — possible crash or freeze."];
            if (lastKnownStateAtStartup) {
                crashLines.push("You were last working on: " + (lastKnownStateAtStartup.PROJECT || "—") +
                    (lastKnownStateAtStartup.COMP && lastKnownStateAtStartup.COMP !== "—" ? " — comp \"" + lastKnownStateAtStartup.COMP + "\"" : "") +
                    (lastKnownStateAtStartup.TIME ? " (around " + lastKnownStateAtStartup.TIME + ")" : ""));
            }
            crashLines.push("Check RECENT BACKUPS below to restore.");
            var crashBanner = styledText(win, crashLines.join("\n"), 13, "REGULAR", BRAND.accent, true);
            crashBanner.alignment = ["fill", "top"];
            crashBanner.preferredSize = [384, lastKnownStateAtStartup ? 62 : 40];
        }

        divider(win);

        // ---- System Load card ----
        var loadCard = card(win);
        styledText(loadCard, "SYSTEM LOAD — why AE might be lagging", 13, "BOLD", BRAND.muted);

        var statsRow = loadCard.add("group");
        statsRow.orientation = "row";
        statsRow.alignChildren = ["fill", "top"];
        statsRow.spacing = 24;

        var cpuCol = statsRow.add("group");
        cpuCol.orientation = "column";
        cpuCol.alignChildren = ["fill", "top"];
        cpuCol.alignment = ["fill", "top"];
        styledText(cpuCol, "CPU", 12, "BOLD", BRAND.muted);
        cpuValueText = styledText(cpuCol, "—", 40, "BOLD", BRAND.text);
        cpuBar = gaugeBar(cpuCol);

        var ramCol = statsRow.add("group");
        ramCol.orientation = "column";
        ramCol.alignChildren = ["fill", "top"];
        ramCol.alignment = ["fill", "top"];
        styledText(ramCol, "RAM", 12, "BOLD", BRAND.muted);
        ramValueText = styledText(ramCol, "—", 40, "BOLD", BRAND.text);
        ramBar = gaugeBar(ramCol);
        ramSubText = styledText(ramCol, "", 12, "REGULAR", BRAND.muted);

        var tempRow = loadCard.add("group");
        tempRow.orientation = "row";
        tempRow.alignChildren = ["fill", "top"];
        tempRow.spacing = 24;

        var tempCol = tempRow.add("group");
        tempCol.orientation = "column";
        tempCol.alignChildren = ["left", "top"];
        tempCol.alignment = ["fill", "top"];
        styledText(tempCol, "CPU TEMP", 12, "BOLD", BRAND.muted);
        tempValueText = styledText(tempCol, "Checking…", 13, "ITALIC", BRAND.muted, true);
        tempValueText.preferredSize = [180, 34];

        var gpuCol = tempRow.add("group");
        gpuCol.orientation = "column";
        gpuCol.alignChildren = ["left", "top"];
        gpuCol.alignment = ["fill", "top"];
        styledText(gpuCol, "GPU TEMP", 12, "BOLD", BRAND.muted);
        gpuValueText = styledText(gpuCol, "Checking…", 13, "ITALIC", BRAND.muted, true);
        gpuValueText.preferredSize = [180, 34];

        explanationText = loadCard.add("statictext", undefined, "", { multiline: true });
        explanationText.alignment = ["fill", "top"];
        explanationText.preferredSize = [380, 36];
        try {
            explanationText.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13);
            explanationText.graphics.foregroundColor = explanationText.graphics.newPen(explanationText.graphics.PenType.SOLID_COLOR, BRAND.accent, 1);
        } catch (e) {}

        flatButton(loadCard, "Check before I render", function () { checkRenderReadiness(true); });

        // ---- Auto-Backup card ----
        var autoCard = card(win);
        styledText(autoCard, "AUTO-BACKUP", 13, "BOLD", BRAND.muted);
        var backupExplain = styledText(autoCard,
            "Saves a timestamped copy of your project into a \"Kreevo_Backups\" folder next to it — so if After Effects crashes, freezes, or you lose work, you can restore an earlier version below.",
            12, "REGULAR", BRAND.muted, true);
        backupExplain.preferredSize = [384, 46];

        var enableRow = autoCard.add("group");
        enableRow.orientation = "row";
        enableRow.alignChildren = ["left", "center"];
        var enableCheck = enableRow.add("checkbox", undefined, "  Enabled — protecting your work automatically");
        enableCheck.value = settings.enabled;
        try { enableCheck.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}

        var intervalRow = autoCard.add("group");
        intervalRow.orientation = "row";
        intervalRow.alignChildren = ["left", "center"];
        intervalRow.spacing = 10;
        styledText(intervalRow, "Every", 14, "REGULAR", BRAND.muted);
        var intervalInput = intervalRow.add("edittext", undefined, String(settings.intervalMinutes));
        intervalInput.characters = 4;
        try { intervalInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}
        styledText(intervalRow, "minutes", 14, "REGULAR", BRAND.muted);

        var keepRow = autoCard.add("group");
        keepRow.orientation = "row";
        keepRow.alignChildren = ["left", "center"];
        keepRow.spacing = 10;
        styledText(keepRow, "Keep last", 14, "REGULAR", BRAND.muted);
        var maxBackupsInput = keepRow.add("edittext", undefined, String(settings.maxBackups));
        maxBackupsInput.characters = 4;
        try { maxBackupsInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}
        styledText(keepRow, "backups", 14, "REGULAR", BRAND.muted);

        statusText = styledText(autoCard, settings.enabled ? "Auto-backup on" : "Auto-backup off", 13, "REGULAR", BRAND.muted);
        backupAgoText = styledText(autoCard, "No backup yet this session", 13, "REGULAR", BRAND.muted);

        function applySettingsFromUI() {
            settings.enabled = enableCheck.value;

            var interval = parseInt(intervalInput.text, 10);
            if (isNaN(interval) || interval < 1) interval = 10;
            settings.intervalMinutes = interval;
            intervalInput.text = String(interval);

            var keep = parseInt(maxBackupsInput.text, 10);
            if (isNaN(keep) || keep < 1) keep = 20;
            settings.maxBackups = keep;
            maxBackupsInput.text = String(keep);

            saveSettings(settings);

            if (settings.enabled) {
                setStatus("Auto-backup on — every " + settings.intervalMinutes + " min");
                scheduleNextBackup();
            } else {
                setStatus("Auto-backup off");
                if (backupTaskId !== null) { try { app.cancelTask(backupTaskId); } catch (e) {} backupTaskId = null; }
            }
        }

        enableCheck.onClick = applySettingsFromUI;
        intervalInput.onChange = applySettingsFromUI;
        maxBackupsInput.onChange = applySettingsFromUI;

        // ---- Action buttons ----
        var actions = win.add("group");
        actions.orientation = "column";
        actions.alignChildren = ["fill", "top"];
        actions.spacing = 10;

        flatButton(actions, "Back up now", function () { runBackup(false); });
        flatButton(actions, "Run health check", runHealthCheck);
        flatButton(actions, "View history log", showHistoryWindow);

        divider(win);

        // ---- Restore card ----
        var restoreCard = card(win);
        styledText(restoreCard, "RECENT BACKUPS", 13, "BOLD", BRAND.muted);
        var restoreExplain = styledText(restoreCard, "Pick a version below and restore it if something goes wrong.", 12, "REGULAR", BRAND.muted, true);
        restoreExplain.preferredSize = [384, 20];

        var backupDropdown = restoreCard.add("dropdownlist", undefined, []);
        backupDropdown.alignment = ["fill", "top"];
        try { backupDropdown.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}

        function refreshBackupList() {
            backupDropdown.removeAll();
            var files = listBackups();
            for (var i = 0; i < files.length; i++) backupDropdown.add("item", files[i].name);
            backupDropdown._files = files;
            if (files.length > 0) {
                backupDropdown.selection = 0;
                if (!lastBackupDate) lastBackupDate = files[0].created;
            }
        }
        refreshBackupList();

        var restoreActions = restoreCard.add("group");
        restoreActions.orientation = "column";
        restoreActions.alignChildren = ["fill", "top"];
        restoreActions.spacing = 10;

        flatButton(restoreActions, "Restore selected", function () {
            var idx = backupDropdown.selection ? backupDropdown.selection.index : -1;
            if (idx < 0 || !backupDropdown._files || !backupDropdown._files[idx]) {
                alert("Select a backup from the list first.");
                return;
            }
            restoreBackup(backupDropdown._files[idx]);
        });
        flatButton(restoreActions, "Refresh list", refreshBackupList);

        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () { this.layout.resize(); };

        win.onClose = function () {
            if (monitorTaskId !== null) { try { app.cancelTask(monitorTaskId); } catch (e) {} }
            clearSessionMarker();
        };

        if (settings.enabled) scheduleNextBackup();
        recordLastKnownState();
        updateMonitorUI();
        scheduleNextMonitorTick();

        return win;
    }

    var panel = buildUI(thisObj);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
