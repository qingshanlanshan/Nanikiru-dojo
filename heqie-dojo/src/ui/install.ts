import { h } from './dom';
import { getStats } from './stats';
import { load, save } from './storage';

// "Add to home screen" tip. Shown once the player has answered a few problems, only on
// phones, only in browsers that can install (not WeChat's in-app browser), and never again
// after being dismissed or installed.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const MIN_ANSWERS = 5;
const ua = navigator.userAgent;
const isAndroid = /Android/i.test(ua);
// iPadOS reports itself as a Mac; a touch-capable "Mac" is an iPad.
const isIOS = !isAndroid && (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const isInApp = /MicroMessenger|QQ\/|Weibo|DingTalk|XiaoHongShu|discover/i.test(ua);

let deferred: InstallPromptEvent | null = null;
let shown = false;

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function answersSoFar(): number {
  const s = getStats();
  return Object.values(s.levels).reduce((n, l) => n + l.n, 0) + Object.keys(s.daily).length;
}

function showTip() {
  shown = true;
  const bar = h('div', { class: 'install-tip', role: 'dialog', 'aria-label': '添加到主屏幕' });
  const dismiss = () => {
    save('installTip', 'dismissed');
    bar.remove();
  };
  const how = isIOS
    ? h('span', {}, '点 Safari 底部的 分享 按钮，选「添加到主屏幕」')
    : deferred
      ? null
      : h('span', {}, '在浏览器菜单里选「添加到主屏幕」或「安装应用」');
  const parts: (HTMLElement | null)[] = [
    h('img', { src: '/icons/icon-192.png', alt: '', class: 'install-icon' }),
    h('div', { class: 'install-text' }, h('b', {}, '装到桌面，离线也能练'), how),
    deferred
      ? h('button', {
          class: 'btn btn-primary install-btn',
          onclick: async () => {
            const e = deferred!;
            deferred = null;
            await e.prompt();
            await e.userChoice.catch(() => null);
            dismiss();
          },
        }, '安装')
      : null,
    h('button', { class: 'install-close', 'aria-label': '关闭', onclick: dismiss }, '×'),
  ];
  bar.append(...parts.filter((n): n is HTMLElement => n !== null));
  document.body.append(bar);
}

function maybeShow() {
  if (shown || isStandalone() || isInApp || !(isIOS || isAndroid)) return;
  if (load<string>('installTip', '') === 'dismissed' || answersSoFar() < MIN_ANSWERS) return;
  showTip();
}

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own tip at a better moment
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => save('installTip', 'dismissed'));
  document.addEventListener('heqie:answered', () => setTimeout(maybeShow, 1200));

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
