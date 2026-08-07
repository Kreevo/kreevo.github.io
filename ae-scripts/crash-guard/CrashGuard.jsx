// Crash Guard by Kreevo
// ScriptUI dockable panel for After Effects — versioned auto-backup,
// live system load monitor, pre-render health check, project cleaner.
// v1.1 — native-controls rebuild (custom-drawn buttons/tabs were not
// rendering reliably; this build uses ScriptUI's built-in controls,
// which are OS-drawn and always visible, at the cost of some styling).
// Palette matches kreevo.github.io's actual brand system (near-black
// surfaces, single green accent) rather than an invented one.

(function (thisObj) {

    // ---------------------------------------------------------------
    // BRAND — matches kreevo.github.io: near-black surfaces, white
    // text, and a single accent color (#4ade80) used across the real
    // site for positive/brand touches. The site has no warning color
    // of its own (green can't mean both "good" and "CPU is on fire"),
    // so BRAND.warn is a separate color used only for load/heat alerts.
    // ---------------------------------------------------------------
    var BRAND = {
        bg:       [0x14 / 255, 0x14 / 255, 0x14 / 255],
        card:     [0x1E / 255, 0x1E / 255, 0x1E / 255],
        accent:   [0x4A / 255, 0xDE / 255, 0x80 / 255],
        warn:     [0xF8 / 255, 0x71 / 255, 0x71 / 255],
        text:     [0xFF / 255, 0xFF / 255, 0xFF / 255],
        muted:    [0x9E / 255, 0x9E / 255, 0x9E / 255]
    };

    function getBestFont() {
        return ($.os.indexOf("Windows") !== -1) ? "Segoe UI" : "Helvetica Neue";
    }
    var FONT = getBestFont();
    var IS_WIN = ($.os.indexOf("Windows") !== -1);
    // Full path, not just "powershell" — AE's system.callSystem may run
    // with a reduced PATH that can't resolve the bare command name.
    var POWERSHELL_EXE = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

    // ---------------------------------------------------------------
    // PATHS
    // ---------------------------------------------------------------
    var BASE_DIR = Folder.userData.fsName + "/Kreevo/CrashGuard";
    var SETTINGS_FILE = new File(BASE_DIR + "/settings.txt");
    var HISTORY_FILE = new File(BASE_DIR + "/history.log");
    var SESSION_MARKER = new File(BASE_DIR + "/session.lock");
    var LAST_STATE_FILE = new File(BASE_DIR + "/last_state.txt");
    var CPU_RAM_PS1_FILE = new File(BASE_DIR + "/cg_cpu_ram.ps1");
    var TEMP_PS1_FILE = new File(BASE_DIR + "/cg_temp.ps1");

    function ensureBaseDir() {
        try {
            var f = new Folder(BASE_DIR);
            if (!f.exists) f.create();
        } catch (e) {}
    }

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
        // A stray or hand-edited settings file could contain a value below
        // the UI's own minimum (e.g. maxBackups=0), which would make
        // cleanupOldBackups delete every backup immediately after it's
        // created. Clamp on load too, not just when the UI writes it.
        if (result.maxBackups < 1) result.maxBackups = SETTINGS_DEFAULTS.maxBackups;
        if (result.intervalMinutes < 1) result.intervalMinutes = SETTINGS_DEFAULTS.intervalMinutes;
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
    // LAST KNOWN STATE
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
    // CRASH DETECTION
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
    // SYSTEM LOAD
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
        var cmd = '"' + POWERSHELL_EXE + '" -NoProfile -ExecutionPolicy Bypass -File "' + file.fsName + '"';
        return runSystemCommand(cmd);
    }

    // CPU + RAM, tried the fastest way first. Every process launch is a
    // blocking call that freezes the whole AE UI until it returns — wmic
    // is a small native executable that starts almost instantly, while
    // powershell.exe has to load the .NET runtime and host first, which
    // can take seconds. wmic needs two calls instead of PowerShell's one,
    // but two fast launches still beat one slow one; PowerShell is kept
    // only as a fallback for Windows builds where wmic was removed.
    function getWindowsCPURAM() {
        var cpuOut = runSystemCommand("wmic cpu get loadpercentage");
        // A multi-socket machine reports one LoadPercentage line per
        // physical CPU — average them all rather than just the first.
        var cpu = null;
        if (cpuOut) {
            var cpuNums = [];
            var cpuLines = cpuOut.split(/\r?\n/);
            for (var ci = 0; ci < cpuLines.length; ci++) {
                var cn = firstNumber(cpuLines[ci]);
                if (cn !== null) cpuNums.push(cn);
            }
            if (cpuNums.length > 0) {
                var sum = 0;
                for (var cj = 0; cj < cpuNums.length; cj++) sum += cpuNums[cj];
                cpu = sum / cpuNums.length;
            }
        }
        var memOut = runSystemCommand("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value");
        var freeKB = null, totalKB = null;
        if (memOut) {
            var fm = memOut.match(/FreePhysicalMemory=(\d+)/);
            var tm = memOut.match(/TotalVisibleMemorySize=(\d+)/);
            if (fm) freeKB = parseFloat(fm[1]);
            if (tm) totalKB = parseFloat(tm[1]);
        }
        if (cpu !== null && freeKB !== null && totalKB !== null) {
            return { cpu: cpu, freeKB: freeKB, totalKB: totalKB };
        }

        var script = "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average\r\n" +
            "$os = Get-CimInstance Win32_OperatingSystem\r\n" +
            "$os.FreePhysicalMemory\r\n" +
            "$os.TotalVisibleMemorySize\r\n";
        var out = runPS1(CPU_RAM_PS1_FILE, script);
        if (!out) return null;
        var nums = [];
        var lines = out.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var n = firstNumber(lines[i]);
            if (n !== null) nums.push(n);
        }
        if (nums.length < 3) return null;
        return { cpu: nums[0], freeKB: nums[1], totalKB: nums[2] };
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

    // CPU + RAM only — called every tick, so kept to a single blocking
    // process launch on Windows whenever possible. Temperature/GPU are
    // fetched separately and less often (see crashGuardMonitorTick).
    function readCoreStats() {
        try {
            if (IS_WIN) {
                var combined = getWindowsCPURAM();
                if (combined && combined.totalKB > 0) {
                    var usedKB = combined.totalKB - combined.freeKB;
                    return {
                        cpu: Math.round(combined.cpu),
                        ram: {
                            percent: Math.round((usedKB / combined.totalKB) * 100),
                            usedGB: usedKB / 1048576,
                            totalGB: combined.totalKB / 1048576
                        }
                    };
                }
                // Both wmic and PowerShell failed inside getWindowsCPURAM —
                // give up rather than launching yet more blocking processes.
                return { cpu: null, ram: null };
            } else {
                return { cpu: getMacCPULoad(), ram: getMacRAMUsage() };
            }
        } catch (e) {
            return { cpu: null, ram: null };
        }
    }

    // Kept for the manual "Check before I render" button, where one
    // extra blocking call in response to a click is an acceptable cost.
    function readSystemStats() {
        var core = readCoreStats();
        var temp = IS_WIN ? getWindowsTemp() : null;
        return { cpu: core.cpu, ram: core.ram, temp: temp };
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
                runSystemCommand('"' + POWERSHELL_EXE + '" -NoProfile -Command "[console]::beep(880,150)"');
            } else {
                runSystemCommand("afplay /System/Library/Sounds/Glass.aiff");
            }
        } catch (e) {}
    }

    // Ten-block text gauge — pure text, no custom drawing, always visible.
    function textBar(percent) {
        if (percent === null) return "──────────";
        var filled = Math.round(Math.max(0, Math.min(100, percent)) / 10);
        var bar = "";
        for (var i = 0; i < 10; i++) bar += (i < filled) ? "▓" : "░";
        return bar;
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
    // PROJECT CLEANER
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
    // SCHEDULED TASKS
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
    var lastTemp = null, lastGpuTemp = null;
    function scheduleNextMonitorTick() {
        // Every system.callSystem launch blocks the AE UI thread until the
        // process returns, so this interval is deliberately generous —
        // frequent polling was making the whole app feel like it was
        // hanging every few seconds.
        try { monitorTaskId = app.scheduleTask("$.global.crashGuardMonitorTick()", 20000, false); } catch (e) {}
    }
    $.global.crashGuardMonitorTick = function () {
        // Temperature is intentionally NOT auto-refreshed here: the WMI
        // thermal-zone query it depends on can be slow or even hang on
        // some systems, which would turn a background tick into a long,
        // unpredictable freeze. Temp/GPU only refresh when the user asks
        // for them (Refresh temps button, or Check before I render).
        updateMonitorUI(lastTemp, lastGpuTemp);
        recordLastKnownState();
        try {
            var isRendering = !!(app.project && app.project.renderQueue && app.project.renderQueue.rendering);
            if (isRendering && !wasRendering) checkRenderReadiness(false);
            wasRendering = isRendering;
        } catch (e) {}
        scheduleNextMonitorTick();
    };

    // ---------------------------------------------------------------
    // UI HELPERS — native controls only, so everything is guaranteed
    // to actually draw. Color styling is applied where ScriptUI allows
    // it (mostly text and panel backgrounds); button chrome stays
    // native rather than custom-drawn.
    // ---------------------------------------------------------------
    function styledText(parent, label, size, weight, color, multiline) {
        var t = parent.add("statictext", undefined, label, multiline ? { multiline: true } : undefined);
        try {
            t.graphics.font = ScriptUI.newFont(FONT, weight, size);
            t.graphics.foregroundColor = t.graphics.newPen(t.graphics.PenType.SOLID_COLOR, color, 1);
        } catch (e) {}
        return t;
    }

    function nativeButton(parent, label, onClick) {
        var b = parent.add("button", undefined, label);
        b.alignment = ["fill", "top"];
        try { b.graphics.font = ScriptUI.newFont(FONT, "BOLD", 14); } catch (e) {}
        b.onClick = onClick;
        return b;
    }

    function card(parent) {
        var c = parent.add("group");
        c.orientation = "column";
        c.alignChildren = ["fill", "top"];
        c.spacing = 10;
        c.margins = 14;
        try {
            c.graphics.backgroundColor = c.graphics.newBrush(c.graphics.BrushType.SOLID_COLOR, BRAND.card);
        } catch (e) {}
        return c;
    }

    // ---------------------------------------------------------------
    // MONITOR UI STATE
    // ---------------------------------------------------------------
    var cpuValueText = null, cpuBarText = null;
    var ramValueText = null, ramSubText = null, ramBarText = null;
    var tempValueText = null, gpuValueText = null, explanationText = null;
    var backupAgoText = null;

    function updateMonitorUI(temp, gpuTemp) {
        try {
            var stats = readCoreStats();
            var cpu = stats.cpu, ram = stats.ram;

            if (cpuValueText) {
                cpuValueText.text = (cpu === null) ? "—" : (cpu + "%");
                try {
                    var cpuColor = (cpu !== null && cpu >= 85) ? BRAND.warn : BRAND.text;
                    cpuValueText.graphics.foregroundColor = cpuValueText.graphics.newPen(cpuValueText.graphics.PenType.SOLID_COLOR, cpuColor, 1);
                } catch (e) {}
            }
            if (cpuBarText) {
                cpuBarText.text = textBar(cpu);
                try {
                    var cbColor = (cpu !== null && cpu >= 85) ? BRAND.warn : BRAND.muted;
                    cpuBarText.graphics.foregroundColor = cpuBarText.graphics.newPen(cpuBarText.graphics.PenType.SOLID_COLOR, cbColor, 1);
                } catch (e) {}
            }

            if (ramValueText) {
                ramValueText.text = (ram === null) ? "—" : (ram.percent + "%");
                try {
                    var ramColor = (ram !== null && ram.percent >= 85) ? BRAND.warn : BRAND.text;
                    ramValueText.graphics.foregroundColor = ramValueText.graphics.newPen(ramValueText.graphics.PenType.SOLID_COLOR, ramColor, 1);
                } catch (e) {}
            }
            if (ramBarText) {
                ramBarText.text = textBar(ram === null ? null : ram.percent);
                try {
                    var rbColor = (ram !== null && ram.percent >= 85) ? BRAND.warn : BRAND.muted;
                    ramBarText.graphics.foregroundColor = ramBarText.graphics.newPen(ramBarText.graphics.PenType.SOLID_COLOR, rbColor, 1);
                } catch (e) {}
            }
            if (ramSubText) ramSubText.text = (ram === null) ? "" : (ram.usedGB.toFixed(1) + " / " + ram.totalGB.toFixed(1) + " GB");

            if (tempValueText) tempValueText.text = (temp === null) ? "Not available on this system" : (temp + "°C");
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

            if (backupAgoText) {
                var rel = relativeTime(lastBackupDate);
                backupAgoText.text = rel ? ("Last backup: " + rel) : "No backup yet this session";
            }
        } catch (e) {}
    }

    // ---------------------------------------------------------------
    // HISTORY VIEWER
    // ---------------------------------------------------------------
    function showHistoryWindow() {
        var w = new Window("palette", "Crash Guard — History", undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "fill"];
        w.spacing = 10;
        w.margins = 16;
        w.preferredSize = [440, 380];
        try { w.graphics.backgroundColor = w.graphics.newBrush(w.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        styledText(w, "BACKUP & ISSUE HISTORY", 14, "BOLD", BRAND.muted);

        var box = w.add("edittext", undefined, readHistoryTail(300), { multiline: true, readonly: true, scrollable: true });
        box.alignment = ["fill", "fill"];
        try {
            box.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13);
            box.graphics.foregroundColor = box.graphics.newPen(box.graphics.PenType.SOLID_COLOR, BRAND.text, 1);
            box.graphics.backgroundColor = box.graphics.newBrush(box.graphics.BrushType.SOLID_COLOR, BRAND.card);
        } catch (e) {}

        nativeButton(w, "Close", function () { w.close(); });

        w.center();
        w.show();
    }

    // ---------------------------------------------------------------
    // UI
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
            styledText(win, "Crash Guard couldn't start", 16, "BOLD", BRAND.warn);
            var msg = styledText(win, String(err), 13, "REGULAR", BRAND.text, true);
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
        win.spacing = 10;
        win.margins = 18;
        win.preferredSize.width = 390;

        try { win.graphics.backgroundColor = win.graphics.newBrush(win.graphics.BrushType.SOLID_COLOR, BRAND.bg); } catch (e) {}

        // ---- Header — a small accent-color mark + bold text wordmark.
        // No raster image: a bitmap logo baked at one fixed pixel size
        // looks soft/blurry once ScriptUI scales the panel on a high-DPI
        // display, while text stays crisp at any size — and it matches
        // kreevo.github.io, which itself uses a text wordmark, not an icon. ----
        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["left", "center"];
        header.spacing = 10;

        var mark = header.add("group");
        mark.minimumSize.width = mark.maximumSize.width = 10;
        mark.minimumSize.height = mark.maximumSize.height = 10;
        try { mark.graphics.backgroundColor = mark.graphics.newBrush(mark.graphics.BrushType.SOLID_COLOR, BRAND.accent); } catch (e) {}

        styledText(header, "CRASH GUARD", 20, "BOLD", BRAND.text);
        var spacer = header.add("group");
        spacer.alignment = ["fill", "fill"];
        styledText(header, "by Kreevo", 12, "BOLD", BRAND.accent);

        if (possibleCrashDetected) {
            var crashLines = ["⚠ Last session didn't close cleanly — possible crash or freeze."];
            if (lastKnownStateAtStartup) {
                crashLines.push("Last working on: " + (lastKnownStateAtStartup.PROJECT || "—") +
                    (lastKnownStateAtStartup.COMP && lastKnownStateAtStartup.COMP !== "—" ? " — \"" + lastKnownStateAtStartup.COMP + "\"" : "") +
                    (lastKnownStateAtStartup.TIME ? " (" + lastKnownStateAtStartup.TIME + ")" : ""));
            }
            crashLines.push("See BACKUP tab to restore.");
            var crashBanner = styledText(win, crashLines.join("\n"), 13, "REGULAR", BRAND.warn, true);
            crashBanner.alignment = ["fill", "top"];
            crashBanner.minimumSize.height = lastKnownStateAtStartup ? 58 : 38;
        }

        // ---- Native tabbed panel: guaranteed to render and switch,
        // unlike a hand-drawn tab bar. ----
        var tabs = win.add("tabbedpanel");
        tabs.alignChildren = ["fill", "top"];
        tabs.alignment = ["fill", "fill"];

        var monitorTab = tabs.add("tab", undefined, "Monitor");
        monitorTab.orientation = "column";
        monitorTab.alignChildren = ["fill", "top"];
        monitorTab.spacing = 10;
        monitorTab.margins = 12;

        var backupTab = tabs.add("tab", undefined, "Backup");
        backupTab.orientation = "column";
        backupTab.alignChildren = ["fill", "top"];
        backupTab.spacing = 10;
        backupTab.margins = 12;

        var cleanerTab = tabs.add("tab", undefined, "Cleaner");
        cleanerTab.orientation = "column";
        cleanerTab.alignChildren = ["fill", "top"];
        cleanerTab.spacing = 10;
        cleanerTab.margins = 12;

        tabs.selection = monitorTab;

        // ================= MONITOR TAB =================
        var loadCard = card(monitorTab);
        styledText(loadCard, "WHY AE MIGHT BE LAGGING", 13, "BOLD", BRAND.muted);

        var statsRow = loadCard.add("group");
        statsRow.orientation = "row";
        statsRow.alignChildren = ["fill", "top"];
        statsRow.spacing = 16;

        var cpuCol = statsRow.add("group");
        cpuCol.orientation = "column";
        cpuCol.alignChildren = ["fill", "top"];
        cpuCol.alignment = ["fill", "top"];
        cpuCol.spacing = 3;
        styledText(cpuCol, "CPU", 12, "BOLD", BRAND.muted);
        cpuValueText = styledText(cpuCol, "—", 34, "BOLD", BRAND.text);
        cpuBarText = styledText(cpuCol, textBar(null), 14, "REGULAR", BRAND.muted);

        var ramCol = statsRow.add("group");
        ramCol.orientation = "column";
        ramCol.alignChildren = ["fill", "top"];
        ramCol.alignment = ["fill", "top"];
        ramCol.spacing = 3;
        styledText(ramCol, "RAM", 12, "BOLD", BRAND.muted);
        ramValueText = styledText(ramCol, "—", 34, "BOLD", BRAND.text);
        ramBarText = styledText(ramCol, textBar(null), 14, "REGULAR", BRAND.muted);
        ramSubText = styledText(ramCol, "", 12, "REGULAR", BRAND.muted);

        var tempRow = loadCard.add("group");
        tempRow.orientation = "row";
        tempRow.alignChildren = ["fill", "top"];
        tempRow.spacing = 16;

        var tempCol = tempRow.add("group");
        tempCol.orientation = "column";
        tempCol.alignChildren = ["left", "top"];
        tempCol.alignment = ["fill", "top"];
        styledText(tempCol, "CPU TEMP", 12, "BOLD", BRAND.muted);
        tempValueText = styledText(tempCol, "Tap \"Refresh temperatures\" below", 13, "ITALIC", BRAND.muted, true);
        tempValueText.alignment = ["fill", "top"];
        tempValueText.minimumSize.height = 32;

        var gpuCol = tempRow.add("group");
        gpuCol.orientation = "column";
        gpuCol.alignChildren = ["left", "top"];
        gpuCol.alignment = ["fill", "top"];
        styledText(gpuCol, "GPU TEMP", 12, "BOLD", BRAND.muted);
        gpuValueText = styledText(gpuCol, "Tap \"Refresh temperatures\" below", 13, "ITALIC", BRAND.muted, true);
        gpuValueText.alignment = ["fill", "top"];
        gpuValueText.minimumSize.height = 32;

        explanationText = loadCard.add("statictext", undefined, "", { multiline: true });
        explanationText.alignment = ["fill", "top"];
        explanationText.minimumSize.height = 46;
        try {
            explanationText.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 13);
            explanationText.graphics.foregroundColor = explanationText.graphics.newPen(explanationText.graphics.PenType.SOLID_COLOR, BRAND.warn, 1);
        } catch (e) {}

        nativeButton(monitorTab, "Check before I render", function () { checkRenderReadiness(true); });
        nativeButton(monitorTab, "Refresh temperatures", function () {
            lastTemp = IS_WIN ? getWindowsTemp() : null;
            lastGpuTemp = getGPUTemp();
            updateMonitorUI(lastTemp, lastGpuTemp);
        });

        // ================= BACKUP TAB =================
        var autoCard = card(backupTab);
        styledText(autoCard, "AUTO-BACKUP", 13, "BOLD", BRAND.muted);
        var backupExplain = styledText(autoCard,
            "Saves a timestamped copy into \"Kreevo_Backups\" next to your project — restore any version below if AE crashes or you lose work.",
            12, "REGULAR", BRAND.muted, true);
        backupExplain.alignment = ["fill", "top"];
        backupExplain.minimumSize.height = 34;

        var enableRow = autoCard.add("group");
        enableRow.orientation = "row";
        enableRow.alignChildren = ["left", "center"];
        var enableCheck = enableRow.add("checkbox", undefined, "  Enabled — protecting your work");
        enableCheck.value = settings.enabled;
        try { enableCheck.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}

        var intervalRow = autoCard.add("group");
        intervalRow.orientation = "row";
        intervalRow.alignChildren = ["left", "center"];
        intervalRow.spacing = 8;
        styledText(intervalRow, "Every", 14, "REGULAR", BRAND.muted);
        var intervalInput = intervalRow.add("edittext", undefined, String(settings.intervalMinutes));
        intervalInput.characters = 4;
        try { intervalInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}
        styledText(intervalRow, "min", 14, "REGULAR", BRAND.muted);
        styledText(intervalRow, "   Keep last", 14, "REGULAR", BRAND.muted);
        var maxBackupsInput = intervalRow.add("edittext", undefined, String(settings.maxBackups));
        maxBackupsInput.characters = 4;
        try { maxBackupsInput.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}

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

        var actions = backupTab.add("group");
        actions.orientation = "column";
        actions.alignChildren = ["fill", "top"];
        actions.spacing = 6;

        nativeButton(actions, "Back up now", function () { runBackup(false); });
        nativeButton(actions, "Run health check", runHealthCheck);
        nativeButton(actions, "View history log", showHistoryWindow);

        var restoreCard = card(backupTab);
        styledText(restoreCard, "RECENT BACKUPS", 13, "BOLD", BRAND.muted);
        var restoreExplain = styledText(restoreCard, "Pick a version and restore it if something goes wrong.", 12, "REGULAR", BRAND.muted, true);
        restoreExplain.alignment = ["fill", "top"];
        restoreExplain.minimumSize.height = 17;

        var backupDropdown = restoreCard.add("dropdownlist", undefined, []);
        backupDropdown.alignment = ["fill", "top"];
        try { backupDropdown.graphics.font = ScriptUI.newFont(FONT, "REGULAR", 14); } catch (e) {}

        // Shown only when the list comes back empty, so an empty dropdown
        // never looks like it silently failed — it always says why.
        var restoreStatusText = styledText(restoreCard, "", 12, "ITALIC", BRAND.muted, true);
        restoreStatusText.alignment = ["fill", "top"];
        restoreStatusText.minimumSize.height = 0;

        function refreshBackupList() {
            backupDropdown.removeAll();
            var files = listBackups();
            for (var i = 0; i < files.length; i++) backupDropdown.add("item", files[i].name);
            backupDropdown._files = files;
            if (files.length > 0) {
                backupDropdown.selection = 0;
                if (!lastBackupDate) lastBackupDate = files[0].created;
                restoreStatusText.text = "";
                restoreStatusText.minimumSize.height = 0;
            } else if (!app.project) {
                restoreStatusText.text = "No project is open.";
                restoreStatusText.minimumSize.height = 17;
            } else if (!app.project.file) {
                restoreStatusText.text = "This project isn't saved yet — use File > Save As first, so Crash Guard knows where to keep backups.";
                restoreStatusText.minimumSize.height = 32;
            } else {
                restoreStatusText.text = "No backups found yet in \"Kreevo_Backups\" next to this project.";
                restoreStatusText.minimumSize.height = 17;
            }
        }
        refreshBackupList();

        var restoreActions = restoreCard.add("group");
        restoreActions.orientation = "column";
        restoreActions.alignChildren = ["fill", "top"];
        restoreActions.spacing = 6;

        nativeButton(restoreActions, "Restore selected", function () {
            var idx = backupDropdown.selection ? backupDropdown.selection.index : -1;
            if (idx < 0 || !backupDropdown._files || !backupDropdown._files[idx]) {
                alert("Select a backup from the list first.");
                return;
            }
            restoreBackup(backupDropdown._files[idx]);
        });
        nativeButton(restoreActions, "Refresh list", refreshBackupList);

        // ================= CLEANER TAB =================
        var cleanCard = card(cleanerTab);
        styledText(cleanCard, "PROJECT CLEANER", 13, "BOLD", BRAND.muted);
        var cleanExplain = styledText(cleanCard,
            "Housekeeping that keeps every project running smoothly — do this every so often, not just when something breaks.",
            12, "REGULAR", BRAND.muted, true);
        cleanExplain.alignment = ["fill", "top"];
        cleanExplain.minimumSize.height = 32;

        nativeButton(cleanCard, "Remove unused footage", cleanerRemoveUnused);
        var removeExplain = styledText(cleanCard, "Deletes project items nothing in your comps actually uses.", 12, "REGULAR", BRAND.muted, true);
        removeExplain.alignment = ["fill", "top"];
        removeExplain.minimumSize.height = 17;

        nativeButton(cleanCard, "Consolidate duplicate footage", cleanerConsolidate);
        var consolidateExplain = styledText(cleanCard, "Merges footage imported more than once into a single item.", 12, "REGULAR", BRAND.muted, true);
        consolidateExplain.alignment = ["fill", "top"];
        consolidateExplain.minimumSize.height = 17;

        nativeButton(cleanCard, "Purge memory and disk caches", cleanerPurge);
        var purgeExplain = styledText(cleanCard, "Frees up RAM immediately — use this when the Monitor tab shows RAM running high.", 12, "REGULAR", BRAND.muted, true);
        purgeExplain.alignment = ["fill", "top"];
        purgeExplain.minimumSize.height = 32;

        // ---- wire up ----
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () { this.layout.resize(); };

        win.onClose = function () {
            if (monitorTaskId !== null) { try { app.cancelTask(monitorTaskId); } catch (e) {} }
            if (backupTaskId !== null) { try { app.cancelTask(backupTaskId); } catch (e) {} }
            clearSessionMarker();
        };

        if (settings.enabled) scheduleNextBackup();
        recordLastKnownState();
        // Temperature is not fetched automatically on open — only when the
        // user taps "Refresh temperatures" — since that query can be slow
        // on some systems and shouldn't be part of the panel's startup cost.
        updateMonitorUI(lastTemp, lastGpuTemp);
        scheduleNextMonitorTick();

        return win;
    }

    var panel = buildUI(thisObj);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
