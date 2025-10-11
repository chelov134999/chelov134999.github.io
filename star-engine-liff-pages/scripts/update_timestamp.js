#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const releasesRoot = path.join(root, 'releases');

const KEEP_RELEASE_COUNT = (() => {
  const raw = process.env.KEEP_RELEASE_COUNT || process.env.RELEASE_KEEP_COUNT || '2';
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 2;
})();

const rawInput = process.argv[2];
const nowIso = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
const defaultTs = nowIso.replace(/[-:]/g, '');
const timestamp = rawInput || defaultTs;

if (!/^20\d{6}T\d{4}$/.test(timestamp)) {
  console.error(`[update_timestamp] 無效的格式：${timestamp}，應為 YYYYMMDDTHHMM`);
  process.exit(1);
}

const releaseDir = path.join(releasesRoot, timestamp);

if (!fs.existsSync(releasesRoot)) {
  fs.mkdirSync(releasesRoot, { recursive: true });
}

const filesToUpdate = [
  'config.js',
  'config.runtime.js',
  'index.html',
  'about.html',
  'plans.html',
  'report.html',
  'sample-report.html',
];

const copyPairs = [
  ['index.html', path.join('releases', timestamp, 'index.html')],
  ['about.html', path.join('releases', timestamp, 'about.html')],
  ['plans.html', path.join('releases', timestamp, 'plans.html')],
  ['sample-report.html', path.join('releases', timestamp, 'sample-report.html')],
  ['report.html', path.join('releases', timestamp, 'report.html')],
  ['config.js', path.join('releases', timestamp, 'config.js')],
  ['config.runtime.js', path.join('releases', timestamp, 'config.runtime.js')],
  ['analytics.js', path.join('releases', timestamp, 'analytics.js')],
  ['app.js', path.join('releases', timestamp, 'app.js')],
  ['cognos-avatar.svg', path.join('releases', timestamp, 'cognos-avatar.svg')],
  ['logo.png', path.join('releases', timestamp, 'logo.png')],
  ['report.js', path.join('releases', timestamp, 'report.js')],
  ['report-utils.js', path.join('releases', timestamp, 'report-utils.js')],
  ['styles.css', path.join('releases', timestamp, 'styles.css')],
];

const pattern = /ts=20\d{6}T\d{4}/g;
const releasePathPattern = /releases\/20\d{6}T\d{4}/g;
let updatedCount = 0;

filesToUpdate.forEach((relativePath) => {
  const targetPath = path.join(root, relativePath);
  if (!fs.existsSync(targetPath)) {
    console.warn(`[update_timestamp] 找不到檔案：${relativePath}`);
    return;
  }

  const original = fs.readFileSync(targetPath, 'utf8');
  const replaced = original
    .replace(pattern, `ts=${timestamp}`)
    .replace(releasePathPattern, `releases/${timestamp}`);
  if (replaced !== original) {
    fs.writeFileSync(targetPath, replaced);
    updatedCount += 1;
  }
});

copyPairs.forEach(([source, dest]) => {
  const srcPath = path.join(root, source);
  const destPath = path.join(root, dest);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[update_timestamp] 找不到來源檔案：${source}`);
    return;
  }
  const destDir = path.dirname(destPath);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, destPath);
});

const replaceInFile = (filePath, replacements) => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let mutated = content;
  replacements.forEach(([pattern, value]) => {
    mutated = mutated.replace(pattern, value);
  });
  if (mutated !== content) {
    fs.writeFileSync(filePath, mutated);
    return true;
  }
  return false;
};

const releaseConfigTargets = [
  path.join(releaseDir, 'config.js'),
  path.join(releaseDir, 'config.runtime.js'),
];

releaseConfigTargets.forEach((target) => {
  replaceInFile(target, [[/releases\/latest/g, `releases/${timestamp}`]]);
});

const latestDir = path.join(releasesRoot, 'latest');
try {
  fs.rmSync(latestDir, { recursive: true, force: true });
  fs.cpSync(releaseDir, latestDir, { recursive: true });
  console.log('[update_timestamp] 已更新 latest 快照。');
} catch (error) {
  console.warn(`[update_timestamp] 更新 latest 快照時發生錯誤：${error.message || error}`);
}

const latestConfigTargets = [
  path.join(latestDir, 'config.js'),
  path.join(latestDir, 'config.runtime.js'),
];

latestConfigTargets.forEach((target) => {
  replaceInFile(target, [[/releases\/20\d{6}T\d{4}/g, 'releases/latest']]);
});

const releaseDirs = fs
  .readdirSync(releasesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^20\d{6}T\d{4}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => (a > b ? -1 : 1));

releaseDirs.slice(KEEP_RELEASE_COUNT).forEach((dir) => {
  const target = path.join(releasesRoot, dir);
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`[update_timestamp] 移除舊 release 目錄 ${dir}`);
});

const latestFile = path.join(releasesRoot, 'latest.txt');
fs.writeFileSync(latestFile, `${timestamp}\n`, 'utf8');

console.log(
  `[update_timestamp] 已設定 ts=${timestamp}，更新 ${updatedCount} 份檔案並同步 release 目錄 ${path.relative(root, releaseDir)}。`,
);
