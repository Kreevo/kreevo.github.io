// Crash Guard by Kreevo
// ScriptUI dockable panel for After Effects — versioned auto-backup,
// live system load monitor, pre-render health check, project cleaner.
// v1.0 — tabbed layout rebuild

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
    var LAST_STATE_FILE = new File(BASE_DIR + "/last_state.txt");
    // Separate, single-purpose PowerShell scripts — one metric per file.
    // A single combined multi-line script proved unreliable: only its
    // first output line consistently made it back through callSystem
    // (CPU showed up, RAM/temp never did). Splitting removes that risk.
    var CPU_PS1_FILE = new File(BASE_DIR + "/cg_cpu.ps1");
    var RAM_PS1_FILE = new File(BASE_DIR + "/cg_ram.ps1");
    var TEMP_PS1_FILE = new File(BASE_DIR + "/cg_temp.ps1");

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
    // draws pixels 1:1. Decoded once into a small cache file (ScriptUI
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

    function firstNumber(s) {
        if (!s) return null;
        var m = s.match(/-?\d+(\.\d+)?/);
        if (!m) return null;
        var n = parseFloat(m[0]);
        return isNaN(n) ? null : n;
    }

    function writeScriptOnce(file, content) {
        try {
            if (file.exists) return true;
            ensureBaseDir();
            file.open("w");
            file.write(content);
            file.close();
            return file.exists;
        } catch (e) {
            return false;
        }
    }

    function runPS1(file, content) {
        if (!writeScriptOnce(file, content)) return null;
        var cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + file.fsName + '"';
        return runSystemCommand(cmd);
    }

    function getWindowsCPU() {
        var out = runPS1(CPU_PS1_FILE, "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average\r\n");
        var n = firstNumber(out);
        if (n !== null) return Math.round(n);
        // Fallback for machines where PowerShell is restricted; wmic is
        // deprecated on newest Windows builds, so this is second choice.
        var wmicOut = runSystemCommand("wmic cpu get loadpercentage");
        n = firstNumber(wmicOut);
        return n === null ? null : Math.round(n);
    }

    function getWindowsRAM() {
        var out = runPS1(RAM_PS1_FILE,
            "$os = Get-CimInstance Win32_OperatingSystem\r\nWrite-Output $os.FreePhysicalMemory\r\nWrite-Output $os.TotalVisibleMemorySize\r\n");
        var freeKB = null, totalKB = null;
        if (out) {
            var lines = out.split(/\r?\n/);
            var nums = [];
            for (var i = 0; i < lines.length; i++) {
                var n = firstNumber(lines[i]);
                if (n !== null) nums.push(n);
            }
            if (nums.length >= 2) { freeKB = nums[0]; totalKB = nums[1]; }
        }
        if (freeKB === null || totalKB === null) {
            var wmicOut = runSystemCommand("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value");
            if (wmicOut) {
                var fm = wmicOut.match(/FreePhysicalMemory=(\d+)/);
                var tm = wmicOut.match(/TotalVisibleMemorySize=(\d+)/);
                if (fm) freeKB = parseFloat(fm[1]);
                if (tm) totalKB = parseFloat(tm[1]);
            }
        }
        if (freeKB === null || totalKB === null || totalKB <= 0) return null;
        var usedKB = totalKB - freeKB;
        return {
            percent: Math.round((usedKB / totalKB) * 100),
            usedGB: usedKB / 1048576,
            totalGB: totalKB / 1048576
        };
    }

    function getWindowsTemp() {
        var script = "$ErrorActionPreference = 'SilentlyContinue'\r\n" +
            "(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1 -ExpandProperty CurrentTemperature)\r\n";
        var out = runPS1(TEMP_PS1_FILE, script);
        var n = firstNumber(out);
        if (n === null || n <= 0) return null;
        return Math.round((n / 10) - 273.15);
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
                return { cpu: getWindowsCPU(), ram: getWindowsRAM(), temp: getWindowsTemp() };
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
            var n = firstNumber(out);
            return n === null ? null : Math.round(n);
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

    var statusChip = null;
    var lastBackupDate = null;
    function setStatus(msg) { if (statusChip) { try { statusChip.setText(msg); } catch (e) {} } }

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
            setStatus("Backup skipped — retrying next cycle");
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
        if (minutes < 60) return minutes + " min ago";
        var hours = Math.floor(minutes / 60);
        return hours + " hr ago";
    }

    // ---------------------------------------------------------------
    // PROJECT CLEANER — the housekeeping tasks every editor ends up
    // doing by hand: drop footage nothing references, merge duplicate
    // imports, and free the RAM/disk caches AE builds up over a session.
    // ---------------------------------------------------------------
    function cleanerRemoveUnused() {
        if (!app.project) { alert("Open a project first."); return; }
        try {
            var before = app.project.numItems;
            app.project.removeUnusedFootage();
            var removed = before - app.project.numItems;
            alert(removed > 0 ? ("Removed " + removed + " unused item(s) from the project.") : "Nothing to remove — no unused footage found.");
            appendHistory("Cleaner: removed " + removed + " unused footage item(s).");
        } catch (e) {
            alert("Couldn't remove unused footage: " + e.toString());
        }
    }

    function cleanerConsolidate() {
        if (!app.project) { alert("Open a project first."); return; }
        try {
            var before = app.project.numItems;
            app.project.consolidateFootage();
            var merged = before - app.project.numItems;
            alert(merged > 0 ? ("Consolidated " + merged + " duplicate footage item(s).") : "No duplicate footage found.");
            appendHistory("Cleaner: consolidated " + merged + " duplicate footage item(s).");
        } catch (e) {
            alert("Couldn't consolidate footage: " + e.toString());
        }
    }

    function cleanerPurge() {
        try {
            app.purge(PurgeTarget.ALL_CACHES);
            alert("Memory and disk caches purged — this can free up RAM right away.");
            appendHistory("Cleaner: purged all caches.");
        } catch (e) {
            alert("Couldn't purge caches: " + e.toString());
        }
    }

    // ---------------------------------------------------------------
    // PRE-RENDER CHECK
    // ---------------------------------------------------------------
    function checkRenderReadiness(alwaysAlert) {
        var stats = readSystemStats();
        var reasons = [];
        if (stats.cpu !== null && stats.cpu >= 85) reasons.push("CPU is at " + stats.cpu + "% — already maxed out.");
        if (stats.ram !== null && stats.ram.percent >= 85) reasons.push("RAM is at " + stats.ram.percent + "% — very little headroom left.");
        if (stats.temp !== null && stats.temp >= 85) reasons.push("CPU temperature is at " + stats.temp + "°C — running hot.");

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
        group.minimumSize.height = 40;
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
            label_.graphics.font = ScriptUI.newFont(FONT, "BOLD", 14);
            label_.graphics.foregroundColor = label_.graphics.newPen(label_.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}

        group.addEventListener("mouseover", function () { isOver = true; group.notify("onDraw"); });
        group.addEventListener("mouseout", function () { isOver = false; group.notify("onDraw"); });
        group.addEventListener("mousedown", function () { if (onClick) onClick(); });

        return group;
    }

    // A tab: flat, switches to an accent fill when active.
    function tabButton(parent, label, onClick) {
        var group = parent.add("group");
        group.orientation = "column";
        group.alignChildren = ["fill", "center"];
        group.alignment = ["fill", "top"];
        group.minimumSize.height = 34;
        group._active = false;
        group.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, this._active ? BRAND.accent : BRAND.card);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };
        var label_ = group.add("statictext", undefined, label);
        label_.alignment = ["center", "center"];
        try {
            label_.graphics.font = ScriptUI.newFont(FONT, "BOLD", 12);
            label_.graphics.foregroundColor = label_.graphics.newPen(label_.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}
        group.addEventListener("mousedown", function () { if (onClick) onClick(); });
        group.setActive = function (a) { this._active = a; this.notify("onDraw"); };
        return group;
    }

    function card(parent) {
        var c = parent.add("group");
        c.orientation = "column";
        c.alignChildren = ["fill", "top"];
        c.spacing = 8;
        c.margins = 12;
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

    // Small pill-style status readout — a colored background behind
    // short text, instead of plain text floating in empty space.
    function chip(parent, initialText) {
        var c = parent.add("group");
        c.orientation = "row";
        c.alignChildren = ["center", "center"];
        c.alignment = ["left", "top"];
        c.margins = [10, 5, 10, 5];
        c.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, BRAND.btn);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };
        var t = c.add("statictext", undefined, initialText);
        try {
            t.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 12);
            t.graphics.foregroundColor = t.graphics.newPen(t.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}
        c.setText = function (txt) { t.text = txt; try { this.notify("onDraw"); } catch (e2) {} };
        return c;
    }

    // A flat horizontal gauge bar (0-100%). Fill turns coral past 85%
    // so danger reads at a glance, the way the big numbers above it do.
    function gaugeBar(parent) {
        var bar = parent.add("group");
        bar.alignment = ["fill", "top"];
        bar.minimumSize.height = 8;
        bar.maximumSize.height = 8;
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
    var backupAgoChip = null;

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
            if (ram !== null && ram.percent >= 85) explanations.push("RAM usage is very high — this is likely why After Effects is lagging. Try Purge Caches in the CLEANER tab.");
            if (temp !== null && temp >= 85) explanations.push("CPU is running hot (" + temp + "°C) — check that vents/fans aren't blocked.");
            if (gpuTemp !== null && gpuTemp >= 85) explanations.push("GPU is running hot (" + gpuTemp + "°C) — check cooling before a long render.");
            if (explanationText) explanationText.text = explanations.join("\n");

            var highNow = explanations.length > 0;
            if (highNow && !wasHighLoad) appendHistory("High load detected — " + explanations.join(" / "));
            wasHighLoad = highNow;

            if (backupAgoChip) {
                var rel = relativeTime(lastBackupDate);
                backupAgoChip.setText(rel ? ("Last backup: " + rel) : "No backup yet this session");
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
        w.spacing = 10;
        w.margins = 16;
        w.preferredSize = [440, 380];
        try { w.graphics.backgroundColor = w.graphics.newBrush(w.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        styledText(w, "BACKUP & ISSUE HISTORY", 13, "BOLD", BRAND.muted);

        var box = w.add("edittext", undefined, readHistoryTail(300), { multiline: true, readonly: true, scrollable: true });
        box.alignment = ["fill", "fill"];
        try {
            box.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 12);
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
            styledText(win, "Crash Guard couldn't start", 15, "BOLD", BRAND.accent);
            var msg = styledText(win, String(err), 12, "REGULAR", BRAND.text, true);
            msg.preferredSize = [340, 100];
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
        win.spacing = 8;
        win.margins = 14;
        win.preferredSize.width = 360;

        try { win.graphics.backgroundColor = win.graphics.newBrush(win.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        // ---- Header ----
        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["left", "center"];
        header.spacing = 10;

        if (LOGO_FILE) {
            try { header.add("image", undefined, LOGO_FILE); } catch (e) {}
        }

        styledText(header, "CRASH GUARD", 16, "BOLD", BRAND.text);

        var spacer = header.add("group");
        spacer.alignment = ["fill", "fill"];

        var badge = header.add("group");
        badge.orientation = "column";
        badge.alignChildren = ["center", "center"];
        badge.minimumSize = [74, 20];
        badge.onDraw = function () {
            var g = this.graphics;
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, BRAND.accent);
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(fill);
        };
        var badgeText = badge.add("statictext", undefined, "by Kreevo");
        try {
            badgeText.graphics.font = ScriptUI.newFont(FONT, "BOLD", 10);
            badgeText.graphics.foregroundColor = badgeText.graphics.newPen(badgeText.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
        } catch (e) {}

        if (possibleCrashDetected) {
            var crashLines = ["⚠ Last session didn't close cleanly — possible crash or freeze."];
            if (lastKnownStateAtStartup) {
                crashLines.push("Last working on: " + (lastKnownStateAtStartup.PROJECT || "—") +
                    (lastKnownStateAtStartup.COMP && lastKnownStateAtStartup.COMP !== "—" ? " — \"" + lastKnownStateAtStartup.COMP + "\"" : "") +
                    (lastKnownStateAtStartup.TIME ? " (" + lastKnownStateAtStartup.TIME + ")" : ""));
            }
            crashLines.push("See BACKUP tab to restore.");
            var crashBanner = styledText(win, crashLines.join("\n"), 12, "REGULAR", BRAND.accent, true);
            crashBanner.alignment = ["fill", "top"];
            crashBanner.preferredSize = [330, lastKnownStateAtStartup ? 52 : 34];
        }

        // ---- Tab bar ----
        var tabRow = win.add("group");
        tabRow.orientation = "row";
        tabRow.alignChildren = ["fill", "fill"];
        tabRow.spacing = 3;

        var monitorPage, backupPage, cleanerPage;
        function setActiveTab(name) {
            monitorTab.setActive(name === "monitor");
            backupTab.setActive(name === "backup");
            cleanerTab.setActive(name === "cleaner");
            monitorPage.visible = (name === "monitor");
            backupPage.visible = (name === "backup");
            cleanerPage.visible = (name === "cleaner");
            try { win.layout.layout(true); win.layout.resize(); } catch (e) {}
        }
        var monitorTab = tabButton(tabRow, "MONITOR", function () { setActiveTab("monitor"); });
        var backupTab = tabButton(tabRow, "BACKUP", function () { setActiveTab("backup"); });
        var cleanerTab = tabButton(tabRow, "CLEANER", function () { setActiveTab("cleaner"); });

        // ================= MONITOR PAGE =================
        monitorPage = win.add("group");
        monitorPage.orientation = "column";
        monitorPage.alignChildren = ["fill", "top"];
        monitorPage.spacing = 8;

        var loadCard = card(monitorPage);
        styledText(loadCard, "WHY AE MIGHT BE LAGGING", 12, "BOLD", BRAND.muted);

        var statsRow = loadCard.add("group");
        statsRow.orientation = "row";
        statsRow.alignChildren = ["fill", "top"];
        statsRow.spacing = 16;

        var cpuCol = statsRow.add("group");
        cpuCol.orientation = "column";
        cpuCol.alignChildren = ["fill", "top"];
        cpuCol.alignment = ["fill", "top"];
        cpuCol.spacing = 4;
        styledText(cpuCol, "CPU", 11, "BOLD", BRAND.muted);
        cpuValueText = styledText(cpuCol, "—", 30, "BOLD", BRAND.text);
        cpuBar = gaugeBar(cpuCol);

        var ramCol = statsRow.add("group");
        ramCol.orientation = "column";
        ramCol.alignChildren = ["fill", "top"];
        ramCol.alignment = ["fill", "top"];
        ramCol.spacing = 4;
        styledText(ramCol, "RAM", 11, "BOLD", BRAND.muted);
        ramValueText = styledText(ramCol, "—", 30, "BOLD", BRAND.text);
        ramBar = gaugeBar(ramCol);
        ramSubText = styledText(ramCol, "", 11, "REGULAR", BRAND.muted);

        var tempRow = loadCard.add("group");
        tempRow.orientation = "row";
        tempRow.alignChildren = ["fill", "top"];
        tempRow.spacing = 16;

        var tempCol = tempRow.add("group");
        tempCol.orientation = "column";
        tempCol.alignChildren = ["left", "top"];
        tempCol.alignment = ["fill", "top"];
        styledText(tempCol, "CPU TEMP", 11, "BOLD", BRAND.muted);
        tempValueText = styledText(tempCol, "Checking…", 12, "ITALIC", BRAND.muted, true);
        tempValueText.preferredSize = [150, 30];

        var gpuCol = tempRow.add("group");
        gpuCol.orientation = "column";
        gpuCol.alignChildren = ["left", "top"];
        gpuCol.alignment = ["fill", "top"];
        styledText(gpuCol, "GPU TEMP", 11, "BOLD", BRAND.muted);
        gpuValueText = styledText(gpuCol, "Checking…", 12, "ITALIC", BRAND.muted, true);
        gpuValueText.preferredSize = [150, 30];

        explanationText = loadCard.add("statictext", undefined, "", { multiline: true });
        explanationText.alignment = ["fill", "top"];
        explanationText.preferredSize = [330, 44];
        try {
            explanationText.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 12);
            explanationText.graphics.foregroundColor = explanationText.graphics.newPen(explanationText.graphics.PenType.SOLID_COLOR, BRAND.accent, 1);
        } catch (e) {}

        flatButton(monitorPage, "Check before I render", function () { checkRenderReadiness(true); });

        // ================= BACKUP PAGE =================
        backupPage = win.add("group");
        backupPage.orientation = "column";
        backupPage.alignChildren = ["fill", "top"];
        backupPage.spacing = 8;

        var autoCard = card(backupPage);
        styledText(autoCard, "AUTO-BACKUP", 12, "BOLD", BRAND.muted);
        var backupExplain = styledText(autoCard,
            "Saves a timestamped copy into \"Kreevo_Backups\" next to your project — restore any version below if AE crashes or you lose work.",
            11, "REGULAR", BRAND.muted, true);
        backupExplain.preferredSize = [330, 32];

        var enableRow = autoCard.add("group");
        enableRow.orientation = "row";
        enableRow.alignChildren = ["left", "center"];
        var enableCheck = enableRow.add("checkbox", undefined, "  Enabled — protecting your work");
        enableCheck.value = settings.enabled;
        try { enableCheck.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}

        var intervalRow = autoCard.add("group");
        intervalRow.orientation = "row";
        intervalRow.alignChildren = ["left", "center"];
        intervalRow.spacing = 8;
        styledText(intervalRow, "Every", 13, "REGULAR", BRAND.muted);
        var intervalInput = intervalRow.add("edittext", undefined, String(settings.intervalMinutes));
        intervalInput.characters = 4;
        try { intervalInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}
        styledText(intervalRow, "min", 13, "REGULAR", BRAND.muted);
        styledText(intervalRow, "   Keep last", 13, "REGULAR", BRAND.muted);
        var maxBackupsInput = intervalRow.add("edittext", undefined, String(settings.maxBackups));
        maxBackupsInput.characters = 4;
        try { maxBackupsInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}

        var chipRow = autoCard.add("group");
        chipRow.orientation = "row";
        chipRow.alignChildren = ["left", "center"];
        chipRow.spacing = 6;
        statusChip = chip(chipRow, settings.enabled ? "Auto-backup on" : "Auto-backup off");
        backupAgoChip = chip(chipRow, "No backup yet this session");

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

        var actions = backupPage.add("group");
        actions.orientation = "column";
        actions.alignChildren = ["fill", "top"];
        actions.spacing = 6;

        flatButton(actions, "Back up now", function () { runBackup(false); });
        flatButton(actions, "Run health check", runHealthCheck);
        flatButton(actions, "View history log", showHistoryWindow);

        var restoreCard = card(backupPage);
        styledText(restoreCard, "RECENT BACKUPS", 12, "BOLD", BRAND.muted);
        var restoreExplain = styledText(restoreCard, "Pick a version and restore it if something goes wrong.", 11, "REGULAR", BRAND.muted, true);
        restoreExplain.preferredSize = [330, 16];

        var backupDropdown = restoreCard.add("dropdownlist", undefined, []);
        backupDropdown.alignment = ["fill", "top"];
        try { backupDropdown.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13); } catch (e) {}

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
        restoreActions.spacing = 6;

        flatButton(restoreActions, "Restore selected", function () {
            var idx = backupDropdown.selection ? backupDropdown.selection.index : -1;
            if (idx < 0 || !backupDropdown._files || !backupDropdown._files[idx]) {
                alert("Select a backup from the list first.");
                return;
            }
            restoreBackup(backupDropdown._files[idx]);
        });
        flatButton(restoreActions, "Refresh list", refreshBackupList);

        // ================= CLEANER PAGE =================
        cleanerPage = win.add("group");
        cleanerPage.orientation = "column";
        cleanerPage.alignChildren = ["fill", "top"];
        cleanerPage.spacing = 8;

        var cleanCard = card(cleanerPage);
        styledText(cleanCard, "PROJECT CLEANER", 12, "BOLD", BRAND.muted);
        var cleanExplain = styledText(cleanCard,
            "Housekeeping that keeps every project running smoothly — do this every so often, not just when something breaks.",
            11, "REGULAR", BRAND.muted, true);
        cleanExplain.preferredSize = [330, 30];

        flatButton(cleanCard, "Remove unused footage", cleanerRemoveUnused);
        var removeExplain = styledText(cleanCard, "Deletes project items nothing in your comps actually uses.", 11, "REGULAR", BRAND.muted, true);
        removeExplain.preferredSize = [330, 16];

        flatButton(cleanCard, "Consolidate duplicate footage", cleanerConsolidate);
        var consolidateExplain = styledText(cleanCard, "Merges footage imported more than once into a single item.", 11, "REGULAR", BRAND.muted, true);
        consolidateExplain.preferredSize = [330, 16];

        flatButton(cleanCard, "Purge memory and disk caches", cleanerPurge);
        var purgeExplain = styledText(cleanCard, "Frees up RAM immediately — use this when the SYSTEM LOAD tab shows RAM running high.", 11, "REGULAR", BRAND.muted, true);
        purgeExplain.preferredSize = [330, 30];

        // ---- wire up ----
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () { this.layout.resize(); };

        win.onClose = function () {
            if (monitorTaskId !== null) { try { app.cancelTask(monitorTaskId); } catch (e) {} }
            clearSessionMarker();
        };

        setActiveTab("monitor");

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
