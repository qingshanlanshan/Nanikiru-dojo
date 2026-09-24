import { h } from './dom';

// Optional tips. Add QR images under public/sponsor/ and list them here; with nothing
// configured, no sponsor UI is shown anywhere.

interface SponsorQr {
  label: string;
  /** Path under public/, e.g. '/sponsor/wechat.png'. */
  src: string;
}

const QRS: SponsorQr[] = [
  // { label: '微信赞赏', src: '/sponsor/wechat.png' },
  // { label: '支付宝', src: '/sponsor/alipay.png' },
];

/** e.g. { label: '去爱发电赞助', href: 'https://afdian.com/a/xxx' } */
const LINK: { label: string; href: string } | null = null;

export const sponsorEnabled = QRS.length > 0 || LINK !== null;

const inWeChat = /MicroMessenger/i.test(navigator.userAgent);

export function openSponsor() {
  const overlay = h('div', { class: 'sheet-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '赞助' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => e.target === overlay && close());

  const img = h('img', { class: 'sponsor-qr', alt: '' });
  const tabs = h('div', { class: 'levels sponsor-tabs', role: 'tablist' });
  const select = (i: number) => {
    img.src = QRS[i].src;
    img.alt = `${QRS[i].label}二维码`;
    tabs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
  };
  if (QRS.length > 1) {
    QRS.forEach((q, i) => tabs.append(h('button', { class: 'level', role: 'tab', onclick: () => select(i) }, q.label)));
  }

  const hint = inWeChat ? '长按二维码识别' : '截图后，在微信/支付宝「扫一扫」里从相册选取';
  overlay.append(
    h(
      'div',
      { class: 'sheet sponsor-sheet' },
      h('h3', {}, '请作者喝杯奶茶'),
      h('p', { class: 'muted small center' }, '何切道场免费、无广告、不收集数据。如果它帮到了你，欢迎随意赞助，金额随心。'),
      QRS.length > 1 ? tabs : null,
      QRS.length ? img : null,
      QRS.length ? h('p', { class: 'muted small center' }, hint) : null,
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
