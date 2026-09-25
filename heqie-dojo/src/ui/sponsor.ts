import { h } from './dom';

// Optional tips. Add QR images under public/sponsor/ and list them here; with nothing
// configured, no sponsor UI is shown anywhere.

interface SponsorQr {
  label: string;
  /** App that scans this code, used in the hint. */
  app: '微信' | '支付宝';
  /** Path under public/, e.g. '/sponsor/wechat.png'. */
  src: string;
}

const QRS: SponsorQr[] = [
  { label: '微信赞赏', app: '微信', src: '/sponsor/wechat.png' },
  // { label: '支付宝', app: '支付宝', src: '/sponsor/alipay.png' },
];

/** International tips (card / PayPal), e.g. { label: 'Ko-fi（银行卡 / PayPal）', href: 'https://ko-fi.com/xxx' } */
const LINK: { label: string; href: string } | null = { label: 'Ko-fi（银行卡 / PayPal）', href: 'https://ko-fi.com/qingshanlanshan' };

export const sponsorEnabled = QRS.length > 0 || LINK !== null;

const inWeChat = /MicroMessenger/i.test(navigator.userAgent);

// A code shown on the phone you'd scan with can't be scanned directly: long-press works
// inside WeChat for WeChat codes, otherwise screenshot and pick it from the album.
const hintFor = (q: SponsorQr) =>
  inWeChat && q.app === '微信' ? '长按二维码识别' : `截图后，在${q.app}「扫一扫」里从相册选取`;

export function openSponsor() {
  const overlay = h('div', { class: 'sheet-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '赞助' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => e.target === overlay && close());

  const img = h('img', { class: 'sponsor-qr', alt: '' });
  const hint = h('p', { class: 'muted small center' });
  const tabs = h('div', { class: 'levels sponsor-tabs', role: 'tablist' });
  const select = (i: number) => {
    img.src = QRS[i].src;
    img.alt = `${QRS[i].label}二维码`;
    hint.textContent = hintFor(QRS[i]);
    tabs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
  };
  if (QRS.length > 1) {
    QRS.forEach((q, i) => tabs.append(h('button', { class: 'level', role: 'tab', onclick: () => select(i) }, q.label)));
  }

  overlay.append(
    h(
      'div',
      { class: 'sheet sponsor-sheet' },
      h('h3', {}, '请作者喝杯奶茶'),
      h('p', { class: 'muted small center' }, '何切道场免费、无广告、不收集数据。如果它帮到了你，欢迎随意赞助，金额随心。'),
      h('p', { class: 'muted small center' }, '意见反馈永远免费，请用页面底部的「意见反馈」。'),
      QRS.length > 1 ? tabs : null,
      QRS.length ? img : null,
      QRS.length ? hint : null,
      h(
        'div',
        { class: 'actions' },
        LINK ? h('a', { class: 'btn btn-primary', href: LINK.href, target: '_blank', rel: 'noopener' }, LINK.label) : null,
        h('button', { class: 'btn', onclick: close }, '关闭'),
      ),
    ),
  );
  if (QRS.length) select(0);
  document.body.append(overlay);
}
